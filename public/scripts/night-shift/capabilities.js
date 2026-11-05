/* Explain which native device tools MeshCentral currently exposes. */
(function () {
  'use strict';
  if (window.__NightShiftCapabilities) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, rows = {};
  var items = [
    ['MainDevDesktop','Remote desktop'],['MainDevTerminal','Terminal'],
    ['MainDevFiles','Device files'],['MainDevAmt','Intel AMT']
  ];
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function available(id) {
    var native = $(id);
    if (!native || native.disabled || native.hidden || native.getAttribute('aria-hidden') === 'true' || native.style.display === 'none') return false;
    if (typeof getComputedStyle === 'function' && getComputedStyle(native).display === 'none') return false;
    return !native.getClientRects || native.getClientRects().length > 0;
  }
  function build() {
    var host = $('p10info'); if (!host) return;
    if (!panel) {
      panel = create('section','ns-capabilities'); panel.id = 'ns-device-capabilities';
      panel.setAttribute('aria-label','Available device tools');
      panel.append(create('h3','','Available device tools'));
      var list = create('div','ns-capabilities-list');
      items.forEach(function (item) {
        var row = create('div','ns-capability-row');
        row.append(create('span','ns-capability-name',item[1]));
        rows[item[0]] = create('strong','ns-capability-status','Checking');
        rows[item[0]].dataset.capability = item[0]; row.append(rows[item[0]]); list.append(row);
      });
      panel.append(list,create('p','ns-capability-note','Availability reflects the native MeshCentral tab for this device and account.'));
      host.insertBefore(panel,host.firstChild);
    }
    items.forEach(function (item) {
      var state = available(item[0]);
      rows[item[0]].textContent = state ? 'Available' : 'Unavailable';
      rows[item[0]].className = state ? 'ns-capability-status is-available' : 'ns-capability-status is-unavailable';
    });
  }
  function boot() {
    if (!$('p10')) return;
    build();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(build);
      ['p10','MainDevDesktop','MainDevTerminal','MainDevFiles','MainDevAmt'].forEach(function (id) {
        var target = $(id); if (target) observer.observe(target,{attributes:true,attributeFilter:['class','style','disabled','hidden']});
      });
    }
  }
  window.__NightShiftCapabilities = {refresh:build};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
