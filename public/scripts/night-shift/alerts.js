/* Opt-in connection alerts for the currently open authorized device. */
(function () {
  'use strict';
  if (window.__NightShiftAlerts) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, enabled, metricEnabled, storageEnabled, cpuLimit, memoryLimit, storageLimit, quietStart, quietEnd, status, activeNode = null, lastState = null, lastNotices = {}, overThreshold = {}, fleetStates = Object.create(null), fleetHookInstalled = false;
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
    window.putstore(key(activeNode), JSON.stringify({e:enabled.checked?1:0,m:metricEnabled.checked?1:0,c:cpuLimit.value,r:memoryLimit.value,s:quietStart.value,t:quietEnd.value}));
    window.putstore('nsAlertsS.' + activeNode,JSON.stringify({b:storageEnabled.checked?1:0,f:storageLimit.value}));
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
    var metricToggle = create('label','ns-alert-toggle'); metricEnabled = create('input',''); metricEnabled.type = 'checkbox';
    metricEnabled.addEventListener('change',function () {
      if (metricEnabled.checked && window.Notification && window.Notification.permission === 'default') window.Notification.requestPermission().then(save);
      else save();
    });
    metricToggle.append(metricEnabled,create('span','','Notify when CPU or memory crosses its threshold')); panel.append(metricToggle);
    var storageToggle = create('label','ns-alert-toggle'); storageEnabled = create('input',''); storageEnabled.type = 'checkbox';
    storageEnabled.addEventListener('change',function () {
      if (storageEnabled.checked && window.Notification && window.Notification.permission === 'default') window.Notification.requestPermission().then(save);
      else save();
    });
    storageToggle.append(storageEnabled,create('span','','Notify when Windows volume free space falls below threshold')); panel.append(storageToggle);
    var thresholds = create('div','ns-alert-times');
    function numberControl(label,id,value) {
      var wrap = create('label','ns-alert-time'); wrap.append(create('span','',label));
      var input = create('input','form-control form-control-sm'); input.id = id; input.type = 'number'; input.min = '1'; input.max = '100'; input.step = '1'; input.value = value;
      input.addEventListener('change',save); wrap.append(input); thresholds.append(wrap); return input;
    }
    cpuLimit = numberControl('CPU threshold (%)','ns-alert-cpu-limit','85');
    memoryLimit = numberControl('Memory threshold (%)','ns-alert-memory-limit','90');
    storageLimit = numberControl('Free space threshold (%)','ns-alert-storage-limit','15');
    panel.append(thresholds);
    var times = create('div','ns-alert-times');
    quietStart = addTimeControl(times,'Quiet hours start','ns-alert-quiet-start');
    quietEnd = addTimeControl(times,'Quiet hours end','ns-alert-quiet-end');
    panel.append(times);
    status = create('p','ns-alert-status','Opted-in connection alerts follow native device updates while this page is open. CPU and memory alerts require the native live graph.');
    status.setAttribute('aria-live','polite'); panel.append(status);
    if (anchor && anchor.parentNode === host) host.insertBefore(panel,anchor.nextSibling);
    else host.append(panel);
  }
  function hydrate(node) {
    if (!enabled) return;
    var prefs = load(node);
    var storagePrefs = {};
    try { storagePrefs = JSON.parse(window.getstore('nsAlertsS.' + node._id,'{}')); } catch (e) { }
    enabled.checked = prefs.e === 1;
    metricEnabled.checked = prefs.m === 1;
    storageEnabled.checked = storagePrefs.b === 1;
    cpuLimit.value = prefs.c || '85'; memoryLimit.value = prefs.r || '90';
    storageLimit.value = storagePrefs.f || '15';
    quietStart.value = typeof prefs.s === 'string' ? prefs.s : '';
    quietEnd.value = typeof prefs.t === 'string' ? prefs.t : '';
  }
  function quietNow(date, preferences) {
    var start = preferences ? preferences.s : (quietStart && quietStart.value);
    var end = preferences ? preferences.t : (quietEnd && quietEnd.value);
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
    var label = (node.name || node.rname || 'Device') + ' connection: ' + current.split('+').join(' / ');
    notify(node,dedupeKey,label,enabled.checked,now);
  }
  function notify(node,dedupeKey,label,allowed,now,quietPreferences) {
    if (!allowed || quietNow(now,quietPreferences) || (lastNotices[dedupeKey] && now.getTime() - lastNotices[dedupeKey] < 300000)) return;
    lastNotices[dedupeKey] = now.getTime();
    if (status) status.textContent = label;
    if (window.Notification && window.Notification.permission === 'granted') {
      try { new window.Notification('MeshCentral connection changed',{body:label,tag:dedupeKey}); } catch (e) { }
    }
  }
  function sample(event) {
    var value = event && event.detail, node = window.currentNode;
    if (!metricEnabled || !metricEnabled.checked || !value || !node || value.nodeid !== node._id) return;
    var cpu = typeof value.cpu === 'number' && value.cpu >= Number(cpuLimit.value);
    var memory = typeof value.memory === 'number' && value.memory >= Number(memoryLimit.value);
    var now = new Date(), name = node.name || node.rname || 'Device';
    [['cpu',cpu,value.cpu],['memory',memory,value.memory]].forEach(function (item) {
      var metricKey = node._id + '|metric|' + item[0];
      if (item[1] && !overThreshold[metricKey]) notify(node,metricKey,name + ' ' + item[0] + ' is ' + item[2].toFixed(1) + '%',true,now);
      overThreshold[metricKey] = item[1];
    });
  }
  function storageSample(event) {
    var value = event && event.detail, node = window.currentNode;
    if (!storageEnabled || !storageEnabled.checked || !value || !node || value.nodeid !== node._id || !Array.isArray(value.volumes)) return;
    var threshold = Number(storageLimit.value), now = new Date(), device = node.name || node.rname || 'Device';
    value.volumes.forEach(function (volume) {
      if (!volume || typeof volume.name !== 'string' || !(volume.size > 0) || !(volume.free >= 0)) return;
      var freePercent = volume.free / volume.size * 100, low = freePercent <= threshold;
      var metricKey = node._id + '|storage|' + volume.name;
      if (low && !overThreshold[metricKey]) notify(node,metricKey,device + ' volume ' + volume.name + ' has ' + freePercent.toFixed(1) + '% free',true,now);
      overThreshold[metricKey] = low;
    });
  }
  function update() {
    build(); if (!panel) return;
    var node = window.currentNode;
    if (!node || !node._id) { panel.hidden = true; activeNode = null; lastState = null; return; }
    panel.hidden = false;
    if (activeNode !== node._id) { activeNode = node._id; lastState = null; overThreshold = {}; hydrate(node); }
    var current = state(node);
    if (lastState !== null && current !== lastState) announce(node,current);
    lastState = current;
  }
  function seedFleetStates() {
    if (!Array.isArray(window.nodes)) return;
    window.nodes.forEach(function (node) {
      if (node && typeof node._id === 'string') fleetStates[node._id] = state(node);
    });
  }
  function installFleetConnectionHook() {
    var nativeUpdate = window.updateDeviceViewDevice;
    if (fleetHookInstalled || typeof nativeUpdate !== 'function') return;
    window.updateDeviceViewDevice = function (node) {
      if (node && typeof node._id === 'string') {
        var current = state(node), previous = fleetStates[node._id];
        fleetStates[node._id] = current;
        if (previous !== undefined && previous !== 'unknown' && previous !== current) {
          var preferences = load(node);
          var label = (node.name || node.rname || 'Device') + ' connection: ' + current.split('+').join(' / ');
          notify(node,node._id + '|' + current,label,preferences.e === 1,new Date(),preferences);
        }
      }
      return nativeUpdate.apply(this,arguments);
    };
    fleetHookInstalled = true;
  }
  function boot() {
    seedFleetStates();
    installFleetConnectionHook();
    update();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(update);
      ['MainComputerState','p10info','p10title'].forEach(function (id) {
        var target = $(id); if (target) observer.observe(target,{childList:true,subtree:true,attributes:true});
      });
    }
    if (document.addEventListener) document.addEventListener('visibilitychange',update);
    if (window.addEventListener) window.addEventListener('ns-native-health-sample',sample);
    if (window.addEventListener) window.addEventListener('ns-native-storage-sample',storageSample);
  }
  window.__NightShiftAlerts = {refresh:update};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
