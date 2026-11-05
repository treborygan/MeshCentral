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
