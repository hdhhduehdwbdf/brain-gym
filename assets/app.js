/* ===== 脑力健身房 · 公共脚本 ===== */
window.BT = (function(){
  var PREFIX = 'bt:';

  function todayKey(d){
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function get(key, fallback){
    try{
      var v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    }catch(e){ return fallback; }
  }
  function set(key, val){ localStorage.setItem(PREFIX + key, JSON.stringify(val)); }

  /* ---- 活动流水：驱动打卡 / 总览 ---- */
  function log(testId, extra){
    var arr = get('activity', []);
    arr.push({ date: todayKey(), ts: Date.now(), testId: testId, extra: extra || {} });
    if(arr.length > 1000) arr = arr.slice(-1000);
    set('activity', arr);
  }

  function uniqueDates(){
    var arr = get('activity', []), s = {};
    arr.forEach(function(a){ s[a.date] = 1; });
    return Object.keys(s).sort();
  }

  function streak(){
    var ds = uniqueDates();
    if(ds.length === 0) return 0;
    var setOf = {};
    ds.forEach(function(d){ setOf[d] = 1; });
    var cursor = new Date();
    if(!setOf[todayKey(cursor)]){
      cursor.setDate(cursor.getDate() - 1);
      if(!setOf[todayKey(cursor)]) return 0;
    }
    var n = 0;
    while(setOf[todayKey(cursor)]){
      n++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }

  function daysTrained(){ return uniqueDates().length; }

  function todayCount(testId){
    var t = todayKey();
    return get('activity', []).filter(function(a){
      return a.date === t && (!testId || a.testId === testId);
    }).length;
  }

  function totalCount(testId){
    return get('activity', []).filter(function(a){ return !testId || a.testId === testId; }).length;
  }

  function heat(n){
    var out = [], setOf = {};
    get('activity', []).forEach(function(a){ setOf[a.date] = (setOf[a.date] || 0) + 1; });
    for(var i = n - 1; i >= 0; i--){
      var d = new Date(); d.setDate(d.getDate() - i);
      var k = todayKey(d);
      out.push({ date: k, count: setOf[k] || 0 });
    }
    return out;
  }

  /* ---- 各测试成绩摘要（大厅 / 总览复用） ---- */
  function sumOver(recs, pick){
    var best = null, count = 0;
    Object.keys(recs).forEach(function(k){
      var v = pick(recs[k]);
      if(v != null && (best === null || v < best)) best = v;
      if(recs[k].count) count += recs[k].count;
    });
    return { best: best, count: count };
  }

  function schulteSummary(){
    var recs = get('schulte', {});
    var bestA = null, bestD = null, bestC = null, count = 0;
    Object.keys(recs).forEach(function(d){
      var r = recs[d];
      if(r.count) count += r.count;
      if(r.asc   != null && (bestA === null || r.asc   < bestA)) bestA = r.asc;
      if(r.desc  != null && (bestD === null || r.desc  < bestD)) bestD = r.desc;
      if(r.color != null && (bestC === null || r.color < bestC)) bestC = r.color;
    });
    var best = Math.min.apply(null, [bestA, bestD, bestC].filter(function(v){ return v != null; }));
    if(!isFinite(best)) best = null;
    return {
      best: best != null ? best.toFixed(1) + 's' : null,
      line: '正序 ' + (bestA != null ? bestA.toFixed(1)+'s' : '--') +
            ' · 倒序 ' + (bestD != null ? bestD.toFixed(1)+'s' : '--'),
      extra: '累计 ' + count + ' 组'
    };
  }

  function digitSummary(){
    var recs = get('digit', []);
    if(!recs.length) return { best: null, line: '历史最佳 --', extra: '累计 0 天' };
    var best = 0;
    recs.forEach(function(r){ if(r.maxLen > best) best = r.maxLen; });
    var tr = recs.filter(function(r){ return r.date === todayKey(); })[0];
    return {
      best: best + '位',
      line: '历史最佳 ' + best + ' 位' + (tr ? ' · 今日 ' + tr.maxLen + ' 位' : ''),
      extra: '累计 ' + recs.length + ' 天'
    };
  }

  function breathSummary(){
    var d = get('breath', { log: [] });
    var total = 0, today = 0;
    (d.log || []).forEach(function(r){
      total += r.cycles;
      if(r.date === todayKey()) today += r.cycles;
    });
    return {
      best: total ? total + '轮' : null,
      line: '累计 ' + total + ' 轮' + (today ? ' · 今日 ' + today + ' 轮' : ''),
      extra: '累计 ' + (d.log || []).length + ' 次'
    };
  }

  function palaceSummary(){
    var d = get('palace', { log: [], reviews: [] });
    var due = (d.reviews || []).filter(function(r){ return r.due <= todayKey(); }).length;
    if(!d.log || !d.log.length){
      return { best: null, line: due ? '待复习 ' + due + ' 组' : '还没有记录', extra: due ? '记得回来复习' : '从今晚开始' };
    }
    var c = 0, t = 0;
    d.log.forEach(function(r){ c += r.correct; t += r.total; });
    var pct = t ? Math.round(c / t * 100) : 0;
    return {
      best: pct + '%',
      line: '平均回忆率 ' + pct + '%',
      extra: (due ? '待复习 ' + due + ' 组 · ' : '') + '累计 ' + d.log.length + ' 组'
    };
  }

  function pressureSummary(){
    var d = get('pressure', { log: [] });
    if(!d.log || !d.log.length) return { best: null, line: '还没开过口', extra: '每天 1 次就有效' };
    var avg = 0;
    d.log.forEach(function(r){ avg += r.rating; });
    avg = avg / d.log.length;
    return {
      best: d.log.length + '次',
      line: '平均自评 ' + avg.toFixed(1) + ' 分',
      extra: '累计 ' + d.log.length + ' 次'
    };
  }

  /* ---- 通用：从活动流水读取某测试的记录（新测试成绩都走 extra） ---- */
  function actSummary(testId, reducer){
    var acts = get('activity', []).filter(function(a){ return a.testId === testId; });
    if(!acts.length) return { best: null, line: '还没测过', extra: '每次约 1-2 分钟' };
    var acc = { n: acts.length, best: null };
    acts.forEach(function(a){ reducer(acc, a.extra || {}, a); });
    return acc;
  }
  function fmtMs(v){ return v != null ? Math.round(v) + 'ms' : null; }
  function fmtSec(v){ return v != null ? (+v).toFixed(1) + 's' : null; }

  function stroopSummary(){
    return actSummary('stroop', function(acc, e){
      if(e.interference != null && (acc.best === null || e.interference < acc.best)) acc.best = e.interference;
      acc.line = '干扰量 ' + (acc.best != null ? Math.round(acc.best) + 'ms' : '--') +
        ' · 正确率 ' + (e.accuracy != null ? Math.round(e.accuracy*100) + '%' : '--');
    });
  }
  function nbackSummary(){
    return actSummary('nback', function(acc, e){
      if(e.level != null && (acc.best === null || e.level > acc.best)) acc.best = e.level;
      acc.line = '最高 ' + (acc.best || 0) + '-back · 正确率 ' + (e.accuracy != null ? Math.round(e.accuracy*100) + '%' : '--');
    });
  }
  function gonogoSummary(){
    return actSummary('gonogo', function(acc, e){
      if(e.rt != null && (acc.best === null || e.rt < acc.best)) acc.best = e.rt;
      acc.line = '反应 ' + fmtMs(e.rt) + ' · 误点 ' + (e.commission != null ? e.commission : '--') + ' 次';
    });
  }
  function srtSummary(){
    return actSummary('srt', function(acc, e){
      if(e.rt != null && (acc.best === null || e.rt < acc.best)) acc.best = e.rt;
      acc.line = '最快均值 ' + fmtMs(acc.best) + ' · 上次 ' + fmtMs(e.rt);
    });
  }
  function corsiSummary(){
    return actSummary('corsi', function(acc, e){
      if(e.span != null && (acc.best === null || e.span > acc.best)) acc.best = e.span;
      acc.line = '空间跨度 ' + (acc.best || '--') + ' 格 · 上次 ' + (e.span != null ? e.span : '--');
    });
  }
  function tmtSummary(){
    return actSummary('tmt', function(acc, e){
      if(e.sec != null && (acc.best === null || e.sec < acc.best)) acc.best = e.sec;
      acc.line = '最佳 ' + fmtSec(acc.best) + ' · 上次 ' + fmtSec(e.sec) + (e.errors ? ' · 错 ' + e.errors : '');
    });
  }
  function rotationSummary(){
    return actSummary('rotation', function(acc, e){
      if(e.accuracy != null && (acc.best === null || e.accuracy > acc.best)) acc.best = e.accuracy;
      acc.line = '正确率 ' + (e.accuracy != null ? Math.round(e.accuracy*100) + '%' : '--') + ' · 平均 ' + fmtMs(e.rt);
    });
  }
  function sdmtSummary(){
    return actSummary('sdmt', function(acc, e){
      if(e.correct != null && (acc.best === null || e.correct > acc.best)) acc.best = e.correct;
      acc.line = '60 秒译码 ' + (acc.best || '--') + ' 个 · 上次 ' + (e.correct != null ? e.correct : '--');
    });
  }
  function drmSummary(){
    return actSummary('drm', function(acc, e){
      if(e.falseRate != null && (acc.best === null || e.falseRate < acc.best)) acc.best = e.falseRate;
      acc.line = '误报率 ' + (e.falseRate != null ? Math.round(e.falseRate*100) + '%' : '--') +
        ' · 击中 ' + (e.hitRate != null ? Math.round(e.hitRate*100) + '%' : '--');
    });
  }
  function delaySummary(){
    return actSummary('delay', function(acc, e){
      if(e.patience != null && (acc.best === null || e.patience > acc.best)) acc.best = e.patience;
      acc.line = '耐心指数 ' + (e.patience != null ? Math.round(e.patience*100) + '%' : '--');
    });
  }

  return {
    todayKey: todayKey, get: get, set: set, log: log,
    streak: streak, daysTrained: daysTrained, todayCount: todayCount,
    totalCount: totalCount, heat: heat,
    stats: {
      schulte: schulteSummary,
      digit: digitSummary,
      breathing: breathSummary,
      palace: palaceSummary,
      pressure: pressureSummary,
      stroop: stroopSummary,
      nback: nbackSummary,
      gonogo: gonogoSummary,
      srt: srtSummary,
      corsi: corsiSummary,
      tmt: tmtSummary,
      rotation: rotationSummary,
      sdmt: sdmtSummary,
      drm: drmSummary,
      delay: delaySummary
    }
  };
})();
