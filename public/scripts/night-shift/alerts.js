/* Opt-in connection alerts for the currently open authorized device. */
(function () {
  'use strict';
  if (window.__NightShiftAlerts) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, enabled, quietStart, quietEnd, status, activeNode = null, lastState = null, lastNotice = null;
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function key(node) { return 'nsAlerts.' + node._id; }
  function load(node) {
    try { return JSON.parse(window.getstore(key(node), '{}')); } catch (e) { return {}; }
  }
  function save() {
    if (!activeNode || typeof window.putstore !== 'function') return;
    window.putstore(key(activeNode), JSON.stringify({enabled:enabled.checked,quietStart:quietStart.value,quietEnd:quietEnd.value}));
  }
  function addTimeControl(host, label, id) {
    var wrap = create('label','ns-alert-time'); wrap.append(create('span','',label));
    var input = create('input','form-control form-control-sm'); input.id = id; input.type = 'time';
    input.addEventListener('change',function () { save(); }); wrap.append(input); host.append(wrap); return input;
  }
  function build() {
    var host = $('p10info'), anchor = $('p10html2');
    if (!host || panel) return;
    panel = create('section','ns-alert-panel'); panel.id = 'ns-connection-alerts';
    panel.setAttribute('aria-label','Connection alert settings');
    panel.append(create('h3','','Connection alerts'));
    var toggle = create('label','ns-alert-toggle'); enabled = create('input',''); enabled.type = 'checkbox';
    enabled.addEventListener('change',function () {
      if (enabled.checked && window.Notification && window.Notification.permission === 'default') {
        window.Notification.requestPermission().then(function () { save(); });
      } else save();
    });
    toggle.append(enabled,create('span','','Notify when this device connection changes')); panel.append(toggle);
    var times = create('div','ns-alert-times');
    quietStart = addTimeControl(times,'Quiet hours start','ns-alert-quiet-start');
    quietEnd = addTimeControl(times,'Quiet hours end','ns-alert-quiet-end');
    panel.append(times);
    status = create('p','ns-alert-status','Alerts watch connection changes while this MeshCentral page is open.');
    status.setAttribute('aria-live','polite'); panel.append(status);
    if (anchor && anchor.parentNode === host) host.insertBefore(panel,anchor.nextSibling);
    else host.append(panel);
  }
  function hydrate(node) {
    if (!enabled) return;
    var prefs = load(node);
    enabled.checked = prefs.enabled === true;
    quietStart.value = typeof prefs.quietStart === 'string' ? prefs.quietStart : '';
    quietEnd.value = typeof prefs.quietEnd === 'string' ? prefs.quietEnd : '';
  }
  function quietNow(date) {
    var start = quietStart && quietStart.value, end = quietEnd && quietEnd.value;
    if (!start || !end || start === end) return false;
    var now = date.getHours() * 60 + date.getMinutes();
    var toMinutes = function (v) { var p = v.split(':'); return (+p[0] * 60) + (+p[1]); };
    var a = toMinutes(start), b = toMinutes(end);
    return a < b ? (now >= a && now < b) : (now >= a || now < b);
  }
  function state(node) {
    var conn = Number(node && node.conn);
    if (!isFinite(conn)) return 'unknown';
    var routes = [];
    if (conn & 1) routes.push('agent');
    if (conn & 2) routes.push('amt-cira');
    if (conn & 4) routes.push('amt');
    if (conn & 8) routes.push('relay');
    if (conn & 16) routes.push('mqtt');
    return routes.join('+') || 'offline';
  }
  function announce(node, current) {
    var now = new Date(), dedupeKey = node._id + '|' + current;
    if (!enabled.checked || quietNow(now) || (lastNotice && lastNotice.key === dedupeKey && now.getTime() - lastNotice.time < 300000)) return;
    var label = (node.name || node.rname || 'Device') + ' connection: ' + current.split('+').join(' / ');
    lastNotice = {key:dedupeKey,time:now.getTime()};
    status.textContent = label;
    if (window.Notification && window.Notification.permission === 'granted') {
      try { new window.Notification('MeshCentral connection changed',{body:label,tag:dedupeKey}); } catch (e) { }
    }
  }
  function update() {
    build(); if (!panel) return;
    var node = window.currentNode;
    if (!node || !node._id) { panel.hidden = true; activeNode = null; lastState = null; return; }
    panel.hidden = false;
    if (activeNode !== node._id) { activeNode = node._id; lastState = null; hydrate(node); }
    var current = state(node);
    if (lastState !== null && current !== lastState) announce(node,current);
    lastState = current;
  }
  function boot() {
    if (!$('p10')) return;
    update();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(update);
      ['MainComputerState','p10info','p10title'].forEach(function (id) {
        var target = $(id); if (target) observer.observe(target,{childList:true,subtree:true,attributes:true});
      });
    }
    if (document.addEventListener) document.addEventListener('visibilitychange',update);
  }
  window.__NightShiftAlerts = {refresh:update};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
