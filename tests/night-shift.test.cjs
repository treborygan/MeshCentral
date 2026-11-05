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
const devicesSource = read('public/scripts/night-shift/devices.js');
const mobileControls = read('public/scripts/night-shift/mobile-controls.js');
const shell = read('public/scripts/night-shift/shell.js');

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

test('elapsed uptime formatting is deterministic and rejects future boot dates',()=>{
  const window={};
  const document={readyState:'loading',addEventListener(){}};
  vm.runInNewContext(health,{window,document,Date,isFinite},{timeout:1000});
  const now=Date.UTC(2026,10,5,12,0,0);
  const boot=new Date(now-(2*24*60+3*60+4)*60000);
  assert.match(window.__NightShiftHealth.formatUptime(boot,now),/^2 days 3h · booted /);
  assert.equal(window.__NightShiftHealth.formatUptime(new Date(now+60000),now),null);
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
  assert.doesNotMatch(capabilities,/dispatchEvent|\.click\(|gotoDevice|meshserver\.send/);
});

test('capability summary updates from the native tab visibility state',()=>{
  class FakeElement {
    constructor(){this.children=[];this.style={display:'block'};this.attributes={};this.dataset={};this.hidden=false;this.disabled=false;this.className='';}
    append(...children){children.forEach(child=>this.children.push(child));}
    insertBefore(child){this.children.unshift(child);}
    setAttribute(k,v){this.attributes[k]=v;}
    getAttribute(k){return this.attributes[k] ?? null;}
    getClientRects(){return this.style.display==='none'||this.hidden?[]:[{}];}
  }
  const ids=new Map(), p10=new FakeElement(), host=new FakeElement();ids.set('p10',p10);ids.set('p10info',host);
  for(const id of ['MainDevDesktop','MainDevTerminal','MainDevFiles','MainDevAmt']){const el=new FakeElement();ids.set(id,el);}
  ids.get('MainDevTerminal').style.display='none';ids.get('MainDevAmt').style.display='none';
  const document={readyState:'complete',getElementById:id=>ids.get(id)||null,createElement:()=>new FakeElement(),addEventListener(){}};
  const window={};
  vm.runInNewContext(capabilities,{window,document,console,getComputedStyle:el=>el.style},{timeout:1000});
  const panel=host.children[0], rows=panel.children[1].children;
  assert.equal(rows[0].children[1].textContent,'Available');
  assert.equal(rows[1].children[1].textContent,'Unavailable');
  ids.get('MainDevFiles').style.display='none';window.__NightShiftCapabilities.refresh();
  assert.equal(rows[2].children[1].textContent,'Unavailable');
});

test('remote viewer information drawer preserves native details navigation',()=>{
  assert.match(viewer,/aria-expanded/);
  assert.match(viewer,/ns-viewer-info-drawer/);
  assert.match(viewer,/MainDevInfo/);
  assert.match(viewer,/Escape/);
  assert.match(viewer,/window\.desktop/);
  assert.doesNotMatch(viewer,/new\s+WebSocket|meshserver\.send|gotoDevice/);
});

test('floating desktop viewer controls use only visible native controls and auto-hide',()=>{
  assert.match(viewer,/ns-viewer-controls/);
  assert.match(viewer,/pointermove/);
  assert.match(viewer,/setTimeout\(hideControls,2800\)/);
  assert.match(viewer,/nativeAction\(item\[2\]\)/);
  assert.match(viewer,/native\.click\(\)/);
  assert.match(viewer,/window\.deskToggleFull\(\{shiftKey:false\}\)/);
  assert.match(viewer,/controls\.hidden = !visible\(\$\('p11'\)\)/);
  assert.match(viewer,/connectbutton1r/);
  assert.match(viewer,/disconnectbutton1/);
  assert.match(css,/\.ns-viewer-controls\.is-idle/);
  assert.match(css,/@media\(max-width:700px\)\{\.ns-viewer-controls\{display:none!important\}/);
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
    focus(){this.focused=true;}
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
  actions.find(button=>button.textContent==='Connect').click();
  assert.equal(connect.clickCount,1,'Connect delegates to the visible native Agent control');
  actions.find(button=>button.textContent==='Full screen').click();
  assert.equal(window.deskToggleFullCalls,1,'Fullscreen delegates to MeshCentral even when its title-bar icon is hidden');
  p11.hidden=true;window.__NightShiftViewer.refresh();
  assert.equal(controls.hidden,true,'Toolbar hides when the native viewer is inactive');
});

function createMobileHarness(isMobile = true, classicMode = false) {
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
    querySelector: () => null,
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
    navigator:{clipboard:{readText(){},writeText(){}}}
  };
  const context = {
    window, document, console,
    matchMedia: () => ({ matches: isMobile }),
    getComputedStyle: () => ({ visibility: 'visible' }),
    requestAnimationFrame: callback => callback(),
    addEventListener:addWindowEvent, setInterval() { return 1; }, clearTimeout() {}, setTimeout() { return 1; },
    MutationObserver: class { observe() {} },
    MouseEvent: class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } }
  };
  vm.runInNewContext(js, context, { timeout: 1000 });
  return { document, documentEvents, windowEvents, byId, calls, window, storage, styleSheet, get reloadCount(){return reloadCount;}, agentConnect, rdpConnect, disconnect, activeElement: () => activeElement };
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

