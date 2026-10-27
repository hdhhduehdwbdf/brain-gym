/* ===== 脑力健身房 · 内联 SVG 图标（Lucide 风格细线，替换 emoji）=====
 * 用法：BT.icon('schulte') 返回 SVG 字符串；静态 HTML 里用 <span data-icon="schulte"></span>
 * 页面加载后 BT.mountIcons() 扫描 [data-icon] 自动填充。
 * 图标统一 viewBox 24、stroke 2、round cap/join，与玻璃风格一致。
 */
(function(){
  if (!window.BT) window.BT = {};

  /* 每个测试一个语义化线性图标 */
  var P = {
    // 大脑（首页 hero）
    brain: '<path d="M9.5 3a2.5 2.5 0 0 0-2.45 3 2.5 2.5 0 0 0-1.9 4 2.5 2.5 0 0 0 .6 4.4A3 3 0 0 0 8.5 21a2.5 2.5 0 0 0 3.5-2.3V5.5A2.5 2.5 0 0 0 9.5 3Z"/><path d="M14.5 3a2.5 2.5 0 0 1 2.45 3 2.5 2.5 0 0 1 1.9 4 2.5 2.5 0 0 1-.6 4.4A2.5 2.5 0 0 1 15.5 21 2.5 2.5 0 0 1 12 18.7V5.5A2.5 2.5 0 0 1 14.5 3Z"/>',
    // 火焰（连击）
    flame: '<path d="M12 2c1 3-1 4.5-2.5 6C8 9.5 7 10.5 7 13a5 5 0 0 0 10 0c0-1.5-.5-3-1.5-4.2-.4 1-1 1.7-2 2.2.3-2.6-.6-6-3.5-9Z"/><path d="M12 22a3 3 0 0 1-3-3c0-1 .5-2 1.5-2.7.3 1 1 1.6 1.5 1.2.5-.4.6-1.2.5-2 1.5.7 2.5 1.7 2.5 3a3 3 0 0 1-3 3Z"/>',
    // 靶心（舒尔特方格）
    schulte: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    // 数字（数字广度）
    digit: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8.5 9.5 10 8.5V15.5"/><path d="M13.5 9.5h3l-2 2.6a2.2 2.2 0 1 1-1.8 3.8"/>',
    // 风（呼吸）
    breathing: '<path d="M4 8h9a2.5 2.5 0 1 0-2.4-3.2"/><path d="M4 12h14a2.5 2.5 0 1 1-2.4 3"/><path d="M4 16h6a2 2 0 1 1-1.9 2.6"/>',
    // 地标/宫殿（记忆宫殿）
    palace: '<path d="M4 21h16"/><path d="M5 21V10l7-6 7 6v11"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/>',
    // 麦克风（高压舱）
    pressure: '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/>',
    // 红绿灯（Go/No-Go）
    gonogo: '<rect x="8" y="2.5" width="8" height="19" rx="4"/><circle cx="12" cy="7" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none"/>',
    // 调色板（Stroop）
    stroop: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.8 2-1.8 0-.9-.6-1.4-.6-2.2 0-1 .8-1.8 2-1.8H17a4 4 0 0 0 4-4c0-4.5-4-8.2-9-8.2Z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="7.2" r="1.2" fill="currentColor" stroke="none"/>',
    // 闪电（反应速度）
    srt: '<path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z"/>',
    // 拼图（N-back）
    nback: '<path d="M9 4h6v3a2 2 0 1 0 2 2h3v6h-3a2 2 0 1 0-2 2v3H9v-3a2 2 0 1 0-2-2H4V9h3a2 2 0 1 0 2-2V4Z"/>',
    // 方块组（Corsi）
    corsi: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="14.5" y="4" width="5.5" height="5.5" rx="1.5"/><rect x="14.5" y="13" width="5.5" height="7" rx="1.8"/><rect x="4" y="13.5" width="7" height="7" rx="1.8"/>',
    // 铅笔连线（TMT）
    tmt: '<path d="M4 19 8 9l4 6 3-9 5 13"/><circle cx="4" cy="19" r="1.3" fill="currentColor" stroke="none"/><circle cx="20" cy="19" r="1.3" fill="currentColor" stroke="none"/>',
    // 旋转箭头（心理旋转）
    rotation: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 3v4h-4"/>',
    // 键盘（SDMT）
    sdmt: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M6.5 9h.01M10.5 9h.01M14.5 9h.01M18 9h.01M6.5 13h.01M18 13h.01M8 17h12" stroke-linecap="round"/>',
    // 云雾（DRM）
    drm: '<path d="M7 18a4.5 4.5 0 1 1 .8-8.9A6 6 0 0 1 18.5 12 3.5 3.5 0 0 1 17.5 19H7Z"/><path d="M9 14.5h.01M12.5 14.5h.01M15 14.5h.01"/>',
    // 沙漏（延迟折扣）
    delay: '<path d="M6 3h12M6 21h12"/><path d="M7 3v3.5a5 5 0 0 0 2.2 4.1L11 12.5l-1.8.9A5 5 0 0 0 7 17.5V21"/><path d="M17 3v3.5a5 5 0 0 1-2.2 4.1L13 12l1.8.4a5 5 0 0 1 2.2 4.1V21"/>',
    // 折线（成绩）
    progress: '<path d="M3.5 20h17"/><path d="M4.5 16.5 9.5 11l3.5 3 6-7"/><circle cx="18.5" cy="7" r="1.4" fill="currentColor" stroke="none"/>',
    // 勾 / 叉（通用反馈）
    check: '<path d="M4.5 12.5 10 18 19.5 6.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    // 箭头（卡片右箭头）
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    // 发送（对话框）
    send: '<path d="M4 12 20 4l-4.5 16-4-6.5L4 12Z"/><path d="m11.5 13.5 4-6.5"/>'
  };

  function icon(name, size, cls){
    var d = P[name];
    if(!d) return '';
    var s = size || 22;
    return '<svg class="ic ' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* 扫描静态占位：<span data-icon="schulte" data-size="22"></span> */
  function mountIcons(root){
    (root || document).querySelectorAll('[data-icon]').forEach(function(el){
      if(el.dataset.done) return;
      el.innerHTML = icon(el.dataset.icon, el.dataset.size || 22);
      el.dataset.done = '1';
    });
  }

  BT.icon = icon;
  BT.mountIcons = mountIcons;
  if(document.readyState !== 'loading') mountIcons();
  else document.addEventListener('DOMContentLoaded', function(){ mountIcons(); });
})();
