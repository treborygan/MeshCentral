/* Use the browser's install prompt when the native MeshCentral manifest qualifies. */
(function () {
  'use strict';
  if (window.__NightShiftPwa) return;
  var promptEvent = null, installButton = null;
  function create(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function mount() {
    var host = document.getElementById('ns-appbar-actions');
    if (!host) return;
    if (!installButton) {
      installButton = create('button','ns-install-app','Install app');
      installButton.type = 'button';
      installButton.setAttribute('aria-label','Install MeshCentral on this device');
      installButton.addEventListener('click',function () {
        if (!promptEvent) return;
        var deferred = promptEvent; promptEvent = null; installButton.hidden = true;
        deferred.prompt();
        Promise.resolve(deferred.userChoice).then(function () { mount(); }).catch(function () { mount(); });
      });
      host.append(installButton);
    }
    installButton.hidden = !promptEvent;
  }
  if (window.addEventListener) {
    window.addEventListener('beforeinstallprompt',function (event) {
      event.preventDefault(); promptEvent = event; mount();
    });
    window.addEventListener('appinstalled',function () { promptEvent = null; if (installButton) installButton.hidden = true; });
  }
  window.__NightShiftPwa = {refresh:mount};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
