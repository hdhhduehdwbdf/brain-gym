/* ===== 脑力健身房 · 前端同步层 =====
 * 在 BT（app.js）之上透明接入后端：
 *  - 所有写入先落本地（离线可用、界面零改动），再异步推给服务器
 *  - 页面加载时从服务器拉取状态合并，并做一次性旧数据迁移
 *  - 服务器不可达时静默降级为纯本地模式
 * 用法：在 app.js 之后、页面脚本之前引入：
 *   <script src="../assets/app.js"></script>
 *   <script src="../assets/sync.js"></script>
 */
(function(){
  if (!window.BT) return;

  var API = window.BT_API || '';   // 同源为空串；跨域部署时由 assets/config.js 指定后端地址
  var OUTBOX = 'bt:outbox';
  var MIGRATED = 'bt:migrated';
  var online = false;

  /* ---- 基础 ---- */
  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r){
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }
  function getState() {
    return fetch(API + '/api/state').then(function(r){
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  /* ---- 发件箱：保证最终送达 ---- */
  function queue(task) {
    var box = BT.get('outbox', []);
    box.push(task);
    if (box.length > 300) box = box.slice(-300);
    BT.set('outbox', box);
  }
  function flush() {
    var box = BT.get('outbox', []);
    if (!box.length) return Promise.resolve();
    var chain = Promise.resolve();
    var remain = box.slice();
    box.forEach(function(task){
      chain = chain.then(function(){
        return post(task.path, task.body).then(function(){
          remain.shift();
        }).catch(function(){ /* 保持在队列里，下次再试 */ });
      });
    });
    return chain.then(function(){
      BT.set('outbox', remain);
    });
  }

  /* ---- 拦截 BT.log / BT.set：写本地 + 入队 ---- */
  var _log = BT.log;
  BT.log = function(testId, extra){
    var r = _log.apply(null, arguments);
    queue({ path: '/api/activity', body: { testId: testId, extra: extra || {} }, ts: Date.now() });
    scheduleFlush();
    return r;
  };

  /* 成绩类写入：页面直接调用 BT.reportScore(kind, payload) */
  BT.reportScore = function(kind, payload){
    payload = payload || {};
    payload.date = BT.todayKey();
    queue({ path: '/api/scores/' + kind, body: payload, ts: Date.now() });
    scheduleFlush();
  };

  var flushTimer = null;
  function scheduleFlush(){
    if (flushTimer) return;
    flushTimer = setTimeout(function(){
      flushTimer = null;
      if (!online) return;
      flush().catch(function(){});
    }, 800);
  }

  /* ---- 启动：探测后端 → 迁移旧数据 → 拉取合并 ---- */
  function mergeFromServer(state){
    // 活动流水：按 ts 去重合并
    var local = BT.get('activity', []);
    var byTs = {};
    local.forEach(function(a){ byTs[a.ts] = a; });
    (state.activity || []).forEach(function(a){ if (!byTs[a.ts]) byTs[a.ts] = a; });
    var merged = Object.keys(byTs).map(function(k){ return byTs[k]; }).sort(function(a,b){ return a.ts - b.ts; });
    BT.set('activity', merged.slice(-1000));

    // 成绩：逐类合并（取更优值）
    var s = state.scores || {};

    // schulte（毫秒→秒已由服务器统一；本地旧格式为毫秒）
    if (s.schulte) {
      var localSch = {};
      try { localSch = JSON.parse(localStorage.getItem('bt:schulte')) || {}; } catch(e){}
      Object.keys(s.schulte).forEach(function(d){
        var srv = s.schulte[d], loc = localSch[d];
        if (!loc) { localSch[d] = { asc: srv.asc, desc: srv.desc, color: srv.color, count: srv.count }; return; }
        ['asc','desc','color'].forEach(function(m){
          if (srv[m] != null && (loc[m] == null || srv[m] < loc[m])) loc[m] = srv[m];
        });
        loc.count = Math.max(loc.count || 0, srv.count || 0);
        localSch[d] = loc;
      });
      BT.set('schulte', localSch);
    }

    // digit
    if (Array.isArray(s.digit)) {
      var localDigit = BT.get('digit', []);
      var dMap = {};
      localDigit.forEach(function(r){ dMap[r.date] = r.maxLen; });
      s.digit.forEach(function(r){ dMap[r.date] = Math.max(dMap[r.date] || 0, r.maxLen); });
      BT.set('digit', Object.keys(dMap).sort().map(function(d){ return { date: d, maxLen: dMap[d] }; }));
    }

    // 追加型成绩：服务器有但本地没有的，回填到本地 log
    ['breathing','palace','pressure','gonogo','stroop','srt',
     'corsi','tmt','nback','rotation','sdmt','drm','delay'].forEach(function(kind){
      if (!Array.isArray(s[kind])) return;
      var container = BT.get(kind, { log: [] });
      var localArr = container.log || [];
      var seen = {};
      localArr.forEach(function(r){ if (r.ts) seen[r.ts] = 1; });
      s[kind].forEach(function(r){ if (!r.ts || !seen[r.ts]) localArr.push(r); });
      localArr.sort(function(a, b){ return (a.ts || 0) - (b.ts || 0); });
      container.log = localArr;
      BT.set(kind, container);
    });
  }

  function migrateOldLocal(){
    if (localStorage.getItem(MIGRATED)) return Promise.resolve();
    var activity = BT.get('activity', []);
    var scores = {
      schulte: [], digit: [], breathing: [], palace: [], pressure: []
    };
    // 旧 schulte 数据（毫秒）转秒
    var sch = {};
    try { sch = JSON.parse(localStorage.getItem('bt:schulte')) || {}; } catch(e){}
    Object.keys(sch).forEach(function(d){
      var r = sch[d];
      ['asc','desc','color'].forEach(function(m){
        if (r[m] != null) scores.schulte.push({ date: d, mode: m, sec: r[m] / 1000 });
      });
    });
    (BT.get('digit', [])).forEach(function(r){ scores.digit.push(r); });
    (BT.get('breathing', { log: [] }).log || []).forEach(function(r){ scores.breathing.push(r); });
    (BT.get('palace', { log: [] }).log || []).forEach(function(r){
      scores.palace.push({ date: r.date, correct: r.correct, total: r.total, pct: r.pct });
    });
    (BT.get('pressure', { log: [] }).log || []).forEach(function(r){ scores.pressure.push(r); });

    localStorage.setItem(MIGRATED, '1');
    return post('/api/migrate', { activity: activity, scores: scores }).catch(function(){ /* 离线就跳过 */ });
  }

  function boot(){
    getState().then(function(state){
      online = true;
      document.documentElement.dataset.sync = 'on';
      return migrateOldLocal().then(function(){ return getState(); });
    }).then(function(state){
      if (state) mergeFromServer(state);
      return flush();
    }).then(function(){
      // 合并/补发完成后再通知页面刷新汇总，避免读到旧数据
      document.dispatchEvent(new CustomEvent('bt:synced'));
    }).catch(function(){
      online = false;
      document.documentElement.dataset.sync = 'off';
      document.dispatchEvent(new CustomEvent('bt:synced'));
    });
  }

  window.addEventListener('online', function(){ boot(); });
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) { /* 回到页面时补发 */ if (online) flush().catch(function(){}); }
  });

  // 暴露状态给调试/状态指示
  BT.syncStatus = function(){ return online ? 'on' : 'off'; };

  boot();
})();
