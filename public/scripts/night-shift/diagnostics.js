/* Night Shift remote-session diagnostics. Native MeshCentral handlers remain authoritative. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftDiagnostics) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, rows = {}, actionButton, guidance, queued = false, controlStateHookServer = null, lastWebRtcFailure = null;
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
    appendRow(list,'webrtc','WebRTC link');
    appendRow(list,'session','Remote session');
    appendRow(list,'display','Remote display');
    appendRow(list,'cloudflare','Cloudflare Access');
    panel.append(list);
    guidance = create('p','ns-diagnostics-guidance','');
    guidance.setAttribute('aria-live','polite');
    guidance.setAttribute('aria-atomic','true');
    panel.append(guidance);
    actionButton = create('button','ns-diagnostics-action','Show native connection controls');
    actionButton.type = 'button';
    actionButton.addEventListener('click',function () {
      var state = window.desktop && (Number.isInteger(window.desktop.State) ? window.desktop.State : window.desktop.state);
      var recoveringDisplay = Number.isInteger(state) && state >= 3 && !($('Desk') && $('Desk').getClientRects && $('Desk').getClientRects().length);
      var controls = recoveringDisplay ? ['disconnectbutton1','connectbutton1','connectbutton1r','connectbutton1h'] : ['connectbutton1','connectbutton1r','connectbutton1h'];
      for (var i = 0; i < controls.length; i++) {
        var target = $(controls[i]);
        if (nativeControlAvailable(controls[i])) {
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
    var channel = window.webRtcDesktop && window.webRtcDesktop.webchannel;
    if (desktop.webRtcActive && channel && channel.readyState === 'open') transport += ' · WebRTC';
    var state = Number.isInteger(desktop.State) ? desktop.State : desktop.state;
    return transport + ' · ' + (stateNames[state] || 'State unavailable');
  }
  function webRtcStatus() {
    var session = window.webRtcDesktop;
    if (!session) return lastWebRtcFailure ? 'ICE ' + lastWebRtcFailure.state + ' · link reset by MeshCentral' : 'Not active';
    var peer = session.webrtc, channel = session.webchannel, parts = [];
    if (peer && typeof peer.iceConnectionState === 'string') parts.push('ICE ' + peer.iceConnectionState);
    if (channel && typeof channel.readyState === 'string') parts.push('data channel ' + channel.readyState);
    return parts.length ? parts.join(' · ') : 'Negotiating';
  }
  function nativeControlAvailable(id) {
    var target = $(id);
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true' || !target.getClientRects || !target.getClientRects().length) return false;
    for (var parent = target.parentElement || target.parentNode; parent; parent = parent.parentElement || parent.parentNode) {
      var style = getComputedStyle(parent);
      if (parent.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  }
  function update() {
    build();
    if (!panel || !rows.browser) return;
    var rtc = window.webRtcDesktop, peer = rtc && rtc.webrtc, channel = rtc && rtc.webchannel;
    var nodeId = window.currentNode && window.currentNode._id;
    if (lastWebRtcFailure && (lastWebRtcFailure.nodeId !== nodeId || lastWebRtcFailure.desktop !== window.desktop || (rtc && lastWebRtcFailure.session !== rtc))) lastWebRtcFailure = null;
    if (lastWebRtcFailure && peer && channel && channel.readyState === 'open' && (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed')) lastWebRtcFailure = null;
    var browser = window.navigator && typeof window.navigator.onLine === 'boolean'
      ? (window.navigator.onLine ? 'Online' : 'Offline') : 'Unknown';
    var socket = window.meshserver && window.meshserver.State;
    rows.browser.textContent = browser;
    rows.control.textContent = typeof socket === 'number' ? (socket === 2 ? 'Connected' : 'Disconnected') : 'Unknown';
    rows.device.textContent = routeStatus(window.currentNode);
    rows.webrtc.textContent = webRtcStatus();
    var desktop = window.desktop;
    rows.session.textContent = transportName(desktop);
    var desktopState = desktop && (Number.isInteger(desktop.State) ? desktop.State : desktop.state);
    var active = Number.isInteger(desktopState) && desktopState >= 3;
    var canvas = $('Desk');
    var canvasMounted = !!(canvas && canvas.getClientRects && canvas.getClientRects().length);
    rows.display.textContent = active ? (canvasMounted ? 'Canvas mounted' : 'Connected; canvas not mounted') : 'No active display session';
    rows.cloudflare.textContent = 'Not observable after page load';
    if (actionButton) actionButton.hidden = active && canvasMounted;
    if (guidance) {
      var route = window.currentNode && typeof window.currentNode.conn === 'number' ? window.currentNode.conn : null;
      var next = 'Choose a native connection control to start a remote session.';
      if (browser === 'Offline') next = 'This browser is offline. Restore network access, then check the native connection status.';
      else if (typeof socket === 'number' && socket !== 2) next = 'The MeshCentral control channel is disconnected. Restore the page connection before reconnecting a device.';
      else if (lastWebRtcFailure) next = 'WebRTC ICE ' + lastWebRtcFailure.state + '; MeshCentral reset the WebRTC path.' + (active ? ' The native desktop session remains active; if the display did not recover, use native Disconnect and reconnect controls.' : ' Start or retry the session with MeshCentral’s native controls.');
      else if (route !== null && (route & 15) === 0) next = nativeControlAvailable('connectbutton1r')
        ? 'No Agent or AMT route is currently reported for this device. Browser RDP is available; use the native RDP Connect control or check the device agent.'
        : 'No Agent or AMT route is currently reported for this device, and Browser RDP is unavailable. Check the device status and use an enabled native connection method.';
      else if (Number.isInteger(desktopState) && (desktopState === 1 || desktopState === 2)) next = 'The native remote session is still connecting. Wait for its state to change before retrying.';
      else if (active && !canvasMounted) next = 'The session reports connected, but the display canvas is not mounted. Use the native Disconnect control before reconnecting.';
      else if (active) next = 'The native session is connected. Connection, input, monitor and recording controls remain available in MeshCentral.';
      else if (window.currentNode && typeof route === 'number') next = 'Device route status is shown above. Start, change or reset the session with MeshCentral’s native controls.';
      guidance.textContent = next;
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }
  function installControlStateHook() {
    var server = window.meshserver, native = server && server.onStateChanged;
    if (!server || typeof native !== 'function' || server === controlStateHookServer) return;
    var wrapped = function () {
      try { return native.apply(this,arguments); }
      finally { schedule(); }
    };
    wrapped.__nightShiftDiagnosticsHook = true;
    server.onStateChanged = wrapped;
    controlStateHookServer = server;
  }
  function installWebRtcResetHook() {
    var native = window.webRtcDesktopReset;
    if (typeof native !== 'function' || native.__nightShiftDiagnosticsHook) return;
    var wrapped = function () {
      var session = window.webRtcDesktop, peer = session && session.webrtc;
      var ice = peer && peer.iceConnectionState;
      try { return native.apply(this,arguments); }
      finally {
        lastWebRtcFailure = (ice === 'failed' || ice === 'disconnected') ? {state:ice,nodeId:window.currentNode && window.currentNode._id,desktop:window.desktop,session:session} : null;
        schedule();
      }
    };
    wrapped.__nightShiftDiagnosticsHook = true;
    window.webRtcDesktopReset = wrapped;
  }
  function boot() {
    if (!$('p11') || !$('deskarea0')) return;
    build();
    installControlStateHook();
    installWebRtcResetHook();
    update();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(schedule);
      ['p11','deskarea0','deskstatus','connectbutton1','connectbutton1r','connectbutton1h','disconnectbutton1'].forEach(function (id) {
        var target = $(id);
        if (target) observer.observe(target,{attributes:true,attributeFilter:['class','style','disabled','hidden'],childList:id === 'deskstatus' || id === 'deskarea0',characterData:id === 'deskstatus',subtree:id === 'deskstatus' || id === 'deskarea0'});
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
