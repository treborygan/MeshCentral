(function () {
  'use strict';
  if (window.__NightShiftClassicMode || window.__NightShiftSoftwareTimeout) return;

  var timeoutMs = 30000;
  var timeoutHandle = null;
  var status, content;

  function isLoading() {
    return !!(status && /loading\s+(?:desktop|store)\s+apps/i.test(status.textContent || ''));
  }

  function clearPending() {
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function inspect() {
    if (!isLoading()) {
      clearPending();
      return;
    }
    if (timeoutHandle !== null) return;
    timeoutHandle = window.setTimeout(function () {
      timeoutHandle = null;
      if (!isLoading()) return;

      // This is the native page's global in-flight guard. Releasing only that
      // guard leaves the original Refresh handler and native response routing
      // in control, and preserves the request type for a response that arrives
      // after this advisory timeout.
      if (window.installedAppsLoading === true) window.installedAppsLoading = false;
      status.textContent = 'No response';
      content.textContent = 'The device agent did not return usable software data. Use Refresh to try again.';
    }, timeoutMs);
  }

  function install() {
    if (window.__NightShiftClassicMode || typeof MutationObserver !== 'function') return;
    status = document.getElementById('p18Status');
    content = document.getElementById('p18html');
    if (!status || !content) return;
    window.__NightShiftSoftwareTimeout = true;
    var observer = new MutationObserver(inspect);
    observer.observe(status, { childList: true, characterData: true, subtree: true });
    observer.observe(content, { childList: true, characterData: true, subtree: true });
    inspect();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
