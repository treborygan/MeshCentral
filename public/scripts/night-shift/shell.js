/*
 * Night Shift structural layer — progressive enhancement of real MeshCentral DOM.
 * Does not manufacture devices, sessions, events or server state; native controls
 * remain authoritative. The original interface remains available below the
 * enhancements, including plugin/advanced operations.
 */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
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
    ['p14', 'Intel AMT'], ['p15', 'Console'], ['p16', 'Device events'],
    ['p17', 'Device details'], ['p18', 'Software'], ['p19', 'Plugins'],
    ['p9', 'Registry'], ['p10', 'Device details'], ['p2', 'Account'],
    ['p3', 'Events'], ['p4', 'Users'], ['p5', 'Server files'],
    ['p6', 'Server'], ['p20', 'Group details'], ['p21', 'Group summary'],
    ['p30', 'User record'], ['p31', 'User events'], ['p40', 'Server Stats'],
    ['p41', 'Server Trace'], ['p42', 'Server Plugins'], ['p43', 'Plugin admin'],
    ['p50', 'User Groups'], ['p51', 'User Group'], ['p52', 'Recordings'],
    ['p60', 'Reports'], ['p1', 'Devices']
  ];
  var appbar, title, breadcrumb, status, dashboard, deviceCount, onlineCount, offlineCount, dashboardNote, shortcuts, deviceTools, remoteState;
  var queued = false;
  var lastVisiblePage = null;
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
    // These Modern sidebar anchors bind go() to click, not mouseup. Keep the
    // native permission checks and handler by activating the original element.
    if (native && typeof native.click === 'function') {
      native.click();
      return true;
    }
    if (native && typeof native.dispatchEvent === 'function') {
      native.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }
    return false;
  }
  function deviceAction(entry) {
    var native = $(entry.id);
    if (!allowed(native) || !visible(native)) return false;
    // Device tabs bind inline mouseup handlers whose MeshCentral functions are
    // closure-scoped. Invoke that exact native handler so touch actions retain
    // its permissions and routing without relying on synthetic event dispatch.
    var event = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 });
    if (entry.page !== undefined && typeof native.onmouseup === 'function') native.onmouseup.call(native, event);
    else native.dispatchEvent(event);
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
    // On compact/mobile layouts some native pages can report no client rects
    // while MeshCentral has already committed the route in its query string.
    // Use that native route as a label fallback; it does not trigger navigation.
    var search = window.location && window.location.search;
    var match = typeof search === 'string' && /(?:^|[?&])viewmode=(\d+)(?:&|$)/.exec(search);
    if (match) {
      var view = 'p' + match[1];
      for (var routeIndex = 0; routeIndex < routes.length; routeIndex++) {
        if (routes[routeIndex][0] === view) return routes[routeIndex][1];
      }
    }
    return 'Workspace';
  }
  function makeSkipLink() {
    if (!document.body || $('ns-skip-main')) return;
    var skip = create('a','ns-skip-main','Skip to main content');
    skip.id = 'ns-skip-main';
    skip.href = '#main-content';
    skip.addEventListener('click',function (event) {
      event.preventDefault();
      var target = null;
      for (var i = 0; i < routes.length; i++) {
        var page = $(routes[i][0]);
        if (visible(page)) { target = page; break; }
      }
      target = target || $('column_l');
      if (!target || typeof target.focus !== 'function') return;
      if (target.getAttribute('tabindex') === null) target.setAttribute('tabindex','-1');
      target.focus();
    });
    document.body.insertBefore(skip,document.body.firstChild);
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
    var nativeMenu;
    function closeMenu() {
      if (menu.hidden) return;
      menu.hidden = true;
      nativeMenu.setAttribute('aria-expanded', 'false');
    }
    entries.forEach(function (entry) { if (allowed($(entry.id))) menu.append(link(entry, 'ns-shell-action')); });
    menu.append(button('Classic UI','ns-shell-action',function () {
      if (window.__nightShiftUI && typeof window.__nightShiftUI.enableClassic === 'function') window.__nightShiftUI.enableClassic();
    },'Switch to the native Classic MeshCentral UI'));
    nativeMenu = button('More', 'ns-shell-more', function () {
      menu.hidden = !menu.hidden;
      nativeMenu.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
    }, 'Open additional MeshCentral sections');
    nativeMenu.setAttribute('aria-expanded', 'false');
    right.append(nativeMenu);
    appbar.append(left, right, menu);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !menu.hidden) {
        closeMenu();
        nativeMenu.focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (!menu.hidden && !appbar.contains(event.target)) closeMenu();
    });
    menu.addEventListener('click', closeMenu);
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
    var activePage = null;
    for (var pageIndex = 0; pageIndex < routes.length; pageIndex++) {
      var candidate = $(routes[pageIndex][0]);
      if (visible(candidate)) { activePage = candidate; break; }
    }
    if (activePage && activePage !== lastVisiblePage) {
      var column = $('column_l');
      if (column) { column.scrollTop = 0; column.scrollLeft = 0; }
      activePage.scrollTop = 0;
      activePage.scrollLeft = 0;
      if (activePage.querySelectorAll) {
        var nestedScrollAreas = activePage.querySelectorAll('*');
        for (var scrollIndex = 0; scrollIndex < nestedScrollAreas.length; scrollIndex++) {
          nestedScrollAreas[scrollIndex].scrollTop = 0;
          nestedScrollAreas[scrollIndex].scrollLeft = 0;
        }
      }
      lastVisiblePage = activePage;
    }
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
    makeSkipLink();
    makeBar(); makeDashboard(); makeDeviceTools(); makeRemoteState();
    if (!appbar) return;
    document.body.classList.add('ns-shell-ready');
    sync();
    var watcher = new MutationObserver(schedule), watchIds = ['xdevices','deskstatus','connectbutton1','connectbutton1r',
      'disconnectbutton1','MainSubMenuSpan','MainDevDesktop','MainDevTerminal','MainDevFiles','MainDevAmt'];
    for (var pageIndex = 1; pageIndex <= 19; pageIndex++) watchIds.push('p' + pageIndex);
    routes.forEach(function (route) { if (watchIds.indexOf(route[0]) < 0) watchIds.push(route[0]); });
    watchIds.forEach(function (id) {
      var target = $(id);
      if (target) watcher.observe(target,
        { attributes: true, attributeFilter: ['class', 'style', 'disabled', 'hidden', 'aria-hidden'],
          childList: id === 'xdevices' || id === 'deskstatus', characterData: id === 'deskstatus',
          subtree: id === 'xdevices' || id === 'deskstatus' });
    });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    document.addEventListener('visibilitychange', schedule);
  }
  window.__nightShiftShell = { version: '2.0.0', refresh: schedule };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();