test('desktop viewport keeps the mobile navigation and remote dock out of view', () => {
  const h = createMobileHarness(false);
  assert.equal(h.byId.get('ns-mobile-nav').hidden, true, 'workspace navigation is hidden on desktop');
  assert.equal(h.byId.get('ns-mobile-dock').hidden, true, 'remote dock is hidden on desktop');
  assert.equal(h.byId.get('connectbutton1').hidden, false, 'native desktop controls remain available');
  assert.equal(h.byId.get('connectbutton1r').hidden, false, 'native desktop RDP control remains available');
});

test('modern, responsive and fallback selectors remain present', () => {
  for (const token of [
    '--ns-accent','#page_leftbar','#deskarea0','#DeskParent',
    '.ns-mobile-nav','.ns-mobile-dock','@media',
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
    append(...children){children.forEach(child=>{child.parentNode=this;this.children.push(child);});}
    replaceChildren(...children){this.children=[];this.append(...children);}
    prepend(child){child.parentNode=this;this.children.unshift(child);}
    insertBefore(child,anchor){child.parentNode=this;const index=this.children.indexOf(anchor);this.children.splice(index<0?this.children.length:index,0,child);}
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
      return [];
    }
    focus(){this.focused=true;}
  }
  const body=new MockElement('body');
  const document={
    body,documentElement:new MockElement('html'),readyState:'complete',visibilityState:'visible',
    createElement:tag=>new MockElement(tag),
    getElementById:id=>ids.get(id)||null,
    querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}
  };
  const add=(id,parent=body)=>{
    const node=new MockElement('div');node.id=id;parent.append(node);return node;
  };
  add('container');const column=add('column_l');add('masthead');
  const devices=add('LeftMenuMyDevices');let devicesMouseup=0;devices.addEventListener('mouseup',()=>devicesMouseup++);
  const events=add('LeftMenuMyEvents');let eventsMouseup=0;events.addEventListener('mouseup',()=>eventsMouseup++);const page=add('p1',column);
  add('p10',column);
  const remotePage=add('p11',column);remotePage.hidden=true;
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
  add('MainDevDesktop');add('MainDevTerminal');add('MainDevFiles');
  const opened=[];
  const disconnectedSessions=[];
  const compressionUpdates=[];
  const monitorSelections=[];
  let fullscreenToggles=0;
  const favoriteWrites=[];
  const updatedNativeDevices=[];
  const recentStorage=new Map();
  const window={
    addEventListener(){},
    stars:{},
    putstore:(key,value)=>favoriteWrites.push({key,value}),
    updateDeviceViewDevice:id=>updatedNativeDevices.push(id),
    userinfo:{_id:'user/domain/qa'},
    desktopsettings:{agentencoding:4,framerate:50},
    navigator:{onLine:true},
    meshserver:{State:2},
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
    MutationObserver:class{observe(){}},
    MouseEvent:class{constructor(type,props){this.type=type;Object.assign(this,props);}}
  },{timeout:1000});
  assert.ok(ids.has('ns-appbar'),'Contextual appbar is generated');
  assert.ok(ids.has('ns-overview'),'Native data dashboard is generated');
  assert.ok(ids.has('ns-device-actions'),'Device quick actions are generated');
  assert.equal(window.__nightShiftShell.version,'2.0.0');
  const overview=ids.get('ns-overview');
  const count=overview.children[1].children[1].children[1];
  assert.equal(count.textContent,'2','The dashboard counts rendered native device rows');
  const bar=ids.get('ns-appbar'),more=bar.children[1].children.find(node=>node.textContent==='More');
  const menu=bar.children[2];
  assert.equal(menu.hidden,true,'Additional navigation starts closed');
  more.click();
  assert.equal(menu.hidden,false,'More opens actionable navigation');
  const deviceLink=menu.children.find(node=>node.dataset.native==='LeftMenuMyDevices');
  assert.ok(deviceLink,'The available native Devices action is linked');
  deviceLink.click();
  assert.equal(devicesMouseup,1,'The new navigation dispatches the original MeshCentral mouseup action');
  const eventsLink=menu.children.find(node=>node.dataset.native==='LeftMenuMyEvents');
  assert.ok(eventsLink,'The available native Events action is linked');
  eventsLink.click();
  assert.equal(eventsMouseup,1,'The Events route dispatches the native MeshCentral mouseup handler');
  const inventory=ids.get('ns-live-inventory');
  assert.ok(inventory,'The native device collection is enhanced');
  const controls=inventory.children[1];
  const layoutSelect=controls.children.find(node=>node.dataset.control==='layout');
  const sortSelect=controls.children.find(node=>node.dataset.control==='sort');
  const tagSelect=controls.children.find(node=>node.dataset.control==='tag');
  assert.ok(layoutSelect,'Inventory offers cards, table and compact layouts');
  assert.ok(sortSelect,'Inventory offers explicit sorting');
  assert.ok(tagSelect,'Inventory offers native device-tag filtering');
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
  page.hidden=true;remotePage.hidden=false;
  window.currentNode=window.nodes[0];
  window.multiDesktop={'node//offline':{State:1,contype:1},'node//online':{State:3,contype:1}};
  window.__NightShiftDiagnostics.refresh();
  window.__NightShiftSessions.refresh();
  const sessionTabs=ids.get('ns-session-tabs');
  assert.ok(sessionTabs,'Remote workspace exposes tabs for native live sessions');
  assert.equal(sessionTabs.children.filter(node=>node.classList.contains('ns-session-tab')).length,2,'Tabs enumerate existing and connecting native sessions');
  assert.equal(sessionTabs.getAttribute('role'),null,'Session navigation does not claim tablist semantics without tab keyboard behavior');
  const archiveTab=sessionTabs.children.find(node=>node.dataset.sessionId==='node//offline');
  assert.ok(archiveTab,'Session tabs identify sessions by native device ID');
  assert.equal(archiveTab.getAttribute('aria-current'),null,'Background sessions are not marked current');
  const currentSessionTab=sessionTabs.children.find(node=>node.classList.contains('ns-session-tab')&&node.getAttribute('aria-current')==='true');
  assert.ok(currentSessionTab,'The active native session is exposed as the current navigation item');
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
  const profileControl=key=>profilePanel.children[1].children.find(row=>row.children[1].dataset.profileField===key).children[1];
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
  profilePanel.children[2].children.find(button=>button.textContent==='Apply fullscreen').click();
  assert.equal(fullscreenToggles,1,'Fullscreen preference invokes MeshCentral native viewer control on direct user action');
  window.currentNode=window.nodes[1];window.desktop=null;window.__NightShiftProfiles.refresh();
  profilePanel.children[1].children.find(row=>row.children[1].dataset.profileField==='method').children[1].value='agent';
  profilePanel.children[1].children.find(row=>row.children[1].dataset.profileField==='fullscreen').children[1].value='true';
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
  assert.match(guidance.textContent,/native controls/i,'Idle session offers the normal native connect path');
  assert.ok(diagnostic('browser'),'Browser diagnostic row is present');
  assert.equal(diagnostic('browser').children[1].textContent,'Online','Browser connectivity uses navigator.onLine');
  assert.equal(diagnostic('control').children[1].textContent,'Connected','MeshCentral control-channel state uses the native socket');
  assert.equal(diagnostic('device').children[1].textContent,'Agent via relay','Device route reports native agent and relay flags');
  assert.equal(diagnostic('cloudflare').children[1].textContent,'Not observable after page load','The UI does not infer Cloudflare tunnel health from an authenticated page');
  const showNativeControls=diagnostics.children.find(node=>node.classList.contains('ns-diagnostics-action'));
  assert.ok(showNativeControls,'Unconnected sessions offer a shortcut to native connect controls');
  showNativeControls.click();
  assert.equal(nativeConnect.focused,true,'Connection shortcut focuses the available native Connect control');
  window.desktop={State:3,contype:4,webRtcActive:false};
  nativeStatus.textContent='Connected, RDP';
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('session').children[1].textContent,'Browser RDP · Connected','Session transport and state use native MeshCentral values');
  assert.equal(diagnostic('display').children[1].textContent,'Canvas mounted','Remote-display diagnosis checks the native canvas without intercepting input');
  assert.equal(showNativeControls.hidden,true,'Native connect shortcut is hidden while the session is active');
  window.desktop.State=4;
  window.__NightShiftDiagnostics.refresh();
  assert.equal(diagnostic('session').children[1].textContent,'Browser RDP · Connected','MeshCentral terminal connected state is also treated as active');
  assert.equal(showNativeControls.hidden,true,'Native connect shortcut stays hidden in state four');
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
