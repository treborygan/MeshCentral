/* Node-only Night Shift contract tests. No production services or secrets needed. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const css = read('public/styles/custom.css');
const js = read('public/scripts/custom.js');
const installer = read('scripts/Install-NightShift.ps1');
const health = read('public/scripts/night-shift/health.js');
const history = read('public/scripts/night-shift/history.js');
const files = read('public/scripts/night-shift/files.js');
const actions = read('public/scripts/night-shift/actions.js');
const alerts = read('public/scripts/night-shift/alerts.js');
const pwa = read('public/scripts/night-shift/pwa.js');
const capabilities = read('public/scripts/night-shift/capabilities.js');
const viewer = read('public/scripts/night-shift/viewer.js');
const serverAdmin = read('public/scripts/night-shift/server-admin.js');
const devicesSource = read('public/scripts/night-shift/devices.js');
const mobileControls = read('public/scripts/night-shift/mobile-controls.js');
const nativeCompat = read('public/scripts/night-shift/native-compat.js');
const shell = read('public/scripts/night-shift/shell.js');
const sessionsSource = read('public/scripts/night-shift/sessions.js');
const softwareTimeout = read('public/scripts/night-shift/software-timeout.js');

test('CodeQL workflow grants SARIF upload permission and uses supported actions',()=>{
  const workflow=read('.github/workflows/codeql-analysis.yml');
  assert.match(workflow,/permissions:\s*\n\s+contents:\s*read\s*\n\s+security-events:\s*write/);
  assert.match(workflow,/github\/codeql-action\/init@v4/);
  assert.match(workflow,/github\/codeql-action\/analyze@v4/);
});

test('native clipboard permission failures provide mobile feedback without replacing transport',()=>{
  const template=read('views/default3.handlebars');
  assert.match(mobileControls,/notifyClipboardError:function\(\)\{message\('Clipboard access was blocked\./);
  assert.match(template,/navigator\.clipboard\.writeText\(text\)\.then\(function \(\) \{ \}\)\.catch\(function \(err\) \{ console\.log\(err\); if \(window\.__nightShiftUI\) window\.__nightShiftUI\.notifyClipboardError\(\); \}\)/);
  assert.match(template,/navigator\.clipboard\.writeText\(message\.data\)\.then\(function \(\) \{ \}\)\.catch\(function \(err\) \{ console\.log\(err\); if \(window\.__nightShiftUI\) window\.__nightShiftUI\.notifyClipboardError\(\); \}\)/);
  assert.match(template,/navigator\.clipboard\.readText\(\)\.then\(function \(text\)/);
  assert.match(template,/if \(window\.__nightShiftUI\) window\.__nightShiftUI\.notifyClipboardError\(\);/);
});

test('mobile soft keyboard waits for committed input-method text before native Unicode delivery',()=>{
  const template=read('views/default3.handlebars');
  assert.match(template,/oninput="onSoftKeyboardInput\(this, event\)"/);
  assert.match(template,/oncompositionend="onSoftKeyboardCompositionEnd\(this, event\)"/);
  assert.match(template,/if \(inputEvent && inputEvent\.isComposing\) return;/);
  assert.match(template,/if \(mobileKbdCompositionCommitPending\) \{ el\.value = ''; return; \}/);
  assert.match(template,/typeof compositionEvent\.data === 'string'\) \? compositionEvent\.data : el\.value/);
  assert.match(template,/desktop\.m\.SendKeyUnicode\(desktop\.m\.KeyAction\.DOWN, c\)/);

  const keyboard=template.match(/var mobileKbdGotKeypress = false;[\s\S]*?\n        function _updateSoftKbdIcon\(\)/);
  assert.ok(keyboard,'native mobile keyboard handlers are present');
  const sent=[],timers=[];
  const context={
    desktop:{m:{KeyAction:{DOWN:1,UP:2},SendKeyUnicode:(action,code)=>sent.push([action,code])}},
    Q:()=>({checked:true}),_mobileModifiers:{ctrl:false,shift:false,alt:false},
    _releaseMobileModifiers(){},setTimeout:callback=>timers.push(callback)
  };
  vm.runInNewContext(keyboard[0].replace(/\n        function _updateSoftKbdIcon\(\)$/,''),context);
  const input={value:'に'};
  context.onSoftKeyboardInput(input,{isComposing:true});
  assert.equal(input.value,'に','intermediate composition remains available to the IME');
  assert.deepEqual(sent,[],'uncommitted composition does not reach the remote session');
  input.value='日本語';
  context.onSoftKeyboardCompositionEnd(input,{data:'日本語'});
  input.value='日本語';
  context.onSoftKeyboardInput(input,{isComposing:false});
  assert.equal(input.value,'','the browser follow-up input is consumed while the commit is queued');
  timers[0]();
  assert.deepEqual(sent,[[1,0x65e5],[2,0x65e5],[1,0x672c],[2,0x672c],[1,0x8a9e],[2,0x8a9e]],'only committed Unicode text is sent once through MeshCentral');
});

test('native sticky modifiers require supported key actions and release held keys safely',()=>{
  const template=read('views/default3.handlebars');
  const modifiers=template.match(/\/\/ Mobile sticky modifier keys \(CTRL\/SHIFT\/ALT\)[\s\S]*?\n        \/\/ Mobile soft-keyboard/);
  assert.ok(modifiers,'native modifier helpers are present');
  const sent=[],ui=[];
  const context={
    desktop:{m:{KeyAction:{DOWN:1,UP:2,EXDOWN:3,EXUP:4},SendKeyMsgKC:(action,code)=>sent.push([action,code])}},
    Q:id=>id==='DeskControl'?{checked:true}:null,
    _updateMobileModifierUI:()=>ui.push({...context._mobileModifiers})
  };
  vm.runInNewContext(modifiers[0].replace(/\n        \/\/ Mobile soft-keyboard$/,''),context);
  assert.equal(context.mobileModifiersSupported(),true);
  assert.equal(context.toggleMobileModifier('ctrl'),true);
  assert.equal(context.toggleMobileModifier('shift'),true);
  assert.deepEqual(sent,[[3,17],[1,16]],'Ctrl uses extended down while Shift uses regular down');
  context._releaseMobileModifiers();
  assert.deepEqual(sent,[[3,17],[1,16],[4,17],[2,16]],'release sends matching native key-up actions');
  assert.deepEqual({...context._mobileModifiers},{ctrl:false,shift:false,alt:false});

  const unsupported={
    desktop:{m:{KeyAction:{DOWN:1,UP:2},SendKeyMsgKC:(action,code)=>sent.push([action,code])}},
    Q:id=>id==='DeskControl'?{checked:true}:null,
    _updateMobileModifierUI:()=>{}
  };
  vm.runInNewContext(modifiers[0].replace(/\n        \/\/ Mobile soft-keyboard$/,''),unsupported);
  unsupported._mobileModifiers.alt=true;
  assert.equal(unsupported.mobileModifiersSupported(),false,'missing extended key actions disables sticky modifiers');
  assert.equal(unsupported.toggleMobileModifier('ctrl'),false,'unsupported transports receive no modifier events');
  unsupported._releaseMobileModifiers();
  assert.equal(unsupported._mobileModifiers.alt,false,'local held state clears even when native release is unsupported');
  assert.deepEqual(sent,[[3,17],[1,16],[4,17],[2,16]],'unsupported release sends nothing to the transport');
});

test('deployed overlay safely adapts legacy MeshCentral mobile handlers',async()=>{
  const listeners={},timers=[],calls=[],notifications=[];let refreshes=0;
  const clipboard={
    readText:()=>Promise.reject(new Error('denied')),
    writeText:()=>Promise.reject(new Error('denied'))
  };
  const held={ctrl:false,shift:false,alt:false};
  const context={
    document:{readyState:'loading',getElementById:id=>id==='container'?{}:null,addEventListener:(name,fn)=>{listeners[name]=fn;}},
    window:{
      navigator:{clipboard},setTimeout:fn=>timers.push(fn),
      __nightShiftUI:{notifyClipboardError:()=>notifications.push('blocked'),refresh:()=>refreshes++},
      desktop:{m:{KeyAction:{DOWN:1,UP:2,EXDOWN:3,EXUP:4},SendKeyMsgKC:(action,code)=>calls.push([action,code])}},
      _mobileModifiers:held,Q:()=>({checked:true}),
      _updateMobileModifierUI:()=>{},
      toggleMobileModifier(mod){held[mod]=!held[mod];},
      _releaseMobileModifiers(){for(const key of Object.keys(held)){if(held[key]){calls.push(['release',key]);held[key]=false;}}},
      onSoftKeyboardInput(target){calls.push(['text',target.value]);target.value='';}
    },Object,Promise
  };
  vm.runInNewContext(nativeCompat,context);
  listeners.DOMContentLoaded();
  assert.equal(refreshes,1,'the dock rerenders after transport capability detection');
  assert.equal(context.window.mobileModifiersSupported(),true);
  assert.equal(context.window.toggleMobileModifier('ctrl'),true);
  assert.equal(context.window.toggleMobileModifier('invalid'),false);
  assert.equal(held.ctrl,true);
  const target={id:'softKeyboard',value:'に'};
  const intermediate={target,isComposing:true,stopped:false,stopImmediatePropagation(){this.stopped=true;},preventDefault(){}};
  listeners.input(intermediate);
  assert.equal(intermediate.stopped,true);
  assert.equal(target.value,'に','composition text remains in the native input until committed');
  listeners.compositionend({target});
  target.value='日本語';
  const finalInput={target,isComposing:false,stopped:false,stopImmediatePropagation(){this.stopped=true;},preventDefault(){}};
  listeners.input(finalInput);
  assert.equal(finalInput.stopped,true,'the browser follow-up input is not sent twice');
  timers[0]();
  assert.deepEqual(calls,[['text','日本語']]);
  await Promise.allSettled([clipboard.readText(),clipboard.writeText()]);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(notifications.length,2,'clipboard permission errors reach Night Shift feedback');

  const unsupportedListeners={},unsupportedHeld={ctrl:true,shift:false,alt:true},unsupportedCalls=[];
  const unsupported={
    document:{readyState:'complete',addEventListener:(name,fn)=>{unsupportedListeners[name]=fn;}},
    window:{desktop:{m:{KeyAction:{DOWN:1,UP:2},SendKeyMsgKC:(...args)=>unsupportedCalls.push(args)}},_mobileModifiers:unsupportedHeld,_updateMobileModifierUI(){},Q:()=>({checked:true}),toggleMobileModifier(){throw new Error('must not call unsupported native toggle');},_releaseMobileModifiers(){throw new Error('must not call unsupported native release');},navigator:{}},Object,Promise
  };
  vm.runInNewContext(nativeCompat,unsupported);
  assert.equal(unsupported.window.mobileModifiersSupported(),false);
  assert.equal(unsupported.window.toggleMobileModifier('ctrl'),false);
  unsupported.window._releaseMobileModifiers();
  assert.deepEqual({...unsupportedHeld},{ctrl:false,shift:false,alt:false});
  assert.deepEqual(unsupportedCalls,[],'unsupported transports receive no unsafe key events');

  const modernClipboard={readText(){return Promise.resolve('');},writeText(){return Promise.resolve();}};
  const modernListeners={};
  const modern={
    document:{readyState:'loading',addEventListener:(name,fn)=>{modernListeners[name]=fn;}},
    window:{navigator:{clipboard:modernClipboard},setTimeout(){},mobileModifiersSupported:()=>true,onSoftKeyboardCompositionEnd(){},toggleMobileModifier(){}},Object,Promise
  };
  vm.runInNewContext(nativeCompat,modern);
  modernListeners.DOMContentLoaded();
  assert.equal(modern.window.toggleMobileModifier.name,'toggleMobileModifier','enhanced native handlers remain untouched');
  assert.equal(modern.window.navigator.clipboard.readText,modernClipboard.readText,'enhanced clipboard handlers are not wrapped twice');
  assert.deepEqual(Object.keys(modernListeners),['DOMContentLoaded'],'enhanced IME handlers do not receive duplicate listeners');
});

test('legacy mobile touch gestures release remote drags on cancel, multitouch and permission loss',()=>{
  const calls=[],canvasListeners={},observers=[];let control={checked:true};
  const canvas={addEventListener:(name,fn)=>{canvasListeners[name]=fn;}};
  const parent={scrollLeft:12,scrollTop:14};
  const desk={style:{cursor:'text'}};
  const listeners={};
  const dm={
    mousemove:event=>calls.push(['mousemove',event.addx,event.addy]),
    sendKeepAlive:()=>calls.push(['keepalive']),
    mouseup:event=>calls.push(['mouseup',event.x,event.y,event.button]),
    mousedown:event=>calls.push(['mousedown',event.x,event.y,event.button]),
    mousedblclick:event=>calls.push(['double',event.x,event.y,event.button])
  };
  const window={
    desktop:{m:dm},xxdialogMode:false,dtouchDragActive:false,trackpadDragActive:false,
    dtouchLastX:8,dtouchLastY:9,dtouchLongPressed:true,trackpadLongPressed:true,
    dtouchLongPressTimer:77,trackpadTapTimer:88,trackpadLastX:5,trackpadLastY:6,trackpadDown:true,
    dtouchMoved:false,trackpadTapMoved:false,dtouchLastTapTime:0,dtouchLastTapX:0,dtouchLastTapY:0,
    dtouchStartX:0,dtouchStartY:0,
    Q:id=>id==='DeskControl'?control:id==='DeskParent'?parent:id==='Desk'?desk:null,
    setSessionActivity:()=>{},
    dtouchGetModule:()=>dm,dtouchMakeEvent:(x,y,button)=>({x,y,button}),trackpadMakeEvent:button=>({x:20,y:21,button}),
    trackpadStopEdgeScroll:()=>calls.push(['stop-edge']),clearTimeout:id=>calls.push(['clear',id]),
    dtouchstart(){calls.push(['native-start']);},dtouchend(){calls.push(['native-end']);},
    dmousemove:function(){calls.push(['legacy-move']);},
    dtouchSendClick(){calls.push(['native-click']);},
    navigator:{},__nightShiftUI:{refresh(){}},
    MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}}
  };
  window.dmousemove.toString=()=>"function dmousemove(e) { Q('Desk').style.cursor = ''; }";
  const document={
    readyState:'complete',getElementById:id=>id==='container'?{}:id==='DeskParent'?parent:id==='Desk'?canvas:null,
    querySelector:selector=>selector==='link[href*="style-bootstrap"]'?{}:null,addEventListener:(name,fn)=>{listeners[name]=fn;}
  };
  vm.runInNewContext(nativeCompat,{window,document,Object,Promise,Date});
  assert.equal(typeof window.dtouchcancel,'function','legacy templates gain the missing native touch-cancel handler');
  assert.equal(typeof canvasListeners.touchcancel,'function','the existing Desk canvas releases drags on browser touch cancellation');

  window.dtouchDragActive=true;
  window.dtouchstart({});
  assert.deepEqual(calls.slice(0,3),[['mouseup',8,9,0],['stop-edge'],['native-start']], 'a second touch releases a held remote drag before native start handling');

  calls.length=0;
  window.trackpadDragActive=true;
  window.dtouchLongPressTimer=77;window.trackpadTapTimer=88;
  canvasListeners.touchcancel({type:'touchcancel'});
  assert.ok(calls.some(call=>call[0]==='mouseup'&&call[1]===20&&call[2]===21),'touchcancel releases a held trackpad drag');
  assert.deepEqual(calls.filter(call=>call[0]==='clear'),[['clear',77],['clear',88]]);
  assert.equal(window.trackpadLastX,null);assert.equal(window.trackpadDown,false);

  calls.length=0;control.checked=false;window.dtouchDragActive=true;
  window.dtouchend({preventDefault(){}});
  assert.ok(calls.some(call=>call[0]==='mouseup'&&call[1]===8&&call[2]===9),'disabling remote input cannot leave a pressed mouse button');
  assert.equal(calls.some(call=>call[0]==='native-end'),false,'the stale legacy end handler cannot send a click after permission is disabled');

  calls.length=0;control.checked=true;window.dtouchLastTapTime=Date.now()-100;window.dtouchLastTapX=100;window.dtouchLastTapY=100;window.dtouchStartX=102;window.dtouchStartY=101;
  window.dtouchSendClick(100,100,0);
  assert.deepEqual(calls,[['mousedown',100,100,0],['double',100,100,0],['mouseup',100,100,0]],'legacy double taps use MeshCentral native double-click transport');

  calls.length=0;const mouseEvent={};window.dmousemove(mouseEvent);
  assert.equal(desk.style.cursor,'text','legacy mouse movement preserves the remote cursor shape');
  assert.deepEqual([mouseEvent.addx,mouseEvent.addy],[12,14]);
  assert.deepEqual(calls,[['mousemove',12,14]],'cursor compatibility retains MeshCentral mouse transport');

  const replacementListeners={};
  document.getElementById=id=>id==='container'?{}:id==='DeskParent'?parent:id==='Desk'?{addEventListener:(name,fn)=>{replacementListeners[name]=fn;}}:null;
  observers[0].fn();
  assert.equal(typeof replacementListeners.touchcancel,'function','replacement canvases also receive the cancellation handler');
});

test('desktop navigation rail expands accessibly without replacing native routes',()=>{
  assert.match(mobileControls,/function installRailToggle\(\)/);
  assert.match(mobileControls,/aria-controls', 'page_leftbar'/);
  assert.match(mobileControls,/aria-expanded/);
  assert.match(mobileControls,/ns-rail-expanded/);
  assert.match(css,/fullscreen:not\(\.menu_stack\):not\(\.arg_hide\):not\(\.fulldesk\) #container\{grid-template-columns:90px minmax\(0,1fr\)\}/);
  assert.match(css,/body\.ns-theme\.ns-rail-expanded\.fullscreen[^\n]*#container\{grid-template-columns:168px minmax\(0,1fr\)\}/);
});

test('Classic UI preference skips Night Shift enhancements and provides an accessible return control',()=>{
  const h=createMobileHarness(true,true);
  assert.equal(h.window.__NightShiftClassicMode,true,'stored Classic UI preference is detected before feature modules run');
  assert.equal(h.document.body.classList.contains('ns-theme'),false,'native page does not receive Night Shift theme classes');
  assert.equal(h.byId.has('ns-appbar'),false,'Night Shift appbar is omitted in Classic UI mode');
  assert.equal(h.byId.has('ns-mobile-dock'),false,'Night Shift touch dock is omitted in Classic UI mode');
  assert.equal(h.styleSheet.disabled,true,'Night Shift override stylesheet is disabled in Classic UI mode');
  for(const moduleFlag of ['__nightShiftShell','__nightShiftDevices','__NightShiftDiagnostics','__NightShiftSessions','__NightShiftFiles','__NightShiftAlerts','__NightShiftViewer']) {
    assert.equal(h.window[moduleFlag],undefined,moduleFlag+' remains unloaded in Classic UI mode');
  }
  const restore=h.byId.get('ns-classic-toggle');
  assert.ok(restore,'a return control remains available on the native UI');
  assert.equal(restore.getAttribute('aria-label'),'Switch back to Night Shift');
  assert.match(h.byId.get('ns-classic-toggle').style.cssText,/outline:2px solid/,'the return control retains a visible native keyboard focus outline');
  restore.click();
  assert.equal(h.storage.has('_nsClassicUI'),false,'returning to Night Shift removes the local Classic preference');
  assert.equal(h.reloadCount,1,'the preference change reloads native controls cleanly');
  assert.match(shell,/Classic UI/,'authenticated appbar menu exposes the user-facing fallback');
  const nightShift=createMobileHarness(true,false);
  assert.equal(nightShift.window.__nightShiftUI.enableClassic(),true,'the Night Shift menu can enable the Classic UI preference');
  assert.equal(nightShift.storage.get('_nsClassicUI'),'1','the local presentation preference is saved');
  assert.equal(nightShift.reloadCount,1,'switching to Classic UI reloads the native pages cleanly');
});

test('native MeshCentral Classic template enters fallback without a Night Shift local preference',()=>{
  const classic=read('views/default.handlebars');
  const modern=read('views/default3.handlebars');
  const login=read('views/login2.handlebars');
  assert.match(classic,/scripts\/meshcentral\{\{\{min\}\}\}\.js/,'Classic app template loads the native app runtime');
  assert.doesNotMatch(classic,/styles\/style-bootstrap\.css/,'Classic app template omits Modern UI bootstrap styles');
  assert.match(modern,/styles\/style-bootstrap\.css/,'Modern app template carries the Modern UI marker');
  assert.doesNotMatch(login,/scripts\/meshcentral\{\{\{min\}\}\}\.js/,'login templates are not mistaken for an authenticated Classic app');
  assert.match(classic,/function toggleBootstrapUIMode\(\)/,'the native Classic template exposes MeshCentral UI selection');
  assert.match(classic,/putstore\('uiViewMode', nUiViewMode\)/,'the native UI selector persists the selected Modern or Classic mode');

  const h=createMobileHarness(true,false,false,'classic');
  assert.equal(h.window.__NightShiftClassicMode,true,'native template detection happens before feature modules evaluate');
  assert.equal(h.window.__NightShiftNativeClassicTemplate,true,'the restore action knows the native template selected Classic mode');
  assert.equal(h.styleSheet.disabled,true,'Night Shift CSS is disabled for the native Classic template');
  assert.equal(h.byId.has('ns-appbar'),false,'Modern-only controls do not attach to the native Classic template');
  const restore=h.byId.get('ns-classic-toggle');
  assert.ok(restore,'the accessible return control remains available');
  assert.equal(restore.textContent,'Choose Modern UI','the control opens the choice instead of claiming an immediate mode switch');
  assert.equal(restore.getAttribute('aria-label'),'Open MeshCentral UI selector to choose Modern UI with Night Shift');
  const notice=h.byId.get('ns-classic-notice');
  assert.ok(notice,'the unchanged Classic layout explains why Night Shift is not active');
  assert.equal(notice.getAttribute('role'),'status');
  assert.match(notice.children[0].textContent,/Night Shift is off in Classic UI\. Choose Modern UI/);
  assert.match(notice.style.cssText,/max-width:min\(520px,calc\(100vw - 24px\)\)/,'the notice stays inside narrow mobile viewports');
  restore.click();
  assert.deepEqual(h.calls,[['native-ui-mode']],'the control opens MeshCentral native interface selection');
  assert.equal(h.reloadCount,0,'MeshCentral owns saving the new mode and performing its reload');

  const storedFallback=createMobileHarness(true,true,false,'classic');
  storedFallback.byId.get('ns-classic-toggle').click();
  assert.equal(storedFallback.storage.has('_nsClassicUI'),false,'stale local fallback preference is cleared before switching native mode');
  assert.deepEqual(storedFallback.calls,[['native-ui-mode']]);
});

test('contextual breadcrumbs route through native MeshCentral navigation',()=>{
  assert.match(shell,/setAttribute\('aria-label', 'Breadcrumb'\)/);
  assert.match(shell,/navigate\(entries\[0\]\)/);
  assert.match(shell,/deviceAction\(\{ id: 'MainDevInfo' \}\)/);
  assert.match(shell,/window\.currentNode/);
});

test('contextual shell refreshes from native mutations and lifecycle events without polling',()=>{
  assert.match(shell,/new MutationObserver\(schedule\)/);
  assert.match(shell,/watchIds\.push\('p' \+ pageIndex\)/);
  assert.match(shell,/watchIds = \['xdevices','deskstatus','connectbutton1'/);
  assert.match(shell,/window\.addEventListener\('pageshow', schedule\)/);
  assert.match(shell,/document\.addEventListener\('visibilitychange', schedule\)/);
  assert.doesNotMatch(shell,/setInterval|setTimeout/);
});

test('device inventory refreshes from native changes without polling and explains empty results',()=>{
  assert.match(devicesSource,/new MutationObserver\(scheduleUpdate\)/);
  assert.match(devicesSource,/viewSelect\.addEventListener\('change',scheduleUpdate\)/);
  assert.match(devicesSource,/visibilitychange',scheduleUpdate/);
  assert.doesNotMatch(devicesSource,/setInterval|1800\)/);
  assert.match(devicesSource,/No managed devices are available to this account/);
  assert.match(devicesSource,/No favorites yet/);
  assert.match(devicesSource,/Clear filters/);
});

test('mobile dock state follows native page and control changes without polling',()=>{
  assert.match(mobileControls,/new MutationObserver\(scheduleUpdate\)/);
  assert.match(mobileControls,/watchIds\.push\('p'\+page\)/);
  assert.match(mobileControls,/target\.id==='deskarea0'/);
  assert.match(mobileControls,/else scheduleUpdate\(\)/);
  assert.doesNotMatch(mobileControls,/setInterval/);
  assert.match(mobileControls,/searchReturnFocus/);
  assert.match(mobileControls,/aria-expanded','false'/);
  assert.match(mobileControls,/toggleMobileModifier/);
  assert.match(mobileControls,/window\._mobileModifiers/);
  assert.match(mobileControls,/Disable trackpad mode/);
  assert.match(mobileControls,/Disable right-click mode/);
});

test('custom script bundle matches its modular source components',()=>{
  const result=spawnSync(process.execPath,['scripts/build-night-shift.js','--check'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr || 'Generated custom.js is stale or the build script is missing');
});

test('device health uses cached native details and delegates CPU graph to MeshCentral',()=>{
  assert.match(health,/function uptime\(date, now\)/);
  assert.match(health,/formatUptime:uptime/);
  assert.match(health,/Uptime \/ last boot/);
  assert.match(health,/DeviceDetailsHardware/);
  assert.match(health,/deviceDetailsStatsChart/);
  assert.match(health,/ns-native-health-sample/);
  assert.match(health,/ns-native-storage-sample/);
  assert.match(health,/devListToolbarViewIcons3/);
  assert.match(health,/native\.click\(\)/);
  assert.match(health,/installClearHook/);
  assert.match(health,/lastNodeId !== node\._id/);
  assert.doesNotMatch(health,/setInterval|send\(\s*\{\s*action:\s*['"]msg['"]|recoveryPassword|encryptionMethod|bitlocker/i);
  assert.match(health,/sizeremaining/);

  const ids=new Map(),calls=[];
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.parentNode=null;this.textContent='';}
    set id(value){this._id=value;ids.set(value,this);} get id(){return this._id||'';}
    append(...nodes){nodes.forEach(node=>{node.parentNode=this;this.children.push(node);});}
    insertBefore(node,anchor){node.parentNode=this;const index=this.children.indexOf(anchor);this.children.splice(index<0?this.children.length:index,0,node);}
    setAttribute(key,value){this.attributes[key]=String(value);}
    addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
  }
  const parent=new Element('div'),host=new Element('div');host.id='p17info';parent.append(host);
  const info=new Element('div');info.id='p17info2';host.append(info);
  const page=new Element('div');page.id='p17';
  const window={currentNode:{_id:'node/a',conn:1,osdesc:'Windows'},deviceDetailsStatsClear(){calls.push('clear');return 'native result';},addEventListener(){}};
  const document={readyState:'complete',getElementById:id=>ids.get(id)||null,querySelector(){return null;},addEventListener(){},createElement:tag=>new Element(tag)};
  vm.runInNewContext(health,{window,document,console,MutationObserver:undefined,Date,isFinite},{timeout:1000});
  const grid=ids.get('ns-device-health').children[1],cpu=grid.children[2].children[1],memory=grid.children[3].children[1];
  cpu.textContent='41.2%';memory.textContent='67.5%';
  assert.equal(window.deviceDetailsStatsClear(),'native result','wrapped cleanup preserves the native return value');
  assert.deepEqual(calls,['clear'],'native graph cleanup still runs');
  assert.equal(cpu.textContent,'Unavailable','closing the native graph clears its stale CPU sample');
  assert.equal(memory.textContent,'Unavailable','closing the native graph clears its stale memory sample');
  cpu.textContent='41.2%';memory.textContent='67.5%';window.currentNode={_id:'node/b',conn:1};window.__NightShiftHealth.refresh();
  assert.equal(cpu.textContent,'Unavailable','switching devices cannot display the prior device CPU sample');
  assert.equal(memory.textContent,'Unavailable','switching devices cannot display the prior device memory sample');
});

test('device health expires CPU and memory values after native graph samples stop',()=>{
  const ids=new Map(), timers=new Map(); let nextTimer=0, controlHandler;
  class Element {
    constructor(){this.children=[];this.parentNode=null;this.textContent='';}
    set id(value){this._id=value;ids.set(value,this);} get id(){return this._id||'';}
    append(...nodes){nodes.forEach(node=>{node.parentNode=this;this.children.push(node);});}
    insertBefore(node,anchor){node.parentNode=this;const index=this.children.indexOf(anchor);this.children.splice(index<0?this.children.length:index,0,node);}
    setAttribute(){}
    addEventListener(name,fn){if(name==='click')controlHandler=fn;}
  }
  const parent=new Element(),host=new Element();host.id='p17info';parent.append(host);
  const info=new Element();info.id='p17info2';host.append(info);const page=new Element();page.id='p17';
  const graphControl={addEventListener(name,fn){if(name==='click')controlHandler=fn;}};
  const window={currentNode:{_id:'node/a',conn:1},deviceDetailsStatsData:[[1,41.2,67.5]],deviceDetailsStatsChart:{update(){}},addEventListener(){}};
  const document={readyState:'complete',getElementById:id=>ids.get(id)||null,querySelector:()=>graphControl,addEventListener(){},createElement:()=>new Element()};
  const setTimeout=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;};
  const clearTimeout=id=>timers.delete(id);
  vm.runInNewContext(health,{window,document,console,MutationObserver:undefined,Date,isFinite,setTimeout,clearTimeout},{timeout:1000});
  controlHandler();
  const install=[...timers.entries()].find(([,timer])=>timer.delay===0); install[1].fn(); timers.delete(install[0]);
  window.deviceDetailsStatsChart.update();
  const grid=ids.get('ns-device-health').children[1],cpu=grid.children[2].children[1],memory=grid.children[3].children[1];
  assert.equal(cpu.textContent,'41.2%');assert.equal(memory.textContent,'67.5%');
  let expiry=[...timers.values()].find(timer=>timer.delay===6000);assert.ok(expiry,'a single six-second expiry is scheduled');
  window.deviceDetailsStatsData.push([2,42,68]);window.deviceDetailsStatsChart.update();
  expiry.fn();
  assert.equal(cpu.textContent,'42.0%','an older expiry cannot clear a newer sample');
  expiry=[...timers.values()].find(timer=>timer.delay===6000&&timer.fn!==expiry.fn);
  assert.ok(expiry,'the newest sample has its own expiry');expiry.fn();
  assert.equal(cpu.textContent,'Unavailable');assert.equal(memory.textContent,'Unavailable');
});

test('native device-details refresh shows pending, timeout, and response feedback without replacing its handler',()=>{
  assert.match(css,/\.ns-health-refresh-status\{[^}]*font-size:\.82rem/,'The live response hint has a compact visible treatment');
  const ids=new Map(),timers=new Map(),calls=[],documentEvents={};let nextTimer=0,activeControl;
  class Element {
    constructor(){this.children=[];this.attributes={};this.events={};this.parentNode=null;this.textContent='';this.hidden=false;}
    set id(value){this._id=value;ids.set(value,this);} get id(){return this._id||'';}
    get nextSibling(){if(!this.parentNode)return null;const siblings=this.parentNode.children;return siblings[siblings.indexOf(this)+1]||null;}
    append(...nodes){nodes.forEach(node=>{node.parentNode=this;this.children.push(node);});}
    insertBefore(node,anchor){node.parentNode=this;const index=this.children.indexOf(anchor);this.children.splice(index<0?this.children.length:index,0,node);}
    setAttribute(name,value){this.attributes[name]=String(value);}
    addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
  }
  const parent=new Element(),title=new Element();title.id='p17title';parent.append(title);
  const host=new Element();host.id='p17info';parent.append(host);const page=new Element();page.id='p17';
  const refreshControl=new Element();activeControl=refreshControl;
  const nativeRefresh=function(){calls.push('native refresh');};
  const nativeUpdate=function(node){calls.push(['native update',node._id]);};
  const window={currentNode:{_id:'node/a',conn:1},refreshDetails:nativeRefresh,updateDeviceDetails:nativeUpdate,addEventListener(){}};
  const document={readyState:'complete',getElementById:id=>ids.get(id)||null,querySelector:selector=>selector.includes('Refresh details information')?activeControl:null,addEventListener:(name,fn)=>{(documentEvents[name]||=[]).push(fn);},createElement:()=>new Element()};
  const setTimeout=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;};
  const clearTimeout=id=>timers.delete(id);
  vm.runInNewContext(health,{window,document,Date,isFinite,setTimeout,clearTimeout},{timeout:1000});
  assert.equal(window.refreshDetails,nativeRefresh,'The native click handler is not replaced');
  refreshControl.events.click[0]();
  const status=ids.get('ns-details-refresh-status');
  assert.equal(status.attributes.role,'status');assert.equal(status.attributes['aria-live'],'polite');
  assert.equal(status.textContent,'Refreshing device details…');assert.equal(status.hidden,false);
  assert.ok([...timers.values()].some(timer=>timer.delay===12000),'A bounded wait explains when no response arrives');
  window.refreshDetails();assert.deepEqual(calls,['native refresh'],'The original MeshCentral refresh action still runs');
  const timeout=[...timers.entries()].find(([,timer])=>timer.delay===12000);timeout[1].fn();timers.delete(timeout[0]);
  assert.equal(status.textContent,'No device details response yet. You can retry.','Timeout does not claim that the request failed');
  window.updateDeviceDetails(window.currentNode,{windows:{}});
  assert.deepEqual(calls,['native refresh',['native update','node/a']]);
  assert.equal(status.textContent,'Device details response received.','A native details update is the only success signal');

  // MeshCentral can replace the page title and native toolbar when changing
  // devices without reloading this script. The delegated refresh hook should
  // bind the new control, and feedback must be attached to the new title.
  const replacementParent=new Element(),replacementTitle=new Element();replacementTitle.id='p17title';replacementParent.append(replacementTitle);
  const replacementControl=new Element();activeControl=replacementControl;window.currentNode={_id:'node/b',conn:1};
  window.__NightShiftHealth.refresh();
  assert.equal(ids.get('ns-details-refresh-status').textContent,'','Changing devices clears the previous device response message');
  assert.equal(ids.get('ns-details-refresh-status').parentNode,replacementParent,'Route-change feedback is attached to the replacement title');
  const documentClick=documentEvents.click[0];
  const dispatchReplacementClick=()=>documentClick({target:{closest(selector){return selector.includes('Refresh details information')?replacementControl:null;}}});
  dispatchReplacementClick();
  const replacementStatus=ids.get('ns-details-refresh-status');
  assert.equal(replacementStatus.textContent,'Refreshing device details…','A replacement native toolbar still starts feedback');
  assert.equal(replacementStatus.parentNode,replacementParent,'Feedback is moved to the replacement details title');
  const refreshTimers=[...timers.entries()].filter(([,timer])=>timer.delay===12000);
  assert.equal(refreshTimers.length,1,'The replacement request has one active timeout');
  window.updateDeviceDetails({_id:'node/a'},{windows:{}});
  assert.equal(replacementStatus.textContent,'Refreshing device details…','A late response from the previous device cannot complete the new request');
  dispatchReplacementClick();
  assert.equal([...timers.values()].filter(timer=>timer.delay===12000).length,1,'Repeated refresh replaces rather than duplicates its timer');
  window.updateDeviceDetails(window.currentNode,{windows:{}});
  assert.equal(replacementStatus.textContent,'Device details response received.','The current device native response completes the replacement request');
});

test('elapsed uptime formatting is deterministic and rejects future boot dates',()=>{
  const window={};
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(health,{window,document,Date,isFinite},{timeout:1000});
  const now=Date.UTC(2026,10,5,12,0,0);
  const boot=new Date(now-(2*24*60+3*60+4)*60000);
  assert.match(window.__NightShiftHealth.formatUptime(boot,now),/^2 days 3h · booted /);
  assert.equal(window.__NightShiftHealth.formatUptime(new Date(now+60000),now),null);
  assert.equal(window.__NightShiftHealth.parseDmtfDate('20261105140000.000000+120').getTime(),Date.UTC(2026,10,5,12,0,0),'Windows DMTF positive UTC offset converts local boot time to UTC');
  assert.equal(window.__NightShiftHealth.parseDmtfDate('20261105100000.000000-120').getTime(),Date.UTC(2026,10,5,12,0,0),'Windows DMTF negative UTC offset converts local boot time to UTC');
  assert.equal(window.__NightShiftHealth.parseDmtfDate('20260230120000.000000+000'),null,'invalid calendar dates are not displayed as uptime');
});

test('device health reports native connection routes without mislabeling AMT as agent status',()=>{
  const window={};
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(health,{window,document,Date,isFinite},{timeout:1000});
  const route=window.__NightShiftHealth.connectionRoutes;
  assert.equal(route(1),'Agent');
  assert.equal(route(2),'AMT CIRA');
  assert.equal(route(4),'Intel AMT');
  assert.equal(route(8),'Relay');
  assert.equal(route(16),'MQTT');
  assert.equal(route(3),'Agent · AMT CIRA');
  assert.equal(route(0),'Offline');
  assert.equal(route(undefined),'Unavailable');
});

test('device health reports Agent connectivity only from native state and labels AMT-only nodes clearly',()=>{
  const window={},document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(health,{window,document,Date,isFinite},{timeout:1000});
  const status=window.__NightShiftHealth.agentStatus;
  assert.equal(status({conn:1,agent:{ver:'1.3.4'}}),'Connected · MeshAgent · 1.3.4');
  assert.equal(status({conn:0,agent:{ver:'1.2.0'}}),'Disconnected · MeshAgent · 1.2.0');
  assert.equal(status({conn:4,intelamt:{}}),'No MeshAgent · AMT available');
  assert.equal(status({conn:0}),'Unavailable');
  assert.equal(status({}),'Unavailable');
});

test('history search filters only native rendered events and recordings',()=>{
  assert.match(history,/p3events/);
  assert.match(history,/p52recordings/);
  assert.match(history,/Search loaded records/);
  assert.match(history,/aria-live','polite'/);
  assert.match(history,/Showing ' \+ counts\.visible \+ ' of '/);
  assert.match(history,/groupHeaders\.forEach/);
  assert.match(history,/item\.header\.hidden = !item\.visible/);
  assert.doesNotMatch(history,/meshserver\.send|downloadFile|openRecodringPlayer|localStorage|sessionStorage/);
});

test('history observer refresh does not rewrite unchanged status inside its observed page',()=>{
  let writes=0, observer;
  function element(){let text=''; return {children:[],value:'',append(...nodes){this.children.push(...nodes);},setAttribute(){},addEventListener(){},querySelectorAll(){return [];},get textContent(){return text;},set textContent(value){text=value; writes++;}};}
  const page=element(), title=element(), events=element();
  const ids={p3:page,p3title:title,p3events:events};
  const document={readyState:'complete',getElementById:id=>ids[id]||null,createElement:element};
  const window={addEventListener(){}};
  class MutationObserver {constructor(callback){observer=callback;} observe(){}}
  vm.runInNewContext(history,{document,window,MutationObserver},{timeout:1000});
  const afterBoot=writes;
  observer(); observer();
  assert.equal(writes,afterBoot,'observer callbacks must not create another child-list mutation');
});

test('rendered native events can be opened from the keyboard',()=>{
  const eventRow={dataset:{},textContent:'Server restarted',attributes:{},listeners:{},clicks:0,
    setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(name,callback){(this.listeners[name]||=[]).push(callback);},
    click(){this.clicks++;}};
  const rootNode={querySelectorAll(selector){return selector==='table.p3eventsTable tr[onclick*="showEventDetails"]'?[eventRow]:[];}};
  const document={readyState:'complete',getElementById(id){return id==='p3events'?rootNode:null;}};
  const window={addEventListener(){}};
  vm.runInNewContext(history,{window,document,console},{timeout:1000});
  assert.equal(eventRow.tabIndex,0,'native click rows enter keyboard tab order');
  assert.match(eventRow.attributes['aria-label'],/Open event details: Server restarted/);
  assert.equal(eventRow.listeners.keydown.length,1);
  for(const key of ['Enter',' ']){
    let prevented=false;
    eventRow.listeners.keydown[0]({target:eventRow,key,preventDefault(){prevented=true;}});
    assert.equal(prevented,true,key+' prevents its page-level default action');
  }
  assert.equal(eventRow.clicks,2,'Enter and Space delegate through the existing native event-row click handler');
  window.__NightShiftHistory.refresh();
  assert.equal(eventRow.listeners.keydown.length,1,'native rerenders do not install duplicate handlers');
  assert.match(css,/tr\[onclick\*="showEventDetails"\]:focus-visible/);
});

test('native recording rows open from Space without intercepting nested controls',()=>{
  const row={dataset:{},tabIndex:0,listeners:{},keypresses:[],hasAttribute(name){return name==='tabindex';},
    addEventListener(name,callback){(this.listeners[name]||=[]).push(callback);},
    dispatchEvent(event){this.keypresses.push(event);if(this.onkeypress)this.onkeypress(event);return true;},
    onkeypress(event){if(event.key==='Enter')this.opened=true;}};
  const rootNode={querySelectorAll(selector){return selector==='tbody tr[onkeypress*="showRecordingDialog"]'?[row]:[];}};
  const document={readyState:'complete',getElementById(id){return id==='p52recordings'?rootNode:null;}};
  class KeyEvent{constructor(type,options){this.type=type;Object.assign(this,options);}}
  const window={addEventListener(){}};
  vm.runInNewContext(history,{window,document,console,KeyboardEvent:KeyEvent},{timeout:1000});
  assert.equal(row.listeners.keydown.length,1);
  let prevented=false;
  row.listeners.keydown[0]({target:row,key:' ',preventDefault(){prevented=true;}});
  assert.equal(prevented,true,'Space does not scroll the recording list');
  assert.equal(row.opened,true,'Space invokes the row native recording-dialog keyboard handler');
  assert.equal(row.keypresses.length,1);
  assert.equal(row.keypresses[0].key,'Enter');
  assert.equal(row.keypresses[0].bubbles,false,'the delegated native key event stays on the row');
  row.listeners.keydown[0]({target:{},key:' ',preventDefault(){throw Error('nested controls must retain their own Space behavior');}});
  window.__NightShiftHistory.refresh();
  assert.equal(row.listeners.keydown.length,1,'native rerenders do not duplicate the keyboard handler');
});

test('history search counts matches and preserves date headings for matching recordings',()=>{
  const ids=new Map();
  class Element {
    constructor(tag,text=''){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.events={};this.hidden=false;this.value='';this._text=text;this.parentNode=null;this.kind='';}
    set id(value){this._id=value;ids.set(value,this);} get id(){return this._id||'';}
    set textContent(value){this._text=String(value);this.children=[];} get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    append(...nodes){nodes.forEach(node=>{node.parentNode=this;this.children.push(node);});}
    setAttribute(name,value){this.attributes[name]=String(value);}
    addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
    dispatch(name){(this.events[name]||[]).forEach(fn=>fn({target:this}));}
    click(){this.dispatch('click');}
    focus(){this.focused=true;}
    querySelectorAll(selector){
      if(selector==='table.p3eventsTable')return this.tables||[];
      if(selector==='tr'||selector==='tbody tr')return this.rows||this.children.filter(node=>node.tagName==='TR');
      if(selector==='td')return this.children.filter(node=>node.tagName==='TD');
      if(selector==='tbody')return this.bodies||[];
      return [];
    }
    querySelector(selector){if(selector==='td[colspan]'&&this.header)return this.children[0]||null;return null;}
    get nextElementSibling(){if(!this.parentNode)return null;const i=this.parentNode.children.indexOf(this);return this.parentNode.children[i+1]||null;}
  }
  const makeRow=(text,cells,header=false)=>{const row=new Element('tr');row.header=header;row.cells=cells;for(let i=0;i<cells;i++)row.append(new Element('td',i===0?text:''));return row;};
  const p3events=new Element('div');p3events.id='p3events';
  const eventTable=new Element('table');eventTable.rows=[makeRow('date',4,true),makeRow('Disk alert',3),makeRow('',0),makeRow('User login',3),makeRow('',0)];eventTable.rows.forEach(row=>eventTable.append(row));p3events.tables=[eventTable];
  const p52recordings=new Element('div');p52recordings.id='p52recordings';
  const tbody=new Element('tbody');tbody.rows=[makeRow('2026-11-05',4,true),makeRow('Alpha workstation',2),makeRow('Beta laptop',2)];tbody.rows.forEach(row=>tbody.append(row));p52recordings.bodies=[tbody];
  ['p3','p3title','p52','p52title'].forEach(id=>{const el=new Element('div');el.id=id;});
  const document={readyState:'complete',createElement:tag=>new Element(tag),getElementById:id=>ids.get(id)||null,addEventListener(){}};
  vm.runInNewContext(history,{window:{addEventListener(){}},document,console,MutationObserver:class{observe(){}}},{timeout:1000});
  const eventsWrap=ids.get('p3title').children[0],recordingsWrap=ids.get('p52title').children[0];
  const eventsInput=eventsWrap.children[0].children[1],recordingsInput=recordingsWrap.children[0].children[1];
  const clearEvents=eventsWrap.children[1],clearRecordings=recordingsWrap.children[1];
  const eventStatus=ids.get('p3title').children[1],recordingStatus=ids.get('p52title').children[1];
  assert.equal(eventStatus.textContent,'2 loaded events.');
  assert.equal(recordingStatus.textContent,'2 loaded recordings.');
  assert.equal(clearEvents.hidden,true,'clear action is hidden while the search is empty');
  eventsInput.value='disk';eventsInput.dispatch('input');
  assert.equal(eventTable.rows[1].hidden,false);assert.equal(eventTable.rows[3].hidden,true);assert.equal(eventStatus.textContent,'Showing 1 of 2 loaded events.');
  assert.equal(clearEvents.hidden,false,'clear action appears when a search is active');
  clearEvents.click();
  assert.equal(eventsInput.value,'','clear action resets the search text');
  assert.equal(eventsInput.focused,true,'clear action returns keyboard focus to its search field');
  assert.equal(eventTable.rows[3].hidden,false,'clear action restores every loaded event');
  assert.equal(eventStatus.textContent,'2 loaded events.');
  recordingsInput.value='alpha';recordingsInput.dispatch('input');
  assert.equal(tbody.rows[0].hidden,false,'The date heading stays visible while its group has a match');
  assert.equal(tbody.rows[2].hidden,true);assert.equal(recordingStatus.textContent,'Showing 1 of 2 loaded recordings.');
  recordingsInput.value='no match';recordingsInput.dispatch('input');
  assert.equal(tbody.rows[0].hidden,true,'The date heading hides with an empty group');
  assert.equal(recordingStatus.textContent,'No matching recordings in loaded records.');
  clearRecordings.click();
  assert.equal(tbody.rows[0].hidden,false,'clearing recordings search restores date headings');
  assert.equal(tbody.rows[2].hidden,false,'clearing recordings search restores all loaded rows');
});

test('file workspace filters the current folder and uses native selection actions',()=>{
  assert.match(files,/p13files/);
  assert.match(files,/p13filetree/);
  assert.match(files,/window\.p13doUploadFiles\(dropped\)/);
  assert.match(files,/p13UploadButton/);
  for (const id of ['p13DownloadButton','p13RenameFileButton','p13DeleteFileButton']) assert.ok(files.includes(id));
  assert.doesNotMatch(files,/files\.send|fetch\s*\(|XMLHttpRequest|checksum|resume/);
});

test('upload queue display follows native queued files and native progress state',()=>{
  assert.match(files,/window\.uploadFile/);
  assert.match(files,/upload\.xfiles/);
  assert.match(files,/typeof upload\.xfiles\.length !== 'number'/);
  assert.match(files,/d2progressLabel/);
  assert.match(files,/aria-live',\s*'polite'/);
  assert.match(files,/new MutationObserver\(updateUploadQueue\)/);
  assert.match(files,/window\.p13doUploadFiles\(dropped\)/);
  assert.match(css,/\.ns-transfer-queue/);
  assert.match(files,/window\.p13gotUploadData = function/);
  assert.match(files,/action === 'uploaddone'.*Completed/);
  assert.match(files,/action === 'uploaderror'.*Failed/);
  assert.match(files,/window\.p13doUploadFiles\(\[entry\.file\]\)/);
  assert.match(files,/Recent transfers/);
  assert.match(css,/\.ns-transfer-history/);
  assert.match(files,/historyAnnouncement\.setAttribute\('role','status'\)/);
  assert.match(files,/historyAnnouncement\.setAttribute\('aria-live','polite'\)/);
  assert.match(files,/announceTransfer\(entry\)/);
  assert.match(files,/aria-label','Clear recent transfer history'/);
  assert.match(files,/historyAnnouncement\.textContent = 'Transfer history cleared\.'/);
  assert.match(css,/\.ns-transfer-announcement\{position:absolute;width:1px;height:1px/);
  assert.match(css,/\.ns-transfer-clear:focus-visible/);
  assert.doesNotMatch(files,/fetch\(|XMLHttpRequest|WebSocket\(/);
});

test('upload history observes native acknowledgments and retries through the native uploader',()=>{
  const ids=new Map(), calls=[];
  class Element {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.events={};this.classList={add(){}};this.hidden=false;this.disabled=false;this.textContent='';this.value='';}
    set id(value){this._id=value;ids.set(value,this);} get id(){return this._id||'';}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=nodes;}
    remove(){this.removed=true;}
    setAttribute(name,value){this.attributes[name]=String(value);}
    addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
    click(){(this.events.click||[]).forEach(fn=>fn({target:this}));}
    querySelectorAll(){return [];}
    insertAdjacentElement(){ }
  }
  ['p13','p13title','p13filetable','p13files','p13UploadButton','p13DownloadButton'].forEach(id=>{const el=new Element('div');el.id=id;});
  ids.get('p13UploadButton').disabled=false;
  ids.get('p13DownloadButton').disabled=false;
  const nativeCalls=[],downloads=[];const file={name:'inventory.csv',size:12};let failUpload=false,failDownload=false;
  const window={currentNode:{_id:'node/a'},uploadFile:{xfiles:[file],xfilePtr:0},p13gotUploadData(message){nativeCalls.push(message.action);},p13doUploadFiles(items){calls.push(items);if(failUpload)throw new Error('upload start failed');},p13downloadDeviceFile(path){downloads.push(path);if(failDownload)throw new Error('download start failed');}};
  const document={readyState:'complete',createElement:tag=>new Element(tag),getElementById:id=>ids.get(id)||null,querySelector(){return null;},addEventListener(){}};
  const context={window,document,console,MutationObserver:class{observe(){}},addEventListener(){}};
  vm.runInNewContext(files,context,{timeout:1000});
  window.p13gotUploadData({action:'uploadstart'});
  window.p13gotUploadData({action:'uploaderror'});
  const history=ids.get('p13filetable').children.find(node=>node.className==='ns-transfer-history');
  const clear=history.children[1], announcement=history.children[2], list=history.children[3];
  assert.equal(clear.textContent,'Clear history');
  assert.equal(clear.attributes['aria-label'],'Clear recent transfer history');
  assert.equal(announcement.attributes.role,'status');
  assert.equal(announcement.attributes['aria-live'],'polite');
  assert.equal(announcement.textContent,'Upload inventory.csv: Failed.','native upload acknowledgments announce their resulting state');
  const item=list.children[0];
  assert.equal(item.children[1].textContent,'Failed');
  item.children[2].click();
  assert.equal(calls.length,1,'Retry invokes the native upload function once');
  assert.equal(calls[0][0],file,'Retry reuses the selected File object through the native upload function');
  assert.deepEqual(nativeCalls,['uploadstart','uploaderror'],'Native acknowledgment handling still runs');
  window.p13downloadDeviceFile('folder%2Freport.zip');
  const downloadRow=list.children.find(row=>row.children[0].textContent==='report.zip');
  assert.equal(announcement.textContent,'Download report.zip: Requested.','download requests are announced without claiming completion');
  assert.equal(downloadRow.children[1].textContent,'Requested','Browser downloads are labeled requested, not falsely reported complete');
  window.currentNode={_id:'node/b'};downloadRow.children[2].click();
  assert.deepEqual(downloads,['folder%2Freport.zip'],'History cannot replay a download against a different device');
  window.currentNode={_id:'node/a'};downloadRow.children[2].click();
  assert.deepEqual(downloads,['folder%2Freport.zip','folder%2Freport.zip'],'Download again uses the native MeshCentral endpoint');
  failDownload=true;assert.equal(window.p13downloadDeviceFile('folder%2Fbroken.zip'),false,'synchronous native download start failures are contained');
  const failedDownload=list.children.find(row=>row.children[0].textContent==='broken.zip');
  assert.equal(failedDownload.children[1].textContent,'Failed to start','failed downloads are not shown as pending requests');
  assert.equal(announcement.textContent,'Download broken.zip: Failed to start.');
  window.p13gotUploadData({action:'uploaderror'});
  failUpload=true;const retry=list.children.find(row=>row.children[0].textContent==='inventory.csv').children[2];retry.click();
  const failedRetry=list.children.find(row=>row.children[0].textContent==='inventory.csv');
  assert.equal(failedRetry.children[1].textContent,'Failed to start','native upload startup exceptions remain retryable and visible');
  assert.equal(announcement.textContent,'Upload inventory.csv: Failed to start.');
  clear.click();
  assert.equal(list.children.length,1,'clearing replaces rows with the empty history message');
  assert.equal(list.children[0].textContent,'Transfers started in this page will appear here.');
  assert.equal(announcement.textContent,'Transfer history cleared.','clearing the local history is announced');
  for(let i=0;i<22;i++)window.p13downloadDeviceFile('history%2Fitem-'+i+'.bin');
  assert.equal(list.children.length,20,'transfer history remains bounded to the newest 20 page-session entries');
  assert.equal(list.children[0].children[0].textContent,'item-21.bin','the newest transfer stays first when older entries are dropped');
});

test('quick power and command actions mirror MeshCentral rights and open its native audit flow',()=>{
  assert.match(actions,/GetNodeRights\(node\)/);
  assert.match(actions,/window\.deviceActionFunction\(\)/);
  assert.match(actions,/window\.runDeviceCmd\(\)/);
  assert.match(actions,/131072/);
  assert.match(actions,/262144/);
  assert.doesNotMatch(actions,/meshserver\.send|poweraction|runcommands/);
});

test('native action shortcuts remain disabled without rights and supported node type',()=>{
  class FakeElement {
    constructor(tag){this.tagName=tag;this.children=[];this.events={};this.attributes={};this.disabled=false;this.hidden=false;this.parentNode=null;this.textContent='';}
    append(...children){children.forEach(child=>{child.parentNode=this;this.children.push(child);});}
    insertBefore(child,reference){child.parentNode=this;const index=this.children.indexOf(reference);this.children.splice(index<0?this.children.length:index,0,child);}
    setAttribute(k,v){this.attributes[k]=v;}
    addEventListener(type,fn){(this.events[type] ||= []).push(fn);}
    click(){(this.events.click||[]).forEach(fn=>fn({target:this}));}
  }
  const ids=new Map();
  const host=new FakeElement('div');host.id='p10';ids.set('p10',host);
  const anchor=new FakeElement('div');anchor.id='p10info';anchor.parentNode=host;ids.set('p10info',anchor);
  const calls=[];
  const window={currentNode:{_id:'node/a',mtype:3,conn:1,agent:{id:1}},GetNodeRights:()=>131072,
    deviceActionFunction:()=>calls.push('power'),runDeviceCmd:()=>calls.push('command')};
  const document={readyState:'complete',getElementById:id=>ids.get(id)||null,createElement:tag=>new FakeElement(tag),addEventListener(){}};
  vm.runInNewContext(actions,{window,document,console},{timeout:1000});
  const row=host.children[0].children[2],power=row.children[0],commands=row.children[1];
  assert.equal(commands.disabled,true,'non-agent device type cannot run configured commands');
  assert.equal(power.disabled,true,'command right alone does not grant power actions');
  window.currentNode.mtype=2;window.GetNodeRights=()=>131072;window.__NightShiftActions.refresh();
  assert.equal(commands.disabled,false);commands.click();assert.deepEqual(calls,['command']);
  window.GetNodeRights=()=>262144;window.__NightShiftActions.refresh();
  assert.equal(power.disabled,false);power.click();assert.deepEqual(calls,['command','power']);
});

test('connection alerts are opt-in, device-scoped, deduplicated and quiet-hours aware',()=>{
  assert.match(alerts,/putstore\(key\(activeNode\)/);
  assert.match(alerts,/Notification\.requestPermission/);
  assert.match(alerts,/300000/);
  assert.match(alerts,/lastNotices\[dedupeKey\]/);
  assert.match(alerts,/quietNow/);
  assert.match(alerts,/CPU threshold/);
  assert.match(alerts,/ns-native-health-sample/);
  assert.match(alerts,/ns-native-storage-sample/);
  assert.match(alerts,/seedFleetStates/);
  assert.match(alerts,/installFleetConnectionHook/);
  assert.match(alerts,/preferences\.e === 1/);
  assert.match(alerts,/status\.setAttribute\('role','status'\); status\.setAttribute\('aria-live','polite'\); status\.setAttribute\('aria-atomic','true'\)/);
  assert.doesNotMatch(alerts,/setInterval|meshserver\.send|poweraction|runcommands/);
});

test('alert deduplication history expires old keys and recovers from clock changes',()=>{
  const helper=alerts.match(/function pruneNoticeHistory\(nowTime\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'notification history has an expiry helper');
  const lastNotices={expired:1,recent:700000,future:900001,invalid:'bad'};
  const prune=vm.runInNewContext('('+helper[0]+')',{lastNotices,Object,isFinite});
  prune(900000);
  assert.deepEqual(Object.keys(lastNotices),['recent'],'only timestamps within the five-minute dedupe interval remain');
  assert.match(alerts,/pruneNoticeHistory\(nowTime\)/,'each allowed notification prunes expired dedupe keys');
});

test('configurable alert thresholds clamp to valid percentages and recover invalid preferences',()=>{
  const helper=alerts.match(/function normalizeThreshold\(value, fallback\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'alert threshold normalizer exists');
  const normalize=vm.runInNewContext('('+helper[0]+')');
  assert.equal(normalize('',85),'85','empty settings fall back to the documented default');
  assert.equal(normalize('not-a-number',90),'90','malformed saved settings recover to the documented default');
  assert.equal(normalize('-4',15),'1','thresholds cannot be set below one percent');
  assert.equal(normalize('130',15),'100','thresholds cannot exceed one hundred percent');
  assert.equal(normalize('36.7',15),'37','percentage thresholds use whole numbers');
  assert.match(alerts,/normalizeThreshold\(prefs\.c,85\)/);
  assert.match(alerts,/value\.cpu >= Number\(normalizeThreshold\(cpuLimit\.value,85\)\)/);
  assert.match(alerts,/normalizeThreshold\(storageLimit\.value,15\)/);
});

test('alert settings explain denied and unavailable browser notifications',()=>{
  const helper=alerts.match(/function notificationStatus\(permission\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'notification permission status helper exists');
  const context={window:{}};
  const status=vm.runInNewContext('('+helper[0]+')',context);
  assert.match(status(),/unavailable/,'browsers without Notification receive a page-only explanation');
  context.window.Notification={permission:'denied'};
  assert.match(status(),/blocked/,'denied notification permission gives an actionable site-settings hint');
  context.window.Notification.permission='default';
  assert.match(status(),/request browser notifications/,'the user is told when enabling an alert can prompt');
  context.window.Notification.permission='granted';
  assert.match(status(),/notifications are enabled/,'granted permission is reflected accurately');
  assert.match(alerts,/enabled\.addEventListener\('change',saveToggle\)/);
  assert.match(alerts,/metricEnabled\.addEventListener\('change',saveToggle\)/);
  assert.match(alerts,/storageEnabled\.addEventListener\('change',saveToggle\)/);
  assert.match(alerts,/setPermissionStatus\(notificationStatus\(\)\)/,'notification guidance refreshes independently of the latest alert');
  assert.match(alerts,/status\.textContent = label;/,'alert announcements do not replace persistent permission guidance');
  assert.match(alerts,/permissionStatus = create\('p','ns-alert-permission-status',notificationStatus\(\)\)/);
  assert.match(alerts,/window\.addEventListener\('focus',update\)/,'permission guidance refreshes when returning from browser site settings');
});

test('alerts observer writes only changed permission text to avoid a self-triggering mutation loop',()=>{
  const helper=alerts.match(/function setPermissionStatus\(value\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'alert permission guidance has an idempotent writer');
  let writes=0;
  const permissionStatus={_text:'',get textContent(){return this._text;},set textContent(value){writes++;this._text=value;}};
  const setStatus=vm.runInNewContext('('+helper[0]+')',{permissionStatus});
  setStatus('Browser notifications are enabled.');
  setStatus('Browser notifications are enabled.');
  assert.equal(writes,1,'an observer callback that repeats the same status creates no second DOM mutation');
  assert.match(alerts,/if \(!panel\.hidden\) panel\.hidden = true/,'hidden-state updates are idempotent');
  assert.match(alerts,/if \(panel\.hidden\) panel\.hidden = false/,'visible-state updates are idempotent');
});

test('isolated alerts startup observer settles and catches the pre-fix feedback loop',()=>{
  function run(source,limit=30){
    const ids=new Map(),observers=[],pending=new Set();let callbacks=0;
    function changed(node,type){
      observers.forEach(observer=>observer.targets.forEach(({target,options})=>{
        let current=node,inside=current===target;
        while(!inside&&current&&options.subtree){current=current.parentNode;inside=current===target;}
        if(!inside)return;
        if(type==='childList'&&options.childList||type==='attributes'&&options.attributes)pending.add(observer);
      }));
    }
    class Element{
      constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.className='';this.hidden=false;this.events={};this.attributes={};this._text='';}
      set id(value){this._id=value;ids.set(value,this);}get id(){return this._id||'';}
      set textContent(value){this._text=String(value);this.children.forEach(child=>child.parentNode=null);this.children=[];changed(this,'childList');}
      get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
      append(...nodes){nodes.forEach(node=>{node.parentNode=this;this.children.push(node);});changed(this,'childList');}
      insertBefore(node,reference){node.parentNode=this;const index=this.children.indexOf(reference);this.children.splice(index<0?this.children.length:index,0,node);changed(this,'childList');}
      get nextSibling(){if(!this.parentNode)return null;const siblings=this.parentNode.children,index=siblings.indexOf(this);return siblings[index+1]||null;}
      setAttribute(name,value){this.attributes[name]=String(value);changed(this,'attributes');}
      addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
    }
    class MutationObserver{constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(target,options){this.targets.push({target,options});}}
    const host=new Element('div');host.id='p10info';
    const anchor=new Element('div');anchor.id='p10html2';host.append(anchor);
    const window={currentNode:null,addEventListener(){}};
    const document={readyState:'complete',getElementById:id=>ids.get(id)||null,createElement:tag=>new Element(tag),addEventListener(){}};
    vm.runInNewContext(source,{window,document,MutationObserver,console,Date,isFinite,Promise},{timeout:1000});
    host.setAttribute('data-native-refresh','1');
    while(pending.size&&callbacks<limit){const batch=Array.from(pending);pending.clear();batch.forEach(observer=>{callbacks++;observer.callback([]);});}
    return {callbacks,pending:pending.size,refresh:window.__NightShiftAlerts&&window.__NightShiftAlerts.refresh};
  }
  const fixed=run(alerts);
  assert.equal(fixed.pending,0,'the isolated Modern device-info startup drains its observer queue');
  assert.equal(fixed.callbacks,1,'one native refresh produces one observer callback and settles');
  const updateBlock=alerts.match(/function update\(\) \{[\s\S]*?\n  \}/);
  assert.ok(updateBlock,'alerts startup update callback exists');
  const regressed=alerts.replace(updateBlock[0],updateBlock[0].replace('setPermissionStatus(notificationStatus());','if (permissionStatus) permissionStatus.textContent = notificationStatus();'));
  const broken=run(regressed);
  assert.equal(broken.callbacks,30,'the pre-fix same-value text write repeatedly re-enters the observer');
  assert.ok(broken.pending>0,'the callback queue remains nonempty when the safety bound is reached');
});

test('alert delivery failures retain the in-page notice and explain browser fallback',()=>{
  const helper=alerts.match(/function notify\(node,dedupeKey,label,allowed,now,quietPreferences\) \{[\s\S]*?\n  \}/);
  assert.ok(helper,'alert delivery helper exists');
  const permissionStatus={textContent:''},status={textContent:''};
  const setHelper=alerts.match(/function setPermissionStatus\(value\) \{[\s\S]*?\n  \}/);
  const setPermissionStatus=vm.runInNewContext('('+setHelper[0]+')',{permissionStatus});
  function Notification(){throw new Error('OS notifications unavailable');}
  Notification.permission='granted';
  const context={window:{Notification},lastNotices:{},status,permissionStatus,setPermissionStatus,quietNow:()=>false,pruneNoticeHistory:()=>{}};
  const notify=vm.runInNewContext('('+helper[0]+')',context);
  notify({_id:'node/a'},'node/a|offline','Archive connection: offline',true,new Date(1000));
  assert.equal(status.textContent,'Archive connection: offline','the alert remains visible in-page when OS notification creation fails');
  assert.match(permissionStatus.textContent,/could not display.*in-page alerts remain available/i,'the failure is explained through the permission guidance region');
});

test('fleet connection alerts observe native device updates only for opted-in devices',()=>{
  const alertsSource=read('public/scripts/night-shift/alerts.js'),notifications=[],nativeCalls=[];
  const nodes=[{_id:'node/a',name:'Allowed',conn:0},{_id:'node/b',name:'Muted',conn:0}];
  class Notification { constructor(title,options){notifications.push({title,options});} }
  Notification.permission='granted';
  const window={nodes,Notification,getstore:key=>key==='nsAlerts.node/a'?'{"e":1}':'{}',updateDeviceViewDevice(node){nativeCalls.push(node._id);}};
  const document={readyState:'complete',getElementById(){return null;},addEventListener(){}};
  vm.runInNewContext(alertsSource,{window,document,console,Date,MutationObserver:undefined},{timeout:1000});
  nodes[0].conn=1;window.updateDeviceViewDevice(nodes[0]);
  nodes[1].conn=1;window.updateDeviceViewDevice(nodes[1]);
  assert.equal(notifications.length,1,'Only a device with its own saved alert preference produces a notification');
  assert.match(notifications[0].options.body,/Allowed connection: agent/);
  assert.deepEqual(nativeCalls,['node/a','node/b'],'The original MeshCentral view updater still runs for both devices');
});

test('PWA install shortcut uses native browser installability and user gesture',()=>{
  assert.match(pwa,/beforeinstallprompt/);
  assert.match(pwa,/deferred\.prompt\(\)/);
  assert.match(pwa,/appinstalled/);
  assert.match(pwa,/manualInstallAvailable/);
  assert.match(pwa,/Add to Home Screen/);
  assert.match(read('public/scripts/night-shift/shell.js'),/right\.id = 'ns-appbar-actions'/);
  assert.doesNotMatch(pwa,/serviceWorker\.register|caches\.open|fetch\s*\(/);
  assert.match(read('views/default3.handlebars'),/rel="manifest" href="\{\{\{domainurl\}\}\}manifest\.json"/);
});

test('iOS manual installation guidance is limited to non-standalone Apple mobile browsers',()=>{
  const window={navigator:{userAgent:'Mozilla/5.0 (iPhone)',platform:'iPhone',standalone:false},addEventListener(){},matchMedia:()=>({matches:false})};
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(pwa,{window,document,Promise},{timeout:1000});
  assert.equal(window.__NightShiftPwa.manualInstallAvailable(),true);
  window.navigator.standalone=true;
  assert.equal(window.__NightShiftPwa.manualInstallAvailable(),false);
  window.navigator.standalone=false;window.matchMedia=()=>({matches:true});
  assert.equal(window.__NightShiftPwa.manualInstallAvailable(),false);
});

test('PWA installs are mounted in the appbar and manual guidance is keyboard reachable',()=>{
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.events={};this.attributes={};this.hidden=false;}
    append(...children){children.forEach(child=>{child.parentNode=this;this.children.push(child);});}
    setAttribute(key,value){this.attributes[key]=String(value);}
    addEventListener(type,handler){(this.events[type]||=[]).push(handler);}
    click(){(this.events.click||[]).forEach(handler=>handler({type:'click'}));}
    focus(){this.focused=true;}
  }
  const host=new Element('div');host.id='ns-appbar-actions';
  const appbar=new Element('header');appbar.id='ns-appbar';
  const ids=new Map([[host.id,host],[appbar.id,appbar]]);
  const window={navigator:{userAgent:'iPhone',platform:'iPhone',standalone:false},addEventListener(){},matchMedia:()=>({matches:false})};
  const document={readyState:'loading',getElementById:id=>ids.get(id)||null,createElement:tag=>new Element(tag),addEventListener(){}};
  vm.runInNewContext(pwa,{window,document,Promise},{timeout:1000});
  window.__NightShiftPwa.refresh();
  const install=host.children.find(node=>node.className==='ns-install-app');
  const help=appbar.children.find(node=>node.className==='ns-install-help');
  assert.equal(install.textContent,'Add to Home Screen');
  assert.equal(install.hidden,false);
  install.click();
  assert.equal(help.hidden,false);
  assert.equal(install.attributes['aria-expanded'],'true');
  assert.equal(help.children[1].focused,true,'Opening install guidance moves focus to its close control');
});

test('device capability summary reads native tab availability without replacing navigation',()=>{
  assert.match(capabilities,/MainDevDesktop/);
  assert.match(capabilities,/MainDevTerminal/);
  assert.match(capabilities,/MainDevFiles/);
  assert.match(capabilities,/MainDevAmt/);
  assert.match(capabilities,/Unavailable/);
  assert.match(capabilities,/window\.go\(item\[2\],event\)/);
  assert.doesNotMatch(capabilities,/dispatchEvent|\.click\(|gotoDevice|meshserver\.send/);
});

test('capability summary updates from the native tab visibility state',()=>{
  class FakeElement {
    constructor(){this.children=[];this.style={display:'block'};this.attributes={};this.dataset={};this.hidden=false;this.disabled=false;this.className='';}
    append(...children){children.forEach(child=>this.children.push(child));}
    insertBefore(child){this.children.unshift(child);}
    setAttribute(k,v){this.attributes[k]=v;}
    getAttribute(k){return this.attributes[k] ?? null;}
    addEventListener(name,fn){(this.events||={})[name]=fn;}
    click(){if(this.events&&this.events.click)this.events.click({which:1,button:0,shiftKey:false,preventDefault(){}});}
    getClientRects(){return this.style.display==='none'||this.hidden?[]:[{}];}
  }
  const ids=new Map(), p10=new FakeElement(), host=new FakeElement();ids.set('p10',p10);ids.set('p10info',host);
  for(const id of ['MainDevDesktop','MainDevTerminal','MainDevFiles','MainDevAmt']){const el=new FakeElement();ids.set(id,el);}
  ids.get('MainDevTerminal').style.display='none';ids.get('MainDevAmt').style.display='none';
  const document={readyState:'complete',getElementById:id=>ids.get(id)||null,createElement:()=>new FakeElement(),addEventListener(){}};
  const routes=[],window={go:(view,event)=>routes.push([view,event.which])};
  vm.runInNewContext(capabilities,{window,document,console,getComputedStyle:el=>el.style},{timeout:1000});
  const panel=host.children[0], rows=panel.children[1].children;
  assert.equal(rows[0].children[1].textContent,'Available');
  assert.equal(rows[0].children[2].hidden,false,'Available native tools expose an Open action');
  rows[0].children[2].click();
  assert.deepEqual(routes,[[11,1]],'Open delegates to MeshCentral native go() navigation');
  assert.equal(rows[1].children[1].textContent,'Unavailable');
  assert.equal(rows[1].children[2].hidden,true,'Unavailable native tools do not expose an action');
  ids.get('MainDevFiles').style.display='none';window.__NightShiftCapabilities.refresh();
  assert.equal(rows[2].children[1].textContent,'Unavailable');
  assert.equal(rows[2].children[2].disabled,true,'Availability changes disable the native navigation action');
});

test('remote viewer information drawer preserves native details navigation',()=>{
  assert.match(viewer,/aria-expanded/);
  assert.match(viewer,/ns-viewer-info-drawer/);
  assert.match(viewer,/MainDevInfo/);
  assert.match(viewer,/Escape/);
  assert.match(viewer,/window\.desktop/);
  assert.doesNotMatch(viewer,/new\s+WebSocket|meshserver\.send|gotoDevice/);
});

test('remote viewer Info toggle reserves a responsive slot beside the masthead account controls',()=>{
  const infoRule=css.match(/\.ns-viewer-info-toggle\{([^}]+)\}/);
  assert.ok(infoRule,'the fixed Info control has a responsive position rule');
  assert.match(infoRule[1],/right:calc\(1rem \+ clamp\(4rem,26vw,15rem\)\)/,
    'a width-scaled account-control reserve keeps Info clear at desktop and landscape widths');
  const accountReservePx=width=>Math.min(15*16,Math.max(4*16,width*.26));
  assert.ok(accountReservePx(904)>=219,'the landscape reservation exceeds the measured 219px account control');
  assert.ok(accountReservePx(1440)>=219,'the wide desktop reservation still clears the account control');
  assert.ok(accountReservePx(412)>=44,'phone widths reserve at least the avatar and caret control width');
  const phoneRule=css.match(/@media\(max-width:700px\)\{\.ns-viewer-info-drawer\{[^}]+\}\.ns-viewer-info-toggle\{([^}]+)\}/);
  assert.ok(phoneRule,'phone drawer and toggle adjustments remain scoped to the narrow viewport');
  assert.match(phoneRule[1],/top:/);
  assert.doesNotMatch(phoneRule[1],/right:/,'the phone rule must not move Info back over the account controls');
});

test('floating desktop viewer controls use only visible native controls and auto-hide',()=>{
  assert.match(viewer,/ns-viewer-controls/);
  assert.match(viewer,/pointermove/);
  assert.match(viewer,/setTimeout\(hideControls,2800\)/);
  assert.match(viewer,/nativeAction\(item\[2\]\)/);
  assert.match(viewer,/native\.click\(\)/);
  assert.match(viewer,/window\.deskToggleFull\(\{shiftKey:false\}\)/);
  assert.match(viewer,/controls\.hidden = !visible\(\$\('p11'\)\)/);
  assert.match(viewer,/ArrowLeft','ArrowRight','Home','End/);
  assert.match(viewer,/aria-orientation','horizontal'/);
  assert.match(viewer,/connectbutton1r/);
  assert.match(viewer,/disconnectbutton1/);
  assert.match(css,/\.ns-viewer-controls\.is-idle/);
  assert.match(css,/@media\(max-width:900px\)\{\.ns-viewer-controls\{display:none!important\}/);
});

test('viewer toolbar stays within the active viewer and delegates fullscreen',()=>{
  const ids=new Map();
  class Element {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.events={};this.attributes={};this.style={};this.hidden=false;this.className='';this.parentNode=null;}
    set id(value){this._id=value;ids.set(value,this);}
    get id(){return this._id||'';}
    append(...nodes){nodes.forEach(node=>{node.parentNode=this;this.children.push(node);});}
    setAttribute(key,value){this.attributes[key]=String(value);}
    getAttribute(key){return this.attributes[key]??null;}
    addEventListener(type,handler){(this.events[type]||=[]).push(handler);}
    click(){this.clickCount=(this.clickCount||0)+1;(this.events.click||[]).forEach(handler=>handler({type:'click'}));}
    focus(){this.focused=true;document.activeElement=this;}
    getClientRects(){return this.hidden?[]:[{}];}
    querySelector(){return ids.get('native-fullscreen')||null;}
    contains(node){return this.children.includes(node);}
    matches(){return false;}
    get classList(){return {add(){},remove(){}};}
  }
  const body=new Element('body'), p11=new Element('div');p11.id='p11';
  const title=new Element('div');title.id='p11title';
  const full=new Element('button');full.id='native-fullscreen';full.hidden=true;
  const connect=new Element('button');connect.id='connectbutton1';
  const rdp=new Element('button');rdp.id='connectbutton1r';
  const disconnect=new Element('button');disconnect.id='disconnectbutton1';disconnect.hidden=true;
  const mainInfo=new Element('button');mainInfo.id='MainDevInfo';mainInfo.hidden=true;
  const window={currentNode:null,desktop:null,meshes:{},addEventListener(){},deskToggleFullCalls:0,deskToggleFull(){this.deskToggleFullCalls++;}};
  const document={body,readyState:'complete',activeElement:null,getElementById:id=>ids.get(id)||null,createElement:tag=>new Element(tag),addEventListener(){}};
  [p11,title,full,connect,rdp,disconnect,mainInfo].forEach(node=>body.append(node));
  const callbacks=[];
  vm.runInNewContext(viewer,{window,document,console,getComputedStyle:()=>({visibility:'visible'}),MutationObserver:class{observe(){}},setTimeout:callback=>{callbacks.push(callback);return callbacks.length;},clearTimeout(){}},{timeout:1000});
  const controls=ids.get('ns-viewer-controls');
  assert.ok(controls);
  assert.equal(controls.hidden,false,'Toolbar is shown only for the active remote viewer');
  const actions=controls.children;
  assert.equal(controls.getAttribute('aria-orientation'),'horizontal','Toolbar direction is explicit for assistive technology');
  assert.deepEqual(actions.map(button=>button.tabIndex),[0,-1,-1,-1],'Only the first available toolbar action enters the sequential tab order');
  const keydown=(key)=>{let prevented=false;controls.events.keydown.at(-1)({key,preventDefault(){prevented=true;}});assert.equal(prevented,true,key+' is handled inside the toolbar');return document.activeElement;};
  actions[0].focus();
  assert.equal(keydown('ArrowRight'),actions[1],'Right arrow moves to the next available control');
  assert.equal(keydown('ArrowRight'),actions[3],'Arrow navigation skips unavailable native actions');
  assert.equal(keydown('ArrowRight'),actions[0],'Arrow navigation wraps at the end of the toolbar');
  assert.equal(keydown('Home'),actions[0],'Home moves to the first available toolbar action');
  assert.equal(keydown('End'),actions[3],'End moves to the last available toolbar action');
  assert.equal(keydown('ArrowLeft'),actions[1],'Left arrow returns to the previous available control');
  actions.find(button=>button.textContent==='Connect').click();
  assert.equal(connect.clickCount,1,'Connect delegates to the visible native Agent control');
  actions.find(button=>button.textContent==='Full screen').click();
  assert.equal(window.deskToggleFullCalls,1,'Fullscreen delegates to MeshCentral even when its title-bar icon is hidden');
  p11.hidden=true;window.__NightShiftViewer.refresh();
  assert.equal(controls.hidden,true,'Toolbar hides when the native viewer is inactive');
});

function createMobileHarness(isMobile = true, classicMode = false, isLandscape = false, nativeTemplate = 'modern', isPhoneLandscape = false) {
  let landscapeMode = isLandscape;
  const byId = new Map();
  const documentEvents = {};
  const storage = new Map(classicMode ? [['_nsClassicUI','1']] : []);
  let reloadCount = 0;
  const styleSheet={href:'styles/custom.css',disabled:false,getAttribute(name){return name==='href'?'styles/custom.css':null;}};
  let activeElement = null;
  class Element {
    constructor(tag, className = '', text = '') {
      this.tagName = tag.toUpperCase(); this.className = className; this.textContent = text;
      this.children = []; this.attributes = {}; this.style = {}; this.events = {}; this.dataset = {}; this.disabled = false;
      this.hidden = false; this.isVisible = true; this.parentElement = null;
      this.classList = {
        values: new Set(className.split(/\s+/).filter(Boolean)),
        add: (...names) => names.forEach(n => this.classList.values.add(n)),
        remove: (...names) => names.forEach(n => this.classList.values.delete(n)),
        contains: name => this.classList.values.has(name),
        toggle: (name, force) => {
          const enabled = force === undefined ? !this.classList.contains(name) : force;
          enabled ? this.classList.add(name) : this.classList.remove(name);
          return enabled;
        }
      };
      Object.defineProperty(this, 'id', {
        get: () => this._id || '',
        set: value => { this._id = value; if (value) byId.set(value, this); }
      });
    }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
    prepend(node) { node.parentElement = this; this.children.unshift(node); }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    getClientRects() { return this.hidden || !this.isVisible ? [] : [{}]; }
    addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
    dispatchEvent(event) { for (const fn of this.events[event.type] || []) fn(event); return true; }
    click() { this.clickCount = (this.clickCount || 0) + 1; this.dispatchEvent({ type: 'click', target: this, preventDefault() {} }); }
    focus() { activeElement = this; }
    querySelector(selector) {
      if (selector.startsWith('.')) return this.children.find(child => child.classList.contains(selector.slice(1))) || null;
      return null;
    }
    querySelectorAll() { return []; }
  }
  const document = {
    readyState: 'complete', visibilityState: 'visible', hidden:false,
    documentElement: new Element('html'), body: new Element('body'),
    get activeElement() { return activeElement; },
    createElement: tag => new Element(tag),
    getElementById: id => byId.get(id) || null,
    querySelector: selector => {
      if (selector === 'script[src*="meshcentral"]') return nativeTemplate === 'login' ? null : {};
      if (selector === 'link[href*="style-bootstrap"]') return nativeTemplate === 'modern' ? {} : null;
      return null;
    },
    querySelectorAll: selector => selector==='link[rel="stylesheet"]'?[styleSheet]:[],
    addEventListener(name, fn) { (documentEvents[name] ||= []).push(fn); }
  };
  const addExisting = (id, visible = true) => {
    const el = new Element('button'); el.id = id; el.isVisible = visible; document.body.append(el); return el;
  };
  addExisting('container'); addExisting('LeftMenuMyDevices', false); addExisting('p11');
  const agentConnect = addExisting('connectbutton1');
  const rdpConnect = addExisting('connectbutton1r');
  const disconnect = addExisting('disconnectbutton1', false);
  addExisting('DeskScreens');
  addExisting('DeskWD');
  const inputControl=addExisting('DeskControl');inputControl.checked=true;
  addExisting('DeskType');
  addExisting('DeskClipboardOutButton');
  addExisting('DeskClipboardInButton');
  const calls = [];
  const windowEvents={};
  const addWindowEvent=(name,fn)=>(windowEvents[name]||=[]).push(fn);
  const window = {
    addEventListener:addWindowEvent,
    localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
    location:{reload(){reloadCount++;}},
    trackpadMode: false,
    _mobileZoomMode:'fit',
    _mobileModifiers:{ctrl:false,shift:false,alt:false},
    go: page => calls.push(['go', page]),
    deskToggleTrackpad: () => calls.push(['trackpad']),
    toggleMobileKeyboard: () => {window._mobileKbdEnabled=!window._mobileKbdEnabled;calls.push(['keyboard']);},
    deskMobileToggleZoom: () => {window._mobileZoomMode=window._mobileZoomMode==='native'?'fit':'native';calls.push(['zoom']);},
    deskToggleRightClickMode: () => calls.push(['right-click']),
    toggleMobileModifier: mod => { window._mobileModifiers[mod]=!window._mobileModifiers[mod];calls.push(['modifier',mod]); },
    mobileModifiersSupported:()=>true,
    _releaseMobileModifiers: () => { Object.keys(window._mobileModifiers).forEach(mod=>window._mobileModifiers[mod]=false);calls.push(['release-all']); },
    deskToggleFull: event => calls.push(['fullscreen', event]),
    deskToggleMobileActions: () => calls.push(['more-actions']),
    showDesktopSettings: () => calls.push(['settings']),
    deskClipboardOutFunction: () => calls.push(['clipboard-out']),
    deskClipboardInFunction: () => calls.push(['clipboard-in']),
    showDeskType: () => calls.push(['type-text']),
    sendCAD: () => calls.push(['cad']),
    sendDeskEsc: () => calls.push(['escape']),
    deskSendKeys: () => calls.push(['send-keys']),
    toggleBootstrapUIMode: () => calls.push(['native-ui-mode']),
    navigator:{clipboard:{readText(){},writeText(){}}}
  };
  const context = {
    window, document, console,
    matchMedia: query => ({ matches: query.includes('pointer: coarse') ? isPhoneLandscape && landscapeMode : query.includes('orientation: landscape') ? landscapeMode : isMobile }),
    getComputedStyle: () => ({ visibility: 'visible' }),
    requestAnimationFrame: callback => callback(),
    addEventListener:addWindowEvent, setInterval() { return 1; }, clearTimeout() {}, setTimeout() { return 1; },
    MutationObserver: class { observe() {} },
    MouseEvent: class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } }
  };
  vm.runInNewContext(js, context, { timeout: 1000 });
  return { document, documentEvents, windowEvents, byId, calls, window, storage, styleSheet, get reloadCount(){return reloadCount;}, agentConnect, rdpConnect, disconnect, activeElement: () => activeElement, setLandscape(value){landscapeMode=value;(windowEvents.orientationchange||[]).forEach(fn=>fn());} };
}

test('custom JavaScript parses and registers without requiring a live server', () => {
  const compiled = new vm.Script(js, { filename: 'custom.js' });
  const callbacks = {};
  const ctx = {
    window: {},
    document: {
      readyState: 'loading',
      addEventListener(name, fn) { callbacks[name] = fn; }
    },
    console
  };
  compiled.runInNewContext(ctx, { timeout: 1000 });
  assert.equal(ctx.window.__nightShiftUI.version, '1.0.0');
  assert.equal(typeof callbacks.DOMContentLoaded, 'function');
});

test('MeshCentral login2 receives the Night Shift theme despite lacking the app container', () => {
  const login2 = read('views/login2.handlebars');
  assert.match(login2, /class="arg_hide login"/);
  assert.match(login2, /id="centralTable"/);
  assert.doesNotMatch(login2, /id\s*=\s*["']?container\b/);
  const bodyClasses = new Set(['login']);
  const htmlClasses = new Set();
  const classList = values => ({
    add: name => values.add(name),
    contains: name => values.has(name)
  });
  const ctx = {
    window: {},
    document: {
      readyState: 'complete',
      body: { classList: classList(bodyClasses) },
      documentElement: { classList: classList(htmlClasses) },
      getElementById: id => id === 'centralTable' ? {} : null
    },
    console
  };
  vm.runInNewContext(js, ctx, { timeout: 1000 });
  assert.ok(bodyClasses.has('ns-theme'), 'login2 body gets the theme class');
  assert.ok(htmlClasses.has('ns-theme'), 'login2 document gets the theme class');
  assert.ok(css.includes('#body.ns-theme.login'), 'login2 inline background is explicitly overridden');
});

test('UI customization is presentation-only, with native MeshCentral action delegation', () => {
  for (const handler of [
    'connectbutton1','connectbutton1r','disconnectbutton1',
    'deskToggleTrackpad','deskToggleRightClickMode','toggleMobileKeyboard',
    'deskMobileToggleZoom','showDesktopSettings','deskToggleFull',
    'deskToggleMobileActions','DeskScreens'
  ]) assert.ok(js.includes(handler), 'Missing native handler: ' + handler);
  for (const unsafe of [/new\s+WebSocket\s*\(/, /new\s+RTCPeerConnection\s*\(/, /fetch\s*\(\s*['"]\/api/, /localStorage\.clear\s*\(/]) {
    assert.doesNotMatch(js,unsafe,'Night Shift must not replace MeshCentral network or session layer');
  }
});

test('mobile remote dock delegates controls to MeshCentral handlers and keeps restricted navigation available', () => {
  const h = createMobileHarness();
  const dock = h.byId.get('ns-mobile-dock');
  assert.ok(dock, 'mobile remote dock is installed');
  assert.equal(dock.hidden, false, 'dock is visible while the desktop view is open');
  assert.equal(h.byId.get('ns-dock-more').hidden, true, 'portrait keeps its existing full control rows without a redundant expander');
  assert.equal(h.byId.get('ns-dock-secondary').hidden, false, 'portrait keeps every secondary remote action visible');
  assert.equal(h.byId.get('ns-agent-connect').hidden, false, 'native agent connect remains available');
  assert.equal(h.byId.get('ns-rdp-connect').hidden, false, 'native browser RDP connect remains available');
  assert.equal(h.byId.get('ns-trackpad').textContent,'Trackpad off');
  assert.equal(h.byId.get('ns-rightclick').textContent,'Right-click off');

  h.window.trackpadMode=true;h.window.desktop={m:{SwapMouse:true}};h.window.__nightShiftUI.refresh();
  assert.equal(h.byId.get('ns-trackpad').textContent,'Trackpad on');
  assert.equal(h.byId.get('ns-trackpad').getAttribute('aria-pressed'),'true');
  assert.equal(h.byId.get('ns-trackpad').getAttribute('aria-label'),'Disable trackpad mode');
  assert.equal(h.byId.get('ns-zoom').textContent,'Native size');
  assert.equal(h.byId.get('ns-zoom').getAttribute('aria-label'),'Show remote display at native size');
  assert.equal(h.byId.get('ns-zoom').getAttribute('aria-pressed'),'false');
  assert.equal(h.byId.get('ns-rightclick').textContent,'Right-click on');
  assert.equal(h.byId.get('ns-rightclick').getAttribute('aria-pressed'),'true');
  const keyboard=h.byId.get('ns-keyboard');
  assert.equal(keyboard.disabled,true,'on-screen keyboard remains unavailable before a native session connects');

  h.byId.get('ns-rdp-connect').click();
  h.byId.get('ns-trackpad').click();
  h.byId.get('ns-zoom').click();
  assert.equal(h.byId.get('ns-zoom').textContent,'Scale to fit','zoom label follows the native zoom mode after toggling');
  assert.equal(h.byId.get('ns-zoom').getAttribute('aria-pressed'),'true');
  h.byId.get('ns-rightclick').click();
  h.byId.get('DeskScreens').click();
  const fullscreen = dock.children.flatMap(row => row.children).find(button => button.textContent === 'Fullscreen');
  fullscreen.click();

  assert.equal(h.rdpConnect.clickCount, 1, 'RDP is delegated to MeshCentral\'s existing connect handler');
  assert.deepEqual(h.calls.map(call => call[0]), ['trackpad', 'zoom', 'right-click', 'fullscreen']);
  assert.equal(h.calls.find(call => call[0] === 'fullscreen')[1].shiftKey, false, 'fullscreen receives the native event shape');
  assert.equal(h.byId.get('DeskScreens').clickCount, 1, 'monitor picker remains the native MeshCentral control');

  h.disconnect.hidden=false;h.disconnect.isVisible=true;
  h.window.__nightShiftUI.refresh();
  assert.equal(keyboard.disabled,false,'on-screen keyboard is available when native input is enabled');
  keyboard.click();
  assert.equal(keyboard.textContent,'Keyboard on','dock follows native on-screen keyboard state');
  assert.equal(keyboard.getAttribute('aria-pressed'),'true','keyboard toggle exposes pressed state');
  h.byId.get('DeskControl').checked=false;
  h.window.__nightShiftUI.refresh();
  assert.equal(keyboard.disabled,true,'on-screen keyboard is unavailable while native remote input is disabled');
  assert.equal(h.byId.get('ns-type-text').disabled,true,'text input shortcuts follow the native input permission');
  assert.equal(h.byId.get('ns-clipboard-out').disabled,false,'clipboard controls retain their independent native availability');
  h.byId.get('DeskControl').checked=true;
  h.window.__nightShiftUI.refresh();
  assert.equal(keyboard.disabled,false,'on-screen keyboard returns when native input is restored');
  for (const id of ['ns-clipboard-out','ns-clipboard-in','ns-type-text','ns-cad','ns-escape','ns-send-key']) {
    assert.ok(h.byId.get(id), 'Touch dock exposes ' + id);
    assert.equal(h.byId.get(id).disabled,false,id + ' is available during a connected session');
    h.byId.get(id).click();
  }
  assert.deepEqual(h.calls.slice(-6).map(call=>call[0]),['clipboard-out','clipboard-in','type-text','cad','escape','send-keys'],'Clipboard, text entry and shortcut buttons delegate to MeshCentral native handlers');

  const mobileNav = h.byId.get('ns-mobile-nav');
  assert.ok(mobileNav, 'mobile workspace navigation is installed');
  const more=mobileNav.children.at(-1);more.focus();assert.equal(h.activeElement(),more);assert.equal(more.id,'ns-search-more');more.click();
  assert.equal(more.getAttribute('aria-controls'),'ns-search-backdrop');
  assert.equal(h.byId.get('ns-search-backdrop').hidden,false,'More opens the accessible navigation search');
  assert.equal(more.getAttribute('aria-expanded'),'true');
  const closeSearch=h.byId.get('ns-search-backdrop').children[0].children[0].children[1];
  closeSearch.click();
  assert.equal(h.activeElement(),more,'Closing search restores focus to the opening control');
  assert.equal(more.getAttribute('aria-expanded'),'false');
  mobileNav.children[0].click();
  assert.deepEqual(h.calls.at(-1), ['go', 1], 'hidden desktop navigation falls back to MeshCentral go()');
  h.byId.get('ns-modifier-toggle').click();
  assert.equal(h.byId.get('ns-dock-modifiers').hidden,false,'Modifier buttons are available in an expanded touch tray');
  h.byId.get('ns-mod-ctrl').click();
  assert.equal(h.byId.get('ns-mod-ctrl').getAttribute('aria-pressed'),'true','Pressed state mirrors the native held modifier');
  assert.deepEqual(h.calls.at(-1),['modifier','ctrl'],'Modifier down/up behavior delegates to MeshCentral native input handling');
  assert.equal(h.byId.get('ns-modifier-toggle').textContent,'Modifiers (1)','The tray summary reports active modifiers');
  h.byId.get('ns-mod-release').click();
  assert.deepEqual(h.calls.at(-1),['release-all'],'Release all delegates to MeshCentral native modifier cleanup');
  assert.equal(h.byId.get('ns-mod-ctrl').getAttribute('aria-pressed'),'false');
  h.window.mobileModifiersSupported=()=>false;
  h.window.__nightShiftUI.refresh();
  assert.equal(h.byId.get('ns-modifier-toggle').hidden,true,'sticky modifiers are hidden when the active transport lacks native key-code support');
  h.window.mobileModifiersSupported=()=>true;
  h.window.__nightShiftUI.refresh();
  h.window._mobileModifiers.ctrl=true;
  h.windowEvents.blur.forEach(fn=>fn());
  assert.equal(h.window._mobileModifiers.ctrl,false,'browser focus loss releases the sticky modifier in the native session');
  assert.deepEqual(h.calls.at(-1),['release-all'],'focus loss delegates cleanup through MeshCentral native input');
  h.document.hidden=true;
  h.window._mobileModifiers.alt=true;
  h.documentEvents.visibilitychange.forEach(fn=>fn());
  assert.equal(h.window._mobileModifiers.alt,false,'a hidden tab also releases held sticky modifiers');
  h.document.hidden=false;
  h.documentEvents.input.forEach(fn=>fn({target:{id:'softKeyboard'}}));
  assert.equal(h.byId.get('ns-mod-ctrl').getAttribute('aria-pressed'),'false','Native soft-keyboard input releases and refreshes the modifier state');
  const deskControl=h.byId.get('DeskControl');deskControl.checked=false;
  h.window._mobileModifiers.shift=true;
  h.documentEvents.change.forEach(fn=>fn({target:deskControl}));
  assert.equal(h.byId.get('ns-modifier-toggle').disabled,true,'The modifier tray follows native remote-input permission changes');
  assert.equal(h.byId.get('ns-mod-release').disabled,false,'Native key-up cleanup remains available when remote input is disabled');
  h.byId.get('ns-mod-release').click();
  assert.equal(h.window._mobileModifiers.shift,false,'Release all clears a held modifier without remote input permission');
});

test('short coarse-pointer phone landscape keeps the remote dock visible above 900px',()=>{
  const phone=createMobileHarness(false,false,true,'modern',true);
  assert.equal(phone.byId.get('ns-mobile-dock').hidden,false,'904px CSS phone landscape is treated as mobile');
  assert.equal(phone.byId.get('ns-mobile-nav').hidden,true,'workspace navigation stays out of a remote session');
  const desktop=createMobileHarness(false,false,true,'modern',false);
  assert.equal(desktop.byId.get('ns-mobile-dock').hidden,true,'tablet/desktop landscape with a fine pointer keeps native desktop controls');
  assert.match(js,/orientation: landscape.*max-width: 1024px.*max-height: 600px.*pointer: coarse/,'The wider breakpoint is limited to short coarse-pointer landscape screens');
  assert.match(css,/@media\(max-width:1024px\) and \(max-height:600px\) and \(orientation:landscape\) and \(pointer:coarse\)\s*\{[\s\S]*?\.ns-mobile-dock\s*\{[\s\S]*?body\.ns-mobile-remote #column_l\s*\{padding-bottom:calc\(92px/,'The dock is compact and the native remote canvas receives bottom clearance at phone landscape widths');
  const coarseControls=css.match(/@media\(max-width:1024px\) and \(max-height:600px\) and \(orientation:landscape\) and \(pointer:coarse\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(coarseControls,'The short coarse-pointer landscape override is present');
  assert.match(coarseControls[1],/body\.ns-shell-ready\.ns-mobile-remote \.ns-viewer-controls\s*\{bottom:calc\(110px \+ env\(safe-area-inset-bottom\)\)\}/,'Remote viewer actions sit above the touch dock at 977x440 coarse-pointer landscape widths');
  const coarseSelector='body.ns-shell-ready.ns-mobile-remote .ns-viewer-controls';
  const laterDesktopSelector='body.ns-shell-ready .ns-viewer-controls';
  const classSpecificity=selector=>(selector.match(/\.[\w-]+/g)||[]).length;
  assert.ok(classSpecificity(coarseSelector)>classSpecificity(laterDesktopSelector),'The coarse-landscape offset outranks the later desktop controls rule in the CSS cascade');
});

test('phone remote workspace puts the live viewer before setup panels',()=>{
  assert.match(css,/body\.ns-shell-ready\.ns-mobile-remote #p11\s*\{display:flex;flex-direction:column\}/,'The remote workspace can order its native viewer and setup panels on phones');
  assert.match(css,/body\.ns-shell-ready\.ns-mobile-remote #deskarea0\s*\{order:1;margin-bottom:12px\}/,'The remote display follows the device title and session strip');
  assert.match(css,/body\.ns-shell-ready\.ns-mobile-remote #ns-session-diagnostics\s*\{order:2\}/,'Connection diagnostics remain below the phone viewer');
  assert.match(css,/body\.ns-shell-ready\.ns-mobile-remote #ns-connection-profile\s*\{order:3\}/,'Connection profile controls stay available after the phone viewer');
});

test('landscape remote view collapses extra controls without hiding native actions or focused controls', () => {
  const h = createMobileHarness(true, false, true);
  const more = h.byId.get('ns-dock-more');
  const secondary = h.byId.get('ns-dock-secondary');
  assert.ok(more, 'Landscape provides a discoverable control for the secondary remote actions');
  assert.ok(secondary, 'Secondary remote actions remain mounted');
  assert.equal(secondary.hidden, true, 'Landscape starts with the remote canvas space reclaimed');
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(more.getAttribute('aria-controls'), 'ns-dock-secondary');

  more.click();
  assert.equal(secondary.hidden, false, 'More expands the complete secondary control row');
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  assert.ok(secondary.children.some(control => control.textContent === 'Fullscreen'), 'Fullscreen stays available');
  assert.ok(secondary.children.some(control => control.id === 'ns-monitors'), 'Monitor selection stays available');

  h.setLandscape(false);
  assert.equal(secondary.hidden, false, 'Portrait restores the complete dock');
  assert.equal(more.hidden, true, 'The extra toggle is unnecessary in portrait');
  const focusedControl = secondary.children.find(control => control.textContent === 'Fullscreen');
  focusedControl.focus();
  h.setLandscape(true);
  assert.equal(secondary.hidden, false, 'Rotation never hides the currently focused native action');
  assert.equal(more.hidden, false, 'The landscape expander remains available while a secondary action has focus');
});

test('desktop viewport keeps the mobile navigation and remote dock out of view', () => {
  const h = createMobileHarness(false);
  assert.equal(h.byId.get('ns-mobile-nav').hidden, true, 'workspace navigation is hidden on desktop');
  assert.equal(h.byId.get('ns-mobile-dock').hidden, true, 'remote dock is hidden on desktop');
  assert.equal(h.byId.get('connectbutton1').hidden, false, 'native desktop controls remain available');
  assert.equal(h.byId.get('connectbutton1r').hidden, false, 'native desktop RDP control remains available');
});

test('Night Shift uses the approved Concept B typography stack',()=>{
  assert.match(css,/font-family:\s*Inter,\s*"Segoe UI",\s*-apple-system,\s*BlinkMacSystemFont,\s*Arial,\s*sans-serif/,'The live theme follows Concept B without adding a remote font dependency');
  assert.doesNotMatch(css,/font-family:\s*"Avenir Next"/,'The later unapproved font substitution does not drift from the approved concept');
  const approved=read('docs/night-shift-acceptance/Concept-B-Night-Shift-Approved.html');
  assert.match(approved,/font-family:Inter,"Segoe UI",-apple-system,BlinkMacSystemFont,Arial,sans-serif/,'The reference concept supplies the typography stack');
});

test('modern, responsive and fallback selectors remain present', () => {
  for (const token of [
    '--ns-accent','#page_leftbar','#deskarea0','#DeskParent',
    '.ns-mobile-nav','.ns-mobile-dock','.ns-dock-secondary[hidden]','@media(max-width:900px) and (orientation:landscape)',
    '.ns-search-panel','prefers-reduced-motion'
  ]) assert.ok(css.includes(token),'Missing styles: ' + token);
  assert.ok(css.includes('z-index:900'), 'Mobile overlays must remain below consent/modal dialogs');
});

test('CSS blocks are balanced', () => {
  const sanitized = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
  let depth=0;
  for (const char of sanitized) {
    if(char==='{')depth++;
    if(char==='}')depth--;
    assert.ok(depth>=0,'Unexpected closing brace');
  }
  assert.equal(depth,0,'Unclosed CSS rule');
});

test('install and rollback are confined to web overrides', () => {
  for (const word of ['meshcentral-web','custom.css','custom.js','RollbackFrom','manifest.json','Get-FileHash']) {
    assert.ok(installer.includes(word),'Installer contract missing: '+word);
  }
  assert.doesNotMatch(installer,/Set-Content\s+.*config\.json/i);
  assert.doesNotMatch(installer,/Stop-Service|Restart-Service/i);
});


test('Android viewport width matches the CSS mobile breakpoint without disabling pinch zoom', () => {
  let content = 'user-scalable=yes,initial-scale=1.0,minimum-scale=1.0';
  const viewport = {
    getAttribute: name => name === 'content' ? content : null,
    setAttribute: (name,value) => { if (name === 'content') content=value; }
  };
  const classes = { add() {}, contains: n => n === 'login' };
  const document = {
    readyState: 'complete',
    querySelector: s => s === 'meta[name="viewport"]' ? viewport : null,
    getElementById: id => id === 'centralTable' ? {} : null,
    body: { classList: classes }, documentElement: { classList: { add() {} } }
  };
  vm.runInNewContext(js, {window:{},document,console}, { timeout:1000 });
  assert.match(content, /(?:^|,)width=device-width(?:,|$)/);
  assert.match(content, /(?:^|,)viewport-fit=cover(?:,|$)/);
  assert.match(content, /user-scalable=yes/, 'Native user pinch zoom must not be disabled');
  assert.match(js, /matchMedia\('\(max-width: 900px\)'\)/, 'JavaScript breakpoint aligns with CSS');
  assert.match(css, /body\.ns-theme #page_leftbar\s*\{\s*display:none!important/);
  assert.match(css, /#xdevices \[name="xxdevice1"\]/, 'Device cards get genuine mobile sizing');
  assert.match(css, /#p2AccountSecurity,#p2AccountActions/, 'Account actions remain visible and usable');
});

test('mobile masthead stays inside the viewport and respects device safe areas', () => {
  const masthead = css.match(/body\.ns-theme #masthead\s*\{([^}]+)\}/);
  assert.ok(masthead, 'Mobile masthead rule exists');
  assert.match(masthead[1], /box-sizing\s*:\s*border-box/, 'Horizontal padding must not extend the masthead beyond the viewport');
  assert.match(masthead[1], /env\(safe-area-inset-(?:left|right)\)/, 'Masthead content respects horizontal device safe areas');
  assert.match(css, /body\.ns-theme #masthead \.masthead-right\s*\{[^}]*max-width:48%/, 'Account controls stay within the narrow-screen masthead');
  assert.match(css, /body\.ns-theme #masthead #userDropdownMenu\s*\{[^}]*width:min\(280px,calc\(100vw - 16px\)\)/, 'Account menu stays inside the viewport');
  assert.match(css, /body\.ns-theme #topbar #logoutControlSpan2\s*\{display:none!important\}/, 'Legacy logout text cannot overflow the mobile masthead');
});

test('portrait remote dock wraps every touch control inside the viewport',()=>{
  assert.match(css,/@media\(max-width:900px\) and \(orientation:portrait\)\s*\{[\s\S]*?body\.ns-theme \.ns-dock-row\s*\{\s*display:grid;\s*grid-template-columns:repeat\(4,minmax\(0,1fr\)\);[\s\S]*?overflow:visible/,'Portrait uses a wrapping grid instead of clipping the remote controls');
  assert.match(css,/body\.ns-theme \.ns-dock-action\s*\{[\s\S]*?min-width:0;[\s\S]*?min-height:44px;[\s\S]*?white-space:normal/,'Touch actions remain reachable and retain 44px minimum targets');
  assert.match(css,/body\.ns-theme \.ns-dock-secondary \.ns-dock-action \{min-height:44px/,'Secondary remote actions stay touch sized in portrait');
});

test('Redmi Note 14 Pro+ portrait target uses the complete mobile remote layout',()=>{
  const physical={width:1220,height:2712},deviceScaleFactor=3;
  const cssViewport={width:Math.round(physical.width/deviceScaleFactor),height:Math.round(physical.height/deviceScaleFactor)};
  assert.deepEqual(cssViewport,{width:407,height:904},'The target device dimensions map to an approximately 407x904 CSS-pixel viewport at 3x');
  assert.ok(cssViewport.width<=900,'The target stays inside the mobile CSS breakpoint');
  assert.match(js,/\(max-width: 900px\)/,'Mobile controls activate at the target CSS viewport width');
  assert.match(css,/@media\(max-width:900px\) and \(orientation:portrait\)/,'Portrait-specific reflow applies at the target CSS viewport width');
  const phone=createMobileHarness(true,false,false);
  assert.equal(phone.byId.get('ns-mobile-dock').hidden,false,'The complete remote dock is present in portrait');
  assert.equal(phone.byId.get('ns-dock-more').hidden,true,'Portrait exposes remote actions without requiring an extra expansion step');
  assert.equal(phone.byId.get('ns-dock-secondary').hidden,false,'Portrait keeps zoom, fullscreen and other secondary controls visible');
});

test('portrait native remote keyboard and input row wraps within the canvas panel',()=>{
  const rule=css.match(/@media\(max-width:900px\) and \(orientation:portrait\)\s*\{\s*body\.ns-shell-ready\.ns-mobile-remote #deskarea4\s*\{[\s\S]*?body\.ns-shell-ready\.ns-mobile-remote #deskarea4 #deskarea4Icons > span\[role="button"\]\s*\{[\s\S]*?max-width:100%;\s*\}\s*\}/);
  assert.ok(rule,'Portrait remote footer has a targeted responsive rule');
  assert.match(rule[0],/body\.ns-shell-ready\.ns-mobile-remote #deskarea4\s*\{[\s\S]*?flex-wrap:wrap!important;[\s\S]*?min-width:0;[\s\S]*?max-width:100%/,'The native footer may wrap without widening the 360px canvas panel');
  assert.match(rule[0],/body\.ns-shell-ready\.ns-mobile-remote #deskarea4 > div:first-child\s*\{[\s\S]*?flex-wrap:wrap!important;[\s\S]*?width:100%;[\s\S]*?min-width:0/,'The nested native action row wraps within the footer');
  assert.match(rule[0],/body\.ns-shell-ready\.ns-mobile-remote #deskarea4 #deskkeys\s*\{[\s\S]*?flex:1 1 100%;[\s\S]*?width:100%!important;[\s\S]*?max-width:100%/,'The shortcut selector stays inside the panel');
  assert.match(rule[0],/body\.ns-shell-ready\.ns-mobile-remote #deskarea4 :is\(#DeskWD,#DeskESC,#DeskClip,#DeskType,#DeskSoftKbdBtn\)\s*\{[\s\S]*?min-height:44px/,'Native keyboard/clipboard/type controls keep touch targets while wrapping');
  assert.match(rule[0],/body\.ns-shell-ready\.ns-mobile-remote #deskarea4 #deskarea4Icons\s*\{[\s\S]*?flex-wrap:wrap!important;[\s\S]*?width:100%;[\s\S]*?min-width:0;[\s\S]*?max-width:100%/,'The second native status/action row also wraps within the footer width');
  assert.match(rule[0],/body\.ns-shell-ready\.ns-mobile-remote #deskarea4 #DeskMonitorSelectionSpan\s*\{[\s\S]*?flex:1 1 100%;[\s\S]*?max-width:100%/,'The monitor picker cannot widen the second row');
  assert.match(rule[0],/body\.ns-shell-ready\.ns-mobile-remote #deskarea4 #deskarea4Icons > span\[role="button"\]\s*\{[\s\S]*?flex:0 0 44px;[\s\S]*?width:44px;[\s\S]*?min-height:44px/,'Native icon actions retain usable touch targets while wrapping');
  const template=read('views/default3.handlebars');
  assert.match(template,/id=deskarea4 class="areaFoot d-flex flex-wrap"[\s\S]*?id="deskkeys"[\s\S]*?id="DeskWD"[\s\S]*?id="DeskControlSpan"[\s\S]*?onclick="toggleKvmControl\(\)"[\s\S]*?id="deskarea4Icons"[\s\S]*?id="DeskLatency"[\s\S]*?id=DeskToolsButton/,'Native handlers and both footer rows remain present and are the controls being reflowed');
});


test('Night Shift structural shell uses live DOM data and native navigation', () => {
  const ids = new Map();
  class MockElement {
    constructor(tag) {
      this.tagName=tag.toUpperCase(); this.children=[]; this.style={};
      this.dataset={}; this.attributes={}; this.events={}; this.hidden=false; this.disabled=false;
      const classes=new Set();
      this.classList={
        add:(...names)=>names.forEach(name=>classes.add(name)),
        remove:(...names)=>names.forEach(name=>classes.delete(name)),
        contains:name=>classes.has(name),
        toggle:(name,force)=>{
          const enabled=force===undefined?!classes.has(name):force;
          enabled?classes.add(name):classes.delete(name); return enabled;
        }
      };
    }
    set id(value){this._id=value;ids.set(value,this);}
    get id(){return this._id||'';}
    set className(value){this._class=value;value.split(/\s+/).filter(Boolean).forEach(name=>this.classList.add(name));}
    get className(){return this._class||'';}
    set textContent(value){this._text=String(value);}
    get textContent(){return this._text||'';}
    get firstChild(){return this.children[0]||null;}
    append(...children){children.forEach(child=>{if(child.parentNode){const old=child.parentNode.children.indexOf(child);if(old>=0)child.parentNode.children.splice(old,1);}child.parentNode=this;this.children.push(child);});}
    replaceChildren(...children){this.children=[];this.append(...children);}
    prepend(child){child.parentNode=this;this.children.unshift(child);}
    insertBefore(child,anchor){child.parentNode=this;const index=this.children.indexOf(anchor);this.children.splice(index<0?this.children.length:index,0,child);}
    removeChild(child){const index=this.children.indexOf(child);if(index<0)throw new Error('Not a child');this.children.splice(index,1);child.parentNode=null;return child;}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    addEventListener(name,handler){(this.events[name]||=[]).push(handler);}
    click(){this.clickCount=(this.clickCount||0)+1;(this.events.click||[]).forEach(handler=>handler({type:'click',preventDefault(){},stopPropagation(){}}));}
    dispatchEvent(event){(this.events[event.type]||[]).forEach(handler=>handler(event));return true;}
    getClientRects(){return this.hidden?[]:[{}];}
    querySelector(selector){
      if(selector.startsWith('[data-native'))return this.children.find(child=>child.dataset.native===selector.match(/"([^"]+)"/)?.[1])||null;
      return null;
    }
    querySelectorAll(selector){
      if(selector==='[name="xxdevice1"]')return this.deviceCheckboxes||[];
      if(selector==='[data-detail]')return this.children.flatMap(child=>child.children).filter(child=>child.dataset.detail);
      if(selector==='*')return this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);
      return [];
    }
    focus(){this.focused=true;}
    contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
  }
  const body=new MockElement('body');
  const document={
    body,documentElement:new MockElement('html'),readyState:'complete',visibilityState:'visible',
    createElement:tag=>new MockElement(tag),
    getElementById:id=>ids.get(id)||null,
    querySelector:()=>null,querySelectorAll:()=>[],events:{},addEventListener(name,handler){(this.events[name]||=[]).push(handler);}
  };
  const add=(id,parent=body)=>{
    const node=new MockElement('div');node.id=id;parent.append(node);return node;
  };
  add('container');const column=add('column_l');add('masthead');
  const devices=add('LeftMenuMyDevices');let devicesClicks=0;devices.addEventListener('click',()=>devicesClicks++);
  const events=add('LeftMenuMyEvents');let eventsClicks=0;events.addEventListener('click',()=>eventsClicks++);const page=add('p1',column);
  const detailsPageForNav=add('p10',column);
  const remotePage=add('p11',column);remotePage.hidden=true;
  const statsPage=add('p40',column);statsPage.hidden=true;
  const eventsPage=add('p3',column);eventsPage.hidden=true;
  const eventHistory=add('p3events',eventsPage);eventHistory.scrollTop=2049;
  devices.addEventListener('click',()=>{page.hidden=false;eventsPage.hidden=true;statsPage.hidden=true;remotePage.hidden=true;detailsPageForNav.hidden=true;});
  events.addEventListener('click',()=>{page.hidden=true;eventsPage.hidden=false;statsPage.hidden=true;remotePage.hidden=true;detailsPageForNav.hidden=true;});
  const desktopArea=add('deskarea0',remotePage);
  const nativeStatus=add('deskstatus',remotePage);
  const nativeConnect=add('connectbutton1',remotePage);nativeConnect.disabled=false;
  const nativeRdpConnect=add('connectbutton1r',remotePage);nativeRdpConnect.disabled=false;
  const nativeDisconnect=add('disconnectbutton1',remotePage);nativeDisconnect.hidden=true;
  const deskCanvas=add('Desk',desktopArea);
  const toolbar=add('devListToolbarSpan',page);
  const nativeGroupAction=add('GroupActionButton',toolbar);nativeGroupAction.disabled=true;
  const list=add('xdevices',page);
  list.deviceCheckboxes=[new MockElement('input'),new MockElement('input')];
  const nativeDesktopTab=add('MainDevDesktop');add('MainDevTerminal');add('MainDevFiles');
  const deviceRouteCalls=[];
  nativeDesktopTab.onmouseup=function(event){deviceRouteCalls.push({route:11,event});detailsPageForNav.hidden=true;remotePage.hidden=false;};
  const opened=[];
  const disconnectedSessions=[];
  const compressionUpdates=[];
  const monitorSelections=[];
  let fullscreenToggles=0;
  const favoriteWrites=[];
  const updatedNativeDevices=[];
  const shellObservers=[];
  let webRtcResetCalls=0;
  const recentStorage=new Map();
  const window={
    location:{search:''},
    addEventListener(){},
    stars:{},
    putstore:(key,value)=>favoriteWrites.push({key,value}),
    updateDeviceViewDevice:id=>updatedNativeDevices.push(id),
    userinfo:{_id:'user/domain/qa'},
    desktopsettings:{agentencoding:4,framerate:50},
    navigator:{onLine:true},
    meshserver:{State:2,nativeStateChanges:0,onStateChanged(){this.nativeStateChanges++;return 'native state result';}},
    webRtcDesktop:null,
    webRtcDesktopReset(){webRtcResetCalls++;this.webRtcDesktop=null;return 'native WebRTC reset';},
    currentNode:null,
    desktop:null,
    localStorage:{
      getItem:key=>recentStorage.get(key)??null,
      setItem:(key,value)=>recentStorage.set(key,value)
    },
    nodes:[
      {_id:'node//online',name:'Workstation',meshid:'mesh//one',conn:9,osdesc:'Windows',tags:['Production','Critical'],v:true},
      {_id:'node//offline',name:'Archive',meshid:'mesh//one',conn:0,osdesc:'Linux',tags:['Archive'],v:true}
    ],
    meshes:{'mesh//one':{name:'Production'}},
    checkedNodeids:{},
    p1devcheck:event=>{
      const input=event.srcElement,nodeId=input.value.substring(6);
      if(input.checked)window.checkedNodeids[nodeId]=1;else delete window.checkedNodeids[nodeId];
      nativeGroupAction.disabled=Object.keys(window.checkedNodeids).length===0;
    },
    p1updateInfo(){},
    gotoDevice:(id)=>opened.push(id),
    toggleKvmDevice:node=>disconnectedSessions.push(node._id),
    deskToggleFull:()=>fullscreenToggles++
  };
  vm.runInNewContext(js,{
    window,document,console,
    matchMedia:()=>({matches:false}),
    getComputedStyle:()=>({display:'block',visibility:'visible'}),
    requestAnimationFrame:callback=>callback(),
    addEventListener(){},setInterval(){},setTimeout(){},clearTimeout(){},
    MutationObserver:class{constructor(callback){this.callback=callback;shellObservers.push(this);}observe(target,options){(this.targets||=[]).push({target,options});}},
    MouseEvent:class{constructor(type,props){this.type=type;Object.assign(this,props);}}
  },{timeout:1000});
  assert.ok(ids.has('ns-appbar'),'Contextual appbar is generated');
  assert.ok(ids.has('ns-overview'),'Native data dashboard is generated');
  assert.ok(ids.has('ns-device-actions'),'Device quick actions are generated');
  assert.equal(window.__nightShiftShell.version,'2.0.0');
  const skipMain=ids.get('ns-skip-main');
  assert.ok(skipMain,'Keyboard users receive a skip-to-main link before the native shell');
  assert.equal(skipMain.textContent,'Skip to main content');
  skipMain.click();
  const detailsPage=ids.get('p10');
  assert.equal(detailsPage.focused,true,'Skip link focuses the currently active native page');
  assert.equal(detailsPage.getAttribute('tabindex'),'-1','Skip target is focusable without entering the sequential tab order');
  assert.ok(shellObservers.length>0,'The shell installs page mutation observers');
  const eventsRoute=ids.get('p3'),eventList=ids.get('p3events');
  detailsPage.hidden=true;eventsRoute.hidden=false;
  column.scrollTop=190;column.scrollLeft=18;eventList.scrollTop=2049;eventList.scrollLeft=40;
  window.__nightShiftShell.refresh();
  assert.equal(column.scrollTop,0,'Route changes reset the outer content scroll position');
  assert.equal(column.scrollLeft,0,'Route changes reset retained horizontal shell scroll');
  assert.equal(eventList.scrollTop,0,'Route changes reset nested event-history scroll');
  assert.equal(eventList.scrollLeft,0,'Nested route scroll reset includes horizontal offsets');
  const remoteNested=ids.get('deskarea0');
  eventsRoute.hidden=true;remotePage.hidden=false;
  column.scrollTop=190;remoteNested.scrollTop=500;
  window.__nightShiftShell.refresh();
  assert.equal(column.scrollTop,0,'Opening remote desktop resets the retained route scroll');
  assert.equal(remoteNested.scrollTop,0,'Opening remote desktop resets nested viewer scroll containers');
  remotePage.hidden=true;statsPage.hidden=false;
  window.__nightShiftShell.refresh();
  assert.equal(ids.get('ns-appbar').children[0].children[1].textContent,'Server Stats','Server Stats gets route-specific appbar metadata instead of Workspace');
  const overview=ids.get('ns-overview');
  const count=overview.children[1].children[1].children[1];
  assert.equal(count.textContent,'2','The dashboard counts rendered native device rows');
  const bar=ids.get('ns-appbar'),more=bar.children[1].children.find(node=>node.textContent==='More');
  const menu=bar.children[2];
  assert.equal(menu.hidden,true,'Additional navigation starts closed');
  more.click();
  assert.equal(menu.hidden,false,'More opens actionable navigation');
  const outsideClick={target:devices};
  document.events.click.forEach(handler=>handler(outsideClick));
  assert.equal(menu.hidden,true,'Clicking native page content dismisses More');
  assert.equal(more.getAttribute('aria-expanded'),'false','Outside dismissal updates the expanded state');
  more.click();
  assert.equal(menu.hidden,false,'More can reopen after outside dismissal');
  const deviceLink=menu.children.find(node=>node.dataset.native==='LeftMenuMyDevices');
  assert.ok(deviceLink,'The available native Devices action is linked');
  deviceLink.click();
  menu.dispatchEvent({type:'click',target:deviceLink});
  assert.equal(menu.hidden,true,'Selecting a section dismisses the secondary menu');
  assert.equal(more.getAttribute('aria-expanded'),'false','Route dismissal updates the expanded state');
  assert.equal(devicesClicks,1,'The new navigation activates the native sidebar click handler');
  const eventsLink=menu.children.find(node=>node.dataset.native==='LeftMenuMyEvents');
  assert.ok(eventsLink,'The available native Events action is linked');
  eventsLink.click();
  assert.equal(eventsClicks,1,'The Events route invokes its native click handler');
  column.scrollTop=96;
  window.__nightShiftShell.refresh();
  assert.equal(ids.get('ns-appbar').children[0].children[1].textContent,'Events','Native Events activation updates the appbar route');
  assert.equal(column.scrollTop,0,'Native Events activation resets the outer scroll position');
  const breadcrumb=ids.get('ns-appbar').children[0].children[0];
  const workspaceCrumb=breadcrumb.children.find(node=>node.classList.contains('ns-breadcrumb-link')&&node.textContent==='Workspace');
  assert.ok(workspaceCrumb,'Workspace breadcrumb is a native Devices navigation action');
  assert.equal(workspaceCrumb.getAttribute('aria-label'),'Open Devices');
  column.scrollTop=88;
  workspaceCrumb.click();
  window.__nightShiftShell.refresh();
  assert.equal(devicesClicks,2,'Workspace breadcrumb activates the same native Devices click handler as the More menu');
  assert.equal(ids.get('ns-appbar').children[0].children[1].textContent,'Devices','Workspace breadcrumb returns to the Devices route');
  assert.equal(column.scrollTop,0,'Workspace breadcrumb navigation resets the outer scroll position');
  page.hidden=true;detailsPageForNav.hidden=false;remotePage.hidden=true;
  const desktopQuickAction=ids.get('ns-device-actions').children[1].children.find(node=>node.dataset.detail==='MainDevDesktop');
  assert.ok(desktopQuickAction,'Device details exposes the Open native Desktop action');
  desktopQuickAction.click();
  assert.equal(deviceRouteCalls.length,1,'Touch action invokes the native inline handler exactly once');
  assert.equal(deviceRouteCalls[0].route,11,'Native inline handler selects Desktop viewmode 11');
  assert.equal(deviceRouteCalls[0].event.button,0,'The delegated route receives a primary-action mouse event');
  assert.equal(deviceRouteCalls[0].event.view,window,'The native handler receives an event bound to the current MeshCentral window');

  assert.equal(detailsPageForNav.hidden,true,'The native handler leaves Device details');
  assert.equal(remotePage.hidden,false,'The native handler opens the Remote desktop route');
  window.__nightShiftShell.refresh();
  assert.equal(ids.get('ns-appbar').children[0].children[1].textContent,'Remote desktop','Appbar reflects the native Desktop route after touch activation');
  page.hidden=true;eventsPage.hidden=true;statsPage.hidden=true;remotePage.hidden=true;detailsPageForNav.hidden=true;
  window.location.search='?viewmode=40&sitestyle=3';
  window.__nightShiftShell.refresh();
  assert.equal(ids.get('ns-appbar').children[0].children[1].textContent,'Server Stats','Appbar uses MeshCentral route state when mobile visibility yields no measurable page rects');
  const inventory=ids.get('ns-live-inventory');
  assert.ok(inventory,'The native device collection is enhanced');
  const controls=inventory.children[1];
  const layoutSelect=controls.children.find(node=>node.dataset.control==='layout');
  const sortSelect=controls.children.find(node=>node.dataset.control==='sort');
  const tagSelect=controls.children.find(node=>node.dataset.control==='tag');
  assert.ok(layoutSelect,'Inventory offers cards, table and compact layouts');
  assert.ok(sortSelect,'Inventory offers explicit sorting');
  assert.ok(tagSelect,'Inventory offers native device-tag filtering');
  const deviceSearch=controls.children.find(node=>node.className==='ns-live-filter');
  deviceSearch.value='critical';
  deviceSearch.dispatchEvent({type:'input'});
  assert.equal(inventory.children[2].children.length,1,'Free-text inventory search also matches native device tags');
  deviceSearch.value='';
  deviceSearch.dispatchEvent({type:'input'});
  const cards=inventory.children[2].children;
  assert.equal(cards.length,2,'Two authorized live device objects produce two cards');
  const onlineCard=cards[0].children.find(node=>node.classList.contains('ns-live-device'));
  let favorite=cards[0].children.find(node=>node.classList.contains('ns-live-favorite'));
  assert.ok(onlineCard,'Each device keeps a native-navigation card action');
  assert.ok(favorite,'Each device exposes a separate accessible favorite control');
  const selection=cards[0].children.find(node=>node.classList.contains('ns-live-selection'));
  assert.ok(selection,'Cards expose native bulk-selection controls');
  selection.checked=true;selection.dispatchEvent({type:'change',srcElement:selection});
  assert.equal(window.checkedNodeids['node//online'],1,'Card selection updates MeshCentral native selection state');
  assert.equal(nativeGroupAction.disabled,false,'Native group action activates for a selected device');
  selection.checked=false;selection.dispatchEvent({type:'change',srcElement:selection});
  assert.equal(window.checkedNodeids['node//online'],undefined,'Deselecting a card clears the native selection');
  const tagChips=onlineCard.children.find(node=>node.classList.contains('ns-live-tags'));
  assert.ok(tagChips && tagChips.children.some(node=>node.textContent==='Critical'),'Device tags are shown on inventory cards');
  tagSelect.value='Critical';
  tagSelect.dispatchEvent({type:'change'});
  assert.equal(inventory.children[2].children.length,1,'Tag filter matches the native device tags');
  tagSelect.value='';
  tagSelect.dispatchEvent({type:'change'});
  window.nodes[0].tags=['Production','Updated'];window.meshes['mesh//one'].name='Production zone';window.nodes[0].agent={id:17};
  window.__nightShiftDevices.refresh();
  assert.ok(tagSelect.children.some(option=>option.value==='Updated'),'Updated native tags enter the tag filter without a device-list DOM mutation');
  const refreshedWorkstation=inventory.children[2].children.find(row=>row.children.some(child=>child.classList.contains('ns-live-device')&&child.children.some(part=>part.classList.contains('ns-live-device-name')&&part.textContent==='Workstation'))).children.find(child=>child.classList.contains('ns-live-device'));
  assert.ok(refreshedWorkstation.children.find(node=>node.classList.contains('ns-live-tags')).children.some(node=>node.textContent==='Updated'),'Card tag chips refresh when the native tag array changes in place');
  assert.ok(refreshedWorkstation.children.find(node=>node.classList.contains('ns-live-device-subtitle')).textContent==='Production zone','Group labels refresh when MeshCentral group metadata changes');
  assert.equal(refreshedWorkstation.children[0].children[0].textContent,'▣','Agent installation changes refresh the device capability icon');
  sortSelect.value='name';
  sortSelect.dispatchEvent({type:'change'});
  const nameSortedCard=inventory.children[2].children[0].children.find(node=>node.classList.contains('ns-live-device'));
  assert.equal(nameSortedCard.children.find(node=>node.classList.contains('ns-live-device-name')).textContent,'Archive','Name sorting is applied to the live collection');
  recentStorage.set('nightShiftRecentDevices:user/domain/qa',JSON.stringify([{id:'node//offline',openedAt:20},{id:'node//online',openedAt:10}]));
  sortSelect.value='recent';
  sortSelect.dispatchEvent({type:'change'});
  const recentSortedCard=inventory.children[2].children[0].children.find(node=>node.classList.contains('ns-live-device'));
  assert.equal(recentSortedCard.children.find(node=>node.classList.contains('ns-live-device-name')).textContent,'Archive','Recent sorting puts the last opened device first');
  sortSelect.value='reachable';
  sortSelect.dispatchEvent({type:'change'});
  layoutSelect.value='table';
  layoutSelect.dispatchEvent({type:'change'});
  assert.equal(inventory.children[2].children[0].children[0].tagName,'TABLE','Table layout renders a semantic table');
  layoutSelect.value='compact';
  layoutSelect.dispatchEvent({type:'change'});
  assert.ok(inventory.children[2].children[0].classList.contains('ns-live-compact-row'),'Compact layout renders compact device rows');
  layoutSelect.value='cards';
  layoutSelect.dispatchEvent({type:'change'});
  const cardsAgain=inventory.children[2].children;
  const firstCard=cardsAgain.find(row=>row.children.some(child=>child.classList.contains('ns-live-device') && child.children.some(part=>part.classList.contains('ns-live-device-name') && part.textContent==='Workstation')));
  favorite=firstCard.children.find(node=>node.classList.contains('ns-live-favorite'));
  favorite.click();
  assert.equal(window.stars['node//online'],1,'Favorite action updates MeshCentral native stars');
  assert.equal(favoriteWrites[0].key,'stars','Favorite state uses MeshCentral user preferences');
  assert.deepEqual(JSON.parse(favoriteWrites[0].value),{'node//online':1});
  assert.equal(favorite.getAttribute('aria-pressed'),'true');
  assert.deepEqual(updatedNativeDevices,['node//online'],'Native device row refreshes after a favorite change');
  const favoriteTab=inventory.children[1].children[1].children.find(node=>node.dataset.filter==='favorites');
  assert.ok(favoriteTab,'The inventory offers a native favorites filter');
  favoriteTab.click();
  assert.equal(inventory.children[2].children.length,1,'Favorites filter shows only native-starred devices');
  const allTab=inventory.children[1].children[1].children.find(node=>node.dataset.filter==='all');
  allTab.click();
  favorite=inventory.children[2].children[0].children.find(node=>node.classList.contains('ns-live-favorite'));
  favorite.click();
  assert.equal(window.stars['node//online'],undefined,'Favorite action can remove a native star');
  assert.equal(favorite.getAttribute('aria-pressed'),'false');
  for(let i=0;i<200;i++)window.stars['node//cap-'+i]=1;
  window.__nightShiftDevices.refresh();
  const cappedFavorite=inventory.children[2].children[0].children.find(node=>node.classList.contains('ns-live-favorite'));
  assert.equal(cappedFavorite.disabled,true,'The card control respects MeshCentral\'s 200-favorite limit');
  const recentKey='nightShiftRecentDevices:user/domain/qa';
  recentStorage.set(recentKey,JSON.stringify(Array.from({length:8},(_,i)=>({id:'node//prior-'+i,openedAt:i+1}))));
  inventory.children[2].children[0].children.find(node=>node.classList.contains('ns-live-device')).click();
  assert.deepEqual(opened,['node//online'],'Clicking a live card delegates to upstream gotoDevice');
  assert.ok(recentStorage.has(recentKey),'Recent devices use an account-scoped local preference key');
  const recentData=JSON.parse(recentStorage.get(recentKey));
  assert.equal(recentData.length,8,'Recent preference is bounded to eight devices');
  assert.equal(recentData[0].id,'node//online','Opening a device moves it to the front of recent history');
  assert.equal(recentData.filter(entry=>entry.id==='node//online').length,1,'Recent history deduplicates the opened device');
  assert.deepEqual(Object.keys(recentData[0]).sort(),['id','openedAt'],'Recent preferences contain no device name or session content');
  const recentTab=inventory.children[1].children[1].children.find(node=>node.dataset.filter==='recent');
  assert.ok(recentTab,'The inventory offers a recent-devices filter');
  recentTab.click();
  assert.equal(inventory.children[2].children.length,1,'Recent filter exposes recently opened authorized devices');
  window.userinfo={_id:'user/domain/other'};
  recentTab.click();
  assert.equal(inventory.children[2].children[0].children[0].textContent,'No recent devices yet. Open a device to add it here.','A second account cannot see the first account\'s recents');
  assert.equal(recentStorage.has('nightShiftRecentDevices:user/domain/other'),false,'Reading another account does not copy history');
  window.userinfo={_id:'user/domain/qa'};
  page.hidden=true;detailsPage.hidden=true;remotePage.hidden=false;
  window.currentNode=window.nodes[0];
  page.hidden=true;remotePage.hidden=false;skipMain.click();
  assert.equal(remotePage.focused,true,'Skip link follows navigation to the active remote-session page');
  window.multiDesktop={'node//offline':{State:1,contype:1},'node//online':{State:3,contype:1}};
  window.__NightShiftDiagnostics.refresh();
  window.__NightShiftSessions.refresh();
  // A remote session can remain in multiDesktop after the current device is
  // cleared (for example while switching or after an interrupted connection).
  // The session toolbar must remain usable and assign one sequential tab stop.
  window.currentNode=null;
  assert.doesNotThrow(()=>window.__NightShiftSessions.refresh(),'Background sessions without a current device must not throw');
  const fallbackTabs=ids.get('ns-session-tabs').children.filter(node=>node.classList.contains('ns-session-tab'));
  assert.equal(fallbackTabs.length,2,'Both background sessions remain available');
  assert.deepEqual(fallbackTabs.map(node=>node.tabIndex),[0,-1],'The first session is keyboard reachable when none is current');
  assert.equal(fallbackTabs.filter(node=>node.getAttribute('aria-current')==='true').length,0,'No background session is marked current');
  window.currentNode=window.nodes[0];
  window.__NightShiftSessions.refresh();
  const sessionTabs=ids.get('ns-session-tabs');
  assert.ok(sessionTabs,'Remote workspace exposes tabs for native live sessions');
  assert.equal(sessionTabs.parentNode,column,'Open sessions remain available from the shared workspace, outside the hidden remote desktop page');
  assert.ok(column.children.indexOf(sessionTabs)<column.children.indexOf(page),'Session navigation appears before native workspace pages');
  assert.equal(sessionTabs.getAttribute('role'),'toolbar','Session controls use a single keyboard navigation group');
  assert.equal(sessionTabs.getAttribute('aria-orientation'),'horizontal');
  assert.equal(sessionTabs.children.filter(node=>node.classList.contains('ns-session-tab')).length,2,'Tabs enumerate existing and connecting native sessions');
  remotePage.hidden=true;page.hidden=false;window.__NightShiftSessions.refresh();
  assert.equal(sessionTabs.hidden,false,'Open session navigation remains visible after leaving the Remote Desktop page');
  remotePage.hidden=false;page.hidden=true;window.__NightShiftSessions.refresh();
  const archiveTab=sessionTabs.children.find(node=>node.dataset.sessionId==='node//offline');
  assert.ok(archiveTab,'Session tabs identify sessions by native device ID');
  assert.equal(archiveTab.tabIndex,-1,'Only the active session starts in the page tab sequence');
  assert.equal(archiveTab.getAttribute('aria-current'),null,'Background sessions are not marked current');
  const currentSessionTab=sessionTabs.children.find(node=>node.classList.contains('ns-session-tab')&&node.getAttribute('aria-current')==='true');
  assert.ok(currentSessionTab,'The active native session is exposed as the current navigation item');
  assert.equal(currentSessionTab.tabIndex,0);
  let sessionKeyPrevented=false;
  sessionTabs.dispatchEvent({type:'keydown',key:'Home',target:currentSessionTab,preventDefault(){sessionKeyPrevented=true;}});
  assert.equal(sessionKeyPrevented,true,'Home is consumed by the horizontal session toolbar');
  assert.equal(archiveTab.focused,true,'Home moves focus to the first session control');
  let nextSessionControl=sessionTabs.children.find(node=>node.classList.contains('ns-session-tab-close'));
  sessionTabs.dispatchEvent({type:'keydown',key:'ArrowRight',target:archiveTab,preventDefault(){}});
  assert.equal(nextSessionControl.focused,true,'ArrowRight includes the background session disconnect control');
  sessionTabs.dispatchEvent({type:'keydown',key:'End',target:nextSessionControl,preventDefault(){}});
  assert.equal(currentSessionTab.focused,true,'End moves focus to the last session control');
  const sessionAnnouncement=sessionTabs.children.find(node=>node.getAttribute('role')==='status');
  assert.ok(sessionAnnouncement,'Session changes have a dedicated status announcement');
  assert.equal(sessionAnnouncement.getAttribute('aria-live'),'polite');
  assert.doesNotMatch(sessionsSource,/panel\.replaceChildren\(/,'Rerendering leaves the live region mounted for reliable announcements');
  assert.match(sessionAnnouncement.textContent,/2 remote sessions\./,'Newly opened sessions are announced after the initial render');
  window.multiDesktop['node//offline'].State=3;
  window.__NightShiftSessions.refresh();
  assert.match(sessionAnnouncement.textContent,/Archive: Connected\./,'A background session state change names the session that changed');
  archiveTab.click();
  assert.equal(opened.at(-1),'node//offline','Switching a tab delegates to native gotoDevice permissions and routing');
  const closeArchive=sessionTabs.children.find(node=>node.classList.contains('ns-session-tab-close'));
  assert.ok(closeArchive,'Background session tabs expose an explicit disconnect action');
  closeArchive.click();
  assert.deepEqual(disconnectedSessions,['node//offline'],'Disconnect delegates to MeshCentral native rights checks');
  window.desktop={State:3,contype:1,m:{displays:{'0':'Display 1','1':'Display 2'},SetDisplay:index=>monitorSelections.push(index),SendCompressionLevel:(encoding,quality,scaling,framerate)=>compressionUpdates.push({encoding,quality,scaling,framerate})}};
  window.__NightShiftProfiles.refresh();
  const profilePanel=ids.get('ns-connection-profile');
  assert.ok(profilePanel,'Device desktop offers a connection profile editor');
  const keyboardMapControl=profilePanel.children[1].children.find(node=>node.id==='ns-profile-keyboard-map-help');
  assert.ok(keyboardMapControl,'Keyboard mapping help is included beside the profile controls');
  assert.match(keyboardMapControl.textContent,/MeshAgent desktop.*Browser RDP derives its keyboard mapping from the browser locale; Intel AMT/i,'The UI explains Agent map support and native RDP/AMT keyboard behavior');
  assert.equal(profilePanel.children[1].children.find(row=>row.children[1]&&row.children[1].dataset.profileField==='keyboardMap').children[1].getAttribute('aria-describedby'),'ns-profile-keyboard-map-help','Keyboard-map guidance is associated with its control for assistive technology');
  const profileControl=key=>profilePanel.children[1].children.find(row=>row.children[1]&&row.children[1].dataset.profileField===key).children[1];
  profileControl('method').value='agent';
  profileControl('monitor').value='1';
  profileControl('scaling').value='768';
  profileControl('quality').value='70';
  profileControl('keyboardMap').value='remote';
  profileControl('fullscreen').value='true';
  profilePanel.children[2].children.find(button=>button.textContent==='Save profile').click();
  const profileKey='nightShiftConnectionProfile:user%2Fdomain%2Fqa:node%2F%2Fonline';
  const savedProfile=JSON.parse(recentStorage.get(profileKey));
  assert.deepEqual(Object.keys(savedProfile).sort(),['fullscreen','keyboardMap','method','monitor','quality','scaling','version'],'Profiles persist only allow-listed display preferences');
  assert.equal(savedProfile.quality,'70');
  assert.deepEqual(monitorSelections,[1],'Saved monitor preference uses MeshCentral native display selection');
  assert.deepEqual(compressionUpdates,[{encoding:4,quality:70,scaling:768,framerate:50}],'Quality and scaling apply through native MeshCentral compression settings');
  assert.equal(window.desktop.m.remoteKeyMap,true,'Keyboard map applies through the native Agent desktop object');
  window.desktop={State:3,contype:1};
  profilePanel.children[2].children.find(button=>button.textContent==='Save profile').click();
  assert.match(profilePanel.children[3].textContent,/No profile settings could be applied/i,'Agent session without a native desktop object is not reported as successfully configured');
  profilePanel.children[2].children.find(button=>button.textContent==='Apply fullscreen').click();
  assert.equal(fullscreenToggles,1,'Fullscreen preference invokes MeshCentral native viewer control on direct user action');
  window.currentNode=window.nodes[1];window.desktop=null;window.__NightShiftProfiles.refresh();
  profilePanel.children[1].children.find(row=>row.children[1]&&row.children[1].dataset.profileField==='method').children[1].value='agent';
  profilePanel.children[1].children.find(row=>row.children[1]&&row.children[1].dataset.profileField==='fullscreen').children[1].value='true';
  profilePanel.children[2].children.find(button=>button.textContent==='Connect using profile').click();
  assert.equal(nativeConnect.clickCount,1,'Connect using a profile delegates to the enabled native Connect control');
  assert.equal(fullscreenToggles,2,'Fullscreen preference is applied during the user-initiated profile connection flow');
  window.currentNode=window.nodes[0];window.desktop={State:3,contype:1,m:{displays:{'0':'Display 1','1':'Display 2'},SetDisplay:index=>monitorSelections.push(index),SendCompressionLevel:(encoding,quality,scaling,framerate)=>compressionUpdates.push({encoding,quality,scaling,framerate})}};
  window.__NightShiftProfiles.refresh();
  const diagnostics=ids.get('ns-session-diagnostics');
  assert.ok(diagnostics,'Remote workspace exposes connection diagnostics');
  const diagnostic=(kind)=>diagnostics.children.flatMap(node=>node.children).find(node=>node.dataset.kind===kind);
  const guidance=diagnostics.children.find(node=>node.classList.contains('ns-diagnostics-guidance'));
  assert.ok(guidance,'Diagnostics include a live next-step message');
  assert.match(read('public/scripts/night-shift/diagnostics.js'),/for \(var parent = target\.parentElement; parent && parent\.nodeType === 1; parent = parent\.parentElement\)/,'Native control visibility checks stop at the document element and never pass Document to getComputedStyle');
  assert.match(guidance.textContent,/native controls/i,'Idle session offers the normal native connect path');
  assert.ok(diagnostic('browser'),'Browser diagnostic row is present');
  assert.ok(diagnostic('webrtc'),'Diagnostics show the native WebRTC link separately');
  assert.equal(diagnostic('browser').children[1].textContent,'Online','Browser connectivity uses navigator.onLine');
  assert.equal(diagnostic('control').children[1].textContent,'Connected','MeshCentral control-channel state uses the native socket');
  window.meshserver.State=0;
  assert.equal(window.meshserver.onStateChanged(window.meshserver,0,2),'native state result','Control-state observation preserves the native callback return value');
  assert.equal(window.meshserver.nativeStateChanges,1,'Control-state observation still calls MeshCentral’s native callback');
  assert.equal(diagnostic('control').children[1].textContent,'Disconnected','Socket disconnect updates diagnostics directly from the native state event');
  window.meshserver.State=2;window.meshserver.onStateChanged(window.meshserver,2,0);
  assert.equal(diagnostic('control').children[1].textContent,'Connected','Socket reconnect updates diagnostics without another DOM mutation');
  assert.equal(diagnostic('device').children[1].textContent,'Agent via relay','Device route reports native agent and relay flags');
  window.desktop.webRtcActive=false;
  window.webRtcDesktop={webrtc:{iceConnectionState:'checking'},webchannel:{readyState:'connecting'}};
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('webrtc').children[1].textContent,'Soft-KVM WebRTC · ICE checking · data channel connecting','Soft-KVM negotiation is reported from its native WebRTC objects');
  window.webRtcDesktop.webrtc.iceConnectionState='failed';
  assert.equal(window.webRtcDesktopReset(),'native WebRTC reset','WebRTC state observation preserves the native reset return value');
  assert.equal(webRtcResetCalls,1,'WebRTC state observation still invokes MeshCentral native cleanup');
  assert.equal(diagnostic('webrtc').children[1].textContent,'ICE failed · link reset by MeshCentral','Native failure cleanup preserves an actionable WebRTC failure status');
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('session').children[1].textContent,'MeshAgent desktop · Connected','A stale native WebRTC flag is not reported as an active WebRTC path after reset');
  assert.match(guidance.textContent,/WebRTC ICE failed.*native desktop session remains active/i,'ICE failure guidance reflects MeshCentral reset behavior and available session recovery');
  window.webRtcDesktop={webrtc:{iceConnectionState:'connected'},webchannel:{readyState:'open'}};
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('webrtc').children[1].textContent,'Soft-KVM WebRTC · ICE connected · data channel open','A later successful Soft-KVM connection replaces stale failure status');
  assert.equal(diagnostic('session').children[1].textContent,'MeshAgent desktop · Connected','Soft-KVM state is not confused with the Agent redirect transport');
  assert.doesNotMatch(guidance.textContent,/WebRTC ICE failed/i,'Recovered WebRTC clears stale failure guidance');
  window.webRtcDesktop=null;
  window.desktop={State:3,contype:1,webRtcActive:true,webrtc:{iceConnectionState:'connected'},webchannel:{readyState:'open'}};
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('webrtc').children[1].textContent,'Agent WebRTC · ICE connected · data channel open','The normal Agent redirect WebRTC peer and channel are reported');
  assert.equal(diagnostic('session').children[1].textContent,'MeshAgent desktop · WebRTC · Connected','Native Agent WebRTC state is reflected in the session transport label');
  window.desktop.webRtcActive=false;window.desktop.webrtc=null;window.desktop.webchannel=null;
  window.__NightShiftDiagnostics.refresh();
  window.webRtcDesktop={webrtc:{iceConnectionState:'failed'},webchannel:{readyState:'connecting'}};
  window.webRtcDesktopReset();
  assert.match(guidance.textContent,/WebRTC ICE failed/i,'A fresh failure is attributed to its active session');
  window.currentNode=window.nodes[1];window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('webrtc').children[1].textContent,'Not active','A prior device ICE failure does not leak into another device diagnostic');
  assert.doesNotMatch(guidance.textContent,/WebRTC ICE failed/i,'Failure guidance is cleared when the active device changes');
  window.currentNode=window.nodes[0];window.webRtcDesktop=null;window.desktop=null;window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('cloudflare').children[1].textContent,'Not observable after page load','The UI does not infer Cloudflare tunnel health from an authenticated page');
  const savedDesktop=window.desktop;window.currentNode.conn=0;window.desktop=null;window.__NightShiftDiagnostics.refresh();
  assert.match(guidance.textContent,/Browser RDP is available/i,'Missing Agent/AMT route guidance preserves an enabled RDP option');
  nativeRdpConnect.disabled=true;window.__NightShiftDiagnostics.refresh();
  assert.match(guidance.textContent,/Browser RDP is unavailable/i,'Guidance does not recommend RDP when its native control is disabled');
  nativeRdpConnect.disabled=false;window.currentNode.conn=9;window.desktop=savedDesktop;window.__NightShiftDiagnostics.refresh();
  const showNativeControls=diagnostics.children.find(node=>node.classList.contains('ns-diagnostics-action'));
  assert.ok(showNativeControls,'Unconnected sessions offer a shortcut to native connect controls');
  showNativeControls.click();
  assert.equal(nativeConnect.focused,true,'Connection shortcut focuses the available native Connect control');
  window.desktop={State:3,contype:4,webRtcActive:false};
  nativeStatus.textContent='Connected, RDP';
  nativeDisconnect.hidden=false;
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('session').children[1].textContent,'Browser RDP · Connected','Session transport and state use native MeshCentral values');
  assert.equal(diagnostic('display').children[1].textContent,'Canvas present; desktop frames not verified','A mounted canvas is not misreported as confirmed desktop frame delivery');
  assert.equal(showNativeControls.hidden,false,'Native recovery shortcut remains available even with an active canvas');
  assert.equal(showNativeControls.textContent,'Show native disconnect control','Connected sessions prioritize the native Disconnect recovery path');
  assert.match(guidance.textContent,/mounted canvas does not prove that desktop frames are arriving/i,'Blank-display guidance distinguishes canvas presence from real video');
  showNativeControls.click();
  assert.equal(nativeDisconnect.focused,true,'Recovery shortcut focuses native Disconnect without invoking it');
  window.desktop.State=4;
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('session').children[1].textContent,'Browser RDP · Connected','MeshCentral terminal connected state is also treated as active');
  assert.equal(showNativeControls.hidden,false,'Native recovery control remains reachable in native connected state four');
  window.navigator.onLine=false;window.meshserver.State=0;
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('browser').children[1].textContent,'Offline','Offline browser state is distinguished from the MeshCentral channel');
  assert.equal(diagnostic('control').children[1].textContent,'Disconnected','Disconnected MeshCentral control channel is reported separately');
  assert.match(guidance.textContent,/browser is offline/i,'Browser network loss gets a cause-specific next step');
  window.navigator.onLine=true;window.meshserver.State=2;window.currentNode=window.nodes[0];window.desktop={State:3,contype:1};
  deskCanvas.hidden=true;nativeDisconnect.hidden=false;
  window.__NightShiftDiagnostics.refresh();
  assert.match(guidance.textContent,/canvas is not mounted/i,'Connected-without-canvas state is identified');
  assert.equal(showNativeControls.hidden,false,'Recovery action appears when connected without a canvas');
  showNativeControls.click();
  assert.equal(nativeDisconnect.focused,true,'Recovery action focuses native Disconnect before a deliberate reconnect');
  window.userinfo={_id:'user/domain/qa'};
  const returnToAll=inventory.children[1].children[1].children.find(node=>node.dataset.filter==='all');
  returnToAll.click();
  const toggle=inventory.children[0].children[1];
  toggle.click();
  assert.equal(inventory.hidden,false,'The original-list toggle stays visible when cards are off');
  assert.equal(body.classList.contains('ns-cards-enabled'),false);
  toggle.click();
  assert.equal(body.classList.contains('ns-cards-enabled'),true,'Cards can be re-enabled');
  window.nodes=Array.from({length:152},(_,index)=>({_id:'node//bulk-'+index,name:'Bulk '+index,meshid:'mesh//one',conn:index%2?1:0,osdesc:'Windows',tags:[],v:true}));
  window.__nightShiftDevices.refresh();
  assert.equal(inventory.children[2].children.filter(row=>row.classList.contains('ns-live-device-frame')).length,150,'Large inventories render an initial bounded page');
  const showMore=inventory.children[2].children.at(-1);
  assert.equal(showMore.textContent,'Show next 2 devices','The continuation control reports how many remaining rows will be added');
  assert.match(showMore.getAttribute('aria-label'),/2 more matches available/);
  showMore.click();
  assert.equal(inventory.children[2].children.filter(row=>row.classList.contains('ns-live-device-frame')).length,152,'Show more exposes devices past the initial 150-row limit');
  assert.equal(inventory.children[2].children.some(row=>row.classList.contains('ns-live-load-more')),false,'The continuation control disappears when every match is rendered');
});

test('structural layer remains progressive with native sessions and no synthetic fleet',()=>{
  for(const token of ['ns-appbar','ns-overview','ns-session-strip','ns-device-actions','ns-appbar-menu']){
    assert.ok(js.includes(token), 'Missing live UI component '+token);
    assert.ok(css.includes(token), 'Missing matching visual component '+token);
  }
  assert.ok(css.includes('.ns-live-favorite[aria-pressed="true"]'),'Favorite state has a visible active treatment');
  assert.match(js,/countRenderedDevices/);
  assert.match(js,/\[name="xxdevice1"\]/);
  assert.match(js,/Remote session connected/);
  assert.match(js,/native\.dispatchEvent\(new MouseEvent\('mouseup'/);
  assert.doesNotMatch(js,/Studio Workstation|Travel Laptop|Build Server|Demo session|fake-desktop/);
  assert.doesNotMatch(js,/new\s+WebSocket\s*\(|new\s+RTCPeerConnection\s*\(/);
  assert.doesNotMatch(css,/#devListToolbarSpan\s*\{\s*display:\s*none/i,'Native bulk-action toolbar stays available');
});

test('native user-group management receives responsive styling without replacing actions',()=>{
  assert.match(css,/body\.ns-theme #p50userGroupOps/);
  assert.match(css,/body\.ns-theme #p50groups \.p3usersTable/);
  assert.match(css,/body\.ns-theme #p50groups tr:focus-visible/);
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?#p50groups \.p3usersTable \{min-width:500px\}/);
  assert.match(read('views/default.handlebars'),/p50usersSelectallButtonFunction\(\)/);
  assert.match(read('views/default.handlebars'),/p50usersGroupActionFunction\(\)/);
  assert.match(read('views/default.handlebars'),/function addUserGroupHtml\(group\)/);
  assert.match(read('views/default.handlebars'),/gotoUserGroup/);
});

test('native user administration keeps its permission-aware search and bulk controls responsive',()=>{
  assert.match(css,/body\.ns-theme #p4 > \.pTable/);
  assert.match(css,/body\.ns-theme #p3users \.p3usersTable/);
  assert.match(css,/body\.ns-theme #UserSearchInput/);
  assert.match(css,/body\.ns-theme #p3users \.p3usersTable > tbody > tr:focus-visible/);
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?#p3users \.p3usersTable \{min-width:560px\}/);
  const template=read('views/default.handlebars');
  assert.match(template,/id=UsersSelectAllButton/);
  assert.match(template,/id=UsersGroupActionButton/);
  assert.match(template,/id=UserSearchInput/);
  assert.match(template,/function addUserHtml\(user, sessions\)/);
  assert.match(template,/gotoUser/);
});

test('disabled bulk-action buttons are visually muted across device, user and group lists',()=>{
  assert.match(css,/body\.ns-theme\.ns-shell-ready :is\(#GroupActionButton,#UsersGroupActionButton,#UsersGroupsGroupActionButton\):disabled \{background:#263139!important;background-image:none!important;border-color:#3b4850!important;color:#91a0a8!important;opacity:\.72;box-shadow:none;cursor:not-allowed\}/);
  const template=read('views/default3.handlebars');
  for(const id of ['GroupActionButton','UsersGroupActionButton','UsersGroupsGroupActionButton']) {
    assert.match(template,new RegExp(`id=${id}[^>]*disabled="disabled"`),`${id} remains natively disabled until a selection exists`);
  }
});

test('native user-group details stack safely at mobile widths',()=>{
  assert.match(css,/body\.ns-theme #p51info > table/);
  assert.match(css,/body\.ns-theme #MainUserImage \{float:none!important/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*?#p51info > table > tbody > tr > td:nth-child\(2\) \{display:none\}/);
  assert.match(css,/body\.ns-theme #p51info > table > tbody > tr > td:last-child \{[\s\S]*?width:100%!important/);
  const template=read('views/default.handlebars');
  assert.match(template,/id=p51group/);
  assert.match(template,/id=MainUserImage/);
  assert.match(template,/onclick=goBack\(\)/);
});

test('native server administration overview organizes live status responsively',()=>{
  assert.match(css,/body\.ns-theme #p6info \{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/body\.ns-theme #p6 #p2ServerActions/);
  assert.match(css,/body\.ns-theme #p6 #serverStats/);
  assert.match(css,/body\.ns-theme #p6 #serverWarningsDiv/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*?body\.ns-theme #p6info \{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/body\.ns-shell-ready #p6 #p2ServerActions > div > div \{[\s\S]*?display:flex[\s\S]*?width:auto/);
  assert.match(css,/body\.ns-shell-ready #p6 #serverStats \.chartViewText \{[\s\S]*?overflow-wrap:anywhere/);
  const template=read('views/default.handlebars');
  assert.match(template,/server_showBackupDlg\(\)/);
  assert.match(template,/server_showRestoreDlg\(\)/);
  assert.match(template,/id="serverStatsTable"/);
  assert.match(template,/id="serverWarningsDiv"/);
});

test('desktop Server General uses the workspace scroller instead of nesting a viewport-sized Memory panel',()=>{
  const template=read('views/default3.handlebars');
  assert.match(template,/QS\('p6info'\)\['height'\]\s*=\s*'calc\(100vh - '\s*\+\s*\(-50 \+ xh \+ xh2\)/,'Upstream assigns p6info a fixed viewport-based height');
  const desktopRule=css.match(/@media\(min-width:901px\)\s*\{\s*body\.ns-shell-ready #p6info \{([^}]+)\}\s*\}/);
  assert.ok(desktopRule,'Desktop clears the native p6info height and nested scroll');
  assert.match(desktopRule[1],/height:auto!important/);
  assert.match(desktopRule[1],/max-height:none!important/);
  assert.match(desktopRule[1],/overflow-x:visible!important;overflow-y:visible!important/);
  assert.match(css,/body\.ns-shell-ready #column_l \{[\s\S]*?overflow-y:auto!important/,'The page workspace remains the single vertical scroll container');
});

test('desktop native overview, account, and device pages expand into the workspace scroller',()=>{
  const desktop=css.match(/@media\(min-width:901px\)\s*\{\s*\/\* Native route templates give several content panels[\s\S]*?\n\}/);
  assert.ok(desktop,'Desktop native panels have a dedicated single-scroll layout rule');
  for(const id of ['#p1','#p2info','#p10info','#p17info']) assert.ok(desktop[0].includes(`body.ns-shell-ready ${id}`),`${id} clears its native fixed height`);
  assert.match(desktop[0],/height:auto!important/);
  assert.match(desktop[0],/max-height:none!important/);
  assert.match(desktop[0],/overflow-y:visible!important/);
  assert.match(desktop[0],/#column_l \{padding-bottom:72px!important\}/,'The workspace can scroll the final rows above fixed route tabs');
});

test('desktop native headings and device console use readable Night Shift colors',()=>{
  const desktop=css.match(/@media\(min-width:901px\)\s*\{\s*\/\* Native route templates give several content panels[\s\S]*?\n\}/);
  assert.ok(desktop);
  for(const id of ['#p10title','#p11title','#p12title','#p13title','#p15title','#p16title','#p17title','#p18title','#p50title','#p60title']) assert.ok(desktop[0].includes(id),`${id} is included in desktop title normalization`);
  assert.match(desktop[0],/background:var\(--ns-canvas\)!important/);
  assert.match(desktop[0],/body\.ns-shell-ready\.ns-theme #p15title \{color:var\(--ns-foreground\)!important\}/,'The console title remains legible');
});

test('desktop floating remote viewer controls clear the fixed device-tab bar',()=>{
  const desktop=css.match(/@media\(min-width:901px\)\s*\{\s*\/\* Native route templates give several content panels[\s\S]*?\n\}/);
  assert.ok(desktop);
  assert.match(desktop[0],/\.ns-viewer-controls \{bottom:3\.5rem\}/);
});

test('account security settings keep native links and use a responsive desktop workspace',()=>{
  assert.match(css,/@media\(min-width:901px\)[\s\S]*?body\.ns-theme #p2info \{[\s\S]*?grid-template-columns:minmax\(230px/);
  assert.match(css,/body\.ns-theme :is\(#p2AccountSecurity,#p2AccountActions\) \{grid-column:2\/-1/);
  assert.match(css,/body\.ns-theme #p2meshes \{display:grid;grid-template-columns:repeat\(auto-fit/);
  assert.match(css,/body\.ns-theme #p2meshes > div \{[\s\S]*?width:auto!important/);
  assert.match(css,/body\.ns-shell-ready #p2info \{box-sizing:border-box;min-width:0;max-width:100%\}/);
  assert.match(css,/body\.ns-shell-ready #p2meshes > \.row \{box-sizing:border-box;width:100%;max-width:100%;margin-left:0!important;margin-right:0!important\}/,'Bootstrap row gutters inside the device-group grid do not exceed the account panel width');
  const template=read('views/default.handlebars');
  assert.match(template,/account_manageAuthApp\(\)/);
  assert.match(template,/account_showChangePassword\(\)/);
  assert.match(template,/account_createMesh\(\)/);
});

test('native dialogs preserve their actions with responsive content and button bars',()=>{
  assert.match(css,/body\.ns-theme #dialogHeader \{[\s\S]*?display:flex/);
  assert.match(css,/body\.ns-theme #dialogBody \{[\s\S]*?overflow:auto/);
  assert.match(css,/body\.ns-theme #idx_dlgButtonBar \{[\s\S]*?display:flex/);
  assert.match(css,/body\.ns-theme #idx_dlgOkButton \{border-color:#b6f078/);
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?body\.ns-theme #dialogBody \{max-height:calc\(100dvh - 170px\)/);
  const template=read('views/default.handlebars');
  assert.match(template,/onclick="dialogclose\(0\)"/);
  assert.match(template,/onclick="dialogclose\(1\)"/);
  assert.match(template,/onclick="dialogclose\(2\)"/);
});

test('user record details stack the native profile and account fields on mobile',()=>{
  assert.match(css,/body\.ns-theme #p30info > table > tbody > tr \{display:grid;grid-template-columns:minmax\(0,1fr\) 12px/);
  assert.match(css,/body\.ns-theme #p30html2,[\s\S]*?#p30html3 \{margin:0 0 14px/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*?body\.ns-theme #p30info > table > tbody > tr > td:nth-child\(2\) \{display:none\}/);
  assert.match(css,/body\.ns-theme #p30info :is\(#MainUserImage,#MainUserImageEx\)/);
  const template=read('views/default.handlebars');
  assert.match(template,/id=p30html/);
  assert.match(template,/id=p30html2/);
  assert.match(template,/id=p30html3/);
  assert.match(template,/id="p30userAuthServiceLogo"/);
  assert.match(template,/account_manageImage\(1\)/);
});

test('device detail pages adapt their native fields, notes and status card to mobile',()=>{
  assert.match(css,/body\.ns-theme #p10info > table > tbody > tr \{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(180px,230px\)\}/);
  assert.match(css,/body\.ns-theme #p10info > table > tbody > tr > td#notesPanel/);
  assert.match(css,/body\.ns-theme #p10info #MainComputerImage/);
  assert.match(css,/@media\(max-width:700px\)[\s\S]*?body\.ns-theme #p10info > table > tbody > tr > td:last-child \{display:flex/);
  assert.match(css,/body\.ns-shell-ready #p10info #p10html \.row\.mb-1 > \.col\.col-md-2\.col-lg-2 \{[\s\S]*?flex:0 0 180px[\s\S]*?word-break:normal/);
  assert.match(css,/body\.ns-shell-ready #p10info #p10html \.row\.mb-1 > \.col\.col-md-10\.col-lg-10 \{[\s\S]*?flex:1 1 0[\s\S]*?min-width:0/);
  assert.match(css,/@media\(min-width:901px\) \{\s*body\.ns-shell-ready #p10info \{\s*height:auto!important;\s*max-height:none!important;\s*overflow-x:visible!important;\s*overflow-y:visible!important/);
  const template=read('views/default.handlebars');
  assert.match(template,/id=p10html/);
  assert.match(template,/id=p10html2/);
  assert.match(template,/id=p10html5/);
  assert.match(template,/id=notesPanel/);
  assert.match(template,/id="p10deviceMsg"/);
  assert.match(template,/id="p10deviceNotify"/);
});

test('server statistics and trace views stay responsive and trace rows use native click actions',()=>{
  assert.match(css,/body\.ns-theme :is\(#p40,#p41\) > \.areaHead \{[\s\S]*?flex-wrap:wrap/);
  assert.match(css,/body\.ns-theme #serverMainStats \{[\s\S]*?width:100%!important/);
  assert.match(css,/body\.ns-theme #p41events \.traceEvent:focus-visible/);
  assert.match(css,/@media\(max-width:600px\)[\s\S]*?body\.ns-theme :is\(#p40,#p41\) > \.areaHead select/);
  const template=read('views/default.handlebars');
  assert.match(template,/updateServerTimelineStats\(\)/);
  assert.match(template,/p41downloadServerTrace\(\)/);
  assert.match(template,/class=traceEvent onclick=showTraceEvent/);
  const row={dataset:{},textContent:'11:04 - WEB: request',attributes:{},listeners:{},clicks:0,
    setAttribute(name,value){this.attributes[name]=String(value);},
    addEventListener(name,callback){(this.listeners[name]||=[]).push(callback);},
    click(){this.clicks++;}};
  const traceRoot={querySelectorAll(selector){return selector==='.traceEvent[onclick]'?[row]:[];}};
  const document={readyState:'complete',getElementById(id){return id==='p41events'?traceRoot:null;}};
  const window={};
  vm.runInNewContext(serverAdmin,{window,document,MutationObserver:class{observe(){};}},{timeout:1000});
  assert.equal(row.tabIndex,0);
  assert.equal(row.attributes.role,'button');
  assert.match(row.attributes['aria-label'],/Open server trace details/);
  let prevented=false;
  row.listeners.keydown[0]({target:row,key:' ',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(row.clicks,1,'Space delegates to the existing trace detail click handler');
  window.__NightShiftServerAdmin.refresh();
  assert.equal(row.listeners.keydown.length,1,'refresh does not duplicate event handlers');
});

test('native user-list settings icon is keyboard reachable and preserves its MeshCentral click handler',()=>{
  assert.match(css,/body\.ns-theme #usersListToolbarSettings:focus-visible \{outline:2px solid var\(--ns-focus\)/);
  const template=read('views/default.handlebars');
  const modernTemplate=read('views/default3.handlebars');
  assert.match(template,/id=usersListToolbarSettings[^>]*onclick="onUsersViewSettings\(\)"/);
  assert.match(modernTemplate,/id=usersListToolbarSettings[^>]*onclick="onUsersViewSettings\(\)"/);
  const icon={attributes:{onclick:'onUsersViewSettings()'},listeners:{},nativeActivations:0,tabIndex:-1,
    getAttribute(name){return this.attributes[name]??null;},
    setAttribute(name,value){this.attributes[name]=String(value);},
    addEventListener(name,callback){(this.listeners[name]||=[]).push(callback);},
    dispatchEvent(event){if(event.type==='click'&&this.attributes.onclick==='onUsersViewSettings()')this.nativeActivations++;return true;}};
  const body={};
  const observers=[];
  const document={readyState:'complete',body,getElementById(id){return id==='usersListToolbarSettings'?icon:null;}};
  const window={};
  vm.runInNewContext(serverAdmin,{window,document,MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(target,options){this.target=target;this.options=options;}},MouseEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}}},{timeout:1000});
  assert.equal(icon.tabIndex,0);
  assert.equal(icon.attributes.role,'button');
  assert.equal(icon.attributes['aria-label'],'User list settings');
  assert.equal(icon.attributes.focusable,'true');
  assert.equal(observers[0].target,body,'future native route insertion is observed');
  let prevented=false;
  icon.listeners.keydown[0]({target:icon,key:'Enter',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(icon.nativeActivations,1,'Enter dispatches the existing native click action');
  prevented=false;
  icon.listeners.keydown[0]({target:icon,key:' ',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(icon.nativeActivations,2,'Space dispatches the existing native click action');
  window.__NightShiftServerAdmin.refresh();
  assert.equal(icon.listeners.keydown.length,1,'refresh does not duplicate the keyboard handler');
});

test('server memory customization labels binary byte values in GiB without changing the native calculation',()=>{
  const template=read('views/default3.handlebars');
  assert.match(template,/round\(bytes \/ 1024 \/ 1024 \/ 1024, 1\)/,'MeshCentral still calculates memory from bytes using binary units');
  const memory={innerHTML:'<b>3.7 Gb</b> free, <b>15.9 Gb</b> total'};
  const observers=[];
  const document={readyState:'complete',getElementById(id){return id==='serverMemoryChartText'?memory:null;}};
  const window={};
  vm.runInNewContext(serverAdmin,{window,document,MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(target,options){this.target=target;this.options=options;}}},{timeout:1000});
  assert.equal(memory.innerHTML,'<b>3.7 GiB</b> free, <b>15.9 GiB</b> total','Initial native memory output receives the correct binary unit label');
  assert.equal(window.__NightShiftServerAdmin.normalizeMemoryUnit('<b>3.7 Gb</b>; network uses Gb/s'),'<b>3.7 GiB</b>; network uses Gb/s','The label conversion is limited to the bold memory value, not rate units');
  assert.equal(observers.length,1,'Dynamic native memory refreshes are observed');
  assert.equal(observers[0].options.subtree,true);
  memory.innerHTML='<b>4.0 Gb</b> free, <b>16.0 Gb</b> total';
  observers[0].callback();
  assert.equal(memory.innerHTML,'<b>4.0 GiB</b> free, <b>16.0 GiB</b> total','Later native telemetry refreshes keep the corrected unit');
});

test('native shell clips inventory overflow and keeps horizontal scrolling local to the table',()=>{
  assert.match(css,/body\.ns-shell-ready #column_l \{[\s\S]*?overflow-x:hidden!important[\s\S]*?overflow-y:auto!important/);
  assert.match(css,/body\.ns-shell-ready #p1 \{[\s\S]*?overflow-x:clip/);
  assert.doesNotMatch(css,/body\.ns-shell-ready #p1\s*\{[^}]*overflow-x:auto/);
  assert.match(css,/body\.ns-shell-ready #p1 #ns-live-inventory select \{max-width:100%;min-width:0\}/);
  assert.match(css,/\.ns-live-table-wrap \{max-width:100%;overflow:auto/);
  assert.match(css,/@media\(max-width:900px\)\s*\{\s*\/\* On narrow screens keep the appbar in normal flow so native page controls[\s\S]*?body\.ns-shell-ready #ns-appbar \{position:relative;top:auto\}/,'The mobile appbar scrolls in normal flow and cannot overlay the native page content');
});

test('server statistics separate the plot from controls and empty reports do not create a blank full-height page',()=>{
  assert.match(css,/body\.ns-shell-ready #p40 > #serverMainStats \{[\s\S]*?margin-top:12px/);
  assert.match(css,/body\.ns-shell-ready #p40title \{position:relative;top:auto;z-index:auto;margin:0 0 10px;background:transparent\}/);
  assert.match(css,/@media\(min-width:901px\)\s*\{[\s\S]*?body\.ns-shell-ready #p40title \{position:sticky;top:76px;z-index:69;margin-bottom:40px\}[\s\S]*?body\.ns-shell-ready #p40 > #serverMainStats \{margin-top:50px\}/,'At desktop widths, the title clears the appbar and the plot retains normal-flow clearance');
  assert.match(css,/body\.ns-shell-ready #p40title > \.fs-4 \{color:var\(--ns-foreground\)!important\}/,'Server Stats heading overrides the native dark text color on Night Shift canvas');
  assert.match(css,/body\.ns-shell-ready #p60 \{[\s\S]*?height:auto!important[\s\S]*?overflow:visible!important/);
  assert.match(css,/body\.ns-shell-ready #p60report:empty::before \{content:"No report generated yet\. Select Generate Report\.\.\. to begin\."\}/);
  const template=read('views/default.handlebars');
  assert.match(template,/id="p60title"/);
  assert.match(template,/onclick=generateReportDialog\(\) value="Generate Report\.\.\."/);
  assert.match(template,/id=p60report/);
});

test('server overview state rows and server console footer fit the shell width',()=>{
  assert.match(css,/body\.ns-shell-ready #p6 #serverStats #serverStatsTable > div > div \{display:block!important;width:100%;max-width:100%;min-width:0\}/);
  assert.match(css,/body\.ns-shell-ready #p6 #serverStats \.serverStateTableCell \{display:block!important;box-sizing:border-box;width:100%;max-width:100%;table-layout:fixed\}/);
  assert.match(css,/body\.ns-shell-ready #p6 #serverStats \.serverStateTableCell tr \{display:block!important;width:100%;min-height:24px\}/);
  assert.match(css,/body\.ns-shell-ready #p6 #serverStats \.serverStateTableCell td:first-child,[\s\S]*?td:last-child \{display:none!important;float:none!important\}/);
  assert.match(css,/body\.ns-shell-ready #p6 #serverStats \.serverStateTableCell td:nth-child\(2\) \{[\s\S]*?display:flex!important;[\s\S]*?justify-content:space-between/);
  assert.match(css,/body\.ns-shell-ready #p6 #serverStats \.serverStateTableCell td:nth-child\(2\) span:last-child \{position:static;display:block;float:none!important;flex:0 1 auto/);
  assert.match(css,/body\.ns-shell-ready #p15 \.areaFoot > table > tbody > tr \{display:flex!important;align-items:center;gap:8px\}/);
  assert.match(css,/body\.ns-shell-ready #p15 \.areaFoot > table td:first-child \{flex:1 1 0;width:auto!important;min-width:0\}/);
  assert.match(css,/body\.ns-shell-ready #p15 \.areaFoot > table td:nth-child\(2\) \{display:none!important\}/);
  assert.match(css,/body\.ns-shell-ready #p15 \.areaFoot > table td:last-child \{flex:0 0 76px;width:76px!important;min-width:76px/);
  assert.match(css,/body\.ns-shell-ready #p15 #id_p15consoleClear \{display:inline-block!important;box-sizing:border-box;width:68px!important;min-width:68px/);
  const template=read('views/default.handlebars');
  assert.match(template,/id="serverStatsTable"/);
  assert.match(template,/class=serverStateTableCell/);
  assert.match(template,/<div style=display:inline-block><table class=serverStateTableCell/);
  assert.match(template,/<span style=float:right>' \+ message\.values\[i\]\[j\]/);
  assert.match(template,/id="id_p15consoleClear"/);
});

test('device and server console output scroll long lines inside the native output pane',()=>{
  assert.match(css,/body\.ns-shell-ready #p15 #p15agentConsole \{box-sizing:border-box;width:100%!important;min-width:0;max-width:100%;overflow:hidden\}/);
  assert.match(css,/body\.ns-shell-ready #p15 #p15agentConsoleText \{display:block;box-sizing:border-box;width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:auto!important;white-space:pre\}/);
  for (const templatePath of ['views/default.handlebars','views/default3.handlebars']) {
    const template=read(templatePath);
    assert.match(template,/id=p15agentConsole[\s\S]*?<pre id=p15agentConsoleText><\/pre>/,'Native console retains its PRE text output container');
    assert.match(template,/Q\('p15agentConsoleText'\)\.scrollTop = Q\('p15agentConsoleText'\)\.scrollHeight/,'Native output continues following incoming console lines');
  }
});

test('desktop device console title and back control stay below the sticky appbar while scrolling',()=>{
  const consoleTitle=css.match(/@media\(min-width:901px\)\s*\{\s*\/\* Keep the native console title\/back control below the persistent shell bar[\s\S]*?body\.ns-shell-ready #p15title \{([^}]+)\}\s*\}/);
  assert.ok(consoleTitle,'The desktop native console title has a dedicated sticky treatment');
  assert.match(consoleTitle[1],/position:sticky/);
  assert.match(consoleTitle[1],/top:76px/,'The native title clears the persistent appbar');
  assert.match(consoleTitle[1],/z-index:69/,'The title stays above console content but below the appbar');
  assert.match(consoleTitle[1],/background:var\(--ns-canvas\)/,'Scrolled console content cannot show through the title row');
  const template=read('views/default3.handlebars');
  assert.match(template,/<div id="p15title" class="d-flex align-items-center">[\s\S]*?id="p15BackButton"/,'The native title treatment keeps MeshCentral back navigation in place');
  assert.match(template,/id=p15consoleText[\s\S]*?id="id_p15consoleClear"/,'The native console input and clear controls remain present');
});

test('native file and registry action toolbars wrap within their workspace',()=>{
  assert.match(css,/body\.ns-theme\.ns-shell-ready :is\(#p5toolbar,#p9toolbar,#p13toolbar\) :is\(button,input\[type=\"button\"\],input\[type=\"submit\"\]\)\.btn-danger:disabled,[\s\S]*?background:#263139!important;border-color:#3b4850!important;color:#91a0a8!important/,'Disabled destructive file and registry actions are muted while retaining native disabled state');
  assert.match(css,/\.ns-theme \.btn-danger:not\(:disabled\)\{background:#4a2c33;border-color:#77444f;color:#ffd2d7\}/,'Enabled danger actions retain their intentional danger treatment');
  assert.match(css,/body\.ns-shell-ready :is\(#p5toolbar,#p9toolbar,#p13toolbar\) \{box-sizing:border-box;width:100%;max-width:100%;table-layout:fixed\}/);
  assert.match(css,/body\.ns-shell-ready #p5toolbar #p5filehead > div:not\(#p5rightOfButtons\),[\s\S]*?flex-wrap:wrap/);
  assert.match(css,/body\.ns-shell-ready #p9toolbar #p9toolbar2 > td > div:not\(#p9rightOfButtons\) \{[\s\S]*?flex-wrap:wrap/);
  assert.match(css,/body\.ns-shell-ready #p13toolbar > tbody > tr \{display:block!important;box-sizing:border-box;width:100%!important/);
  assert.match(css,/body\.ns-shell-ready #p13toolbar tr:nth-child\(2\) > td > div:not\(#p13rightOfButtons\) \{display:flex!important;align-items:center;flex:1 1 100%;flex-wrap:wrap/);
  assert.match(css,/body\.ns-shell-ready #p13toolbar tr:nth-child\(2\) > td > div:not\(#p13rightOfButtons\) > input\[type="button"\] \{flex:1 1 108px;width:auto!important;min-width:0/);
  assert.match(css,/body\.ns-shell-ready #p13toolbar tr:nth-child\(3\) > td \{display:flex!important;align-items:center;justify-content:space-between;flex-wrap:wrap/);
  const template=read('views/default.handlebars');
  assert.match(template,/id="p5toolbar"/);
  assert.match(template,/id=p5PasteButton[^>]*onclick="p5pasteFile\(\)"/);
  assert.match(template,/id="p9toolbar"/);
  assert.match(template,/id=p9DetailsButton[^>]*onclick="p9showSelectedDetails\(\)"/);
  assert.match(template,/id="p13toolbar"/);
  assert.match(template,/id=p13OpenButton[^>]*onclick="p13openfilefolder\(\)"/);
  const modernTemplate=read('views/default3.handlebars');
  assert.match(modernTemplate,/id="p13toolbar"[\s\S]*?id=p13FindButton[\s\S]*?id=p13GoToFolderButton[\s\S]*?id=p13OpenButton/);
  assert.match(modernTemplate,/id=p13GoToFolderButton[^>]*onclick="p13gotofolder\(\)"/);
});

test('Events header and loaded-record search reflow without squeezing title or filter labels',()=>{
  assert.match(css,/body\.ns-theme #p3title\{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;/);
  assert.match(css,/body\.ns-theme #p3title>\.fs-4\{flex:0 1 auto;min-width:0;white-space:nowrap\}/);
  assert.match(css,/body\.ns-theme #p3title\{[^}]*background:var\(--ns-canvas\)!important;color:var\(--ns-foreground\)!important\}/,'Events title strip matches the dark canvas and theme foreground');
  assert.match(css,/body\.ns-theme #p3title>\.fs-4\{color:var\(--ns-foreground\)!important\}/,'Events heading overrides the inherited Bootstrap dark text');
  assert.match(css,/body\.ns-theme #p3title \.ns-history-search\{order:2;flex:1 1 24rem;width:auto;min-width:min\(100%,20rem\)/);
  assert.match(css,/body\.ns-theme #p3title \.ns-history-search label\{flex:1 1 auto;white-space:nowrap\}/);
  assert.match(css,/@media\(max-width:600px\)\{body\.ns-theme #p3title \.ns-history-search\{flex-basis:100%;min-width:0/);
  assert.match(css,/body\.ns-theme #p3 > \.pTable > tbody > tr \{display:block!important;box-sizing:border-box;width:100%;max-width:100%\}/);
  assert.match(css,/body\.ns-theme #p3 > \.pTable td > div \{display:flex;align-items:center;flex-wrap:wrap;gap:6px/);
  assert.match(css,/body\.ns-theme #p3 > \.pTable select \{flex:0 1 12rem;min-width:0;max-width:100%\}/);
  const template=read('views/default3.handlebars');
  assert.match(template,/id="p3title" class="d-flex align-items-center"[\s\S]*?My Events[\s\S]*?id=p3filterevents[\s\S]*?id=p3events/);
});

test('desktop Events header and list share outer scrolling without sticky overlap',()=>{
  assert.match(css,/@media\(min-width:901px\)\s*\{[\s\S]*?body\.ns-shell-ready #p3title \{position:relative;top:auto;z-index:auto\}[\s\S]*?body\.ns-shell-ready #p3 > \.pTable \{position:relative;top:auto;z-index:auto/,'At 1024px desktop width, title and filters remain in normal flow instead of covering the independently scrolling log');
  assert.match(css,/body\.ns-shell-ready #p3events \{height:auto!important;max-height:none!important;overflow:visible!important\}/,'Native event records join the outer workspace scroll so the header cannot cover the log at either scroll endpoint');
  assert.match(css,/body\.is-mobile\.ns-theme\.ns-shell-ready #p3title \{position:relative!important;top:auto!important;z-index:auto!important\}/,'MeshCentral is-mobile important positioning is reset for wide viewport emulation');
  const upstream=read('public/styles/style-bootstrap.css');
  assert.match(upstream,/body\.is-mobile #p3title,[\s\S]*?background: #fff;[\s\S]*?position: relative !important;[\s\S]*?z-index: 1 !important;/,'Upstream is-mobile title rule is an important conflicting declaration');
  const template=read('views/default3.handlebars');
  assert.match(template,/QS\('p3events'\)\['height'\] = 'calc\(100vh - '/,'MeshCentral assigns a fixed event-list height natively, which the wide-screen flow rule must override');
});

test('mobile themed native page titles override MeshCentral white title bars',()=>{
  const upstream=read('public/styles/style-bootstrap.css');
  for(const id of ['p4title','p5title','p6title','p41title']) {
    assert.ok(upstream.includes('body.is-mobile #'+id),'upstream applies its white title bar to '+id);
    assert.match(css,/body\.is-mobile\.ns-theme\.ns-shell-ready :is\(#p4title,#p5title,#p6title,#p41title\) \{background:var\(--ns-canvas\)!important;color:var\(--ns-foreground\)!important\}/,'Night Shift replaces the white title surface and keeps text legible');
  }
  assert.match(css,/body\.is-mobile\.ns-theme\.ns-shell-ready :is\(#p4title,#p5title,#p6title,#p41title\) \.fs-4 \{color:var\(--ns-foreground\)!important\}/);
  assert.match(css,/body\.is-mobile\.ns-theme\.ns-shell-ready #p15title \{[\s\S]*?background:var\(--ns-canvas\)!important;[\s\S]*?color:var\(--ns-foreground\)!important\}/,'The native Console title overrides upstream white and dark title backgrounds at touch breakpoints');
  assert.match(css,/body\.is-mobile\.ns-theme\.ns-shell-ready #p15title \* \{color:var\(--ns-foreground\)!important\}/,'Console title text and native controls keep readable contrast in portrait and landscape');
});

test('mobile device quick actions delegate to MeshCentral route handlers',()=>{
  assert.ok(shell.includes("typeof native.onmouseup === 'function'") && shell.includes('native.onmouseup.call(native, event)'),'Device actions invoke the original native detail-tab handler');
  const modernTemplate=read('views/default3.handlebars');
  assert.match(modernTemplate,/id=MainDevDesktop class="topbar_td style3x" onmouseup=go\(11,event\)/,'Desktop authorization and routing remain in the existing native handler');
});

test('appbar route labels cover native pages outside the six primary workspaces',()=>{
  const shell=read('public/scripts/night-shift/shell.js');
  for(const [id,label] of [['p9','Registry'],['p15','Console'],['p18','Software'],['p40','Server Stats'],['p41','Server Trace'],['p42','Server Plugins'],['p43','Plugin admin'],['p60','Reports']]) {
    assert.match(shell,new RegExp("\\['"+id+"', '"+label.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+"'\\]"),id+' has explicit appbar metadata');
  }
  const template=read('views/default3.handlebars');
  assert.match(template,/id="LeftMenuMyEvents"[^>]*onclick=go\(3,event\)/,'Modern Events sidebar route binds MeshCentral navigation to click');
  assert.match(shell,/if \(native && typeof native\.click === 'function'\)\s*\{\s*native\.click\(\)/,'appbar route links activate the native click handler');
  assert.match(shell,/new MouseEvent\('click'/,'fallback event type matches native sidebar click binding');
  assert.match(shell,/routes\.forEach\(function \(route\).*watchIds\.push\(route\[0\]\)/,'route metadata pages are also watched for activation updates');
});

test('appbar More menu scrolls inside the viewport when short landscape height clips its last action',()=>{
  const menu=css.match(/\.ns-appbar-menu\s*\{([^}]+)\}/);
  assert.ok(menu,'The additional sections popover has a dedicated layout rule');
  assert.match(menu[1],/max-height:min\(420px,calc\(100vh - 190px\)\)/,'A viewport-height fallback limits the popover height');
  assert.match(menu[1],/max-height:min\(420px,calc\(100dvh - 190px\)\)/,'Dynamic viewport height accounts for mobile browser chrome');
  assert.match(menu[1],/overflow-y:auto/,'All native section actions remain reachable by scrolling within the popover');
  assert.match(menu[1],/overscroll-behavior-y:contain/,'Scrolling the menu does not chain into the page behind it');
  assert.match(menu[1],/scrollbar-width:thin;[\s\S]*?scrollbar-color:#7c919c #1a2833/,'The clipped menu has a visible scroll affordance');
});

test('mobile server art, appbar title and device tabs stay within their surfaces in portrait and landscape',()=>{
  assert.match(css,/body\.ns-theme #p6title #MainMeshImage\s*\{[\s\S]*?flex:0 0 38px;[\s\S]*?width:38px!important;[\s\S]*?height:38px!important/,'The server image cannot grow into the mobile actions card');
  assert.match(css,/body\.ns-shell-ready \.ns-appbar-title \{background:transparent!important;background-image:none!important;box-shadow:none!important\}/,'The shell route title stays clean over the appbar surface');
  assert.match(css,/@media\(max-width:960px\) and \(pointer:coarse\)\s*\{\s*body\.ns-theme #MainSubMenuSpan:not\(/,'The tab scroller and visible arrows apply in both orientations on coarse-pointer phones, including the 904px landscape target');
  const submenu=css.match(/body\.ns-theme #MainSubMenuSpan #MainSubMenuScrollInner\s*\{([^}]+)\}/);
  assert.ok(submenu,'The actual nested MeshCentral submenu scroll container is targeted');
  assert.match(submenu[1],/display:block!important/,'The upstream display:contents rule is overridden on the scroll container');
  assert.match(submenu[1],/flex:1 1 0px/,'The scroll container takes only the space between the native arrow controls');
  assert.match(submenu[1],/width:0;[\s\S]*?min-width:0;[\s\S]*?overflow-x:auto!important/,'The scroll container is constrained to the viewport and can scroll its wide table');
  assert.match(submenu[1],/scrollbar-width:thin!important/,'The scroll container exposes a horizontal scroll affordance');
  const span=css.match(/body\.ns-theme #MainSubMenuSpan:not\(\[style\*="display:none"\]\):not\(\[style\*="display: none"\]\)\s*\{([^}]+)\}/);
  assert.ok(span,'The native submenu span remains display:none when MeshCentral hides it');
  assert.match(span[1],/width:100%;[\s\S]*?min-width:0;[\s\S]*?min-height:40px/,'The visible submenu wrapper stays within the available width without a fixed height');
  const template=read('views/default3.handlebars');
  assert.match(template,/id=MainSubMenuSpan[\s\S]*?class="mobile-submenu-scroll"[\s\S]*?id="MainSubMenuScrollInner"[\s\S]*?id=MainSubMenu[\s\S]*?mobileSubMenuScroll\('MainSubMenu',1\)/,'The fixed scroll box wraps the native submenu and both native arrow actions');
  assert.match(css,/body\.ns-theme\.ns-shell-ready :is\(#p5toolbar,#p9toolbar,#p13toolbar\)[\s\S]*?:is\(button,input\[type="button"\],input\[type="submit"\]\):is\(:disabled,\[disabled\],\[aria-disabled="true"\],\.disabled\)[\s\S]*?background:#263139!important/,'The rendered disabled semantics mute available native file actions');
});

test('Software toolbar reflows its nested native controls on narrow screens',()=>{
  const software=css.match(/@media\(max-width:900px\)\s*\{\s*body\.ns-shell-ready #p18,[\s\S]*?body\.ns-shell-ready #p18toolbar #p18Status\s*\{([^}]+)\}/);
  assert.ok(software,'A narrow-screen Software layout rule is present');
  assert.match(software[0],/body\.ns-shell-ready #p18toolbar > div\s*\{[\s\S]*?flex-wrap:wrap!important/,'The native inner toolbar row may wrap its controls');
  assert.match(software[0],/body\.ns-shell-ready #p18toolbar #p18SearchInput\s*\{[\s\S]*?min-width:0;[\s\S]*?max-width:100%/,'The fixed-width search field can shrink within the viewport');
  assert.match(software[1],/flex:1 1 100%;[\s\S]*?min-width:0;[\s\S]*?overflow-wrap:anywhere/,'Live status text has a constrained row and cannot widen the page');
  const template=read('views/default3.handlebars');
  assert.match(template,/id="p18toolbar"[\s\S]*?id="p18RefreshBtn"[\s\S]*?id="p18SearchInput"[\s\S]*?id="p18ShowStore"[\s\S]*?id="p18Status"/,'The responsive rule targets the native Software toolbar hierarchy');
});

test('Software loading timeout releases the native retry guard and yields to native results',()=>{
  const nativeTemplate = read('views/default3.handlebars');
  assert.match(nativeTemplate,/var installedAppsLoading = false;/,'the native in-flight flag remains the retry gate');
  assert.match(nativeTemplate,/id="p18RefreshBtn"[^>]*onclick="loadInstalledApps\(\)"/,'the existing Refresh button keeps its native handler');
  assert.match(nativeTemplate,/meshserver\.send\(\{ action: 'software', nodeid: currentNode\._id, type: 'installedapps'\}\)/,'retry continues through MeshCentral software transport');
  const timers = new Map(); let nextTimer = 0; const observers = [];
  function element(text = '') {
    return { textContent:text, innerHTML:text, children:[], addEventListener(){}, setAttribute(){},
      append(child){this.children.push(child);}, replaceChildren(...children){this.children=children;},
      get firstChild(){return this.children[0] || null;}, removeChild(){this.children.shift();} };
  }
  const status = element('Loading desktop apps…'); const content = element('Loading installed software…'); const refresh = element();
  let retryCalls = 0;
  refresh.click = () => { retryCalls++; windowState.installedAppsLoading = true; status.textContent = 'Loading desktop apps…'; observerCheck(); };
  const elements = {p18Status:status,p18html:content,p18RefreshBtn:refresh};
  const document = {readyState:'complete',getElementById:id=>elements[id] || null};
  const windowState = {installedAppsLoading:true,installedAppsLoadingType:1,loadInstalledApps:()=>refresh.click(),
    setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}};
  const context = {window:windowState,document,MutationObserver:class {constructor(fn){this.fn=fn;observers.push(this);} observe(){}},
    setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);}};
  let observerCheck = () => observers.forEach(observer=>observer.fn());
  vm.runInNewContext(softwareTimeout,context);
  assert.ok(observers.length,'the native Software status is observed');
  const runOnlyTimer = () => {const [id,timer]=timers.entries().next().value;timers.delete(id);timer.fn();return timer.delay;};

  assert.equal(runOnlyTimer(),30000,'a conservative timeout allows slow software enumeration');
  assert.match(content.textContent,/device agent did not return usable software data/i,'timeout explains the native agent did not return usable data');
  assert.match(content.textContent,/Refresh/i,'timeout gives a clear retry instruction');
  assert.equal(windowState.installedAppsLoading,false,'timeout clears only the native in-flight guard');
  assert.equal(windowState.installedAppsLoadingType,1,'the native request type remains available for a late response');
  refresh.click();
  assert.equal(retryCalls,1,'the existing native Refresh button starts a new request');
  assert.equal(windowState.installedAppsLoading,true,'native retry owns the loading state again');

  for (const result of ['Installed software', 'No installed software found.', 'ERROR: Access denied']) {
    status.textContent='Loading desktop apps…'; content.textContent='Loading installed software…';
    windowState.installedAppsLoading=true; windowState.installedAppsLoadingType=1; observerCheck();
    const active=[...timers.entries()].find(([,timer])=>timer.delay===30000);
    status.textContent=result; content.textContent=result; observerCheck();
    assert.equal(timers.has(active[0]),false,'native success, empty, or error status cancels the timeout without replacing the response');
    assert.equal(content.textContent,result,'completed native response remains authoritative');
    timers.delete(active[0]);
  }

  status.textContent='Loading desktop apps…'; content.textContent='Loading installed software…';
  windowState.installedAppsLoading=true;windowState.installedAppsLoadingType=1;observerCheck();
  const late=[...timers.entries()].find(([,timer])=>timer.delay===30000);
  late[1].fn();
  content.textContent='Native app table (late response)';status.textContent='';observerCheck();
  assert.equal(content.textContent,'Native app table (late response)','a late native response replaces the timeout message');
  windowState.installedAppsLoading=false;
  assert.equal(windowState.installedAppsLoading,false,'late native handler remains able to complete its state');
});
