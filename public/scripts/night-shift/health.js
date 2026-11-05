/* Night Shift device health summary. Reads MeshCentral's cached native details. */
(function () {
  'use strict';
  if (window.__NightShiftHealth) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, values = {};
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function row(host, key, label) {
    var item = create('div', 'ns-health-item');
    item.append(create('span', 'ns-health-label', label));
    values[key] = create('strong', 'ns-health-value', 'Unavailable');
    item.append(values[key]); host.append(item);
  }
  function build() {
    var host = $('p17info');
    if (!host || panel) return;
    panel = create('section', 'ns-health-panel'); panel.id = 'ns-device-health';
    panel.setAttribute('aria-label', 'Device health summary');
    panel.append(create('h3', 'ns-health-title', 'Device health'));
    var grid = create('div', 'ns-health-grid');
    row(grid, 'agent', 'Agent status'); row(grid, 'uptime', 'Uptime / last boot');
    row(grid, 'cpu', 'CPU'); row(grid, 'memory', 'Memory');
    row(grid, 'storage', 'Windows volume storage'); row(grid, 'system', 'System information');
    panel.append(grid);
    var note = create('p', 'ns-health-note', 'CPU and memory samples are available while MeshCentral’s native live graph is open.');
    var action = create('button', 'ns-health-action', 'Open CPU and memory graph');
    action.type = 'button';
    action.addEventListener('click', function () {
      var native = document.querySelector('#devListToolbarViewIcons3 [title="Show device CPU and memory usage."]');
      if (native && typeof native.click === 'function') native.click();
    });
    panel.append(note, action);
    var info = $('p17info2');
    if (info && info.parentNode === host) host.insertBefore(panel, info);
    else host.insertBefore(panel, host.firstChild);
  }
  function size(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return null;
    var units = ['B', 'KB', 'MB', 'GB', 'TB'], index = 0, value = bytes;
    while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
    return value.toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
  }
  function uptime(date, now) {
    var elapsed = Math.floor(((now === undefined ? Date.now() : now) - date.getTime()) / 60000);
    if (!isFinite(elapsed) || elapsed < 0) return null;
    var days = Math.floor(elapsed / 1440), hours = Math.floor((elapsed % 1440) / 60), minutes = elapsed % 60;
    var duration = days ? days + (days === 1 ? ' day' : ' days') + (hours ? ' ' + hours + 'h' : '') :
      (hours ? hours + 'h ' : '') + (minutes ? minutes + 'm' : (hours ? '' : 'under 1m'));
    return duration + ' · booted ' + date.toLocaleString();
  }
  function update() {
    build(); if (!panel) return;
    var node = window.currentNode;
    if (!node) { Object.keys(values).forEach(function (key) { values[key].textContent = 'Unavailable'; }); return; }
    var connected = typeof node.conn === 'number' && (node.conn & 15) !== 0;
    values.agent.textContent = connected ? 'Connected' : (typeof node.conn === 'number' ? 'Offline' : 'Unavailable');
    var hardware = window.DeviceDetailsNodeId === node._id ? window.DeviceDetailsHardware : null;
    var boot = node.lastbootuptime instanceof Date ? node.lastbootuptime : null;
    if (!boot && hardware) {
      var win = hardware.windows && hardware.windows.osinfo && hardware.windows.osinfo.LastBootUpTime;
      if (typeof win === 'string' && /^\d{14}(?:\.\d+)?[+-]\d+$/.test(win)) {
        boot = new Date(+win.slice(0,4), +win.slice(4,6)-1, +win.slice(6,8), +win.slice(8,10), +win.slice(10,12), +win.slice(12,14));
      } else if (hardware.linux && hardware.linux.LastBootUpTime) boot = new Date(hardware.linux.LastBootUpTime);
      else if (hardware.darwin && hardware.darwin.LastBootUpTime) boot = new Date(hardware.darwin.LastBootUpTime * 1000);
    }
    values.uptime.textContent = boot && isFinite(boot.getTime()) ? (uptime(boot) || 'Unavailable') : 'Unavailable';
    var volumes = hardware && hardware.windows && hardware.windows.volumes, safe = [];
    var storageSamples = [];
    if (volumes && typeof volumes === 'object') Object.keys(volumes).forEach(function (name) {
      var volume = volumes[name] || {}, total = size(volume.size), free = size(volume.sizeremaining);
      if (total || free) safe.push(name + ': ' + (free || 'Unavailable') + ' free / ' + (total || 'Unavailable'));
      if (typeof volume.size === 'number' && volume.size > 0 && typeof volume.sizeremaining === 'number' && volume.sizeremaining >= 0) {
        storageSamples.push({name:name,size:volume.size,free:volume.sizeremaining});
      }
    });
    values.storage.textContent = safe.length ? safe.join(' · ') : 'Unavailable';
    if (window.dispatchEvent && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('ns-native-storage-sample',{detail:{nodeid:node._id,volumes:storageSamples}}));
    }
    var os = node.osdesc || (hardware && hardware.windows && hardware.windows.osinfo && hardware.windows.osinfo.Description);
    values.system.textContent = typeof os === 'string' && os ? os : 'Unavailable';
  }
  function acceptSample(sample) {
    if (!sample || sample.nodeid !== (window.currentNode && window.currentNode._id)) return;
    values.cpu.textContent = typeof sample.cpu === 'number' && isFinite(sample.cpu) ? sample.cpu.toFixed(1) + '%' : 'Unavailable';
    values.memory.textContent = typeof sample.memory === 'number' && isFinite(sample.memory) ? sample.memory.toFixed(1) + '%' : 'Unavailable';
  }
  function installChartHook() {
    var chart = window.deviceDetailsStatsChart;
    if (!chart || typeof chart.update !== 'function' || chart.__nightShiftHealthHook) return;
    var nativeUpdate = chart.update;
    chart.update = function () {
      var result = nativeUpdate.apply(this, arguments);
      var samples = window.deviceDetailsStatsData;
      var last = samples && samples.length ? samples[samples.length - 1] : null;
      if (last && isFinite(last[0]) && isFinite(last[1]) && isFinite(last[2])) {
        var sample = {nodeid:window.currentNode && window.currentNode._id,time:last[0],cpu:last[1],memory:last[2]};
        acceptSample(sample);
        if (window.dispatchEvent && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('ns-native-health-sample',{detail:sample}));
      }
      return result;
    };
    chart.__nightShiftHealthHook = true;
  }
  function boot() {
    if (!$('p17')) return;
    update();
    var graphControl = document.querySelector('#devListToolbarViewIcons3 [title="Show device CPU and memory usage."]');
    if (graphControl) graphControl.addEventListener('click',function () {
      setTimeout(function () {
        if (!window.deviceDetailsStatsChart) {
          values.cpu.textContent = 'Unavailable'; values.memory.textContent = 'Unavailable';
        } else installChartHook();
      },0);
    },true);
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(update);
      var target = $('p17info2');
      if (target) observer.observe(target, {attributes:true, childList:true, subtree:true});
    }
    document.addEventListener('visibilitychange', update);
    window.addEventListener('resize', update, {passive:true});
  }
  window.__NightShiftHealth = { refresh:update, formatUptime:uptime };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
