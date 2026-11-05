/*
 * Night Shift structural layer — progressive enhancement of real MeshCentral DOM.
 * Does not manufacture devices, sessions, events or server state; native controls
 * remain authoritative. The original interface remains available below the
 * enhancements, including plugin/advanced operations.
 */
(function () {
  'use strict';
  if (window.__nightShiftShell) return;
  var $ = function (id) { return document.getElementById(id); };
  var create = function (tag, cls, label) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (label !== undefined) node.textContent = label;
    return node;
  };
  var entries = [
    { title: 'Devices', id: 'LeftMenuMyDevices', page: 1, icon: '▣' },
    { title: 'Events', id: 'LeftMenuMyEvents', page: 3, icon: '◷' },
    { title: 'Files', id: 'LeftMenuMyFiles', page: 5, icon: '▤' },
    { title: 'Account', id: 'LeftMenuMyAccount', page: 2, icon: '◉' },
    { title: 'Users', id: 'LeftMenuMyUsers', page: 4, icon: '♙' },
    { title: 'Server', id: 'LeftMenuMyServer', page: 6, icon: '⌘' }
  ];
  var detailActions = [
    { title: 'Desktop', id: 'MainDevDesktop', page: 11, icon: '▣' },
    { title: 'Terminal', id: 'MainDevTerminal', page: 12, icon: '⌘' },
    { title: 'Files', id: 'MainDevFiles', page: 13, icon: '▤' }
  ];
  var routes = [
    ['p11', 'Remote desktop'], ['p12', 'Terminal'], ['p13', 'Device files'],
    ['p14', 'Intel AMT'], ['p10', 'Device details'], ['p2', 'Account'],
    ['p3', 'Events'], ['p4', 'Users'], ['p5', 'Server files'],
    ['p6', 'Server'], ['p1', 'Devices']
  ];
  var appbar, title, breadcrumb, status, dashboard, deviceCount, onlineCount, offlineCount, dashboardNote, shortcuts, deviceTools, remoteState;
  var queued = false;
  function visible(node) {
    return !!(node && node.getClientRects && node.getClientRects().length &&
      getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden');
  }
  function allowed(node) {
    return !!(node && !node.disabled && node.getAttribute('aria-disabled') !== 'true' &&
      node.style.display !== 'none' && node.getAttribute('aria-hidden') !== 'true');
  }
  function navigate(entry) {
    var native = $(entry.id);
    if (!allowed(native)) return false;
    // The original element retains MeshCentral's access control and event handlers.
    if (native && typeof native.dispatchEvent === 'function') {
      native.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    }
    return false;
  }
  function deviceAction(entry) {
    var native = $(entry.id);
    if (!allowed(native) || !visible(native)) return false;
    native.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  }
  function button(label, cls, onClick, description) {
    var node = create('button', cls, label);
    node.type = 'button';
    node.setAttribute('aria-label', description || label);
    node.addEventListener('click', onClick);
    return node;
  }
  function link(entry, cls) {
    var el = button(entry.icon + '  ' + entry.title, cls || 'ns-shell-action', function () {
      if (!navigate(entry) && window.__nightShiftUI && window.__nightShiftUI.refresh) {
        window.__nightShiftUI.refresh();
      }
    }, 'Open ' + entry.title + ' in MeshCentral');
    el.dataset.native = entry.id;
    return el;
  }
  function currentRoute() {
    for (var i = 0; i < routes.length; ++i) {
      if (visible($(routes[i][0]))) return routes[i][1];
    }
    return 'Workspace';
  }
  function makeBar() {
    var host = $('column_l');
    if (!host || $('ns-appbar')) return;
    appbar = create('header', 'ns-appbar'); appbar.id = 'ns-appbar';
    var left = create('div', 'ns-appbar-heading');
    breadcrumb = create('nav', 'ns-appbar-trail');
    breadcrumb.setAttribute('aria-label', 'Breadcrumb');
    title = create('h1', 'ns-appbar-title', 'Devices');
    left.append(breadcrumb, title);
    var right = create('div', 'ns-appbar-actions');
    right.id = 'ns-appbar-actions';
    status = create('span', 'ns-appbar-state', 'Native MeshCentral');
    right.append(status);
    if (window.__nightShiftUI && typeof window.__nightShiftUI.search === 'function') {
      right.append(button('⌕  Search', 'ns-shell-search', function () {
        window.__nightShiftUI.search();
      }, 'Search MeshCentral pages and actions'));
    }
    var menu = create('nav', 'ns-appbar-menu'); menu.hidden = true;
    menu.setAttribute('aria-label', 'Additional MeshCentral sections');
    entries.forEach(function (entry) { if (allowed($(entry.id))) menu.append(link(entry, 'ns-shell-action')); });
    var nativeMenu = button('More', 'ns-shell-more', function () {
      menu.hidden = !menu.hidden;
      nativeMenu.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
    }, 'Open additional MeshCentral sections');
    nativeMenu.setAttribute('aria-expanded', 'false');
    right.append(nativeMenu);
    appbar.append(left, right, menu);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !menu.hidden) {
        menu.hidden = true; nativeMenu.setAttribute('aria-expanded', 'false');
        nativeMenu.focus();
      }
    });
    host.insertBefore(appbar, host.firstChild);
  }
  function metric(name, value, note) {
    var box = create('div', 'ns-kpi');
    box.append(create('span', 'ns-kpi-name', name));
    var output = create('strong', 'ns-kpi-value', value);
    box.append(output, create('span', 'ns-kpi-note', note));
    return { el: box, output: output };
  }
  function makeDashboard() {
    var host = $('p1');
    if (!host || $('ns-overview')) return;
    dashboard = create('section', 'ns-overview'); dashboard.id = 'ns-overview';
    dashboard.setAttribute('aria-label', 'Night Shift overview');
    var lead = create('div', 'ns-overview-heading');
    var heading = create('div');
    heading.append(create('span', 'ns-eyebrow', 'WORKSPACE'), create('h2', '', 'Your devices, one place.'));
    heading.append(create('p', '', 'Live MeshCentral controls with your existing groups and permissions.'));
    lead.append(heading);
    var grid = create('div', 'ns-overview-grid');
    var hero = create('div', 'ns-hero');
    hero.append(create('span', 'ns-eyebrow', 'QUICK ACCESS'),
      create('h3', '', 'Secure remote management, streamlined.'));
    hero.append(create('p', '', 'Choose a device in the live inventory to open its desktop, terminal or files.'));
    var openDevices = entries[0];
    hero.append(link(openDevices, 'ns-hero-link'));
    var devices = metric('Devices', '—', 'Accessible managed devices loaded');
    deviceCount = devices.output;
    var online = metric('Reachable', '—', 'Agent, AMT or relay connected');
    onlineCount = online.output;
    var offline = metric('Offline', '—', 'No current connection reported');
    offlineCount = offline.output;
    grid.append(hero, devices.el, online.el, offline.el);
    var quick = create('div', 'ns-quicklinks');
    quick.append(create('h3', '', 'Workspace shortcuts'));
    shortcuts = create('div', 'ns-shortcut-grid');
    quick.append(shortcuts);
    dashboardNote = create('p', 'ns-dashboard-note',
      'Counts come from the authenticated MeshCentral device collection and may be paginated. No simulated devices or sessions.');
    dashboard.append(lead, grid, quick, dashboardNote);
    host.insertBefore(dashboard, host.firstChild);
  }
  function makeDeviceTools() {
    var host = $('p10'), anchor = $('p10info') || $('p10title');
    if (!host || $('ns-device-actions')) return;
    deviceTools = create('section', 'ns-device-actions'); deviceTools.id = 'ns-device-actions';
    deviceTools.setAttribute('aria-label', 'Device quick actions');
    deviceTools.append(create('h3', '', 'Connect and manage'));
    var row = create('div', 'ns-device-actions-row');
    detailActions.forEach(function (entry) {
      var el = button(entry.icon + '  ' + entry.title, 'ns-shell-action', function () {
        deviceAction(entry);
      }, 'Open native ' + entry.title);
      el.dataset.detail = entry.id; row.append(el);
    });
    deviceTools.append(row);
    if (anchor && anchor.parentNode === host) host.insertBefore(deviceTools, anchor);
    else host.insertBefore(deviceTools, host.firstChild);
  }
  function makeRemoteState() {
    var view = $('deskarea0');
    if (!view || $('ns-session-strip') || !view.parentNode) return;
    var strip = create('div', 'ns-session-strip'); strip.id = 'ns-session-strip';
    strip.append(create('span', 'ns-session-dot'));
    remoteState = create('strong', 'ns-session-label', 'Remote session');
    strip.append(remoteState, create('span', 'ns-session-protocol',
      'Connection, input, monitor and recording controls remain native.'));
    view.parentNode.insertBefore(strip, view);
  }
  function countRenderedDevices() {
    var area = $('xdevices');
    if (!area || !area.querySelectorAll) return null;
    var checkboxes = area.querySelectorAll('[name="xxdevice1"]');
    return checkboxes.length ? checkboxes.length : null;
  }
  function sync() {
    if (!appbar || !document.body) return;
    var route = currentRoute();
    if (title && title.textContent !== route) title.textContent = route;
    if (breadcrumb) {
      var crumbNodes = [];
      var home = button('Workspace', 'ns-breadcrumb-link', function () { navigate(entries[0]); }, 'Open Devices');
      crumbNodes.push(home);
      var node = window.currentNode;
      if (node && node._id && route !== 'Workspace' && route !== 'Devices') {
        crumbNodes.push(create('span', 'ns-breadcrumb-separator', '›'));
        var device = button(String(node.name || node.rname || 'Device'), 'ns-breadcrumb-link', function () { deviceAction({ id: 'MainDevInfo' }); }, 'Open device details');
        device.disabled = !allowed($('MainDevInfo'));
        crumbNodes.push(device);
      }
      if (route !== 'Devices') {
        crumbNodes.push(create('span', 'ns-breadcrumb-separator', '›'));
        crumbNodes.push(create('span', 'ns-breadcrumb-current', route));
      }
      breadcrumb.replaceChildren.apply(breadcrumb, crumbNodes);
    }
    var remote = route === 'Remote desktop';
    document.body.classList.toggle('ns-session-active', remote);
    if (status) status.textContent = remote ? 'Remote controls / live' : 'Native MeshCentral';
    if (deviceCount) {
      var nodes = Array.isArray(window.nodes) ? window.nodes.filter(function (n) { return !!n; }) : null;
      if (nodes) {
        deviceCount.textContent = String(nodes.length);
        var active = nodes.filter(function (n) { return ((Number(n.conn) || 0) & 7) !== 0; }).length;
        if (onlineCount) onlineCount.textContent = String(active);
        if (offlineCount) offlineCount.textContent = String(nodes.length - active);
      } else {
        var count = countRenderedDevices();
        deviceCount.textContent = count === null ? '—' : String(count);
        if (onlineCount) onlineCount.textContent = '—';
        if (offlineCount) offlineCount.textContent = '—';
      }
    }
    if (dashboard && dashboard.querySelector) {
      dashboard.hidden = !visible($('p1'));
    }
    if (shortcuts) {
      entries.forEach(function (entry) {
        var el = shortcuts.querySelector('[data-native="' + entry.id + '"]');
        if (!el && allowed($(entry.id))) { shortcuts.append(link(entry, 'ns-shell-action')); }
        else if (el) el.hidden = !allowed($(entry.id));
      });
    }
    if (deviceTools && deviceTools.querySelectorAll) {
      var actions = deviceTools.querySelectorAll('[data-detail]');
      for (var i = 0; i < actions.length; ++i) {
        var native = $(actions[i].dataset.detail);
        actions[i].hidden = !allowed(native) || !visible(native);
      }
    }
    if (remoteState) {
      var disconnect = $('disconnectbutton1');
      remoteState.textContent = visible(disconnect) && allowed(disconnect) ?
        'Remote session connected' : 'Remote session ready';
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; sync(); });
  }
  function boot() {
    if (!$('container') || !$('column_l') || !$('LeftMenuMyDevices')) return;
    makeBar(); makeDashboard(); makeDeviceTools(); makeRemoteState();
    if (!appbar) return;
    document.body.classList.add('ns-shell-ready');
    sync();
    var watcher = new MutationObserver(schedule);
    ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p10', 'p11', 'p12', 'p13',
      'connectbutton1', 'disconnectbutton1', 'MainSubMenuSpan'].forEach(function (id) {
      var target = $(id);
      if (target) watcher.observe(target,
        { attributes: true, attributeFilter: ['class', 'style', 'disabled', 'hidden'] });
    });
    var list = $('xdevices');
    if (list) watcher.observe(list, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    setInterval(function () {
      if (document.visibilityState === 'visible') {
        makeRemoteState(); makeDeviceTools(); sync();
      }
    }, 2500);
  }
  window.__nightShiftShell = { version: '2.0.0', refresh: schedule };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();


