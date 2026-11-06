/* Accessible keyboard behavior for native MeshCentral server trace rows. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftServerAdmin) return;
  var root;
  var memoryObserver;
  var userSettingsObserver;
  function normalizeMemoryUnit(text) {
    return String(text || '').replace(/\bGb\b(?=<\/b>)/g, 'GiB');
  }
  function normalizeMemoryDisplay() {
    var memory = document.getElementById('serverMemoryChartText');
    if (!memory || typeof memory.innerHTML !== 'string') return;
    var normalized = normalizeMemoryUnit(memory.innerHTML);
    if (normalized !== memory.innerHTML) memory.innerHTML = normalized;
  }
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
  function enhanceUserSettings() {
    var settings = document.getElementById('usersListToolbarSettings');
    if (!settings || settings.getAttribute('data-ns-settings-ready') === '1') return;
    settings.setAttribute('data-ns-settings-ready','1');
    settings.setAttribute('role','button');
    settings.setAttribute('aria-label','User list settings');
    settings.setAttribute('focusable','true');
    settings.tabIndex = 0;
    settings.addEventListener('keydown',function (event) {
      if (event.target !== settings || (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar')) return;
      event.preventDefault();
      settings.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,button:0,buttons:0}));
    });
  }
  function boot() {
    enhance();
    enhanceUserSettings();
    normalizeMemoryDisplay();
    var memory = document.getElementById('serverMemoryChartText');
    if (memory && typeof MutationObserver === 'function' && !memoryObserver) {
      memoryObserver = new MutationObserver(normalizeMemoryDisplay);
      memoryObserver.observe(memory,{childList:true,subtree:true,characterData:true});
    }
    root = document.getElementById('p41events');
    if (root && typeof MutationObserver === 'function') {
      new MutationObserver(enhance).observe(root,{childList:true,subtree:true});
    }
    if (document.body && typeof MutationObserver === 'function' && !userSettingsObserver) {
      userSettingsObserver = new MutationObserver(enhanceUserSettings);
      userSettingsObserver.observe(document.body,{childList:true,subtree:true});
    }
  }
  window.__NightShiftServerAdmin = { refresh:function () { enhance(); enhanceUserSettings(); }, normalizeMemoryUnit:normalizeMemoryUnit };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
