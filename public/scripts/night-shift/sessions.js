/* Night Shift tabs over existing MeshCentral multi-desktop sessions. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftSessions) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, announcement, queued = false, previousSessions = null;
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
    var parent = $('column_l');
    if (!parent) return;
    panel = $('ns-session-tabs');
    if (panel) return;
    panel = create('nav','ns-session-tabs');
    panel.id = 'ns-session-tabs';
    panel.setAttribute('aria-label','Open remote sessions');
    panel.setAttribute('role','toolbar');
    panel.setAttribute('aria-orientation','horizontal');
    panel.addEventListener('keydown',function (event) {
      var controls = Array.prototype.filter.call(panel.children,function (child) {
        return child.classList && (child.classList.contains('ns-session-tab') || child.classList.contains('ns-session-tab-close')) && !child.disabled;
      });
      var currentIndex = controls.indexOf(event.target);
      if (currentIndex < 0 || !controls.length) return;
      var nextIndex = currentIndex;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % controls.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex + controls.length - 1) % controls.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = controls.length - 1;
      else return;
      event.preventDefault();
      controls.forEach(function (control,index) { control.tabIndex = index === nextIndex ? 0 : -1; });
      controls[nextIndex].focus();
    });
    announcement = create('span','ns-session-announcement');
    announcement.setAttribute('role','status');
    announcement.setAttribute('aria-live','polite');
    announcement.setAttribute('aria-atomic','true');
    panel.append(announcement);
    var before = $('p1');
    if (!before || before.parentNode !== parent) before = null;
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
    var focused = document.activeElement;
    var restoreFocus = null;
    if (focused && panel.contains && panel.contains(focused) && focused.dataset && focused.dataset.sessionId) {
      restoreFocus = {
        id:focused.dataset.sessionId,
        close:!!(focused.classList && focused.classList.contains('ns-session-tab-close'))
      };
    }
    var open = sessions();
    Array.prototype.slice.call(panel.children || []).forEach(function (child) {
      if (child !== announcement) panel.removeChild(child);
    });
    panel.hidden = open.length === 0;
    var snapshot = Object.create(null);
    var activeEntry = open.find(function (entry) { return entry.current; });
    open.forEach(function (entry,index) {
      snapshot[entry.id] = {
        current:entry.current,
        state:sessionState(entry.session),
        name:entry.node.name || entry.node.host || 'Remote device'
      };
    });
    if (previousSessions !== null && JSON.stringify(snapshot) !== JSON.stringify(previousSessions)) {
      var changes = [];
      open.forEach(function (entry) {
        var before = previousSessions[entry.id], after = snapshot[entry.id];
        if (!before) changes.push(after.name + ' session opened.');
        else if (before.state !== after.state) changes.push(after.name + ': ' + (stateNames[after.state] || 'state unavailable') + '.');
        if (before && !before.current && after.current) changes.push(after.name + ' is now active.');
      });
      Object.keys(previousSessions).forEach(function (id) {
        if (!snapshot[id]) changes.push(previousSessions[id].name + ' session closed.');
      });
      var countText = open.length + (open.length === 1 ? ' remote session' : ' remote sessions');
      announcement.textContent = countText + (changes.length ? '. ' + changes.join(' ') : '.');
    }
    previousSessions = snapshot;
    if (!open.length) {
      if (announcement.parentNode !== panel) panel.append(announcement);
      return;
    }
    var heading = create('span','ns-session-tabs-heading','Sessions');
      panel.insertBefore(heading,announcement);
    open.forEach(function (entry, index) {
      var name = entry.node.name || entry.node.host || 'Remote device';
      var state = sessionState(entry.session);
      var tab = create('button','ns-session-tab');
      tab.type = 'button';
      tab.dataset.sessionId = entry.id;
      tab.tabIndex = entry.current || (!activeEntry && index === 0) ? 0 : -1;
      if (entry.current) tab.setAttribute('aria-current','true');
      tab.setAttribute('aria-label',name + ', ' + (stateNames[state] || 'Session state unavailable'));
      tab.title = name + ' · ' + (stateNames[state] || 'State unavailable');
      var deviceName = create('span','ns-session-tab-name',name);
      var status = create('span','ns-session-tab-status',stateNames[state] || 'Unknown');
      tab.append(deviceName,status);
      tab.addEventListener('click',function () { switchTo(entry.id); });
      panel.insertBefore(tab,announcement);
      if (!entry.current) {
        var close = create('button','ns-session-tab-close','×');
        close.type = 'button';
        close.tabIndex = -1;
        close.dataset.sessionId = entry.id;
        close.setAttribute('aria-label','Disconnect ' + name);
        close.title = 'Disconnect ' + name;
        close.addEventListener('click',function (event) {
          event.preventDefault();
          event.stopPropagation();
          closeSession(entry.id);
        });
        panel.insertBefore(close,announcement);
      }
    });
    if (announcement.parentNode !== panel) panel.append(announcement);
    if (restoreFocus) {
      var controls = Array.prototype.filter.call(panel.children,function (child) {
        return child.classList && (child.classList.contains('ns-session-tab') || child.classList.contains('ns-session-tab-close'));
      });
      var target = controls.find(function (control) {
        return control.dataset.sessionId === restoreFocus.id &&
          control.classList.contains(restoreFocus.close ? 'ns-session-tab-close' : 'ns-session-tab');
      });
      if (!target) target = controls.find(function (control) {
        return control.dataset.sessionId === restoreFocus.id && control.classList.contains('ns-session-tab');
      });
      if (!target) target = controls.find(function (control) {
        return control.classList.contains('ns-session-tab') && control.getAttribute('aria-current') === 'true';
      }) || controls.find(function (control) { return control.classList.contains('ns-session-tab'); });
      if (target) {
        controls.forEach(function (control) { control.tabIndex = control === target ? 0 : -1; });
        target.focus();
      }
    }
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
