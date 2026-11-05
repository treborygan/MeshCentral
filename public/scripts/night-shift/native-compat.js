/* Guarded adapters for MeshCentral templates older than the Night Shift
 * source branch. They preserve the native transport and handlers. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function install() {
    var enhancedModifiers = typeof window.mobileModifiersSupported === 'function';
    if (!enhancedModifiers) installModifierGuard();
    if (typeof window.onSoftKeyboardCompositionEnd !== 'function') installImeGuard();
    // The upstream template changes these compatibility features together.
    // Its enhanced modifier marker therefore tells us its clipboard handlers
    // already provide feedback and prevents duplicate notifications.
    if (!enhancedModifiers) installClipboardFeedback();
  }

  function installModifierGuard() {
    var originalToggle = window.toggleMobileModifier;
    var originalRelease = window._releaseMobileModifiers;
    var codes = { ctrl: 17, shift: 16, alt: 18 };
    function transport() {
      var dm = window.desktop && window.desktop.m;
      var actions = dm && dm.KeyAction;
      if (!dm || typeof dm.SendKeyMsgKC !== 'function' || !actions) return null;
      var required = ['DOWN', 'UP', 'EXDOWN', 'EXUP'];
      for (var i = 0; i < required.length; i++) {
        if (typeof actions[required[i]] !== 'number') return null;
      }
      return dm;
    }
    window.mobileModifiersSupported = function () { return !!transport(); };
    if (typeof originalToggle === 'function') {
      window.toggleMobileModifier = function (mod) {
        var dm = transport();
        var held = window._mobileModifiers;
        var control = typeof window.Q === 'function' ? window.Q('DeskControl') : null;
        if (!dm || !held || !Object.prototype.hasOwnProperty.call(codes, mod) || !control || !control.checked) return false;
        originalToggle(mod);
        return true;
      };
    }
    if (typeof originalRelease === 'function') {
      window._releaseMobileModifiers = function () {
        if (transport()) return originalRelease();
        var held = window._mobileModifiers;
        if (held) Object.keys(held).forEach(function (key) { held[key] = false; });
        if (typeof window._updateMobileModifierUI === 'function') window._updateMobileModifierUI();
      };
    }
  }

  function installImeGuard() {
    if (typeof document.addEventListener !== 'function') return;
    var composing = false;
    var committedTarget = null;
    var followupSuppressed = false;
    var generation = 0;
    document.addEventListener('compositionstart', function (event) {
      if (!event.target || event.target.id !== 'softKeyboard') return;
      composing = true;
      committedTarget = null;
      followupSuppressed = false;
      generation++;
    }, true);
    document.addEventListener('input', function (event) {
      if (!event.target || event.target.id !== 'softKeyboard') return;
      if (composing || event.isComposing || followupSuppressed) {
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (composing) committedTarget = event.target;
        followupSuppressed = false;
      }
    }, true);
    document.addEventListener('compositionend', function (event) {
      if (!event.target || event.target.id !== 'softKeyboard') return;
      composing = false;
      committedTarget = event.target;
      followupSuppressed = true;
      var currentGeneration = ++generation;
      window.setTimeout(function () {
        if (currentGeneration !== generation) return;
        followupSuppressed = false;
        var target = committedTarget;
        committedTarget = null;
        if (target && typeof window.onSoftKeyboardInput === 'function') window.onSoftKeyboardInput(target);
      }, 0);
    }, true);
  }

  function installClipboardFeedback() {
    try {
      var clipboard = window.navigator && window.navigator.clipboard;
      if (!clipboard) return;
      ['readText', 'writeText'].forEach(function (name) {
        var original = clipboard[name];
        if (typeof original !== 'function') return;
        clipboard[name] = function () {
          var result = original.apply(this, arguments);
          if (result && typeof result.catch === 'function') {
            result.catch(function () {
              if (window.__nightShiftUI && typeof window.__nightShiftUI.notifyClipboardError === 'function') {
                window.__nightShiftUI.notifyClipboardError();
              }
            });
          }
          return result;
        };
      });
    } catch (error) {
      // Clipboard permissions and method descriptors vary by browser; native
      // clipboard behavior remains available when a wrapper cannot be added.
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
