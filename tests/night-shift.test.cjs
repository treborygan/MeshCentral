/* Node-only Night Shift contract tests. No production services or secrets needed. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const css = read('public/styles/custom.css');
const js = read('public/scripts/custom.js');
const installer = read('scripts/Install-NightShift.ps1');

function createMobileHarness(isMobile = true) {
  const byId = new Map();
  const documentEvents = {};
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
    readyState: 'complete', visibilityState: 'visible',
    documentElement: new Element('html'), body: new Element('body'),
    createElement: tag => new Element(tag),
    getElementById: id => byId.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener(name, fn) { documentEvents[name] = fn; }
  };
  const addExisting = (id, visible = true) => {
    const el = new Element('button'); el.id = id; el.isVisible = visible; document.body.append(el); return el;
  };
  addExisting('container'); addExisting('LeftMenuMyDevices', false); addExisting('p11');
  const agentConnect = addExisting('connectbutton1');
  const rdpConnect = addExisting('connectbutton1r');
  const disconnect = addExisting('disconnectbutton1', false);
  addExisting('DeskScreens');
  const calls = [];
  const window = {
    trackpadMode: false,
    go: page => calls.push(['go', page]),
    deskToggleTrackpad: () => calls.push(['trackpad']),
    toggleMobileKeyboard: () => calls.push(['keyboard']),
    deskMobileToggleZoom: () => calls.push(['zoom']),
    deskToggleRightClickMode: () => calls.push(['right-click']),
    deskToggleFull: event => calls.push(['fullscreen', event]),
    deskToggleMobileActions: () => calls.push(['more-actions']),
    showDesktopSettings: () => calls.push(['settings'])
  };
  const context = {
    window, document, console,
    matchMedia: () => ({ matches: isMobile }),
    getComputedStyle: () => ({ visibility: 'visible' }),
    requestAnimationFrame: callback => callback(),
    addEventListener() {}, setInterval() { return 1; }, clearTimeout() {}, setTimeout() { return 1; },
    MutationObserver: class { observe() {} },
    MouseEvent: class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } }
  };
  vm.runInNewContext(js, context, { timeout: 1000 });
  return { document, byId, calls, agentConnect, rdpConnect, disconnect, activeElement: () => activeElement };
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

  h.byId.get('ns-rdp-connect').click();
  h.byId.get('ns-trackpad').click();
  h.byId.get('ns-keyboard').click();
  h.byId.get('ns-zoom').click();
  h.byId.get('ns-rightclick').click();
  h.byId.get('DeskScreens').click();
  const fullscreen = dock.children.flatMap(row => row.children).find(button => button.textContent === 'Fullscreen');
  fullscreen.click();

  assert.equal(h.rdpConnect.clickCount, 1, 'RDP is delegated to MeshCentral\'s existing connect handler');
  assert.deepEqual(h.calls.map(call => call[0]), ['trackpad', 'keyboard', 'zoom', 'right-click', 'fullscreen']);
  assert.equal(h.calls.find(call => call[0] === 'fullscreen')[1].shiftKey, false, 'fullscreen receives the native event shape');
  assert.equal(h.byId.get('DeskScreens').clickCount, 1, 'monitor picker remains the native MeshCentral control');

  const mobileNav = h.byId.get('ns-mobile-nav');
  assert.ok(mobileNav, 'mobile workspace navigation is installed');
  mobileNav.children[0].click();
  assert.deepEqual(h.calls.at(-1), ['go', 1], 'hidden desktop navigation falls back to MeshCentral go()');
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
    focus(){}
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
  const toolbar=add('devListToolbarSpan',page);
  const nativeGroupAction=add('GroupActionButton',toolbar);nativeGroupAction.disabled=true;
  const list=add('xdevices',page);
  list.deviceCheckboxes=[new MockElement('input'),new MockElement('input')];
  add('MainDevDesktop');add('MainDevTerminal');add('MainDevFiles');
  const opened=[];
  const favoriteWrites=[];
  const updatedNativeDevices=[];
  const recentStorage=new Map();
  const window={
    addEventListener(){},
    stars:{},
    putstore:(key,value)=>favoriteWrites.push({key,value}),
    updateDeviceViewDevice:id=>updatedNativeDevices.push(id),
    userinfo:{_id:'user/domain/qa'},
    localStorage:{
      getItem:key=>recentStorage.get(key)??null,
      setItem:(key,value)=>recentStorage.set(key,value)
    },
    nodes:[
      {_id:'node//online',name:'Workstation',meshid:'mesh//one',conn:1,osdesc:'Windows',tags:['Production','Critical'],v:true},
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
    gotoDevice:(id)=>opened.push(id)
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
  assert.equal(inventory.children[2].children[0].textContent,'No recent devices yet. Open a device to add it here.','A second account cannot see the first account\'s recents');
  assert.equal(recentStorage.has('nightShiftRecentDevices:user/domain/other'),false,'Reading another account does not copy history');
  window.userinfo={_id:'user/domain/qa'};
  const returnToAll=inventory.children[1].children[1].children.find(node=>node.dataset.filter==='all');
  returnToAll.click();
  const toggle=inventory.children[0].children[1];
  toggle.click();
  assert.equal(inventory.hidden,false,'The original-list toggle stays visible when cards are off');
  assert.equal(body.classList.contains('ns-cards-enabled'),false);
  toggle.click();
  assert.equal(body.classList.contains('ns-cards-enabled'),true,'Cards can be re-enabled');
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
