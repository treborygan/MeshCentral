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
