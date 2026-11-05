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
