/* Night Shift remote-session diagnostics. Native MeshCentral handlers remain authoritative. */
(function () {
  'use strict';
  if (window.__NightShiftDiagnostics) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, rows = {}, actionButton, queued = false;
  var stateNames = ['Disconnected','Connecting','Setting up','Connected','Connected'];
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function appendRow(container, kind, label) {
    var row = create('div','ns-diagnostic-row');
    row.dataset.kind = kind;
    row.append(create('span','ns-diagnostic-label',label),create('strong','ns-diagnostic-value','Unknown'));
    container.append(row);
    rows[kind] = row.children[1];
  }
  function build() {
    var page = $('p11'), area = $('deskarea0');
    if (!page || !area || $('ns-session-diagnostics') || !area.parentNode) return;
    panel = create('section','ns-session-diagnostics');
    panel.id = 'ns-session-diagnostics';
    panel.setAttribute('aria-label','Remote connection diagnostics');
    panel.append(create('h3','ns-diagnostics-title','Connection diagnostics'));
    var list = create('div','ns-diagnostics-grid');
    appendRow(list,'browser','Browser network');
    appendRow(list,'control','MeshCentral control channel');
    appendRow(list,'device','Device route');
    appendRow(list,'session','Remote session');
    appendRow(list,'display','Remote display');
    appendRow(list,'cloudflare','Cloudflare Access');
    panel.append(list);
    actionButton = create('button','ns-diagnostics-action','Show native connection controls');
    actionButton.type = 'button';
    actionButton.addEventListener('click',function () {
      var controls = ['connectbutton1','connectbutton1r','connectbutton1h'];
      for (var i = 0; i < controls.length; i++) {
        var target = $(controls[i]);
        var visible = !!target && !target.disabled && target.getAttribute('aria-disabled') !== 'true' &&
          !!(target.getClientRects && target.getClientRects().length);
        for (var parent = target && (target.parentElement || target.parentNode); visible && parent; parent = parent.parentElement || parent.parentNode) {
          var style = getComputedStyle(parent);
          if (parent.hidden || style.display === 'none' || style.visibility === 'hidden') visible = false;
        }
        if (visible) {
          target.focus();
          if (target.scrollIntoView) target.scrollIntoView({block:'nearest',inline:'nearest'});
          return;
        }
      }
    });
    panel.append(actionButton);
    area.parentNode.insertBefore(panel,area);
  }
  function routeStatus(node) {
    if (!node || typeof node.conn !== 'number') return 'Unavailable';
    var parts = [], conn = node.conn;
    if (conn & 1) parts.push('Agent');
    if (conn & 2) parts.push('AMT CIRA');
    if (conn & 4) parts.push('AMT routable');
    if (!parts.length && (conn & 8)) parts.push('Agent');
    if (conn & 8 && parts.length) parts[0] += ' via relay';
    return parts.length ? parts.join(' · ') : 'No active agent or AMT route';
  }
  function transportName(desktop) {
    if (!desktop) return 'No active session';
    var transport = desktop.contype === 1 ? 'MeshAgent desktop' :
      (desktop.contype === 2 ? 'Intel AMT KVM' : (desktop.contype === 4 ? 'Browser RDP' : 'Native transport'));
    if (desktop.webRtcActive) transport += ' · WebRTC';
    var state = Number.isInteger(desktop.State) ? desktop.State : desktop.state;
    return transport + ' · ' + (stateNames[state] || 'State unavailable');
  }
  function update() {
    build();
    if (!panel || !rows.browser) return;
    var browser = window.navigator && typeof window.navigator.onLine === 'boolean'
      ? (window.navigator.onLine ? 'Online' : 'Offline') : 'Unknown';
    var socket = window.meshserver && window.meshserver.State;
    rows.browser.textContent = browser;
    rows.control.textContent = typeof socket === 'number' ? (socket === 2 ? 'Connected' : 'Disconnected') : 'Unknown';
    rows.device.textContent = routeStatus(window.currentNode);
    var desktop = window.desktop;
    rows.session.textContent = transportName(desktop);
    var active = !!(desktop && (desktop.State === 3 || desktop.state === 3));
    var canvas = $('Desk');
    rows.display.textContent = active ? (canvas && canvas.getClientRects && canvas.getClientRects().length ? 'Canvas mounted' : 'Connected; canvas not mounted') : 'No active display session';
    rows.cloudflare.textContent = 'Not observable after page load';
    if (actionButton) actionButton.hidden = active;
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }
  function boot() {
    if (!$('p11') || !$('deskarea0')) return;
    build();
    update();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(schedule);
      ['p11','deskarea0','deskstatus','connectbutton1','connectbutton1r','connectbutton1h','disconnectbutton1'].forEach(function (id) {
        var target = $(id);
        if (target) observer.observe(target,{attributes:true,attributeFilter:['class','style','disabled','hidden'],childList:id === 'deskstatus',characterData:id === 'deskstatus',subtree:id === 'deskstatus'});
      });
    }
    if (window.addEventListener) {
      window.addEventListener('online',schedule);
      window.addEventListener('offline',schedule);
      window.addEventListener('resize',schedule,{passive:true});
    }
    document.addEventListener('visibilitychange',schedule);
  }
  window.__NightShiftDiagnostics = {refresh:schedule};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
