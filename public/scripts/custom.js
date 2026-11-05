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
  function installRailToggle() {
    const rail = $('page_leftbar');
    const nav = rail && q('nav', rail);
    if (!rail || !nav || $('ns-rail-toggle')) return;
    const toggle = button('›', 'ns-rail-toggle', () => {
      const expanded = !document.body.classList.contains('ns-rail-expanded');
      document.body.classList.toggle('ns-rail-expanded', expanded);
      toggle.textContent = expanded ? '‹' : '›';
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.setAttribute('aria-label', expanded ? 'Collapse navigation' : 'Expand navigation');
      toggle.title = expanded ? 'Collapse navigation' : 'Expand navigation';
    }, 'Expand navigation');
    toggle.id = 'ns-rail-toggle';
    toggle.setAttribute('aria-controls', 'page_leftbar');
    toggle.setAttribute('aria-expanded', 'false');
    nav.before(toggle);
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
      const picker=$('deskkeys');if(picker){picker.focus();picker.click();return;}
      act(()=>nativeFunction('sendSpecialKeys'),'Special keys unavailable');
    },'ns-keys');
    add(secondary,'Send selected key','',()=>act(()=>nativeFunction('deskSendKeys'),'Choose an available key first'),'ns-send-key');
    add(secondary,'Type text','',()=>act(()=>nativeFunction('showDeskType'),'Text entry unavailable'),'ns-type-text');
    add(secondary,'Ctrl+Alt+Del','',()=>act(()=>nativeFunction('sendCAD'),'Shortcut unavailable'),'ns-cad');
    add(secondary,'Escape','',()=>act(()=>nativeFunction('sendDeskEsc'),'Shortcut unavailable'),'ns-escape');
    add(secondary,'Clipboard to remote','',()=>act(()=>nativeFunction('deskClipboardOutFunction'),'Clipboard read is unavailable'),'ns-clipboard-out');
    add(secondary,'Remote clipboard here','',()=>act(()=>nativeFunction('deskClipboardInFunction'),'Remote clipboard is unavailable'),'ns-clipboard-in');
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
      const inputAllowed=connected&&usable($('DeskWD'));
      const keys=$('ns-keys');if(keys)keys.disabled=!inputAllowed;
      ['ns-send-key','ns-type-text','ns-cad','ns-escape'].forEach(id=>{const key=$(id);if(key)key.disabled=!inputAllowed;});
      const type=$('ns-type-text');if(type)type.hidden=!usable($('DeskType'));
      const clipboardOut=$('ns-clipboard-out'),clipboardIn=$('ns-clipboard-in');
      if(clipboardOut){clipboardOut.disabled=!connected;clipboardOut.hidden=!usable($('DeskClipboardOutButton'));}
      if(clipboardIn){clipboardIn.disabled=!connected;clipboardIn.hidden=!usable($('DeskClipboardInButton'));}
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
    installSearch();labelRail();installRailToggle();installMobileNav();installDock();updateNow();
    const observer=new MutationObserver(scheduleUpdate);
    ['p11','container','connectbutton1','connectbutton1r','disconnectbutton1','DeskWD','DeskType','deskkeys','DeskClipboardOutButton','DeskClipboardInButton','MainSubMenuSpan','page_leftbar'].forEach(name=>{
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


/*
 * Night Shift native device inventory adapter. Source of truth is the server-
 * populated window.nodes/window.meshes in default3.handlebars, not demo data.
 * Device opening delegates to gotoDevice(), which retains all upstream checks.
 */
(function () {
  'use strict';
  if (window.__nightShiftDevices) return;
  var $ = function (id) { return document.getElementById(id); };
  var create = function (tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  var mode = 'cards', layout = 'cards', sort = 'reachable', tag = '', state = 'all', term = '', list, grid, toggle, filter, stats, tabs, tagFilter, sortSelect, layoutSelect, lastSignature = '';
  var maxRendered = 150;
  function reachable(node) { return ((Number(node.conn) || 0) & 7) !== 0; }
  function nativeStars() {
    return window.stars && typeof window.stars === 'object' && typeof window.putstore === 'function'
      ? window.stars : null;
  }
  function recentStorageKey() {
    try {
      var userId = window.userinfo && window.userinfo._id;
      var storage = window.localStorage;
      if (typeof userId !== 'string' || !userId || !storage ||
        typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;
      storage.getItem(''); // Confirm storage is readable before offering a nonfunctional filter.
      return 'nightShiftRecentDevices:' + userId;
    } catch (ex) { return null; }
  }
  function readRecentDevices() {
    var key = recentStorageKey();
    if (!key) return [];
    try {
      var items = JSON.parse(window.localStorage.getItem(key) || '[]');
      if (!Array.isArray(items)) return [];
      return items.filter(function (item) {
        return item && typeof item.id === 'string' && Number.isFinite(item.openedAt);
      }).slice(0, 8);
    } catch (ex) { return []; }
  }
  function recordRecentDevice(node) {
    var key = recentStorageKey();
    if (!key) return;
    var items = readRecentDevices().filter(function (item) { return item.id !== node._id; });
    items.unshift({id:node._id,openedAt:Date.now()});
    try { window.localStorage.setItem(key, JSON.stringify(items.slice(0, 8))); } catch (ex) { }
  }
  function isFavorite(node) {
    var favorites = nativeStars();
    return !!(favorites && favorites[node._id] === 1);
  }
  function updateFavoriteButton(node, button) {
    var starred = isFavorite(node);
    button.textContent = starred ? '★' : '☆';
    button.setAttribute('aria-label', (starred ? 'Remove ' : 'Add ') + String(node.name || node.rname || 'device') + (starred ? ' from' : ' to') + ' favorites');
    button.setAttribute('aria-pressed', starred ? 'true' : 'false');
    var favorites = nativeStars();
    button.disabled = !favorites || (!starred && Object.keys(favorites).length >= 200);
    button.title = button.disabled ? 'MeshCentral favorites are unavailable or full' : (starred ? 'Remove from favorites' : 'Add to favorites');
  }
  function toggleFavorite(node, button) {
    var favorites = nativeStars();
    if (!favorites) return;
    if (favorites[node._id] === 1) delete favorites[node._id];
    else {
      if (Object.keys(favorites).length >= 200) return;
      favorites[node._id] = 1;
    }
    window.putstore('stars', JSON.stringify(favorites));
    if (typeof window.updateDeviceViewDevice === 'function') window.updateDeviceViewDevice(node._id);
    updateFavoriteButton(node, button);
    lastSignature = '';
    update();
  }
  function makeSelection(node) {
    var input = create('input','DeviceCheckbox ns-live-selection');
    input.type = 'checkbox';
    input.value = 'devid_' + node._id;
    input.checked = !!(window.checkedNodeids && window.checkedNodeids[node._id]);
    input.disabled = typeof window.p1devcheck !== 'function';
    input.setAttribute('aria-label','Select ' + String(node.name || node.rname || 'Device') + ' for native group actions');
    input.addEventListener('change',function (event) {
      if (typeof window.p1devcheck === 'function') window.p1devcheck(event);
    });
    return input;
  }
  function renderFilterTabs() {
    if (!tabs) return;
    var options = [['all','All']];
    if (recentStorageKey()) options.push(['recent','Recent']);
    if (nativeStars()) options.push(['favorites','Favorites']);
    options.push(['online','Reachable'],['offline','Offline']);
    var changed = tabs.children.length !== options.length;
    for (var i = 0; !changed && i < options.length; i++) {
      if (tabs.children[i].dataset.filter !== options[i][0]) changed = true;
    }
    if (changed) {
      tabs.replaceChildren();
      options.forEach(function (entry) {
        var button = create('button','ns-live-filter-tab',entry[1]);
        button.type = 'button';
        button.dataset.filter = entry[0];
        button.addEventListener('click',function () { state = entry[0]; update(); });
        tabs.append(button);
      });
      if (!options.some(function (entry) { return entry[0] === state; })) state = 'all';
    }
    for (var j = 0; j < tabs.children.length; j++) {
      var active = tabs.children[j].dataset.filter === state;
      tabs.children[j].classList.toggle('active',active);
      tabs.children[j].setAttribute('aria-pressed',active ? 'true' : 'false');
    }
  }
  function inventory() {
    if (!Array.isArray(window.nodes)) return null;
    // node.v is MeshCentral's currently visible/filter-matched flag.
    return window.nodes.filter(function (node) { return node && node.v !== false; });
  }
  function supportsView() {
    var select = $('viewselect'), view = select && String(select.value);
    return !view || view === '1' || view === '2';
  }
  function useCards(on) {
    var ready = inventory() !== null && supportsView();
    var enabled = !!on && ready;
    document.body.classList.toggle('ns-cards-enabled', enabled);
    document.body.classList.toggle('ns-inventory-table', enabled && layout === 'table');
    document.body.classList.toggle('ns-inventory-compact', enabled && layout === 'compact');
    if (list) list.hidden = !ready;
    if (grid) grid.hidden = !enabled;
    if (filter && filter.parentNode) filter.parentNode.hidden = !enabled;
    if (toggle) {
      toggle.textContent = enabled ? 'Original list' : 'Night Shift cards';
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      toggle.disabled = !ready;
    }
  }
  function open(node, event) {
    // No new navigation or access controls. The upstream handler is authoritative.
    if (typeof window.gotoDevice === 'function') {
      recordRecentDevice(node);
      window.gotoDevice(node._id, 10, false, event);
    }
  }
  function makeCard(node) {
    var name = String(node.name || node.rname || 'Device');
    var group = window.meshes && window.meshes[node.meshid];
    var groupName = group && group.name ? String(group.name) : 'Device group unavailable';
    var online = reachable(node);
    var os = node.osdesc || node.osd || '';
    var frame = create('article', 'ns-live-device-frame');
    var card = create('button', 'ns-live-device');
    card.type = 'button';
    card.setAttribute('aria-label', 'Open ' + name + ' in MeshCentral');
    card.addEventListener('click', function (event) { open(node, event); });
    var favorite = create('button', 'ns-live-favorite');
    favorite.type = 'button';
    updateFavoriteButton(node, favorite);
    favorite.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(node, favorite);
    });
    var top = create('span', 'ns-live-device-top');
    var icon = create('span', 'ns-live-device-icon', node.agent && node.agent.id ? '▣' : '◇');
    icon.setAttribute('aria-hidden', 'true');
    var badge = create('span', 'ns-live-status ' + (online ? 'online' : 'offline'),
      online ? 'Reachable' : 'Offline');
    top.append(icon, badge);
    var identity = create('span', 'ns-live-device-name', name);
    var description = create('span', 'ns-live-device-subtitle', groupName);
    var bottom = create('span', 'ns-live-device-foot');
    bottom.append(create('span', '', os ? String(os) : 'Device details'));
    bottom.append(create('span', 'ns-live-device-open', 'Open ↗'));
    card.append(top, identity, description, bottom);
    var tags = makeTags(node);
    if (tags.children.length) card.append(tags);
    frame.append(card, makeSelection(node), favorite);
    return frame;
  }
  function makeTags(node) {
    var wrap = create('span','ns-live-tags');
    var values = Array.isArray(node.tags) ? node.tags.filter(function (value) { return typeof value === 'string' && value; }) : [];
    values.slice(0,4).forEach(function (value) { wrap.append(create('span','ns-live-tag',value)); });
    if (values.length > 4) wrap.append(create('span','ns-live-tag ns-live-tag-more','+' + (values.length - 4)));
    return wrap;
  }
  function makeCompact(node) {
    var row = create('div','ns-live-compact-row');
    var openButton = create('button','ns-live-compact-open');
    openButton.type = 'button';
    openButton.setAttribute('aria-label','Open ' + String(node.name || node.rname || 'Device') + ' in MeshCentral');
    openButton.addEventListener('click',function (event) { open(node,event); });
    openButton.append(create('span','ns-live-compact-status ' + (reachable(node) ? 'online' : 'offline')));
    openButton.append(create('span','ns-live-compact-name',String(node.name || node.rname || 'Device')));
    var group = window.meshes && window.meshes[node.meshid];
    openButton.append(create('span','ns-live-compact-group',group && group.name ? String(group.name) : 'Device group unavailable'));
    var tags = makeTags(node);
    if (tags.children.length) openButton.append(tags);
    var selection = makeSelection(node);
    var favorite = create('button','ns-live-favorite');
    favorite.type = 'button'; updateFavoriteButton(node,favorite);
    favorite.addEventListener('click',function (event) { event.preventDefault();event.stopPropagation();toggleFavorite(node,favorite); });
    row.append(selection,openButton,favorite);
    return row;
  }
  function makeTable(nodes) {
    var wrap = create('div','ns-live-table-wrap');
    var table = create('table','ns-live-table');
    table.setAttribute('aria-label','Managed device inventory');
    var thead = create('thead'), header = create('tr');
    ['Select','Device','Group','Status','Operating system','Tags','Favorite'].forEach(function (label) { var th=create('th','',label);th.setAttribute('scope','col');header.append(th); });
    thead.append(header);
    var tbody = create('tbody');
    nodes.forEach(function (node) {
      var row = create('tr'), selectionCell = create('td'), nameCell = create('td'), groupCell = create('td'), statusCell = create('td'), osCell = create('td'), tagsCell = create('td'), favoriteCell = create('td');
      selectionCell.append(makeSelection(node));
      var openButton = create('button','ns-live-table-open',String(node.name || node.rname || 'Device'));
      openButton.type = 'button'; openButton.addEventListener('click',function (event) { open(node,event); });
      nameCell.append(openButton);
      var group = window.meshes && window.meshes[node.meshid];
      groupCell.textContent = group && group.name ? String(group.name) : 'Device group unavailable';
      statusCell.append(create('span','ns-live-status ' + (reachable(node) ? 'online' : 'offline'),reachable(node) ? 'Reachable' : 'Offline'));
      osCell.textContent = String(node.osdesc || node.osd || '—');
      tagsCell.append(makeTags(node));
      var favorite = create('button','ns-live-favorite'); favorite.type = 'button'; updateFavoriteButton(node,favorite);
      favorite.addEventListener('click',function (event) { event.preventDefault();event.stopPropagation();toggleFavorite(node,favorite); });
      favoriteCell.append(favorite);
      row.append(selectionCell,nameCell,groupCell,statusCell,osCell,tagsCell,favoriteCell); tbody.append(row);
    });
    table.append(thead,tbody); wrap.append(table);
    return wrap;
  }
  function refreshTags(nodes) {
    if (!tagFilter) return;
    var values = [];
    nodes.forEach(function (node) {
      if (Array.isArray(node.tags)) node.tags.forEach(function (value) { if (typeof value === 'string' && value && values.indexOf(value) < 0) values.push(value); });
    });
    values.sort(function (a,b) { return a.localeCompare(b); });
    if (tagFilter.children.length !== values.length + 1 || values.some(function (value,index) { return tagFilter.children[index + 1].value !== value; })) {
      var selected = tag;
      tagFilter.replaceChildren();
      var allOption = create('option','','All tags'); allOption.value = ''; tagFilter.append(allOption);
      values.forEach(function (value) { var option = create('option','',value); option.value = value; tagFilter.append(option); });
      tagFilter.value = values.indexOf(selected) >= 0 ? selected : '';
      tag = tagFilter.value;
    }
  }
  function update() {
    if (!list) return;
    renderFilterTabs();
    var native = inventory();
    if (native === null) { useCards(false); return; }
    var all = native.slice().sort(function (a,b) {
      var s = Number(reachable(b)) - Number(reachable(a));
      return s || String(a.name || '').localeCompare(String(b.name || ''));
    });
    refreshTags(all);
    var recent = readRecentDevices(), recentPositions = Object.create(null);
    recent.forEach(function (item,index) { recentPositions[item.id] = index; });
    var onlineCount = all.filter(reachable).length;
    var view = all.filter(function (node) {
      if (state === 'recent' && typeof recentPositions[node._id] === 'undefined') return false;
      if (state === 'favorites' && !isFavorite(node)) return false;
      if (state === 'online' && !reachable(node)) return false;
      if (state === 'offline' && reachable(node)) return false;
      if (tag && (!Array.isArray(node.tags) || node.tags.indexOf(tag) < 0)) return false;
      if (!term) return true;
      var group = window.meshes && window.meshes[node.meshid];
      var haystack = [node.name,node.rname,node.osdesc,group && group.name]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
    if (state === 'recent' || sort === 'recent') {
      view.sort(function (a,b) {
        var ap = Object.prototype.hasOwnProperty.call(recentPositions,a._id) ? recentPositions[a._id] : Number.MAX_SAFE_INTEGER;
        var bp = Object.prototype.hasOwnProperty.call(recentPositions,b._id) ? recentPositions[b._id] : Number.MAX_SAFE_INTEGER;
        return ap - bp || String(a.name || '').localeCompare(String(b.name || ''));
      });
    } else if (sort === 'name') {
      view.sort(function (a,b) { return String(a.name || a.rname || '').localeCompare(String(b.name || b.rname || '')); });
    } else if (sort === 'group') {
      view.sort(function (a,b) {
        var ga = window.meshes && window.meshes[a.meshid], gb = window.meshes && window.meshes[b.meshid];
        return String(ga && ga.name || '').localeCompare(String(gb && gb.name || '')) || String(a.name || '').localeCompare(String(b.name || ''));
      });
    } else if (sort === 'status') {
      view.sort(function (a,b) { return Number(reachable(b)) - Number(reachable(a)) || String(a.name || '').localeCompare(String(b.name || '')); });
    }
    var favorites = nativeStars();
    var selected = window.checkedNodeids && typeof window.checkedNodeids === 'object' ? Object.keys(window.checkedNodeids).sort().join(',') : '';
    var signature = [mode,layout,sort,tag,state,term,all.length,onlineCount,selected,favorites ? Object.keys(favorites).length : -1,
      recent.map(function (item) { return item.id + ':' + item.openedAt; }).join(','),supportsView(),
      view.slice(0,maxRendered).map(function (n) { return [n._id,n.name,n.conn,n.meshid,n.osdesc,isFavorite(n) ? 1 : 0].join(':'); }).join('|')].join('::');
    if (signature !== lastSignature) {
      lastSignature = signature;
      grid.replaceChildren();
      var rendered = view.slice(0,maxRendered);
      if (layout === 'table') grid.append(makeTable(rendered));
      else rendered.forEach(function (node) { grid.append(layout === 'compact' ? makeCompact(node) : makeCard(node)); });
      if (!view.length) grid.append(create('div','ns-live-empty',state === 'recent'
        ? 'No recent devices yet. Open a device to add it here.'
        : 'No devices match the selected filters.'));
      stats.textContent = all.length + ' loaded · ' + Math.min(view.length,maxRendered) + ' shown · ' + onlineCount + ' reachable · ' +
        (all.length - onlineCount) + ' offline' +
        (view.length > maxRendered ? ' · First ' + maxRendered + ' matches' : '');
    }
    useCards(mode === 'cards');
  }
  function boot() {
    var nativeList = $('xdevices');
    if (!nativeList || !nativeList.parentNode || !$('p1') || !$('LeftMenuMyDevices')) return;
    if ($('ns-live-inventory')) return;
    list = create('section', 'ns-live-inventory'); list.id = 'ns-live-inventory';
    list.setAttribute('aria-label','Live device inventory');
    var header = create('div', 'ns-live-inventory-header');
    var heading = create('div');
    heading.append(create('span','ns-eyebrow','LIVE INVENTORY'),create('h2','','Managed devices'));
    stats = create('p','ns-live-inventory-stats','Loading device state from MeshCentral…');
    heading.append(stats);
    toggle = create('button','ns-shell-more','Original list');toggle.type='button';
    toggle.addEventListener('click',function () {
      mode = mode === 'cards' ? 'native' : 'cards';
      update();
    });
    header.append(heading,toggle);
    var controls = create('div','ns-live-controls');
    filter = create('input','ns-live-filter');filter.type='search';filter.placeholder='Search name, OS or device group';
    filter.setAttribute('aria-label','Filter Night Shift device cards');
    filter.addEventListener('input',function () { term=filter.value.trim().toLowerCase();update(); });
    tabs = create('div','ns-live-tabs');tabs.setAttribute('role','group');
    tabs.setAttribute('aria-label','Filter devices by connection state');
    renderFilterTabs();
    tagFilter=create('select','ns-live-select');tagFilter.dataset.control='tag';tagFilter.setAttribute('aria-label','Filter by device tag');
    sortSelect=create('select','ns-live-select');sortSelect.dataset.control='sort';sortSelect.setAttribute('aria-label','Sort devices');
    [['reachable','Reachable first'],['name','Name'],['group','Group'],['status','Status'],['recent','Recently opened']].forEach(function (entry) { var option=create('option','',entry[1]);option.value=entry[0];sortSelect.append(option); });
    sortSelect.value=sort;
    sortSelect.addEventListener('change',function () { sort=sortSelect.value;update(); });
    tagFilter.addEventListener('change',function () { tag=tagFilter.value;update(); });
    layoutSelect=create('select','ns-live-select');layoutSelect.dataset.control='layout';layoutSelect.setAttribute('aria-label','Device layout');
    [['cards','Cards'],['table','Table'],['compact','Compact']].forEach(function (entry) { var option=create('option','',entry[1]);option.value=entry[0];layoutSelect.append(option); });
    layoutSelect.value=layout;
    layoutSelect.addEventListener('change',function () { layout=layoutSelect.value;update(); });
    controls.append(filter,tabs,tagFilter,sortSelect,layoutSelect);
    grid=create('div','ns-live-grid');
    list.append(header,controls,grid);
    nativeList.parentNode.insertBefore(list,nativeList);
    update();
    setInterval(function () {
      if (document.visibilityState === 'visible') update();
    },1800);
  }
  window.__nightShiftDevices = {version:'2.0.0',refresh:update};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
/* Night Shift remote-session diagnostics. Native MeshCentral handlers remain authoritative. */
(function () {
  'use strict';
  if (window.__NightShiftDiagnostics) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, rows = {}, actionButton, guidance, queued = false;
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
        var visible = !!target && !target.disabled && target.getAttribute('aria-disabled') !== 'true' &&
          !!(target.getClientRects && target.getClientRects().length);
        for (var parent = target && (target.parentElement || target.parentNode); visible && parent; parent = parent.parentElement || parent.parentNode) {
          var style = getComputedStyle(parent);
          if (parent.hidden || style.display === 'none' || style.visibility === 'hidden') visible = false;
        }
        if (visible) {
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
    if (desktop.webRtcActive) transport += ' · WebRTC';
    var state = Number.isInteger(desktop.State) ? desktop.State : desktop.state;
    return transport + ' · ' + (stateNames[state] || 'State unavailable');
  }
  function update() {
    build();
    if (!panel || !rows.browser) return;
    var browser = window.navigator && typeof window.navigator.onLine === 'boolean'
      ? (window.navigator.onLine ? 'Online' : 'Offline') : 'Unknown';
    var socket = window.meshserver && window.meshserver.State;
    rows.browser.textContent = browser;
    rows.control.textContent = typeof socket === 'number' ? (socket === 2 ? 'Connected' : 'Disconnected') : 'Unknown';
    rows.device.textContent = routeStatus(window.currentNode);
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
      else if (route !== null && (route & 15) === 0) next = 'No Agent or AMT route is currently reported for this device. Check that it is online, then use the native Connect controls.';
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
  function boot() {
    if (!$('p11') || !$('deskarea0')) return;
    build();
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
/* Night Shift tabs over existing MeshCentral multi-desktop sessions. */
(function () {
  'use strict';
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
/* Per-device connection preferences layered over native MeshCentral controls. */
(function () {
  'use strict';
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
/* Search only the events and recordings MeshCentral has already rendered. */
(function () {
  'use strict';
  if (window.__NightShiftHistory) return;
  var $ = function (id) { return document.getElementById(id); };
  var fields = {};
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function addSearch(pageId, titleId, key, label) {
    var host = $(titleId), page = $(pageId);
    if (!host || !page || fields[key]) return;
    var wrap = create('label', 'ns-history-search');
    wrap.append(create('span', '', label));
    var input = create('input', 'form-control form-control-sm');
    input.type = 'search'; input.autocomplete = 'off'; input.setAttribute('aria-label', label);
    input.setAttribute('placeholder', 'Search loaded records');
    input.addEventListener('input', function () { filter(key); });
    wrap.append(input); host.append(wrap); fields[key] = input;
  }
  function matches(element, query) {
    return !query || (element.textContent || '').toLocaleLowerCase().includes(query);
  }
  function filterEvents(query) {
    var root = $('p3events'); if (!root) return;
    var tables = root.querySelectorAll('table.p3eventsTable');
    tables.forEach(function (table) {
      var rows = table.querySelectorAll('tr');
      rows.forEach(function (row) {
        if (row.querySelector('td[colspan]')) return;
        var eventRow = row.querySelectorAll('td').length >= 3;
        if (!eventRow) return;
        var show = matches(row, query); row.hidden = !show;
        var spacer = row.nextElementSibling;
        if (spacer && spacer.querySelectorAll('td').length === 0) spacer.hidden = !show;
      });
    });
  }
  function filterRecordings(query) {
    var root = $('p52recordings'); if (!root) return;
    root.querySelectorAll('tbody tr').forEach(function (row) {
      if (row.querySelectorAll('td').length < 2) return;
      row.hidden = !matches(row, query);
    });
  }
  function filter(key) {
    var input = fields[key]; if (!input) return;
    var query = input.value.trim().toLocaleLowerCase();
    if (key === 'events') filterEvents(query); else filterRecordings(query);
  }
  function install() {
    addSearch('p3', 'p3title', 'events', 'Search events');
    addSearch('p52', 'p52title', 'recordings', 'Search recordings');
    filter('events'); filter('recordings');
  }
  function boot() {
    install();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(install);
      ['p3','p52'].forEach(function (id) { var target = $(id); if (target) observer.observe(target, {childList:true, subtree:true}); });
    }
    if (window.addEventListener) window.addEventListener('resize', install, {passive:true});
  }
  window.__NightShiftHistory = { refresh:install };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
/* Native file workspace enhancements: local filter and selection inspector. */
(function () {
  'use strict';
  if (window.__NightShiftFiles) return;
  var $ = function (id) { return document.getElementById(id); };
  var search, inspector, detail, actions = [];
  var uploadObserver, transferQueue, transferStatus, transferList, lastQueueIndex = null;
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function size(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return 'Unavailable';
    var units = ['B','KB','MB','GB','TB'], i = 0, value = bytes;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return value.toFixed(i ? 1 : 0) + ' ' + units[i];
  }
  function filter() {
    var root = $('p13files'); if (!root || !search) return;
    var q = search.value.trim().toLocaleLowerCase();
    root.querySelectorAll('.filelist').forEach(function (entry) {
      entry.hidden = !!q && !(entry.textContent || '').toLocaleLowerCase().includes(q);
    });
  }
  function actionButton(container, id, label) {
    var native = $(id); if (!native) return;
    var button = create('button','ns-file-action',label); button.type = 'button';
    button.disabled = !!native.disabled;
    button.addEventListener('click', function () { if (!native.disabled && native.click) native.click(); });
    actions.push({ button:button, native:native });
    container.append(button);
  }
  function update() {
    filter();
    actions.forEach(function (item) { item.button.disabled = !item.native || !!item.native.disabled; });
    if (!inspector || !detail) return;
    var tree = window.p13filetree, selected = $('p13files') && $('p13files').querySelectorAll('input[name="fd"]:checked');
    detail.replaceChildren();
    if (!tree || !selected || !selected.length) {
      detail.append(create('p','ns-file-empty',tree ? 'Select a file to inspect its details.' : 'Connect to a device to browse files.'));
      return;
    }
    detail.append(create('strong','ns-file-selection-count',selected.length + (selected.length === 1 ? ' item selected' : ' items selected')));
    if (selected.length !== 1) {
      detail.append(create('p','ns-file-empty','Select one item to view its name, type, size and modified time.'));
      return;
    }
    var item = tree.dir && tree.dir[selected[0].value];
    if (!item) { detail.append(create('p','ns-file-empty','Details are unavailable for this item.')); return; }
    detail.append(create('h4','ns-file-name',item.n || 'Unnamed item'));
    detail.append(create('div','ns-file-meta',(item.t < 3 ? 'Folder' : 'File')));
    detail.append(create('div','ns-file-meta','Size: ' + (item.t < 3 ? '—' : size(item.s))));
    detail.append(create('div','ns-file-meta','Modified: ' + (item.d ? new Date(typeof item.d === 'number' ? item.d * 1000 : item.d).toLocaleString() : 'Unavailable')));
  }
  function updateUploadQueue() {
    var upload = window.uploadFile;
    if (!upload || !upload.xfiles || typeof upload.xfiles.length !== 'number' || !upload.xfiles.length) {
      if (transferQueue) transferQueue.remove();
      transferQueue = transferStatus = transferList = null;
      lastQueueIndex = null;
      return;
    }
    var body = $('xxAddAgentBody') || (document.querySelector && document.querySelector('#xxAddAgentModal .modal-body'));
    var progress = $('d2progressLabel');
    if (!body || !progress) return;
    if (!transferQueue) {
      transferQueue = create('section','ns-transfer-queue');
      transferQueue.setAttribute('aria-label','Upload queue');
      transferStatus = create('p','ns-transfer-status');
      transferStatus.setAttribute('aria-live','polite');
      transferStatus.setAttribute('aria-atomic','true');
      transferList = create('ol','ns-transfer-list');
      transferQueue.append(transferStatus,transferList);
      progress.insertAdjacentElement('afterend',transferQueue);
    }
    var index = Math.max(0, Math.min(upload.xfiles.length - 1, Number(upload.xfilePtr) || 0));
    var current = upload.xfiles[index];
    var nativeName = $('p13dfileName');
    var name = nativeName && nativeName.textContent || (current && current.name) || 'Current file';
    var percent = $('d2progressBar');
    var progressText = $('d2progressLabel');
    var amount = percent && Number(percent.max) > 0 ? Math.floor((Number(percent.value) / Number(percent.max)) * 100) : null;
    var state = progressText && progressText.textContent || '';
    var currentProgress = amount === null ? state : Math.max(0,Math.min(100,amount)) + '%';
    var statusText = 'File ' + (index + 1) + ' of ' + upload.xfiles.length + ': ' + name + ' · ' + currentProgress;
    if (transferStatus.textContent !== statusText) transferStatus.textContent = statusText;
    if (lastQueueIndex !== index || transferList.childElementCount !== upload.xfiles.length) {
      transferList.replaceChildren();
      Array.prototype.forEach.call(upload.xfiles,function (file, fileIndex) {
        var item = create('li','ns-transfer-item');
        var fileName = create('span','ns-transfer-name',file && file.name || 'Unnamed file');
        var stateLabel = fileIndex < index ? 'Sent' : fileIndex === index ? 'Current' : 'Queued';
        item.append(fileName,create('span','ns-transfer-state',stateLabel));
        if (fileIndex === index) item.setAttribute('aria-current','true');
        transferList.append(item);
      });
      lastQueueIndex = index;
    }
  }
  function watchUploadQueue() {
    var body = $('xxAddAgentBody') || (document.querySelector && document.querySelector('#xxAddAgentModal .modal-body'));
    if (!body || typeof MutationObserver !== 'function' || uploadObserver) return;
    uploadObserver = new MutationObserver(updateUploadQueue);
    uploadObserver.observe(body,{childList:true,subtree:true,characterData:true});
    var modal = $('xxAddAgentModal');
    if (modal) uploadObserver.observe(modal,{attributes:true,attributeFilter:['class','aria-hidden']});
    updateUploadQueue();
  }
  function build() {
    var page = $('p13'), title = $('p13title'), list = $('p13filetable');
    if (!page || !title || !list) return;
    if (!search) {
      var label = create('label','ns-file-search'); label.append(create('span','','Filter current folder'));
      search = create('input','form-control form-control-sm'); search.type = 'search';
      search.setAttribute('aria-label','Filter current folder'); search.setAttribute('placeholder','Name or type');
      search.addEventListener('input',update); label.append(search); title.append(label);
    }
    if (!inspector) {
      inspector = create('aside','ns-file-inspector'); inspector.setAttribute('aria-label','File selection details');
      inspector.append(create('h3','','Selection details'));
      detail = create('div','ns-file-inspector-content'); inspector.append(detail);
      var actions = create('div','ns-file-actions');
      actionButton(actions,'p13DownloadButton','Download'); actionButton(actions,'p13RenameFileButton','Rename');
      actionButton(actions,'p13DeleteFileButton','Delete'); inspector.append(actions);
      list.classList.add('ns-file-layout'); list.append(inspector);
    }
    update();
  }
  function boot() {
    build();
    watchUploadQueue();
    var dropTarget = $('p13filetable');
    if (dropTarget) {
      dropTarget.addEventListener('dragover',function (event) {
        var upload = $('p13UploadButton');
        if (event.dataTransfer && event.dataTransfer.types && Array.prototype.indexOf.call(event.dataTransfer.types,'Files') >= 0 && upload && !upload.disabled) {
          event.preventDefault(); dropTarget.classList.add('ns-file-drop-active');
        }
      });
      dropTarget.addEventListener('dragleave',function (event) {
        if (!event.relatedTarget || !dropTarget.contains(event.relatedTarget)) dropTarget.classList.remove('ns-file-drop-active');
      });
      dropTarget.addEventListener('drop',function (event) {
        dropTarget.classList.remove('ns-file-drop-active');
        var upload = $('p13UploadButton'), dropped = event.dataTransfer && event.dataTransfer.files;
        if (!upload || upload.disabled || !dropped || !dropped.length || typeof window.p13doUploadFiles !== 'function') return;
        event.preventDefault();
        window.p13doUploadFiles(dropped);
      });
    }
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(build);
      var target = $('p13files');
      if (target) observer.observe(target,{childList:true,subtree:true});
    }
    if (document.addEventListener) document.addEventListener('change',function (event) { if (event.target && event.target.name === 'fd') update(); });
    if (window.addEventListener) window.addEventListener('resize',build,{passive:true});
  }
  window.__NightShiftFiles = { refresh:update };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
/* Permission-aware shortcuts into MeshCentral's audited native action dialog. */
(function () {
  'use strict';
  if (window.__NightShiftActions) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, status, power, commands;
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function hasRights(rights, mask) { return typeof rights === 'number' && (rights & mask) !== 0; }
  function availability() {
    var node = window.currentNode;
    if (!node || typeof window.GetNodeRights !== 'function') return {power:false,commands:false};
    var rights = window.GetNodeRights(node), conn = Number(node.conn) || 0;
    if (node.agent && node.agent.id === 14) return {power:!!((conn & 1) && hasRights(rights,8)),commands:false};
    var canCommand = node.mtype === 2 && !!(conn & 1) && hasRights(rights,131072) && node.agent != null;
    var canPower = hasRights(rights,64) || (conn !== 0 && hasRights(rights,262144)) ||
      ((conn & 16) !== 0) || (hasRights(rights,32768) && (conn & 1) !== 0) ||
      (!!node.intelamt && node.intelamt.state === 2 && (conn & 6) !== 0 && (hasRights(rights,64) || hasRights(rights,262144)));
    return {power:canPower,commands:canCommand};
  }
  function update() {
    var host = $('p10'), anchor = $('p10info') || $('p10title');
    if (!host || !anchor) return;
    if (!panel) {
      panel = create('section','ns-native-actions'); panel.id = 'ns-native-actions';
      panel.setAttribute('aria-label','Native device actions');
      panel.append(create('h3','','Quick actions'));
      status = create('p','ns-native-actions-status','Actions are checked against current MeshCentral device permissions.');
      panel.append(status);
      var row = create('div','ns-native-actions-row');
      power = create('button','ns-native-action','Device actions'); power.type = 'button';
      power.addEventListener('click',function () { if (availability().power && typeof window.deviceActionFunction === 'function') window.deviceActionFunction(); });
      commands = create('button','ns-native-action','Run command'); commands.type = 'button';
      commands.addEventListener('click',function () { if (availability().commands && typeof window.runDeviceCmd === 'function') window.runDeviceCmd(); });
      row.append(power,commands); panel.append(row);
      if (anchor.parentNode === host) host.insertBefore(panel,anchor); else host.insertBefore(panel,host.firstChild);
    }
    var allowed = availability();
    power.disabled = !allowed.power;
    commands.disabled = !allowed.commands || typeof window.runDeviceCmd !== 'function';
    status.textContent = allowed.power || allowed.commands ?
      'Available actions open MeshCentral’s native confirmation and audit flow.' :
      'No power or command actions are available for this device with the current connection and permissions.';
  }
  function boot() {
    if (!$('p10')) return;
    update();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(update);
      ['p10info','p10title','p10html3','p10html5','MainComputerState'].forEach(function (id) {
        var target = $(id); if (target) observer.observe(target,{attributes:true,childList:true,subtree:true});
      });
    }
  }
  window.__NightShiftActions = {refresh:update};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
/* Opt-in connection alerts for the currently open authorized device. */
(function () {
  'use strict';
  if (window.__NightShiftAlerts) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, enabled, metricEnabled, storageEnabled, cpuLimit, memoryLimit, storageLimit, quietStart, quietEnd, status, activeNode = null, lastState = null, lastNotices = {}, overThreshold = {};
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function key(node) { return 'nsAlerts.' + node._id; }
  function load(node) {
    try { return JSON.parse(window.getstore(key(node), '{}')); } catch (e) { return {}; }
  }
  function save() {
    if (!activeNode || typeof window.putstore !== 'function') return;
    window.putstore(key(activeNode), JSON.stringify({e:enabled.checked?1:0,m:metricEnabled.checked?1:0,c:cpuLimit.value,r:memoryLimit.value,s:quietStart.value,t:quietEnd.value}));
    window.putstore('nsAlertsS.' + activeNode,JSON.stringify({b:storageEnabled.checked?1:0,f:storageLimit.value}));
  }
  function addTimeControl(host, label, id) {
    var wrap = create('label','ns-alert-time'); wrap.append(create('span','',label));
    var input = create('input','form-control form-control-sm'); input.id = id; input.type = 'time';
    input.addEventListener('change',function () { save(); }); wrap.append(input); host.append(wrap); return input;
  }
  function build() {
    var host = $('p10info'), anchor = $('p10html2');
    if (!host || panel) return;
    panel = create('section','ns-alert-panel'); panel.id = 'ns-connection-alerts';
    panel.setAttribute('aria-label','Connection alert settings');
    panel.append(create('h3','','Connection alerts'));
    var toggle = create('label','ns-alert-toggle'); enabled = create('input',''); enabled.type = 'checkbox';
    enabled.addEventListener('change',function () {
      if (enabled.checked && window.Notification && window.Notification.permission === 'default') {
        window.Notification.requestPermission().then(function () { save(); });
      } else save();
    });
    toggle.append(enabled,create('span','','Notify when this device connection changes')); panel.append(toggle);
    var metricToggle = create('label','ns-alert-toggle'); metricEnabled = create('input',''); metricEnabled.type = 'checkbox';
    metricEnabled.addEventListener('change',function () {
      if (metricEnabled.checked && window.Notification && window.Notification.permission === 'default') window.Notification.requestPermission().then(save);
      else save();
    });
    metricToggle.append(metricEnabled,create('span','','Notify when CPU or memory crosses its threshold')); panel.append(metricToggle);
    var storageToggle = create('label','ns-alert-toggle'); storageEnabled = create('input',''); storageEnabled.type = 'checkbox';
    storageEnabled.addEventListener('change',function () {
      if (storageEnabled.checked && window.Notification && window.Notification.permission === 'default') window.Notification.requestPermission().then(save);
      else save();
    });
    storageToggle.append(storageEnabled,create('span','','Notify when Windows volume free space falls below threshold')); panel.append(storageToggle);
    var thresholds = create('div','ns-alert-times');
    function numberControl(label,id,value) {
      var wrap = create('label','ns-alert-time'); wrap.append(create('span','',label));
      var input = create('input','form-control form-control-sm'); input.id = id; input.type = 'number'; input.min = '1'; input.max = '100'; input.step = '1'; input.value = value;
      input.addEventListener('change',save); wrap.append(input); thresholds.append(wrap); return input;
    }
    cpuLimit = numberControl('CPU threshold (%)','ns-alert-cpu-limit','85');
    memoryLimit = numberControl('Memory threshold (%)','ns-alert-memory-limit','90');
    storageLimit = numberControl('Free space threshold (%)','ns-alert-storage-limit','15');
    panel.append(thresholds);
    var times = create('div','ns-alert-times');
    quietStart = addTimeControl(times,'Quiet hours start','ns-alert-quiet-start');
    quietEnd = addTimeControl(times,'Quiet hours end','ns-alert-quiet-end');
    panel.append(times);
    status = create('p','ns-alert-status','Alerts watch connection changes while this MeshCentral page is open.');
    status.setAttribute('aria-live','polite'); panel.append(status);
    if (anchor && anchor.parentNode === host) host.insertBefore(panel,anchor.nextSibling);
    else host.append(panel);
  }
  function hydrate(node) {
    if (!enabled) return;
    var prefs = load(node);
    var storagePrefs = {};
    try { storagePrefs = JSON.parse(window.getstore('nsAlertsS.' + node._id,'{}')); } catch (e) { }
    enabled.checked = prefs.e === 1;
    metricEnabled.checked = prefs.m === 1;
    storageEnabled.checked = storagePrefs.b === 1;
    cpuLimit.value = prefs.c || '85'; memoryLimit.value = prefs.r || '90';
    storageLimit.value = storagePrefs.f || '15';
    quietStart.value = typeof prefs.s === 'string' ? prefs.s : '';
    quietEnd.value = typeof prefs.t === 'string' ? prefs.t : '';
  }
  function quietNow(date) {
    var start = quietStart && quietStart.value, end = quietEnd && quietEnd.value;
    if (!start || !end || start === end) return false;
    var now = date.getHours() * 60 + date.getMinutes();
    var toMinutes = function (v) { var p = v.split(':'); return (+p[0] * 60) + (+p[1]); };
    var a = toMinutes(start), b = toMinutes(end);
    return a < b ? (now >= a && now < b) : (now >= a || now < b);
  }
  function state(node) {
    var conn = Number(node && node.conn);
    if (!isFinite(conn)) return 'unknown';
    var routes = [];
    if (conn & 1) routes.push('agent');
    if (conn & 2) routes.push('amt-cira');
    if (conn & 4) routes.push('amt');
    if (conn & 8) routes.push('relay');
    if (conn & 16) routes.push('mqtt');
    return routes.join('+') || 'offline';
  }
  function announce(node, current) {
    var now = new Date(), dedupeKey = node._id + '|' + current;
    var label = (node.name || node.rname || 'Device') + ' connection: ' + current.split('+').join(' / ');
    notify(node,dedupeKey,label,enabled.checked,now);
  }
  function notify(node,dedupeKey,label,allowed,now) {
    if (!allowed || quietNow(now) || (lastNotices[dedupeKey] && now.getTime() - lastNotices[dedupeKey] < 300000)) return;
    lastNotices[dedupeKey] = now.getTime();
    status.textContent = label;
    if (window.Notification && window.Notification.permission === 'granted') {
      try { new window.Notification('MeshCentral connection changed',{body:label,tag:dedupeKey}); } catch (e) { }
    }
  }
  function sample(event) {
    var value = event && event.detail, node = window.currentNode;
    if (!metricEnabled || !metricEnabled.checked || !value || !node || value.nodeid !== node._id) return;
    var cpu = typeof value.cpu === 'number' && value.cpu >= Number(cpuLimit.value);
    var memory = typeof value.memory === 'number' && value.memory >= Number(memoryLimit.value);
    var now = new Date(), name = node.name || node.rname || 'Device';
    [['cpu',cpu,value.cpu],['memory',memory,value.memory]].forEach(function (item) {
      var metricKey = node._id + '|metric|' + item[0];
      if (item[1] && !overThreshold[metricKey]) notify(node,metricKey,name + ' ' + item[0] + ' is ' + item[2].toFixed(1) + '%',true,now);
      overThreshold[metricKey] = item[1];
    });
  }
  function storageSample(event) {
    var value = event && event.detail, node = window.currentNode;
    if (!storageEnabled || !storageEnabled.checked || !value || !node || value.nodeid !== node._id || !Array.isArray(value.volumes)) return;
    var threshold = Number(storageLimit.value), now = new Date(), device = node.name || node.rname || 'Device';
    value.volumes.forEach(function (volume) {
      if (!volume || typeof volume.name !== 'string' || !(volume.size > 0) || !(volume.free >= 0)) return;
      var freePercent = volume.free / volume.size * 100, low = freePercent <= threshold;
      var metricKey = node._id + '|storage|' + volume.name;
      if (low && !overThreshold[metricKey]) notify(node,metricKey,device + ' volume ' + volume.name + ' has ' + freePercent.toFixed(1) + '% free',true,now);
      overThreshold[metricKey] = low;
    });
  }
  function update() {
    build(); if (!panel) return;
    var node = window.currentNode;
    if (!node || !node._id) { panel.hidden = true; activeNode = null; lastState = null; return; }
    panel.hidden = false;
    if (activeNode !== node._id) { activeNode = node._id; lastState = null; overThreshold = {}; hydrate(node); }
    var current = state(node);
    if (lastState !== null && current !== lastState) announce(node,current);
    lastState = current;
  }
  function boot() {
    if (!$('p10')) return;
    update();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(update);
      ['MainComputerState','p10info','p10title'].forEach(function (id) {
        var target = $(id); if (target) observer.observe(target,{childList:true,subtree:true,attributes:true});
      });
    }
    if (document.addEventListener) document.addEventListener('visibilitychange',update);
    if (window.addEventListener) window.addEventListener('ns-native-health-sample',sample);
    if (window.addEventListener) window.addEventListener('ns-native-storage-sample',storageSample);
  }
  window.__NightShiftAlerts = {refresh:update};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
/* Use the browser's install prompt when the native MeshCentral manifest qualifies. */
(function () {
  'use strict';
  if (window.__NightShiftPwa) return;
  var promptEvent = null, installButton = null;
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function mount() {
    var host = document.getElementById('ns-appbar-actions');
    if (!host) return;
    if (!installButton) {
      installButton = create('button','ns-install-app','Install app');
      installButton.type = 'button';
      installButton.setAttribute('aria-label','Install MeshCentral on this device');
      installButton.addEventListener('click',function () {
        if (!promptEvent) return;
        var deferred = promptEvent; promptEvent = null; installButton.hidden = true;
        deferred.prompt();
        Promise.resolve(deferred.userChoice).then(function () { mount(); }).catch(function () { mount(); });
      });
      host.append(installButton);
    }
    installButton.hidden = !promptEvent;
  }
  if (window.addEventListener) {
    window.addEventListener('beforeinstallprompt',function (event) {
      event.preventDefault(); promptEvent = event; mount();
    });
    window.addEventListener('appinstalled',function () { promptEvent = null; if (installButton) installButton.hidden = true; });
  }
  window.__NightShiftPwa = {refresh:mount};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
/* Explain which native device tools MeshCentral currently exposes. */
(function () {
  'use strict';
  if (window.__NightShiftCapabilities) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, rows = {};
  var items = [
    ['MainDevDesktop','Remote desktop'],['MainDevTerminal','Terminal'],
    ['MainDevFiles','Device files'],['MainDevAmt','Intel AMT']
  ];
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function available(id) {
    var native = $(id);
    if (!native || native.disabled || native.hidden || native.getAttribute('aria-hidden') === 'true' || native.style.display === 'none') return false;
    if (typeof getComputedStyle === 'function' && getComputedStyle(native).display === 'none') return false;
    return !native.getClientRects || native.getClientRects().length > 0;
  }
  function build() {
    var host = $('p10info'); if (!host) return;
    if (!panel) {
      panel = create('section','ns-capabilities'); panel.id = 'ns-device-capabilities';
      panel.setAttribute('aria-label','Available device tools');
      panel.append(create('h3','','Available device tools'));
      var list = create('div','ns-capabilities-list');
      items.forEach(function (item) {
        var row = create('div','ns-capability-row');
        row.append(create('span','ns-capability-name',item[1]));
        rows[item[0]] = create('strong','ns-capability-status','Checking');
        rows[item[0]].dataset.capability = item[0]; row.append(rows[item[0]]); list.append(row);
      });
      panel.append(list,create('p','ns-capability-note','Availability reflects the native MeshCentral tab for this device and account.'));
      host.insertBefore(panel,host.firstChild);
    }
    items.forEach(function (item) {
      var state = available(item[0]);
      rows[item[0]].textContent = state ? 'Available' : 'Unavailable';
      rows[item[0]].className = state ? 'ns-capability-status is-available' : 'ns-capability-status is-unavailable';
    });
  }
  function boot() {
    if (!$('p10')) return;
    build();
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(build);
      ['p10','MainDevDesktop','MainDevTerminal','MainDevFiles','MainDevAmt'].forEach(function (id) {
        var target = $(id); if (target) observer.observe(target,{attributes:true,attributeFilter:['class','style','disabled','hidden']});
      });
    }
  }
  window.__NightShiftCapabilities = {refresh:build};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
/* Collapsible, non-modal device information drawer for the native desktop viewer. */
(function () {
  'use strict';
  if (window.__NightShiftViewer) return;
  var $ = function (id) { return document.getElementById(id); };
  var toggle, drawer, closeButton, detailsButton, fields = {};
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
    if (!active) { close(); return; }
    var node = window.currentNode;
    if (!node) { items.forEach(function (item) { set(item[0],'Unavailable'); }); return; }
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
