/* Night Shift — MeshCentral UI enhancement, 1.0.0.
 * Delegates all remote-control actions to original MeshCentral handlers.
 * No protocol, auth, permission, agent or session implementations.
 */
(function () {
  'use strict';
  if (window.__nightShiftUI) return;
  var classicMode = false;
  try { classicMode = window.localStorage && window.localStorage.getItem('_nsClassicUI') === '1'; } catch (error) { }
  window.__NightShiftClassicMode = !!classicMode;
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
  let backdrop, input, results, dock, nav, modifierPanel, modifierToggle, modifierRelease, modifierButtons = {}, modifiersOpen = false;
  let searchReturnFocus = null, refreshScheduled = false, toastHandle;
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
  function changeClassicMode(classic) {
    try {
      if (!window.localStorage) throw new Error('Browser storage is unavailable');
      if (classic) window.localStorage.setItem('_nsClassicUI','1');
      else window.localStorage.removeItem('_nsClassicUI');
    } catch (error) {
      message('Could not save this UI preference. Allow browser storage, then try again.');
      return false;
    }
    if (window.location && typeof window.location.reload === 'function') { window.location.reload(); return true; }
    message('Reload this page to apply the UI preference.');
    return false;
  }
  function installClassicRestore() {
    if (!document.body || $('ns-classic-toggle')) return;
    document.body.classList.add('ns-classic-active');
    const restore=button('Night Shift','ns-classic-toggle',()=>changeClassicMode(false),'Switch back to Night Shift');
    restore.id='ns-classic-toggle';
    restore.style.cssText='position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483000;min-height:42px;padding:9px 14px;border:1px solid #6c8c69;border-radius:999px;background:#14221c;color:#e8f3e5;font:600 14px/1.2 system-ui,sans-serif;box-shadow:0 8px 28px #0008;cursor:pointer;outline:2px solid transparent;outline-offset:3px';
    document.body.append(restore);
  }
  function disableNightShiftStylesheet() {
    if (!document.querySelectorAll) return;
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      const href=link.href||link.getAttribute('href')||'';
      if (/(?:^|\/)custom\.css(?:[?#]|$)/i.test(href)) link.disabled=true;
    });
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
  function act(fn, unavailable) {
    if (!fn()) message(unavailable || 'Action unavailable for this session.');
    else scheduleUpdate();
  }
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
    searchReturnFocus = document.activeElement;
    backdrop.hidden=false; document.body.classList.add('ns-search-open');
    if(searchReturnFocus&&['ns-search-trigger','ns-search-more'].includes(searchReturnFocus.id))searchReturnFocus.setAttribute('aria-expanded','true');
    ['ns-search-trigger','ns-search-more'].forEach(id=>{const control=$(id);if(control)control.setAttribute('aria-expanded','true');});
    input.value=''; updateResults(); input.focus();
  }
  function closeSearch() {
    if (!backdrop) return;
    backdrop.hidden=true; document.body.classList.remove('ns-search-open');
    if(searchReturnFocus&&['ns-search-trigger','ns-search-more'].includes(searchReturnFocus.id))searchReturnFocus.setAttribute('aria-expanded','false');
    ['ns-search-trigger','ns-search-more'].forEach(id=>{const control=$(id);if(control)control.setAttribute('aria-expanded','false');});
    const target=searchReturnFocus;searchReturnFocus=null;
    if(target&&typeof target.focus==='function'&&visible(target))target.focus();
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
    if(target){const trigger=button('⌕','ns-search-trigger',showSearch,'Search navigation (Ctrl+K)');trigger.id='ns-search-trigger';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','ns-search-backdrop');target.prepend(trigger);}
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
      more.id='ns-search-more';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','ns-search-backdrop');
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
    modifierPanel=make('div','ns-dock-modifiers');modifierPanel.id='ns-dock-modifiers';modifierPanel.hidden=true;
    modifierPanel.setAttribute('role','group');modifierPanel.setAttribute('aria-label','Sticky keyboard modifiers');
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
    add(primary,'Keyboard','',()=>act(()=>{const ok=nativeFunction('toggleMobileKeyboard');if(ok)scheduleUpdate();return ok;},'Keyboard unavailable'),'ns-keyboard');
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
    modifierToggle=button('Modifiers','ns-dock-action',()=>{modifiersOpen=!modifiersOpen;scheduleUpdate();},'Show sticky keyboard modifiers');
    modifierToggle.id='ns-modifier-toggle';modifierToggle.setAttribute('aria-controls','ns-dock-modifiers');modifierToggle.setAttribute('aria-expanded','false');
    secondary.append(modifierToggle);
    [['ctrl','CTRL'],['shift','SHIFT'],['alt','ALT']].forEach(function (item) {
      const mod=button(item[1],'ns-dock-modifier',()=>act(()=>nativeFunctionWithArg('toggleMobileModifier',item[0]),item[1]+' unavailable'));
      mod.id='ns-mod-'+item[0];mod.setAttribute('aria-pressed','false');modifierButtons[item[0]]=mod;modifierPanel.append(mod);
    });
    modifierRelease=button('Release all','ns-dock-release',()=>act(()=>nativeFunction('_releaseMobileModifiers'),'Modifier release unavailable'),'Release all held keyboard modifiers');
    modifierRelease.id='ns-mod-release';modifierPanel.append(modifierRelease);
    dock.append(primary,secondary,modifierPanel);document.body.append(dock);
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
      if(t){
        const active=window.trackpadMode===true;
        t.disabled=!connected||typeof window.deskToggleTrackpad!=='function';
        t.textContent=active?'Trackpad on':'Trackpad off';
        t.setAttribute('aria-label',active?'Disable trackpad mode':'Enable trackpad mode');
        t.setAttribute('aria-pressed',active?'true':'false');
      }
      const control=$('DeskControl'),nativeModifiers=window._mobileModifiers||{};
      const inputAllowed=connected&&usable($('DeskWD'))&&!!control&&!control.disabled&&control.checked===true;
      const k=$('ns-keyboard');if(k){const keyboardOn=window._mobileKbdEnabled===true;k.disabled=!inputAllowed||typeof window.toggleMobileKeyboard!=='function';k.textContent=keyboardOn?'Keyboard on':'Keyboard off';k.setAttribute('aria-pressed',keyboardOn?'true':'false');k.setAttribute('aria-label',keyboardOn?'Hide on-screen keyboard':'Show on-screen keyboard');}
      const z=$('ns-zoom');if(z){
        const nativeSize=window._mobileZoomMode==='native';
        z.disabled=!connected||typeof window.deskMobileToggleZoom!=='function';
        z.textContent=nativeSize?'Scale to fit':'Native size';
        z.setAttribute('aria-label',nativeSize?'Scale remote display to fit':'Show remote display at native size');
        z.setAttribute('aria-pressed',nativeSize?'true':'false');
      }
      const modifiersSupported=typeof window.mobileModifiersSupported==='function'?!!window.mobileModifiersSupported():!!(window.desktop&&window.desktop.m&&typeof window.desktop.m.SendKeyMsgKC==='function');
      if(!connected)modifiersOpen=false;
      modifierToggle.hidden=!modifiersSupported;
      modifierToggle.disabled=!connected||!control||control.disabled||control.checked!==true;
      modifierToggle.setAttribute('aria-expanded',modifiersOpen?'true':'false');
      modifierPanel.hidden=!connected||!modifiersOpen||!modifiersSupported;
      const activeModifiers=Object.keys(modifierButtons).filter(mod=>nativeModifiers[mod]===true).length;
      modifierToggle.textContent=activeModifiers?'Modifiers ('+activeModifiers+')':'Modifiers';
      modifierToggle.setAttribute('aria-label',activeModifiers?'Show keyboard modifiers, '+activeModifiers+' active':'Show keyboard modifiers');
      modifierRelease.disabled=!connected||activeModifiers===0||typeof window._releaseMobileModifiers!=='function';
      Object.keys(modifierButtons).forEach(function (mod) {
        const active=nativeModifiers[mod]===true,button=modifierButtons[mod];
        button.disabled=!connected||!modifiersSupported||!control||control.disabled||control.checked!==true;
        button.setAttribute('aria-pressed',active?'true':'false');
        button.setAttribute('aria-label',(active?'Release ':'Hold ')+mod.toUpperCase());
      });
      const keys=$('ns-keys');if(keys)keys.disabled=!inputAllowed;
      ['ns-send-key','ns-type-text','ns-cad','ns-escape'].forEach(id=>{const key=$(id);if(key)key.disabled=!inputAllowed;});
      const type=$('ns-type-text');if(type)type.hidden=!usable($('DeskType'));
      const clipboardOut=$('ns-clipboard-out'),clipboardIn=$('ns-clipboard-in');
      if(clipboardOut){clipboardOut.disabled=!connected;clipboardOut.hidden=!usable($('DeskClipboardOutButton'));}
      if(clipboardIn){clipboardIn.disabled=!connected;clipboardIn.hidden=!usable($('DeskClipboardInButton'));}
      const right=$('ns-rightclick');if(right){
        const active=!!(window.desktop&&window.desktop.m&&window.desktop.m.SwapMouse);
        right.disabled=!connected||typeof window.deskToggleRightClickMode!=='function';
        right.textContent=active?'Right-click on':'Right-click off';
        right.setAttribute('aria-label',active?'Disable right-click mode':'Enable right-click mode');
        right.setAttribute('aria-pressed',active?'true':'false');
      }
      const monitors=$('ns-monitors');if(monitors)monitors.hidden=!usable($('DeskScreens'));
    }
    labelRail();
  }
  function scheduleUpdate(){
    if(refreshScheduled)return;
    refreshScheduled=true;requestAnimationFrame(()=>{refreshScheduled=false;updateNow();});
  }
  function releaseModifiersOnFocusLoss(){
    const held=Object.keys(modifierButtons).some(mod=>window._mobileModifiers&&window._mobileModifiers[mod]===true);
    if(held)nativeFunction('_releaseMobileModifiers');
    scheduleUpdate();
  }
  function boot(){
    if(window.__NightShiftClassicMode){disableNightShiftStylesheet();installClassicRestore();return;}
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
    const observer=new MutationObserver(scheduleUpdate),watchIds=['container','LeftMenuMyDevices','connectbutton1','connectbutton1r',
      'disconnectbutton1','DeskWD','DeskType','deskkeys','DeskClipboardOutButton','DeskClipboardInButton','MainSubMenuSpan',
      'page_leftbar','trackpadCursor','DeskTools','deskMobileActionsPanel','deskRightClickItem'];
    for(let page=1;page<=14;page++)watchIds.push('p'+page);
    watchIds.forEach(name=>{
      const el=$(name);if(el)observer.observe(el,{attributes:true,attributeFilter:['class','style','disabled','hidden','aria-current'],
        childList:name==='deskMobileActionsPanel'||name==='deskRightClickItem',characterData:name==='deskRightClickItem',subtree:name==='deskMobileActionsPanel'});
    });
    document.addEventListener('click',event=>{
      let target=event.target;
      while(target&&target!==document){
        if(target.id==='deskarea0'||target.id==='deskMobileActionsPanel'||target.id==='deskTools'||target.id==='DeskTools'){scheduleUpdate();break;}
        target=target.parentElement||target.parentNode;
      }
    },true);
    document.addEventListener('change',event=>{if(event.target&&event.target.id==='DeskControl')scheduleUpdate();});
    document.addEventListener('input',event=>{if(event.target&&event.target.id==='softKeyboard')scheduleUpdate();});
    addEventListener('resize',scheduleUpdate,{passive:true});
    addEventListener('orientationchange',scheduleUpdate,{passive:true});
    addEventListener('blur',releaseModifiersOnFocusLoss);
    document.addEventListener('visibilitychange',function(){if(document.hidden)releaseModifiersOnFocusLoss();else scheduleUpdate();});
  }
  window.__nightShiftUI={version:'1.0.0',refresh:scheduleUpdate,search:showSearch,enableClassic:function(){return changeClassicMode(true);},notifyClipboardError:function(){message('Clipboard access was blocked. Allow clipboard access for this site, then try again.');}};
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
    entries.forEach(function (entry) { if (allowed($(entry.id))) menu.append(link(entry, 'ns-shell-action')); });
    menu.append(button('Classic UI','ns-shell-action',function () {
      if (window.__nightShiftUI && typeof window.__nightShiftUI.enableClassic === 'function') window.__nightShiftUI.enableClassic();
    },'Switch to the native Classic MeshCentral UI'));
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
    makeSkipLink();
    makeBar(); makeDashboard(); makeDeviceTools(); makeRemoteState();
    if (!appbar) return;
    document.body.classList.add('ns-shell-ready');
    sync();
    var watcher = new MutationObserver(schedule), watchIds = ['xdevices','deskstatus','connectbutton1','connectbutton1r',
      'disconnectbutton1','MainSubMenuSpan','MainDevDesktop','MainDevTerminal','MainDevFiles','MainDevAmt'];
    for (var pageIndex = 1; pageIndex <= 19; pageIndex++) watchIds.push('p' + pageIndex);
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


/*
 * Night Shift native device inventory adapter. Source of truth is the server-
 * populated window.nodes/window.meshes in default3.handlebars, not demo data.
 * Device opening delegates to gotoDevice(), which retains all upstream checks.
 */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__nightShiftDevices) return;
  var $ = function (id) { return document.getElementById(id); };
  var create = function (tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  var mode = 'cards', layout = 'cards', sort = 'reachable', tag = '', state = 'all', term = '', list, grid, toggle, filter, stats, tabs, tagFilter, sortSelect, layoutSelect, lastSignature = '', updateQueued = false;
  var renderLimit = 150;
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
      var haystack = [node.name,node.rname,node.osdesc,group && group.name,Array.isArray(node.tags) ? node.tags.join(' ') : '']
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
    var tagState = all.map(function (node) {
      return [node._id,Array.isArray(node.tags) ? node.tags.join('\u001f') : ''].join(':');
    }).join('|');
    var signature = [mode,layout,sort,tag,state,term,all.length,onlineCount,selected,favorites ? Object.keys(favorites).length : -1,
      recent.map(function (item) { return item.id + ':' + item.openedAt; }).join(','),supportsView(),tagState,
      view.slice(0,renderLimit).map(function (n) {
        var group = window.meshes && window.meshes[n.meshid];
        return [n._id,n.name,n.rname,n.conn,n.meshid,group && group.name,n.osdesc,n.osd,n.agent && n.agent.id,isFavorite(n) ? 1 : 0].join(':');
      }).join('|')].join('::');
    if (signature !== lastSignature) {
      lastSignature = signature;
      grid.replaceChildren();
      var rendered = view.slice(0,renderLimit);
      if (layout === 'table') grid.append(makeTable(rendered));
      else rendered.forEach(function (node) { grid.append(layout === 'compact' ? makeCompact(node) : makeCard(node)); });
      if (!view.length) {
        var empty = create('div','ns-live-empty');
        var message = all.length === 0 ? 'No managed devices are available to this account.' :
          state === 'recent' ? 'No recent devices yet. Open a device to add it here.' :
          state === 'favorites' && !all.some(isFavorite) ? 'No favorites yet. Mark devices with the star control to find them here.' :
          'No devices match the selected filters.';
        empty.append(create('p','',''+message));
        if (all.length > 0 && state !== 'recent' && (term || tag || state !== 'all')) {
          var clear = create('button','ns-live-empty-clear','Clear filters'); clear.type = 'button';
          clear.addEventListener('click',function () {
            term = ''; tag = ''; state = 'all';
            if (filter) filter.value = '';
            if (tagFilter) tagFilter.value = '';
            renderFilterTabs(); update();
          });
          empty.append(clear);
        }
        grid.append(empty);
      }
      if (view.length > renderLimit) {
        var remaining = view.length - renderLimit;
        var more = create('button','ns-live-load-more','Show next ' + Math.min(150,remaining) + ' devices');
        more.type = 'button';
        more.setAttribute('aria-label','Show more devices; ' + remaining + ' more matches available');
        more.addEventListener('click',function () { renderLimit += 150; update(); });
        grid.append(more);
      }
      stats.textContent = all.length + ' loaded · ' + Math.min(view.length,renderLimit) + ' shown · ' + onlineCount + ' reachable · ' +
        (all.length - onlineCount) + ' offline' +
        (view.length > renderLimit ? ' · More matches available' : '');
    }
    useCards(mode === 'cards');
  }
  function scheduleUpdate() {
    if (updateQueued) return;
    updateQueued = true;
    var run = function () { updateQueued = false; update(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run,0);
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
    filter = create('input','ns-live-filter');filter.type='search';filter.placeholder='Search name, OS, group or tag';
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
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(scheduleUpdate);
      observer.observe(nativeList,{attributes:true,attributeFilter:['class','style','hidden'],childList:true,characterData:true,subtree:true});
    }
    var viewSelect = $('viewselect');
    if (viewSelect) viewSelect.addEventListener('change',scheduleUpdate);
    document.addEventListener('visibilitychange',scheduleUpdate);
    if (window.addEventListener) window.addEventListener('pageshow',scheduleUpdate);
  }
  window.__nightShiftDevices = {version:'2.1.0',refresh:update,schedule:scheduleUpdate};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
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
    open.forEach(function (entry) {
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
    controls.keyboardMap.setAttribute('aria-describedby','ns-profile-keyboard-map-help');
    var keyboardMapHelp = create('p','ns-profile-help','MeshAgent desktop uses this map. Browser RDP derives its keyboard mapping from the browser locale; Intel AMT keeps its native keyboard handling.');
    keyboardMapHelp.id = 'ns-profile-keyboard-map-help';
    grid.append(keyboardMapHelp);
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
    var before = $('ns-session-diagnostics') || area;
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
    status.textContent = qualityApplied || keyboardApplied
      ? 'Profile applied to the active Agent session.'
      : (monitorApplied ? 'Monitor preference applied. This transport does not expose the remaining profile settings.' : 'No profile settings could be applied to this active session; native session settings remain available.');
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
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftHealth) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, values = {}, lastNodeId = null;
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
  function connectionRoutes(conn) {
    if (typeof conn !== 'number' || !isFinite(conn)) return 'Unavailable';
    var routes = [];
    [[1,'Agent'],[2,'AMT CIRA'],[4,'Intel AMT'],[8,'Relay'],[16,'MQTT']].forEach(function (route) {
      if ((conn & route[0]) !== 0) routes.push(route[1]);
    });
    return routes.length ? routes.join(' · ') : 'Offline';
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
    if (!node) { lastNodeId = null; Object.keys(values).forEach(function (key) { values[key].textContent = 'Unavailable'; }); return; }
    if (lastNodeId !== node._id) {
      lastNodeId = node._id;
      values.cpu.textContent = 'Unavailable'; values.memory.textContent = 'Unavailable';
    }
    values.connection.textContent = connectionRoutes(node.conn);
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
  function installClearHook() {
    var nativeClear = window.deviceDetailsStatsClear;
    if (typeof nativeClear !== 'function' || nativeClear.__nightShiftHealthHook) return;
    var wrappedClear = function () {
      var result = nativeClear.apply(this,arguments);
      values.cpu.textContent = 'Unavailable'; values.memory.textContent = 'Unavailable';
      return result;
    };
    wrappedClear.__nightShiftHealthHook = true;
    window.deviceDetailsStatsClear = wrappedClear;
  }
  function boot() {
    if (!$('p17')) return;
    installClearHook();
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
  window.__NightShiftHealth = { refresh:update, formatUptime:uptime, connectionRoutes:connectionRoutes, parseDmtfDate:parseDmtfDate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
/* Search only the events and recordings MeshCentral has already rendered. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
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
    var wrap = create('div', 'ns-history-search');
    var searchLabel = create('label','');
    searchLabel.append(create('span', '', label));
    var input = create('input', 'form-control form-control-sm');
    input.type = 'search'; input.autocomplete = 'off'; input.setAttribute('aria-label', label);
    input.setAttribute('placeholder', 'Search loaded records');
    var clear = create('button','ns-history-clear','Clear'); clear.type = 'button';
    clear.setAttribute('aria-label','Clear ' + label.toLocaleLowerCase());
    clear.addEventListener('click',function () { input.value = ''; filter(key); input.focus(); });
    var status = create('span','ns-history-result-status','');
    status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); status.setAttribute('aria-atomic','true');
    input.addEventListener('input', function () { filter(key); });
    searchLabel.append(input); wrap.append(searchLabel,clear); host.append(wrap,status); fields[key] = {input:input,clear:clear,status:status,label:label.toLocaleLowerCase()};
  }
  function matches(element, query) {
    return !query || (element.textContent || '').toLocaleLowerCase().includes(query);
  }
  function enhanceEventRows() {
    var root = $('p3events'); if (!root) return;
    root.querySelectorAll('table.p3eventsTable tr[onclick*="showEventDetails"]').forEach(function (row) {
      if (row.dataset.nsKeyboardReady === '1') return;
      row.dataset.nsKeyboardReady = '1';
      row.tabIndex = 0;
      var summary = (row.textContent || '').replace(/\s+/g,' ').trim();
      if (summary) row.setAttribute('aria-label','Open event details: ' + summary);
      row.addEventListener('keydown',function (event) {
        if (event.target !== row || (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar')) return;
        event.preventDefault();
        row.click();
      });
    });
  }
  function enhanceRecordingRows() {
    var root = $('p52recordings'); if (!root) return;
    root.querySelectorAll('tbody tr[onkeypress*="showRecordingDialog"]').forEach(function (row) {
      if (row.dataset.nsKeyboardReady === '1') return;
      row.dataset.nsKeyboardReady = '1';
      if (!row.hasAttribute('tabindex')) row.tabIndex = 0;
      row.addEventListener('keydown',function (event) {
        if (event.target !== row || (event.key !== ' ' && event.key !== 'Spacebar')) return;
        event.preventDefault();
        if (typeof KeyboardEvent !== 'function' || typeof row.dispatchEvent !== 'function') return;
        row.dispatchEvent(new KeyboardEvent('keypress',{key:'Enter',bubbles:false,cancelable:true}));
      });
    });
  }
  function filterEvents(query) {
    var root = $('p3events'), total = 0, visible = 0; if (!root) return {total:0,visible:0};
    var tables = root.querySelectorAll('table.p3eventsTable');
    tables.forEach(function (table) {
      var rows = table.querySelectorAll('tr');
      rows.forEach(function (row) {
        if (row.querySelector('td[colspan]')) return;
        var eventRow = row.querySelectorAll('td').length >= 3;
        if (!eventRow) return;
        total++;
        var show = matches(row, query); if (show) visible++;
        row.hidden = !show;
        var spacer = row.nextElementSibling;
        if (spacer && spacer.querySelectorAll('td').length === 0) spacer.hidden = !show;
      });
    });
    return {total:total,visible:visible};
  }
  function filterRecordings(query) {
    var root = $('p52recordings'), total = 0, visible = 0; if (!root) return {total:0,visible:0};
    root.querySelectorAll('tbody').forEach(function (body) {
      var group = null, groupHeaders = [];
      body.querySelectorAll('tr').forEach(function (row) {
        if (row.querySelector('td[colspan]')) {
          group = {header:row,visible:false}; groupHeaders.push(group); return;
        }
        if (row.querySelectorAll('td').length < 2) return;
        total++;
        var show = matches(row, query); if (show) visible++;
        row.hidden = !show;
        if (group && show) group.visible = true;
      });
      groupHeaders.forEach(function (item) { item.header.hidden = !item.visible; });
    });
    return {total:total,visible:visible};
  }
  function filter(key) {
    var field = fields[key]; if (!field) return;
    var query = field.input.value.trim().toLocaleLowerCase();
    field.clear.hidden = !query;
    var counts = key === 'events' ? filterEvents(query) : filterRecordings(query);
    var noun = key === 'events' ? 'events' : 'recordings';
    field.status.textContent = query
      ? (counts.visible ? 'Showing ' + counts.visible + ' of ' + counts.total + ' loaded ' + noun + '.' : 'No matching ' + noun + ' in loaded records.')
      : counts.total + ' loaded ' + noun + '.';
  }
  function install() {
    addSearch('p3', 'p3title', 'events', 'Search events');
    addSearch('p52', 'p52title', 'recordings', 'Search recordings');
    enhanceEventRows();
    enhanceRecordingRows();
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
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftFiles) return;
  var $ = function (id) { return document.getElementById(id); };
  var search, inspector, detail, actions = [];
  var uploadObserver, transferQueue, transferStatus, transferList, historyPanel, historyList, historyAnnouncement, clearHistoryButton, lastQueueIndex = null;
  var transferHistory = [], uploadTrackingInstalled = false, downloadTrackingInstalled = false;
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
  function renderHistory() {
    if (!historyList) return;
    historyList.replaceChildren();
    if (!transferHistory.length) {
      historyList.append(create('li','ns-transfer-history-empty','Transfers started in this page will appear here.'));
      return;
    }
    transferHistory.forEach(function (entry) {
      var row = create('li','ns-transfer-history-item');
      var label = create('span','ns-transfer-history-name',entry.name);
      var state = create('span','ns-transfer-history-state',entry.state);
      row.append(label,state);
      if (entry.type === 'upload' && (entry.state === 'Failed' || entry.state === 'Failed to start') && entry.file) {
        var retry = create('button','ns-transfer-retry','Retry');
        retry.type = 'button'; retry.setAttribute('aria-label','Retry upload of ' + entry.name);
        retry.addEventListener('click',function () {
          var upload = $('p13UploadButton');
          if (!upload || upload.disabled || typeof window.p13doUploadFiles !== 'function') return;
          entry.state = 'Queued'; renderHistory(); announceTransfer(entry);
          try { window.p13doUploadFiles([entry.file]); }
          catch (error) { entry.state = 'Failed to start'; renderHistory(); announceTransfer(entry); }
        });
        row.append(retry);
      } else if (entry.type === 'download' && entry.path) {
        var again = create('button','ns-transfer-retry','Download again');
        again.type = 'button'; again.setAttribute('aria-label','Download ' + entry.name + ' again');
        again.addEventListener('click',function () {
          var download = $('p13DownloadButton'), node = window.currentNode;
          if (!download || download.disabled || !node || node._id !== entry.nodeId || typeof window.p13downloadDeviceFile !== 'function') return;
          entry.state = 'Requested again'; renderHistory(); announceTransfer(entry);
          window.p13downloadDeviceFile(entry.path);
        });
        row.append(again);
      }
      historyList.append(row);
    });
  }
  function announceTransfer(entry) {
    if (!historyAnnouncement || !entry) return;
    historyAnnouncement.textContent = (entry.type === 'upload' ? 'Upload' : 'Download') + ' ' + entry.name + ': ' + entry.state + '.';
  }
  function clearTransferHistory() {
    transferHistory = [];
    renderHistory();
    if (historyAnnouncement) historyAnnouncement.textContent = 'Transfer history cleared.';
  }
  function recordUpload(file,state) {
    if (!file) return;
    var entry = transferHistory.find(function (item) { return item.file === file; });
    if (!entry) {
      entry = { type:'upload', name:file.name || 'Unnamed file', file:file, state:state };
      transferHistory.unshift(entry);
      transferHistory = transferHistory.slice(0,20);
    } else entry.state = state;
    renderHistory();
    announceTransfer(entry);
  }
  function watchNativeUploadResults() {
    if (uploadTrackingInstalled || typeof window.p13gotUploadData !== 'function') return;
    var nativeHandler = window.p13gotUploadData;
    window.p13gotUploadData = function (message) {
      var upload = window.uploadFile;
      var file = upload && upload.xfiles && upload.xfiles[upload.xfilePtr];
      var action = message && message.action;
      var result = nativeHandler.apply(this,arguments);
      if (action === 'uploadstart') recordUpload(file,'In progress');
      else if (action === 'uploaddone') recordUpload(file,'Completed');
      else if (action === 'uploaderror') recordUpload(file,'Failed');
      return result;
    };
    uploadTrackingInstalled = true;
  }
  function watchNativeDownloads() {
    if (downloadTrackingInstalled || typeof window.p13downloadDeviceFile !== 'function') return;
    var nativeDownload = window.p13downloadDeviceFile;
    window.p13downloadDeviceFile = function (path) {
      var decoded = path;
      try { decoded = decodeURIComponent(path); } catch (error) { /* Keep the native path as displayed text. */ }
      var name = String(decoded || '').split(/[\\/]/).pop() || 'Device file';
      var node = window.currentNode;
      var entry = {type:'download',name:name,path:path,nodeId:node && node._id,state:'Requested'};
      transferHistory.unshift(entry);
      transferHistory = transferHistory.slice(0,20);
      renderHistory();
      announceTransfer(entry);
      try { return nativeDownload.apply(this,arguments); }
      catch (error) { entry.state = 'Failed to start'; renderHistory(); announceTransfer(entry); return false; }
    };
    downloadTrackingInstalled = true;
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
    if (!historyPanel) {
      historyPanel = create('section','ns-transfer-history');
      historyPanel.setAttribute('aria-label','Recent transfers');
      historyPanel.append(create('h3','','Recent transfers'));
      clearHistoryButton = create('button','ns-transfer-clear','Clear history');
      clearHistoryButton.type = 'button'; clearHistoryButton.setAttribute('aria-label','Clear recent transfer history');
      clearHistoryButton.addEventListener('click',clearTransferHistory);
      historyPanel.append(clearHistoryButton);
      historyAnnouncement = create('p','ns-transfer-announcement');
      historyAnnouncement.setAttribute('role','status'); historyAnnouncement.setAttribute('aria-live','polite'); historyAnnouncement.setAttribute('aria-atomic','true');
      historyList = create('ol','ns-transfer-history-list');
      historyPanel.append(historyAnnouncement,historyList);
      list.append(historyPanel);
      renderHistory();
    }
    update();
  }
  function boot() {
    build();
    watchUploadQueue();
    watchNativeUploadResults();
    watchNativeDownloads();
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
  if (window.__NightShiftClassicMode) return;
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
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftAlerts) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, enabled, metricEnabled, storageEnabled, cpuLimit, memoryLimit, storageLimit, quietStart, quietEnd, status, activeNode = null, lastState = null, lastNotices = {}, overThreshold = {}, fleetStates = Object.create(null), fleetHookInstalled = false;
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
  function normalizeThreshold(value, fallback) {
    if (value === null || value === undefined || String(value).trim() === '') return String(fallback);
    var number = Number(value);
    if (!isFinite(number)) return String(fallback);
    return String(Math.max(1,Math.min(100,Math.round(number))));
  }
  function notificationStatus(permission) {
    if (!window.Notification) return 'Browser notifications are unavailable; in-page alerts require this page to remain open.';
    var state = permission || window.Notification.permission;
    if (state === 'denied') return 'Browser notifications are blocked. Allow them in this site’s browser settings; in-page alerts require this page to remain open.';
    if (state === 'granted') return 'Browser notifications are enabled. Alerts run while this page is open and native updates arrive.';
    return 'Enable an alert to request browser notifications. Alerts run while this page is open and native updates arrive.';
  }
  function save() {
    if (!activeNode || typeof window.putstore !== 'function') return;
    cpuLimit.value = normalizeThreshold(cpuLimit.value,85);
    memoryLimit.value = normalizeThreshold(memoryLimit.value,90);
    storageLimit.value = normalizeThreshold(storageLimit.value,15);
    window.putstore(key(activeNode), JSON.stringify({e:enabled.checked?1:0,m:metricEnabled.checked?1:0,c:cpuLimit.value,r:memoryLimit.value,s:quietStart.value,t:quietEnd.value}));
    window.putstore('nsAlertsS.' + activeNode,JSON.stringify({b:storageEnabled.checked?1:0,f:storageLimit.value}));
  }
  function saveToggle() {
    if ((enabled.checked || metricEnabled.checked || storageEnabled.checked) && window.Notification && window.Notification.permission === 'default' && typeof window.Notification.requestPermission === 'function') {
      try {
        Promise.resolve(window.Notification.requestPermission()).then(function (permission) {
          save(); if (status) status.textContent = notificationStatus(permission);
        }).catch(function () { save(); if (status) status.textContent = notificationStatus(); });
      } catch (e) { save(); if (status) status.textContent = notificationStatus(); }
    } else {
      save(); if (status) status.textContent = notificationStatus();
    }
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
    enabled.addEventListener('change',saveToggle);
    toggle.append(enabled,create('span','','Notify when this device connection changes')); panel.append(toggle);
    var metricToggle = create('label','ns-alert-toggle'); metricEnabled = create('input',''); metricEnabled.type = 'checkbox';
    metricEnabled.addEventListener('change',saveToggle);
    metricToggle.append(metricEnabled,create('span','','Notify when CPU or memory crosses its threshold')); panel.append(metricToggle);
    var storageToggle = create('label','ns-alert-toggle'); storageEnabled = create('input',''); storageEnabled.type = 'checkbox';
    storageEnabled.addEventListener('change',saveToggle);
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
    status = create('p','ns-alert-status',notificationStatus());
    status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); status.setAttribute('aria-atomic','true'); panel.append(status);
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
    cpuLimit.value = normalizeThreshold(prefs.c,85); memoryLimit.value = normalizeThreshold(prefs.r,90);
    storageLimit.value = normalizeThreshold(storagePrefs.f,15);
    quietStart.value = typeof prefs.s === 'string' ? prefs.s : '';
    quietEnd.value = typeof prefs.t === 'string' ? prefs.t : '';
  }
  function quietNow(date, preferences) {
    var start = preferences ? preferences.s : (quietStart && quietStart.value);
    var end = preferences ? preferences.t : (quietEnd && quietEnd.value);
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
  function notify(node,dedupeKey,label,allowed,now,quietPreferences) {
    if (!allowed || quietNow(now,quietPreferences) || (lastNotices[dedupeKey] && now.getTime() - lastNotices[dedupeKey] < 300000)) return;
    lastNotices[dedupeKey] = now.getTime();
    if (status) status.textContent = label + (window.Notification && window.Notification.permission === 'granted' ? '' : '. Browser notifications are not enabled; in-page alerts require this page to remain open.');
    if (window.Notification && window.Notification.permission === 'granted') {
      try { new window.Notification('MeshCentral connection changed',{body:label,tag:dedupeKey}); } catch (e) { }
    }
  }
  function sample(event) {
    var value = event && event.detail, node = window.currentNode;
    if (!metricEnabled || !metricEnabled.checked || !value || !node || value.nodeid !== node._id) return;
    var cpu = typeof value.cpu === 'number' && value.cpu >= Number(normalizeThreshold(cpuLimit.value,85));
    var memory = typeof value.memory === 'number' && value.memory >= Number(normalizeThreshold(memoryLimit.value,90));
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
    var threshold = Number(normalizeThreshold(storageLimit.value,15)), now = new Date(), device = node.name || node.rname || 'Device';
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
  function seedFleetStates() {
    if (!Array.isArray(window.nodes)) return;
    window.nodes.forEach(function (node) {
      if (node && typeof node._id === 'string') fleetStates[node._id] = state(node);
    });
  }
  function installFleetConnectionHook() {
    var nativeUpdate = window.updateDeviceViewDevice;
    if (fleetHookInstalled || typeof nativeUpdate !== 'function') return;
    window.updateDeviceViewDevice = function (node) {
      if (node && typeof node._id === 'string') {
        var current = state(node), previous = fleetStates[node._id];
        fleetStates[node._id] = current;
        if (previous !== undefined && previous !== 'unknown' && previous !== current) {
          var preferences = load(node);
          var label = (node.name || node.rname || 'Device') + ' connection: ' + current.split('+').join(' / ');
          notify(node,node._id + '|' + current,label,preferences.e === 1,new Date(),preferences);
        }
      }
      return nativeUpdate.apply(this,arguments);
    };
    fleetHookInstalled = true;
  }
  function boot() {
    seedFleetStates();
    installFleetConnectionHook();
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
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftPwa) return;
  var promptEvent = null, installButton = null, help = null, helpClose = null;
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
        if (!promptEvent) {
          if (help) {
            help.hidden = !help.hidden;
            installButton.setAttribute('aria-expanded',help.hidden ? 'false' : 'true');
            if (!help.hidden && helpClose) helpClose.focus();
          }
          return;
        }
        var deferred = promptEvent; promptEvent = null; installButton.hidden = true;
        deferred.prompt();
        Promise.resolve(deferred.userChoice).then(function () { mount(); }).catch(function () { mount(); });
      });
      installButton.setAttribute('aria-controls','ns-install-help');
      host.append(installButton);
      var appbar = document.getElementById('ns-appbar');
      if (appbar) {
        help = create('section','ns-install-help'); help.id = 'ns-install-help'; help.hidden = true;
        help.setAttribute('role','dialog'); help.setAttribute('aria-label','Add MeshCentral to your Home Screen');
        help.append(create('p','','To install on iPhone or iPad, open this page’s Share menu and choose “Add to Home Screen”. The installed app will still require your normal MeshCentral and Cloudflare Access sign-in.'));
        helpClose = create('button','ns-install-help-close','Close'); helpClose.type = 'button';
        helpClose.addEventListener('click',function () { help.hidden = true; installButton.setAttribute('aria-expanded','false'); installButton.focus(); });
        help.append(helpClose); appbar.append(help);
      }
    }
    var manual = manualInstallAvailable();
    installButton.hidden = !promptEvent && !manual;
    installButton.textContent = promptEvent ? 'Install app' : 'Add to Home Screen';
    installButton.setAttribute('aria-expanded',help && !help.hidden ? 'true' : 'false');
    if (help && !manual) help.hidden = true;
  }
  function manualInstallAvailable() {
    var nav = window.navigator || {}, ua = nav.userAgent || '', platform = nav.platform || '';
    var ios = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1);
    var standalone = nav.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return ios && !standalone;
  }
  if (window.addEventListener) {
    window.addEventListener('beforeinstallprompt',function (event) {
      event.preventDefault(); promptEvent = event; mount();
    });
    window.addEventListener('appinstalled',function () { promptEvent = null; if (installButton) installButton.hidden = true; });
  }
  if (document.addEventListener) document.addEventListener('keydown',function (event) {
    if (event.key === 'Escape' && help && !help.hidden) {
      help.hidden = true; installButton.setAttribute('aria-expanded','false'); installButton.focus();
    }
  });
  window.__NightShiftPwa = {refresh:mount,manualInstallAvailable:manualInstallAvailable};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
