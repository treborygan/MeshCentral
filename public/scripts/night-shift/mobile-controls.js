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
      const z=$('ns-zoom');if(z)z.disabled=!connected||typeof window.deskMobileToggleZoom!=='function';
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

