/* Use the browser's install prompt when the native MeshCentral manifest qualifies. */
(function () {
  'use strict';
  if (window.__NightShiftClassicMode) return;
  if (window.__NightShiftPwa) return;
  var promptEvent = null, installButton = null, help = null, helpClose = null;
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
        if (!promptEvent) {
          if (help) {
            help.hidden = !help.hidden;
            installButton.setAttribute('aria-expanded',help.hidden ? 'false' : 'true');
            if (!help.hidden && helpClose) helpClose.focus();
          }
          return;
        }
        var deferred = promptEvent; promptEvent = null; installButton.hidden = true;
        deferred.prompt();
        Promise.resolve(deferred.userChoice).then(function () { mount(); }).catch(function () { mount(); });
      });
      installButton.setAttribute('aria-controls','ns-install-help');
      host.append(installButton);
      var appbar = document.getElementById('ns-appbar');
      if (appbar) {
        help = create('section','ns-install-help'); help.id = 'ns-install-help'; help.hidden = true;
        help.setAttribute('role','dialog'); help.setAttribute('aria-label','Add MeshCentral to your Home Screen');
        help.append(create('p','','To install on iPhone or iPad, open this page’s Share menu and choose “Add to Home Screen”. The installed app will still require your normal MeshCentral and Cloudflare Access sign-in.'));
        helpClose = create('button','ns-install-help-close','Close'); helpClose.type = 'button';
        helpClose.addEventListener('click',function () { help.hidden = true; installButton.setAttribute('aria-expanded','false'); installButton.focus(); });
        help.append(helpClose); appbar.append(help);
      }
    }
    var manual = manualInstallAvailable();
    installButton.hidden = !promptEvent && !manual;
    installButton.textContent = promptEvent ? 'Install app' : 'Add to Home Screen';
    installButton.setAttribute('aria-expanded',help && !help.hidden ? 'true' : 'false');
    if (help && !manual) help.hidden = true;
  }
  function manualInstallAvailable() {
    var nav = window.navigator || {}, ua = nav.userAgent || '', platform = nav.platform || '';
    var ios = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1);
    var standalone = nav.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return ios && !standalone;
  }
  if (window.addEventListener) {
    window.addEventListener('beforeinstallprompt',function (event) {
      event.preventDefault(); promptEvent = event; mount();
    });
    window.addEventListener('appinstalled',function () { promptEvent = null; if (installButton) installButton.hidden = true; });
  }
  if (document.addEventListener) document.addEventListener('keydown',function (event) {
    if (event.key === 'Escape' && help && !help.hidden) {
      help.hidden = true; installButton.setAttribute('aria-expanded','false'); installButton.focus();
    }
  });
  window.__NightShiftPwa = {refresh:mount,manualInstallAvailable:manualInstallAvailable};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
