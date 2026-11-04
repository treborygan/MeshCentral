/* Night Shift — MeshCentral UI enhancement, 1.0.0.
 * Delegates all remote-control actions to original MeshCentral handlers.
 * No protocol, auth, permission, agent or session implementations.
 */
(function () {
  'use strict';
  if (window.__nightShiftUI) return;
  const $ = (id) => document.getElementById(id);
  const q = (selector, root = document) => root.querySelector(selector);
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const usable = (el) => !!(visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
  const mobile = () => matchMedia('(max-width: 900px)').matches;
  const destinations = [
    ['Devices','LeftMenuMyDevices',1], ['Account','LeftMenuMyAccount',2],
    ['Events','LeftMenuMyEvents',3], ['Files','LeftMenuMyFiles',5],
    ['Users','LeftMenuMyUsers',4], ['Server','LeftMenuMyServer',6]
  ];
  const tabs = [
    ['General','MainDev',10], ['Desktop','MainDevDesktop',11],
    ['Terminal','MainDevTerminal',12], ['Files','MainDevFiles',13],
    ['Registry','MainDevRegistry',9], ['Software','MainDevApps',18],
    ['Events','MainDevEvents',16], ['Details','MainDevInfo',17],
    ['Intel AMT','MainDevAmt',14], ['Console','MainDevConsole',15],
    ['Plugins','MainDevPlugins',19]
  ];
  let backdrop, input, results, dock, nav, refreshScheduled = false, toastHandle;
  // MeshCentral 1.3.1's default3.handlebars omits width=device-width.
  // Android otherwise retains a ~980 CSS-px layout viewport while touch-only
  // JS navigation activates, producing both the desktop sidebar and mobile bar.
  // Preserve pinch-zoom, user-scalable and existing zoom bounds.
  function ensureDeviceViewport() {
    if (typeof document.querySelector !== 'function') return;
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    let content = viewport.getAttribute('content') || '';
    if (!/(?:^|,)\s*width\s*=\s*device-width(?:\s*,|\s*$)/i.test(content)) {
      content = 'width=device-width,' + content;
    }
    if (!/(?:^|,)\s*viewport-fit\s*=/i.test(content)) {
      content += ',viewport-fit=cover';
    }
    viewport.setAttribute('content', content);
  }
  function message(text) {
    let el = $('ns-message');
    if (!el) {
      el = make('div','ns-message'); el.id='ns-message';
      el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
      document.body.append(el);
    }
    el.textContent = text; el.classList.add('is-visible');
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => el.classList.remove('is-visible'), 2800);
  }
  function button(text, className, handler, title) {
    const el = make('button',className,text);
    el.type='button'; el.setAttribute('aria-label',title || text);
    if (title) el.title=title;
    el.addEventListener('click',handler);
    return el;
  }
  function nativeClick(id) {
    const el = $(id);
    if (!usable(el)) return false;
    el.click(); return true;
  }
  function nativeFunction(name) {
    if (typeof window[name] !== 'function') return false;
    try { window[name](); return true; }
    catch (error) { console.warn('[Night Shift] Original action error',name,error); return false; }
  }
  function act(fn, unavailable) { if (!fn()) message(unavailable || 'Action unavailable for this session.'); }
  function workspace(index) {
    const item = destinations[index]; const el = $(item[1]);
    if (!el) return false;
    if (visible(el)) { el.click(); return true; }
    // Mobile hides the original navigation rail. Use its original go() dispatcher.
    return nativeFunctionWithArg('go',item[2]);
  }
  function nativeFunctionWithArg(name,arg) {
    if (typeof window[name] !== 'function') return false;
    try { window[name](arg); return true; }
    catch (e) { console.warn('[Night Shift] Navigation failed',name,e); return false; }
  }
  function tab(index) {
    const el = $(tabs[index][1]);
    if (!visible(el)) return false;
    el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    return true;
  }
  const remoteOpen = () => visible($('p11'));
  function showSearch() {
    if (!backdrop) return;
    backdrop.hidden=false; document.body.classList.add('ns-search-open');
    input.value=''; updateResults(); input.focus();
  }
  function closeSearch() {
    if (!backdrop) return;
    backdrop.hidden=true; document.body.classList.remove('ns-search-open');
  }
  function commands() {
    const out=[];
    destinations.forEach((item,index) => {
      const link=$(item[1]);
      if (link && (visible(link) || (mobile() && link.style.display !== 'none' && link.getAttribute('aria-hidden') !== 'true'))) out.push({label:item[0],category:'Workspace',run:()=>workspace(index)});
    });
    tabs.forEach((item,index) => {
      if (visible($(item[1]))) out.push({label:item[0],category:'Current device',run:()=>tab(index)});
    });
    const filter=$('SearchInput');
    if (visible(filter)) out.push({label:'Filter devices',category:'Inventory',run:()=>filter.focus()});
    return out;
  }
  function updateResults() {
    results.replaceChildren();
    const needle=input.value.trim().toLowerCase();
    const matches=commands().filter(c=>(c.label+' '+c.category).toLowerCase().includes(needle));
    if (!matches.length) { results.append(make('p','ns-empty','No matching actions.')); return; }
    matches.forEach(command => {
      const row=button(command.label,'ns-command',()=>{closeSearch();command.run();});
      row.prepend(make('span','ns-command-symbol','↳'));
      row.append(make('small','',command.category));
      results.append(row);
    });
  }
  function installSearch() {
    if ($('ns-search-backdrop')) return;
    backdrop=make('div','ns-search-backdrop');backdrop.id='ns-search-backdrop';backdrop.hidden=true;
    backdrop.addEventListener('mousedown',e=>{if(e.target===backdrop)closeSearch();});
    const panel=make('section','ns-search-panel');
    panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
    panel.setAttribute('aria-label','MeshCentral navigation search');
    const head=make('div','ns-search-head');
    input=make('input','ns-search-input'); input.type='search';input.placeholder='Find a page or action…';
    input.setAttribute('aria-label','Search available navigation actions');
    input.addEventListener('input',updateResults);
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){const item=q('.ns-command',results);if(item){e.preventDefault();item.click();}}
      if(e.key==='Escape'){e.preventDefault();closeSearch();}
    });
    head.append(input,button('×','ns-close',closeSearch,'Close search'));
    results=make('div','ns-search-results');
    panel.append(head,results,make('div','ns-search-note','Only currently available MeshCentral pages are shown.'));
    backdrop.append(panel);document.body.append(backdrop);
    backdrop.addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;
      const controls=[...panel.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(visible);
      if(!controls.length)return;
      if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[controls.length-1].focus();}
      else if(!e.shiftKey&&document.activeElement===controls[controls.length-1]){e.preventDefault();controls[0].focus();}
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!backdrop.hidden){e.preventDefault();closeSearch();return;}
      if(!((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'))return;
      if(e.target&&(e.target.isContentEditable||/^(INPUT|TEXTAREA|SELECT|CANVAS)$/.test(e.target.tagName)))return;
      if(remoteOpen()||visible($('dialog'))||visible(q('.modal.show')))return; // Never take shortcuts during desktop input or dialogs.
      e.preventDefault();backdrop.hidden?showSearch():closeSearch();
    });
    const target=q('#masthead .masthead-right')||$('masthead');
    if(target){const trigger=button('⌕','ns-search-trigger',showSearch,'Search navigation (Ctrl+K)');trigger.id='ns-search-trigger';target.prepend(trigger);}
  }
  function labelRail() {
    destinations.forEach(([label,id])=>{
      const el=$(id);
      if(!el||q('.ns-rail-label',el))return;
      el.title=label;el.setAttribute('aria-label',label);
      el.append(make('span','ns-rail-label',label));
    });
  }
  function installMobileNav() {
    if(!$('ns-mobile-nav')&&$('LeftMenuMyDevices')){
      nav=make('nav','ns-mobile-nav');nav.id='ns-mobile-nav';
      nav.setAttribute('aria-label','Workspace');
      [[0,'Devices','fa-computer'],[2,'Events','fa-calendar-days'],[3,'Files','fa-folder-open'],[1,'Account','fa-user-gear']].forEach(([index,title,glyph])=>{
        const el=button(title,'ns-mobile-nav-item',()=>act(()=>workspace(index),title+' unavailable'));
        const icon=make('i','fa-solid '+glyph);icon.setAttribute('aria-hidden','true');
        el.prepend(icon);
        el.dataset.page=String(destinations[index][2]);nav.append(el);
      });
      const more=button('More','ns-mobile-nav-item',showSearch,'Other pages');
      const moreIcon=make('i','fa-solid fa-ellipsis');moreIcon.setAttribute('aria-hidden','true');
      more.prepend(moreIcon);nav.append(more);
      document.body.append(nav);
    }
  }
  function installDock() {
    if(!$('p11')||$('ns-mobile-dock'))return;
    dock=make('nav','ns-mobile-dock');dock.id='ns-mobile-dock';
    dock.setAttribute('aria-label','Touch remote desktop controls');
    const primary=make('div','ns-dock-row');
    const secondary=make('div','ns-dock-row ns-dock-secondary');
    function add(parent,title,klass,callback,id) {
      const b=button(title,'ns-dock-action '+(klass||''),callback);
      if(id)b.id=id;
      parent.append(b);
    }
    add(primary,'Back','',()=>act(()=>nativeFunction('goBack'),'Cannot navigate back'));
    add(primary,'Connect','ns-positive',()=>act(()=>nativeClick('connectbutton1'),'Agent connection unavailable'),'ns-agent-connect');
    add(primary,'RDP','ns-positive',()=>act(()=>nativeClick('connectbutton1r'),'RDP connection unavailable'),'ns-rdp-connect');
    add(primary,'Disconnect','ns-danger',()=>act(()=>nativeClick('disconnectbutton1'),'No connected session'),'ns-disconnect');
    add(primary,'Trackpad','',()=>act(()=>nativeFunction('deskToggleTrackpad'),'Trackpad unavailable'),'ns-trackpad');
    add(primary,'Keyboard','',()=>act(()=>nativeFunction('toggleMobileKeyboard'),'Keyboard unavailable'),'ns-keyboard');
    add(primary,'Right click','',()=>act(()=>nativeFunction('deskToggleRightClickMode'),'Right-click mode unavailable'),'ns-rightclick');
    add(secondary,'Fit / 1:1','',()=>act(()=>nativeFunction('deskMobileToggleZoom'),'Zoom unavailable'),'ns-zoom');
    add(secondary,'Special keys','',()=>{
      const picker=$('deskkeys');if(picker){picker.focus();return;}
      act(()=>nativeFunction('sendSpecialKeys'),'Special keys unavailable');
    },'ns-keys');
    add(secondary,'Settings','',()=>act(()=>nativeFunction('showDesktopSettings'),'Desktop settings unavailable'));
    add(secondary,'Fullscreen','',()=>act(()=>nativeFunctionWithArg('deskToggleFull',{shiftKey:false}),'Fullscreen unavailable'));
    add(secondary,'Monitors','',()=>act(()=>nativeClick('DeskScreens'),'Monitor selection unavailable'),'ns-monitors');
    add(secondary,'More actions','',()=>act(()=>nativeFunction('deskToggleMobileActions'),'Use the original desktop toolbar'));
    dock.append(primary,secondary);document.body.append(dock);
  }
  function updateNow(){
    const small=mobile(), remote=remoteOpen();
    const authenticated=!!$('LeftMenuMyDevices')&&!document.body.classList.contains('login');
    document.body.classList.toggle('ns-mobile-workspace',small&&!remote&&authenticated);
    document.body.classList.toggle('ns-mobile-remote',small&&remote);
    if(nav) {
      nav.hidden=!(small&&!remote&&authenticated);
      if(!nav.hidden) {
        for(const item of nav.querySelectorAll('[data-page]')) {
          const page=$('p'+item.dataset.page);
          const selected=visible(page);
          item.classList.toggle('ns-active', selected);
          if(selected) item.setAttribute('aria-current','page');
          else item.removeAttribute('aria-current');
        }
      }
    }
    if(dock)dock.hidden=!(small&&remote);
    if(dock&&!dock.hidden){
      const connected=usable($('disconnectbutton1'));
      const c=$('ns-agent-connect'),r=$('ns-rdp-connect'),d=$('ns-disconnect');
      if(c)c.hidden=connected||!usable($('connectbutton1'));
      if(r)r.hidden=connected||!usable($('connectbutton1r'));
      if(d)d.hidden=!connected;
      const t=$('ns-trackpad');
      if(t){t.disabled=!connected||typeof window.deskToggleTrackpad!=='function';t.setAttribute('aria-pressed',window.trackpadMode?'true':'false');}
      const k=$('ns-keyboard');if(k)k.disabled=!connected||typeof window.toggleMobileKeyboard!=='function';
      const z=$('ns-zoom');if(z)z.disabled=!connected||typeof window.deskMobileToggleZoom!=='function';
      const keys=$('ns-keys');if(keys)keys.disabled=!connected;
      const right=$('ns-rightclick');if(right){right.disabled=!connected||typeof window.deskToggleRightClickMode!=='function';right.setAttribute('aria-pressed',window.desktop&&window.desktop.m&&window.desktop.m.SwapMouse?'true':'false');}
      const monitors=$('ns-monitors');if(monitors)monitors.hidden=!usable($('DeskScreens'));
    }
    labelRail();
  }
  function scheduleUpdate(){
    if(refreshScheduled)return;
    refreshScheduled=true;requestAnimationFrame(()=>{refreshScheduled=false;updateNow();});
  }
  function boot(){
    const hasAppContainer=!!$('container');
    const isLoginPage=!!(document.body&&(document.body.classList.contains('login')||$('centralTable')));
    if(!hasAppContainer&&!isLoginPage)return;
    ensureDeviceViewport();
    document.documentElement.classList.add('ns-theme');
    document.body.classList.add('ns-theme');
    // MeshCentral's login2 template has no #container. Theme it, but leave its
    // authentication flow and page controls entirely under the native scripts.
    if(!hasAppContainer)return;
    if(q('link[href*="style-bootstrap"]'))document.documentElement.setAttribute('data-bs-theme','dark');
    installSearch();labelRail();installMobileNav();installDock();updateNow();
    const observer=new MutationObserver(scheduleUpdate);
    ['p11','container','connectbutton1','connectbutton1r','disconnectbutton1','MainSubMenuSpan','page_leftbar'].forEach(name=>{
      const el=$(name);if(el)observer.observe(el,{attributes:true,attributeFilter:['class','style','disabled','hidden']});
    });
    addEventListener('resize',scheduleUpdate,{passive:true});
    addEventListener('orientationchange',scheduleUpdate,{passive:true});
    document.addEventListener('visibilitychange',scheduleUpdate);
    setInterval(()=>{if(document.visibilityState==='visible')scheduleUpdate();},1200);
  }
  window.__nightShiftUI={version:'1.0.0',refresh:scheduleUpdate,search:showSearch};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

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
  var appbar, title, section, status, dashboard, deviceCount, dashboardNote, shortcuts, deviceTools, remoteState;
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
    if (native && typeof native.click === 'function') { native.click(); return true; }
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
    var trail = create('div', 'ns-appbar-trail', 'MESHCENTRAL / LIVE WORKSPACE');
    title = create('h1', 'ns-appbar-title', 'Devices');
    left.append(trail, title);
    var right = create('div', 'ns-appbar-actions');
    status = create('span', 'ns-appbar-state', 'Native MeshCentral');
    right.append(status);
    if (window.__nightShiftUI && typeof window.__nightShiftUI.search === 'function') {
      right.append(button('⌕  Search', 'ns-shell-search', function () {
        window.__nightShiftUI.search();
      }, 'Search MeshCentral pages and actions'));
    }
    var nativeMenu = button('More', 'ns-shell-more', function () {
      document.body.classList.toggle('ns-native-expanded');
      nativeMenu.setAttribute('aria-expanded', document.body.classList.contains('ns-native-expanded') ? 'true' : 'false');
    }, 'Show or hide native navigation and advanced options');
    nativeMenu.setAttribute('aria-expanded', 'false');
    right.append(nativeMenu);
    appbar.append(left, right);
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
    var devices = metric('Rendered device rows', '—', 'From the currently loaded device list');
    deviceCount = devices.output;
    var provenance = metric('Data source', 'Live', 'Your authenticated MeshCentral session');
    var compatibility = metric('Core controls', 'Native', 'Original permissions and transports');
    grid.append(hero, devices.el, provenance.el, compatibility.el);
    var quick = create('div', 'ns-quicklinks');
    quick.append(create('h3', '', 'Workspace shortcuts'));
    shortcuts = create('div', 'ns-shortcut-grid');
    quick.append(shortcuts);
    dashboardNote = create('p', 'ns-dashboard-note',
      'Counts reflect the rendered list, not a server-wide total. No simulated devices or sessions.');
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
    var remote = route === 'Remote desktop';
    document.body.classList.toggle('ns-session-active', remote);
    if (status) status.textContent = remote ? 'Remote controls / live' : 'Native MeshCentral';
    if (deviceCount) {
      var count = countRenderedDevices();
      deviceCount.textContent = count === null ? '—' : String(count);
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
