/* Collapsible, non-modal device information drawer for the native desktop viewer. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftViewer) return;
  var $ = function (id) { return document.getElementById(id); };
  var toggle, drawer, closeButton, detailsButton, controls, fields = {}, controlButtons = {}, hideTimer = null;
  var items = [['device','Device'],['group','Device group'],['connection','Connection route'],['session','Remote session'],['agent','Agent'],['os','Operating system']];
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function set(key,value) {
    value = value || 'Unavailable';
    if (fields[key] && fields[key].textContent !== value) fields[key].textContent = value;
  }
  function visible(node) {
    return !!(node && !node.hidden && node.style.display !== 'none' && node.getClientRects && node.getClientRects().length);
  }
  function route(node) {
    var conn = Number(node.conn) || 0, labels = [];
    if (conn & 1) labels.push('Agent');
    if (conn & 2) labels.push('AMT CIRA');
    if (conn & 4) labels.push('AMT routable');
    if (conn & 8) labels.push('Relay');
    if (conn & 16) labels.push('MQTT');
    return labels.length ? labels.join(' · ') : (typeof node.conn === 'number' ? 'Offline' : 'Unavailable');
  }
  function transport(desktop) {
    if (!desktop) return 'No active remote session';
    var name = desktop.contype === 1 ? 'MeshAgent desktop' : desktop.contype === 2 ? 'Intel AMT KVM' : desktop.contype === 4 ? 'Browser RDP' : 'Native transport';
    var state = Number.isInteger(desktop.State) ? desktop.State : desktop.state;
    var states = ['Disconnected','Connecting','Setting up','Connected','Connected'];
    return name + ' · ' + (states[state] || 'State unavailable');
  }
  function update() {
    if (!drawer) return;
    var active = visible($('p11'));
    toggle.hidden = !active;
    if (controls) controls.hidden = !active;
    if (!active) {
      close();
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      return;
    }
    var node = window.currentNode;
    if (!node) { items.forEach(function (item) { set(item[0],'Unavailable'); }); syncControls(); return; }
    var group = window.meshes && window.meshes[node.meshid];
    set('device',node.name || node.rname || 'Unnamed device');
    set('group',group && group.name || (node.meshid ? 'Group unavailable' : 'No device group'));
    set('connection',route(node));
    set('session',transport(window.desktop));
    set('agent',node.agent ? ('MeshAgent' + (node.agent.ver ? ' · ' + node.agent.ver : '')) : (node.intelamt ? 'Agent unavailable · AMT present' : 'Unavailable'));
    set('os',node.osdesc || 'Unavailable');
    var native = $('MainDevInfo');
    detailsButton.disabled = !visible(native);
    detailsButton.setAttribute('aria-disabled',detailsButton.disabled ? 'true' : 'false');
    syncControls();
  }
  function nativeAction(id) {
    var target = $(id);
    if (!visible(target) || target.disabled || target.getAttribute('aria-disabled') === 'true') return false;
    target.click(); return true;
  }
  function syncControls() {
    if (!controls) return;
    controls.hidden = !visible($('p11'));
    if (controls.hidden) return;
    [['connect','connectbutton1'],['rdp','connectbutton1r'],['disconnect','disconnectbutton1']].forEach(function (pair) {
      var native = $(pair[1]), button = controlButtons[pair[0]];
      button.hidden = !visible(native) || !!native.disabled || native.getAttribute('aria-disabled') === 'true';
    });
    var title = $('p11title');
    var fullscreen = title && title.querySelector('#devListToolbarViewIcons [title^="Full Screen"]');
    controlButtons.fullscreen.hidden = !visible(fullscreen) && typeof window.deskToggleFull !== 'function';
  }
  function showControls() {
    if (!controls || !visible($('p11'))) return;
    controls.classList.remove('is-idle');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideControls,2800);
  }
  function hideControls() {
    hideTimer = null;
    if (!controls || !visible($('p11'))) return;
    var active = document.activeElement;
    if (active && controls.contains && controls.contains(active)) return;
    if (controls.matches && controls.matches(':hover')) return;
    controls.classList.add('is-idle');
  }
  function buildControls() {
    if (controls || !$('p11title')) return;
    controls = create('div','ns-viewer-controls'); controls.id = 'ns-viewer-controls';
    controls.setAttribute('role','toolbar'); controls.setAttribute('aria-label','Remote session controls');
    [['connect','Connect','connectbutton1'],['rdp','RDP','connectbutton1r'],['disconnect','Disconnect','disconnectbutton1']].forEach(function (item) {
      var button = create('button','ns-viewer-control',item[1]); button.type = 'button';
      button.addEventListener('click',function () { nativeAction(item[2]); showControls(); });
      controlButtons[item[0]] = button; controls.append(button);
    });
    var fullscreen = create('button','ns-viewer-control','Full screen'); fullscreen.type = 'button';
    fullscreen.addEventListener('click',function () {
      var title = $('p11title'), native = title && title.querySelector('#devListToolbarViewIcons [title^="Full Screen"]');
      if (visible(native)) native.click();
      else if (typeof window.deskToggleFull === 'function') window.deskToggleFull({shiftKey:false});
      showControls();
    });
    controlButtons.fullscreen = fullscreen; controls.append(fullscreen);
    controls.addEventListener('pointerenter',function () { if (hideTimer) clearTimeout(hideTimer); controls.classList.remove('is-idle'); });
    controls.addEventListener('pointerleave',showControls);
    controls.addEventListener('focusin',function () { if (hideTimer) clearTimeout(hideTimer); controls.classList.remove('is-idle'); });
    controls.addEventListener('focusout',function () { setTimeout(showControls,0); });
    document.body.append(controls);
    document.addEventListener('pointermove',showControls,{passive:true});
    document.addEventListener('keydown',function (event) {
      if (visible($('p11')) && event.key !== 'Tab' && !(event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) showControls();
    });
    syncControls(); showControls();
  }
  function close() {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true; toggle.setAttribute('aria-expanded','false');
  }
  function build() {
    var host = $('p11title'); if (!host || drawer) return;
    toggle = create('button','ns-viewer-info-toggle','Info'); toggle.type = 'button';
    toggle.setAttribute('aria-label','Show device and session information'); toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-controls','ns-viewer-info-drawer');
    drawer = create('aside','ns-viewer-info-drawer'); drawer.id = 'ns-viewer-info-drawer';
    drawer.hidden = true; drawer.setAttribute('aria-label','Device and session information');
    var heading = create('div','ns-viewer-info-heading');
    heading.append(create('h2','','Session information'));
    closeButton = create('button','ns-viewer-info-close','Close'); closeButton.type = 'button';
    closeButton.addEventListener('click',function () { close(); toggle.focus(); });
    heading.append(closeButton); drawer.append(heading);
    var list = create('dl','ns-viewer-info-list');
    items.forEach(function (item) {
      var group = create('div','ns-viewer-info-row'); group.append(create('dt','',item[1]));
      fields[item[0]] = create('dd','','Unavailable'); group.append(fields[item[0]]); list.append(group);
    });
    drawer.append(list);
    detailsButton = create('button','ns-viewer-info-details','Open device details'); detailsButton.type = 'button';
    detailsButton.addEventListener('click',function () {
      var native = $('MainDevInfo');
      if (visible(native)) { native.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); close(); }
    });
    drawer.append(detailsButton);
    toggle.addEventListener('click',function () {
      if (drawer.hidden) { update(); drawer.hidden = false; toggle.setAttribute('aria-expanded','true'); closeButton.focus(); }
      else { close(); toggle.focus(); }
    });
    document.body.append(toggle,drawer);
    buildControls();
    document.addEventListener('keydown',function (event) {
      if (event.key === 'Escape' && !drawer.hidden) { close(); toggle.focus(); }
    });
  }
  function boot() {
    if (!$('p11') || !document.body) return;
    build(); update();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(update);
      ['p11','p11title','p11deviceName','deskstatus','disconnectbutton1','MainDevInfo'].forEach(function (id) {
        var target = $(id), textRoot = id === 'deskstatus' || id === 'p11title' || id === 'p11deviceName';
        if (target) observer.observe(target,{attributes:true,attributeFilter:['class','style','hidden','disabled'],childList:textRoot,characterData:textRoot,subtree:textRoot});
      });
    }
    if (window.addEventListener) window.addEventListener('resize',update,{passive:true});
  }
  window.__NightShiftViewer = {refresh:update,close:close};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