/* Explain which native device tools MeshCentral currently exposes. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftCapabilities) return;
  var $ = function (id) { return document.getElementById(id); };
  var panel, rows = {}, openButtons = {};
  var items = [
    ['MainDevDesktop','Remote desktop',11],['MainDevTerminal','Terminal',12],
    ['MainDevFiles','Device files',13],['MainDevAmt','Intel AMT',14]
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
        rows[item[0]].dataset.capability = item[0]; row.append(rows[item[0]]);
        var open = create('button','ns-capability-open','Open');
        open.type = 'button'; open.setAttribute('aria-label','Open ' + item[1]);
        open.addEventListener('click',function (event) {
          if (!available(item[0]) || typeof window.go !== 'function') return;
          window.go(item[2],event);
        });
        openButtons[item[0]] = open; row.append(open); list.append(row);
      });
      panel.append(list,create('p','ns-capability-note','Availability reflects the native MeshCentral tab for this device and account.'));
      host.insertBefore(panel,host.firstChild);
    }
    items.forEach(function (item) {
      var state = available(item[0]);
      rows[item[0]].textContent = state ? 'Available' : 'Unavailable';
      rows[item[0]].className = state ? 'ns-capability-status is-available' : 'ns-capability-status is-unavailable';
      openButtons[item[0]].hidden = !state;
      openButtons[item[0]].disabled = !state || typeof window.go !== 'function';
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
    syncToolbarTabStops();
  }
  function toolbarButtons() {
    return ['connect','rdp','disconnect','fullscreen'].map(function (key) { return controlButtons[key]; })
      .filter(function (button) { return button && !button.hidden && !button.disabled; });
  }
  function syncToolbarTabStops() {
    var buttons = toolbarButtons(), active = document.activeElement;
    if (buttons.indexOf(active) < 0) active = buttons[0];
    Object.keys(controlButtons).forEach(function (key) {
      controlButtons[key].tabIndex = controlButtons[key] === active ? 0 : -1;
    });
  }
  function handleToolbarKeydown(event) {
    var buttons = toolbarButtons();
    if (!buttons.length || ['ArrowLeft','ArrowRight','Home','End'].indexOf(event.key) < 0) return;
    var index = buttons.indexOf(document.activeElement), next = index < 0 ? 0 : index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else if (event.key === 'ArrowRight') next = (next + 1) % buttons.length;
    else next = (next + buttons.length - 1) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
    showControls();
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
    controls.setAttribute('aria-orientation','horizontal');
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
    controls.addEventListener('keydown',handleToolbarKeydown);
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
/* Accessible keyboard behavior for native MeshCentral server trace rows. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftServerAdmin) return;
  var root;
  function enhance() {
    root = document.getElementById('p41events');
    if (!root) return;
    root.querySelectorAll('.traceEvent[onclick]').forEach(function (row) {
      if (row.dataset.nsServerTraceReady === '1') return;
      row.dataset.nsServerTraceReady = '1';
      row.tabIndex = 0;
      row.setAttribute('role','button');
      var summary = (row.textContent || '').replace(/\s+/g,' ').trim();
      if (summary) row.setAttribute('aria-label','Open server trace details: ' + summary);
      row.addEventListener('keydown',function (event) {
        if (event.target !== row || (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar')) return;
        event.preventDefault();
        row.click();
      });
    });
  }
  function boot() {
    enhance();
    root = document.getElementById('p41events');
    if (root && typeof MutationObserver === 'function') {
      new MutationObserver(enhance).observe(root,{childList:true,subtree:true});
    }
  }
  window.__NightShiftServerAdmin = { refresh:enhance };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
