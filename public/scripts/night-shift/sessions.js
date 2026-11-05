/* Night Shift tabs over existing MeshCentral multi-desktop sessions. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftSessions) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, queued = false;
  var stateNames = ['Disconnected','Connecting','Setting up','Connected','Connected'];

  function sessionState(session) {
    if (!session) return 0;
    if (session.State != null) return Number(session.State) || 0;
    if (session.state != null) return Number(session.state) || 0;
    if (session.m) {
      if (session.m.State != null) return Number(session.m.State) || 0;
      if (session.m.state != null) return Number(session.m.state) || 0;
    }
    return 0;
  }
  function findNode(id) {
    var list = window.nodes;
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) if (list[i] && list[i]._id === id) return list[i];
    }
    return typeof window.getNodeFromId === 'function' ? window.getNodeFromId(id) : null;
  }
  function sessions() {
    var result = [], seen = Object.create(null), current = window.currentNode, desktop = window.desktop;
    if (current && desktop && sessionState(desktop) > 0) {
      result.push({id:current._id,node:current,session:desktop,current:true});
      seen[current._id] = true;
    }
    var open = window.multiDesktop;
    if (open && typeof open === 'object') {
      Object.keys(open).forEach(function (id) {
        var session = open[id], node = findNode(id);
        if (!session || !node || seen[id]) return;
        result.push({id:id,node:node,session:session,current:!!(current && current._id === id)});
        seen[id] = true;
      });
    }
    return result;
  }
  function create(tag, cls, text) {
    var item = document.createElement(tag);
    if (cls) item.className = cls;
    if (text !== undefined) item.textContent = text;
    return item;
  }
  function build() {
    var area = $('deskarea0');
    if (!area || !(area.parentNode || area.parentElement)) return;
    panel = $('ns-session-tabs');
    if (panel) return;
    panel = create('nav','ns-session-tabs');
    panel.id = 'ns-session-tabs';
    panel.setAttribute('aria-label','Open remote sessions');
    panel.setAttribute('role','tablist');
    var parent = area.parentNode || area.parentElement;
    var before = $('ns-session-diagnostics') || area;
    parent.insertBefore(panel,before);
  }
  function switchTo(id) {
    if (typeof window.gotoDevice === 'function') window.gotoDevice(id,1);
  }
  function closeSession(id) {
    var node = findNode(id);
    if (node && typeof window.toggleKvmDevice === 'function') window.toggleKvmDevice(node);
  }
  function render() {
    var page = $('p11'), area = $('deskarea0');
    if (!page || !area) return;
    build();
    if (!panel) return;
    var open = sessions();
    panel.replaceChildren();
    panel.hidden = open.length === 0;
    if (!open.length) return;
    var heading = create('span','ns-session-tabs-heading','Sessions');
      panel.append(heading);
    open.forEach(function (entry) {
      var name = entry.node.name || entry.node.host || 'Remote device';
      var state = sessionState(entry.session);
      var tab = create('button','ns-session-tab');
      tab.type = 'button';
      tab.dataset.sessionId = entry.id;
      tab.setAttribute('role','tab');
      tab.setAttribute('aria-selected',entry.current ? 'true' : 'false');
      tab.setAttribute('aria-label',name + ', ' + (stateNames[state] || 'Session state unavailable'));
      tab.title = name + ' · ' + (stateNames[state] || 'State unavailable');
      var deviceName = create('span','ns-session-tab-name',name);
      var status = create('span','ns-session-tab-status',stateNames[state] || 'Unknown');
      tab.append(deviceName,status);
      tab.addEventListener('click',function () { switchTo(entry.id); });
      panel.append(tab);
      if (!entry.current) {
        var close = create('button','ns-session-tab-close','×');
        close.type = 'button';
        close.setAttribute('aria-label','Disconnect ' + name);
        close.title = 'Disconnect ' + name;
        close.addEventListener('click',function (event) {
          event.preventDefault();
          event.stopPropagation();
          closeSession(entry.id);
        });
        panel.append(close);
      }
    });
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; render(); });
  }
  function boot() {
    if (!$('p11') || !$('deskarea0')) return;
    render();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(schedule);
      ['p11','p11deviceName','deskarea0','xdevices','deskstatus','connectbutton1','disconnectbutton1'].forEach(function (id) {
        var target = $(id);
        if (!target) return;
        var complex = id === 'deskarea0' || id === 'xdevices' || id === 'deskstatus';
        observer.observe(target,{
          attributes:true,
          attributeFilter:['class','style','disabled','hidden'],
          childList:id === 'p11deviceName' || complex,
          characterData:id === 'p11deviceName' || id === 'deskstatus',
          subtree:complex
        });
      });
    }
  }
  window.__NightShiftSessions = {refresh:schedule};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
