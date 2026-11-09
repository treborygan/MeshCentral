/* Night Shift device health summary. Reads MeshCentral's cached native details. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftHealth) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, values = {}, lastNodeId = null, sampleTimer = null, latestSample = null;
  var refreshStatus = null, refreshTimer = null, pendingRefreshNode = null;
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
    row(grid, 'connection', 'Connection routes'); row(grid, 'uptime', 'Uptime / last boot');
    row(grid, 'cpu', 'CPU'); row(grid, 'memory', 'Memory');
    row(grid, 'storage', 'Windows volume storage'); row(grid, 'system', 'System information'); row(grid, 'agent', 'Agent status');
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
  function connectionRoutes(conn) {
    if (typeof conn !== 'number' || !isFinite(conn)) return 'Unavailable';
    var routes = [];
    [[1,'Agent'],[2,'AMT CIRA'],[4,'Intel AMT'],[8,'Relay'],[16,'MQTT']].forEach(function (route) {
      if ((conn & route[0]) !== 0) routes.push(route[1]);
    });
    return routes.length ? routes.join(' · ') : 'Offline';
  }
  function agentStatus(node) {
    if (!node || typeof node.conn !== 'number' || !isFinite(node.conn)) return 'Unavailable';
    var agent = node.agent && typeof node.agent === 'object' ? node.agent : null;
    var version = agent && typeof agent.ver === 'string' && agent.ver ? ' · ' + agent.ver : '';
    if ((node.conn & 1) !== 0) return 'Connected · MeshAgent' + version;
    if (agent) return 'Disconnected · MeshAgent' + version;
    if ((node.conn & 6) !== 0) return 'No MeshAgent · AMT available';
    return 'Unavailable';
  }
  function parseDmtfDate(value) {
    if (typeof value !== 'string') return null;
    var match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.\d{6}([+-])(\d{3})$/.exec(value);
    if (!match) return null;
    var parts = match.slice(1,7).map(Number), offset = Number(match[8]);
    var utc = Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]);
    var local = new Date(utc);
    if (local.getUTCFullYear() !== parts[0] || local.getUTCMonth() !== parts[1]-1 || local.getUTCDate() !== parts[2] ||
        local.getUTCHours() !== parts[3] || local.getUTCMinutes() !== parts[4] || local.getUTCSeconds() !== parts[5] || offset > 999) return null;
    return new Date(utc - (match[7] === '+' ? offset : -offset) * 60000);
  }
  function update() {
    build(); if (!panel) return;
    var node = window.currentNode;
    if (!node) {
      lastNodeId = null; latestSample = null;
      if (sampleTimer !== null) { clearTimeout(sampleTimer); sampleTimer = null; }
      if (pendingRefreshNode !== null) {
        pendingRefreshNode = null;
        if (refreshTimer !== null) { clearTimeout(refreshTimer); refreshTimer = null; }
        setRefreshStatus('');
      }
      Object.keys(values).forEach(function (key) { values[key].textContent = 'Unavailable'; }); return;
    }
    if (lastNodeId !== node._id) {
      if (pendingRefreshNode !== null && pendingRefreshNode !== node._id) {
        pendingRefreshNode = null;
        if (refreshTimer !== null) { clearTimeout(refreshTimer); refreshTimer = null; }
        setRefreshStatus('');
      }
      lastNodeId = node._id;
      latestSample = null;
      if (sampleTimer !== null) { clearTimeout(sampleTimer); sampleTimer = null; }
      values.cpu.textContent = 'Unavailable'; values.memory.textContent = 'Unavailable';
    }
    values.connection.textContent = connectionRoutes(node.conn);
    values.agent.textContent = agentStatus(node);
    var hardware = window.DeviceDetailsNodeId === node._id ? window.DeviceDetailsHardware : null;
    var boot = node.lastbootuptime instanceof Date ? node.lastbootuptime : null;
    if (!boot && hardware) {
      var win = hardware.windows && hardware.windows.osinfo && hardware.windows.osinfo.LastBootUpTime;
      if (typeof win === 'string') {
        boot = parseDmtfDate(win);
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
    latestSample = sample;
    if (sampleTimer !== null) clearTimeout(sampleTimer);
    values.cpu.textContent = typeof sample.cpu === 'number' && isFinite(sample.cpu) ? sample.cpu.toFixed(1) + '%' : 'Unavailable';
    values.memory.textContent = typeof sample.memory === 'number' && isFinite(sample.memory) ? sample.memory.toFixed(1) + '%' : 'Unavailable';
    sampleTimer = setTimeout(function () {
      if (latestSample !== sample) return;
      latestSample = null; sampleTimer = null;
      values.cpu.textContent = 'Unavailable'; values.memory.textContent = 'Unavailable';
    },6000);
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
  function installClearHook() {
    var nativeClear = window.deviceDetailsStatsClear;
    if (typeof nativeClear !== 'function' || nativeClear.__nightShiftHealthHook) return;
    var wrappedClear = function () {
      var result = nativeClear.apply(this,arguments);
      latestSample = null;
      if (sampleTimer !== null) { clearTimeout(sampleTimer); sampleTimer = null; }
      values.cpu.textContent = 'Unavailable'; values.memory.textContent = 'Unavailable';
      return result;
    };
    wrappedClear.__nightShiftHealthHook = true;
    window.deviceDetailsStatsClear = wrappedClear;
  }
  function setRefreshStatus(text) {
    var title = $('p17title');
    if (!refreshStatus && title && title.parentNode) {
      refreshStatus = create('div', 'ns-health-refresh-status');
      refreshStatus.id = 'ns-details-refresh-status';
      refreshStatus.setAttribute('role', 'status');
      refreshStatus.setAttribute('aria-live', 'polite');
      refreshStatus.setAttribute('aria-atomic', 'true');
      refreshStatus.hidden = true;
      title.parentNode.insertBefore(refreshStatus, title.nextSibling);
    }
    if (refreshStatus) {
      refreshStatus.textContent = text;
      refreshStatus.hidden = !text;
    }
  }
  function finishDetailsRefresh(node) {
    if (!pendingRefreshNode || !node || node._id !== pendingRefreshNode) return;
    pendingRefreshNode = null;
    if (refreshTimer !== null) { clearTimeout(refreshTimer); refreshTimer = null; }
    setRefreshStatus('Device details response received.');
  }
  function beginDetailsRefreshFeedback() {
    var node = window.currentNode;
    if (!node || !node._id || typeof window.refreshDetails !== 'function') return;
    pendingRefreshNode = node._id;
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    setRefreshStatus('Refreshing device details…');
    refreshTimer = setTimeout(function () {
      refreshTimer = null;
      if (pendingRefreshNode === node._id) setRefreshStatus('No device details response yet. You can retry.');
    }, 12000);
  }
  function installRefreshFeedback() {
    var selector = '#devListToolbarViewIcons3 [title="Refresh details information."]';
    var control = document.querySelector(selector);
    if (control && !control.__nightShiftRefreshFeedback) {
      control.addEventListener('click', beginDetailsRefreshFeedback, true);
      control.__nightShiftRefreshFeedback = true;
    }
    // MeshCentral can replace toolbar nodes during native route changes. Keep
    // feedback attached to replacement buttons without wrapping its handler.
    if (!document.__nightShiftRefreshFeedbackDelegated) {
      document.addEventListener('click', function (event) {
        var target = event.target;
        var delegatedControl = target && typeof target.closest === 'function' ? target.closest(selector) : null;
        if (!delegatedControl || delegatedControl.__nightShiftRefreshFeedback) return;
        beginDetailsRefreshFeedback();
      }, true);
      document.__nightShiftRefreshFeedbackDelegated = true;
    }
    var nativeUpdate = window.updateDeviceDetails;
    if (typeof nativeUpdate === 'function' && !nativeUpdate.__nightShiftRefreshFeedback) {
      var wrappedUpdate = function (node) {
        var result = nativeUpdate.apply(this, arguments);
        finishDetailsRefresh(node || window.currentNode);
        return result;
      };
      wrappedUpdate.__nightShiftRefreshFeedback = true;
      window.updateDeviceDetails = wrappedUpdate;
    }
  }
  function boot() {
    if (!$('p17')) return;
    installClearHook();
    installRefreshFeedback();
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
  window.__NightShiftHealth = { refresh:update, formatUptime:uptime, connectionRoutes:connectionRoutes, agentStatus:agentStatus, parseDmtfDate:parseDmtfDate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
