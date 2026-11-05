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
