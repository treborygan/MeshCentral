/* Explain which native device tools MeshCentral currently exposes. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftCapabilities) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, rows = {}, openButtons = {};
  var items = [
    ['MainDevDesktop','Remote desktop',11],['MainDevTerminal','Terminal',12],
    ['MainDevFiles','Device files',13],['MainDevAmt','Intel AMT',14]
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
        rows[item[0]].dataset.capability = item[0]; row.append(rows[item[0]]);
        var open = create('button','ns-capability-open','Open');
        open.type = 'button'; open.setAttribute('aria-label','Open ' + item[1]);
        open.addEventListener('click',function (event) {
          if (!available(item[0]) || typeof window.go !== 'function') return;
          window.go(item[2],event);
        });
        openButtons[item[0]] = open; row.append(open); list.append(row);
      });
      panel.append(list,create('p','ns-capability-note','Availability reflects the native MeshCentral tab for this device and account.'));
      host.insertBefore(panel,host.firstChild);
    }
    items.forEach(function (item) {
      var state = available(item[0]);
      rows[item[0]].textContent = state ? 'Available' : 'Unavailable';
      rows[item[0]].className = state ? 'ns-capability-status is-available' : 'ns-capability-status is-unavailable';
      openButtons[item[0]].hidden = !state;
      openButtons[item[0]].disabled = !state || typeof window.go !== 'function';
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
