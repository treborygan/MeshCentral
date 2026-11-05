/* Per-device connection preferences layered over native MeshCentral controls. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftProfiles) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, controls = {}, status, pending = null, appliedDesktop = null, loadedNodeId = null, queued = false;
  var scales = ['1024','896','768','640','512','384','256','128'];
  var qualities = ['100','90','80','70','60','50','40','30','20','10','5','1'];
  var methods = {agent:'connectbutton1',rdp:'connectbutton1r',amt:'connectbutton1h'};

  function accountKey(node) {
    try {
      var user = window.userinfo && window.userinfo._id;
      if (typeof user !== 'string' || !user || !node || typeof node._id !== 'string') return null;
      var storage = window.localStorage;
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;
      storage.getItem('');
      return 'nightShiftConnectionProfile:' + encodeURIComponent(user) + ':' + encodeURIComponent(node._id);
    } catch (ex) { return null; }
  }
  function normalize(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      version:1,
      method:Object.prototype.hasOwnProperty.call(methods,value.method) ? value.method : 'agent',
      monitor:Number.isInteger(Number(value.monitor)) && Number(value.monitor) >= 0 && Number(value.monitor) <= 64 ? String(Number(value.monitor)) : 'auto',
      scaling:scales.indexOf(String(value.scaling)) >= 0 ? String(value.scaling) : '1024',
      quality:qualities.indexOf(String(value.quality)) >= 0 ? String(value.quality) : '40',
      keyboardMap:value.keyboardMap === 'remote' ? 'remote' : 'native',
      fullscreen:value.fullscreen === true
    };
  }
  function load(node) {
    var key = accountKey(node);
    if (!key) return normalize(window.__nightShiftProfileMemory && window.__nightShiftProfileMemory[node._id]);
    try { return normalize(JSON.parse(window.localStorage.getItem(key) || 'null')); } catch (ex) { return null; }
  }
  function save(node, profile) {
    var key = accountKey(node);
    if (key) {
      try { window.localStorage.setItem(key,JSON.stringify(profile)); return true; } catch (ex) { }
    }
    window.__nightShiftProfileMemory = window.__nightShiftProfileMemory || Object.create(null);
    window.__nightShiftProfileMemory[node._id] = profile;
    return false;
  }
  function create(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function addOption(select, value, text) {
    var option = create('option','',text);
    option.value = value;
    select.append(option);
  }
  function field(container, label, control) {
    var wrap = create('label','ns-profile-field');
    wrap.append(create('span','ns-profile-label',label),control);
    container.append(wrap);
  }
  function build() {
    var area = $('deskarea0');
    if (!area || !(area.parentNode || area.parentElement)) return;
    panel = $('ns-connection-profile');
    if (panel) return;
    panel = create('section','ns-connection-profile');
    panel.id = 'ns-connection-profile';
    panel.setAttribute('aria-label','Per-device connection profile');
    panel.append(create('h3','ns-profile-title','Connection profile'));
    var grid = create('div','ns-profile-grid');
    controls.method = create('select','ns-profile-select');
    controls.method.dataset.profileField = 'method';
    [['agent','MeshAgent desktop'],['rdp','Browser RDP'],['amt','Intel AMT KVM']].forEach(function (item) { addOption(controls.method,item[0],item[1]); });
    field(grid,'Connection method',controls.method);
    controls.monitor = create('select','ns-profile-select');
    controls.monitor.dataset.profileField = 'monitor';
    addOption(controls.monitor,'auto','Native default');
    field(grid,'Monitor',controls.monitor);
    controls.scaling = create('select','ns-profile-select');
    controls.scaling.dataset.profileField = 'scaling';
    [['1024','100%'],['896','87.5%'],['768','75%'],['640','62.5%'],['512','50%'],['384','37.5%'],['256','25%'],['128','12.5%']].forEach(function (item) { addOption(controls.scaling,item[0],item[1]); });
    field(grid,'Display scaling',controls.scaling);
    controls.quality = create('select','ns-profile-select');
    controls.quality.dataset.profileField = 'quality';
    qualities.forEach(function (value) { addOption(controls.quality,value,value + '%'); });
    field(grid,'Image quality',controls.quality);
    controls.keyboardMap = create('select','ns-profile-select');
    controls.keyboardMap.dataset.profileField = 'keyboardMap';
    addOption(controls.keyboardMap,'native','Native keyboard map');
    addOption(controls.keyboardMap,'remote','Remote keyboard map');
    field(grid,'Keyboard layout map',controls.keyboardMap);
    controls.fullscreen = create('select','ns-profile-select');
    controls.fullscreen.dataset.profileField = 'fullscreen';
    addOption(controls.fullscreen,'false','Windowed');
    addOption(controls.fullscreen,'true','Fullscreen preference');
    field(grid,'Viewer mode',controls.fullscreen);
    panel.append(grid);
    var actions = create('div','ns-profile-actions');
    var saveButton = create('button','ns-profile-button','Save profile');
    saveButton.type = 'button';
    saveButton.addEventListener('click',saveCurrent);
    var connectButton = create('button','ns-profile-button ns-profile-primary','Connect using profile');
    connectButton.type = 'button';
    connectButton.addEventListener('click',connectUsingProfile);
    var fullscreenButton = create('button','ns-profile-button','Apply fullscreen');
    fullscreenButton.type = 'button';
    fullscreenButton.addEventListener('click',applyFullscreen);
    actions.append(saveButton,connectButton,fullscreenButton);
    panel.append(actions);
    status = create('p','ns-profile-status','Profiles contain preferences only; credentials and session data are never saved.');
    status.setAttribute('role','status');
    panel.append(status);
    var parent = area.parentNode || area.parentElement;
    var before = $('ns-session-tabs') || $('ns-session-diagnostics') || area;
    parent.insertBefore(panel,before);
  }
  function updateMonitorOptions(profile) {
    if (!controls.monitor) return;
    var selected = profile ? profile.monitor : 'auto';
    var displays = window.desktop && window.desktop.m && window.desktop.m.displays;
    controls.monitor.replaceChildren();
    addOption(controls.monitor,'auto','Native default');
    if (displays && typeof displays === 'object') {
      Object.keys(displays).forEach(function (index) {
        addOption(controls.monitor,String(index),String(displays[index] || ('Display ' + (Number(index) + 1))));
      });
    }
    if (selected !== 'auto' && !Array.prototype.some.call(controls.monitor.options || [],function (option) { return option.value === selected; })) {
      addOption(controls.monitor,selected,'Display ' + (Number(selected) + 1) + ' (saved)');
    }
    controls.monitor.value = selected;
  }
  function readControls() {
    return normalize({
      method:controls.method.value,
      monitor:controls.monitor.value,
      scaling:controls.scaling.value,
      quality:controls.quality.value,
      keyboardMap:controls.keyboardMap.value,
      fullscreen:controls.fullscreen.value === 'true'
    });
  }
  function populate(node) {
    var profile = load(node) || normalize({method:window.desktop && window.desktop.contype === 4 ? 'rdp' : (window.desktop && window.desktop.contype === 2 ? 'amt' : 'agent'),scaling:window.desktopsettings && window.desktopsettings.scaling,quality:window.desktopsettings && window.desktopsettings.quality});
    controls.method.value = profile.method;
    controls.scaling.value = profile.scaling;
    controls.quality.value = profile.quality;
    controls.keyboardMap.value = profile.keyboardMap;
    controls.fullscreen.value = String(profile.fullscreen);
    updateMonitorOptions(profile);
    loadedNodeId = node._id;
  }
  function currentNode() { return window.currentNode && typeof window.currentNode._id === 'string' ? window.currentNode : null; }
  function saveCurrent() {
    var node = currentNode();
    if (!node) return;
    var profile = readControls(), persistent = save(node,profile);
    appliedDesktop = null;
    status.textContent = persistent ? 'Profile saved for this account and device.' : 'Saved for this page only; browser storage is unavailable.';
    applyToActiveSession(node,profile);
  }
  function methodButton(method) { return $(methods[method]); }
  function controlVisible(control) {
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true' || !control.getClientRects || !control.getClientRects().length) return false;
    for (var parent = control.parentNode || control.parentElement; parent; parent = parent.parentNode || parent.parentElement) {
      var style = getComputedStyle(parent);
      if (parent.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  }
  function connectUsingProfile() {
    var node = currentNode();
    if (!node) return;
    var profile = readControls(), nativeButton = methodButton(profile.method);
    if (!controlVisible(nativeButton)) {
      status.textContent = 'That connection method is unavailable or not permitted for this device. Choose an enabled native method.';
      var first = [methodButton('agent'),methodButton('rdp'),methodButton('amt')].find(controlVisible);
      if (first) { first.focus(); if (first.scrollIntoView) first.scrollIntoView({block:'nearest'}); }
      return;
    }
    save(node,profile);
    pending = {id:node._id,profile:profile};
    status.textContent = 'Opening MeshCentral’s native connection flow; any required consent or credentials remain in its dialog.';
    if (profile.fullscreen && typeof window.deskToggleFull === 'function' && !document.body.classList.contains('fulldesk')) {
      window.deskToggleFull({shiftKey:false});
    }
    nativeButton.click();
  }
  function applyToActiveSession(node, profile) {
    var desktop = window.desktop, methodMatches = desktop && ((profile.method === 'agent' && desktop.contype === 1) || (profile.method === 'amt' && desktop.contype === 2) || (profile.method === 'rdp' && desktop.contype === 4));
    if (!desktop || !methodMatches || sessionState(desktop) < 3 || appliedDesktop === desktop) return false;
    var monitorApplied = false, qualityApplied = false, keyboardApplied = false;
    var displays = desktop.m && desktop.m.displays;
    var hasMonitor = displays && Object.prototype.hasOwnProperty.call(displays,String(profile.monitor));
    if (profile.monitor !== 'auto' && hasMonitor && typeof desktop.m.SetDisplay === 'function') {
      desktop.m.SetDisplay(Number(profile.monitor));
      monitorApplied = true;
    }
    if (desktop.contype === 1 && desktop.m) {
      desktop.m.CompressionLevel = Number(profile.quality);
      desktop.m.ScalingLevel = Number(profile.scaling);
      desktop.m.remoteKeyMap = profile.keyboardMap === 'remote';
      if (typeof desktop.m.SendCompressionLevel === 'function') {
        var settings = window.desktopsettings || {};
        desktop.m.SendCompressionLevel(settings.agentencoding || 4,Number(profile.quality),Number(profile.scaling),settings.framerate || 50);
      }
      qualityApplied = true;
      keyboardApplied = true;
    }
    var monitorPending = profile.monitor !== 'auto' && desktop.m && typeof desktop.m.SetDisplay === 'function' && !hasMonitor;
    if ((monitorApplied || qualityApplied || keyboardApplied || desktop.contype === 4) && !monitorPending) appliedDesktop = desktop;
    status.textContent = desktop.contype === 1
      ? 'Profile applied to the active Agent session.'
      : (monitorApplied ? 'Monitor preference applied. This transport does not expose the remaining profile settings.' : 'This transport does not expose quality, scaling or keyboard-map controls; native session settings remain available.');
    if (profile.fullscreen) status.textContent += ' Use Apply fullscreen to enter viewer fullscreen.';
    return monitorApplied || qualityApplied || keyboardApplied;
  }
  function sessionState(session) {
    if (!session) return 0;
    if (session.State != null) return Number(session.State) || 0;
    if (session.state != null) return Number(session.state) || 0;
    return 0;
  }
  function applyFullscreen() {
    var node = currentNode(), profile = node && load(node);
    if (!profile || !profile.fullscreen) {
      status.textContent = 'Set the fullscreen preference to Fullscreen preference and save it first.';
      return;
    }
    if (!window.desktop || sessionState(window.desktop) < 3 || typeof window.deskToggleFull !== 'function') {
      status.textContent = 'Connect the device first; fullscreen is applied with MeshCentral’s native viewer control.';
      return;
    }
    if (document.body.classList.contains('fulldesk')) {
      status.textContent = 'The viewer is already fullscreen.';
      return;
    }
    window.deskToggleFull({shiftKey:false});
    status.textContent = 'Fullscreen toggled with MeshCentral’s native viewer control.';
  }
  function update() {
    build();
    var node = currentNode();
    if (!panel) return;
    panel.hidden = !$('p11') || !node;
    if (!node) { pending = null; appliedDesktop = null; return; }
    if (loadedNodeId !== node._id) populate(node);
    var saved = load(node);
    if (pending && pending.id === node._id && window.desktop && sessionState(window.desktop) >= 3) {
      applyToActiveSession(node,pending.profile);
      pending = null;
    } else if (saved && window.desktop) {
      applyToActiveSession(node,saved);
    }
    updateMonitorOptions(readControls());
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
      ['p11','p10deviceName','deskarea0','deskstatus','DeskMonitorSelectionSpan','connectbutton1span','connectbutton1rspan','connectbutton1hspan'].forEach(function (id) {
        var target = $(id);
        if (!target) return;
        var subtree = id === 'deskarea0' || id === 'deskstatus' || id === 'DeskMonitorSelectionSpan';
        observer.observe(target,{attributes:true,attributeFilter:['class','style','disabled','hidden'],childList:subtree || id === 'p10deviceName',characterData:id === 'deskstatus' || id === 'p10deviceName',subtree:subtree});
      });
    }
  }
  window.__NightShiftProfiles = {refresh:schedule};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
