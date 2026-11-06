/* Guarded adapters for MeshCentral templates older than the Night Shift
 * source branch. They preserve the native transport and handlers. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function install() {
    var enhancedModifiers = typeof window.mobileModifiersSupported === 'function';
    if (!enhancedModifiers) installModifierGuard();
    if (typeof window.onSoftKeyboardCompositionEnd !== 'function') installImeGuard();
    if (document.getElementById && document.getElementById('container') && document.querySelector && document.querySelector('link[href*="style-bootstrap"]')) {
      installTouchCompatibility();
      installCursorShapeCompatibility();
    }
    // The upstream template changes these compatibility features together.
    // Its enhanced modifier marker therefore tells us its clipboard handlers
    // already provide feedback and prevents duplicate notifications.
    if (!enhancedModifiers) installClipboardFeedback();
    if (document.getElementById && document.getElementById('container') && window.__nightShiftUI && typeof window.__nightShiftUI.refresh === 'function') window.__nightShiftUI.refresh();
  }

  function installTouchCompatibility() {
    var needsDragRelease = typeof window.dtouchReleaseDrag !== 'function';
    var needsTouchCancel = typeof window.dtouchcancel !== 'function';
    var startHasRelease = typeof window.dtouchstart === 'function' && window.dtouchstart.toString().indexOf('dtouchReleaseDrag') >= 0;
    var endHasRelease = typeof window.dtouchend === 'function' && window.dtouchend.toString().indexOf('dtouchReleaseDrag') >= 0;
    var needsDoubleClick = typeof window.dtouchend === 'function' && window.dtouchend.toString().indexOf('mousedblclick') < 0;
    if (!needsDragRelease && !needsTouchCancel && startHasRelease && endHasRelease && !needsDoubleClick) return;

    if (needsDragRelease) {
      window.dtouchReleaseDrag = function () {
        var dm = (!window.xxdialogMode && window.desktop != null && typeof window.dtouchGetModule === 'function') ? window.dtouchGetModule() : null;
        if (window.dtouchDragActive) {
          window.dtouchDragActive = false;
          window.dtouchLongPressed = false;
          if (dm && typeof window.dtouchMakeEvent === 'function') dm.mouseup(window.dtouchMakeEvent(window.dtouchLastX, window.dtouchLastY, 0));
        }
        if (window.trackpadDragActive) {
          window.trackpadDragActive = false;
          window.trackpadLongPressed = false;
          if (dm && typeof window.trackpadMakeEvent === 'function') dm.mouseup(window.trackpadMakeEvent(0));
        }
        if (typeof window.trackpadStopEdgeScroll === 'function') window.trackpadStopEdgeScroll();
      };
    }

    if (needsTouchCancel) {
      window.dtouchcancel = function () {
        if (window.dtouchLongPressTimer) { window.clearTimeout(window.dtouchLongPressTimer); window.dtouchLongPressTimer = null; }
        if (window.trackpadTapTimer) { window.clearTimeout(window.trackpadTapTimer); window.trackpadTapTimer = null; }
        window.dtouchReleaseDrag();
        window.dtouchLongPressed = false;
        window.trackpadLongPressed = false;
        window.dtouchMoved = true;
        window.trackpadTapMoved = true;
        window.trackpadLastX = null;
        window.trackpadLastY = null;
        window.trackpadDown = false;
      };
      installTouchCancelListener();
    }

    if (!startHasRelease && typeof window.dtouchstart === 'function') {
      var nativeTouchStart = window.dtouchstart;
      window.dtouchstart = function () {
        window.dtouchReleaseDrag();
        return nativeTouchStart.apply(this, arguments);
      };
    }
    if (!endHasRelease && typeof window.dtouchend === 'function') {
      var nativeTouchEnd = window.dtouchend;
      window.dtouchend = function (event) {
        var control = typeof window.Q === 'function' ? window.Q('DeskControl') : null;
        if ((window.dtouchDragActive || window.trackpadDragActive) && (!control || control.checked !== true)) {
          window.dtouchcancel(event);
          return;
        }
        return nativeTouchEnd.apply(this, arguments);
      };
    }
    if (needsDoubleClick && typeof window.dtouchSendClick === 'function') {
      var nativeTouchClick = window.dtouchSendClick;
      window.dtouchSendClick = function (clientX, clientY, button) {
        var lastTime = window.dtouchLastTapTime;
        var startX = window.dtouchStartX, startY = window.dtouchStartY;
        if (button === 0 && lastTime > 0 && Date.now() - lastTime < 400 &&
            Math.abs(startX - window.dtouchLastTapX) < 30 && Math.abs(startY - window.dtouchLastTapY) < 30 &&
            typeof window.dtouchGetModule === 'function' && typeof window.dtouchMakeEvent === 'function') {
          var dm = window.dtouchGetModule();
          var event = window.dtouchMakeEvent(window.dtouchLastTapX, window.dtouchLastTapY, 0);
          window.dtouchLastTapTime = 0;
          if (dm) { dm.mousedown(event); dm.mousedblclick(event); dm.mouseup(event); }
          return;
        }
        return nativeTouchClick.apply(this, arguments);
      };
    }
  }

  function installTouchCancelListener() {
    var parent = document.getElementById && document.getElementById('DeskParent');
    if (!parent) return;
    function attach() {
      var canvas = document.getElementById('Desk');
      if (!canvas || canvas.__nightShiftTouchCancel || typeof canvas.addEventListener !== 'function') return;
      canvas.__nightShiftTouchCancel = true;
      canvas.addEventListener('touchcancel', function (event) { window.dtouchcancel(event); }, { passive: false });
    }
    attach();
    if (typeof window.MutationObserver === 'function') {
      var observer = new window.MutationObserver(attach);
      observer.observe(parent, { childList: true });
    }
  }

  function installCursorShapeCompatibility() {
    var nativeMove = window.dmousemove;
    if (typeof nativeMove !== 'function' || nativeMove.toString().indexOf("Q('Desk').style.cursor = ''") < 0) return;
    // Retain MeshCentral's existing mouse/WebRTC transports but avoid erasing
    // the cursor shape most recently sent by the remote desktop agent.
    window.dmousemove = function (event) {
      if (typeof window.setSessionActivity === 'function') window.setSessionActivity();
      var parent = typeof window.Q === 'function' ? window.Q('DeskParent') : null;
      var desk = typeof window.Q === 'function' ? window.Q('Desk') : null;
      var control = typeof window.Q === 'function' ? window.Q('DeskControl') : null;
      if (parent) { event.addx = parent.scrollLeft; event.addy = parent.scrollTop; }
      var desktop = window.desktop;
      if (!window.xxdialogMode && desktop != null && control && control.checked) {
        if (desk && desk.style.cursor === 'not-allowed') desk.style.cursor = '';
        var rtc = window.webRtcDesktop;
        if (rtc != null && rtc.softdesktop != null) {
          rtc.softdesktop.m.mousemove(event);
          desktop.m.sendKeepAlive();
        } else {
          desktop.m.mousemove(event);
        }
      } else if (!window.xxdialogMode && desktop != null && control && !control.checked && desk) {
        desk.style.cursor = 'not-allowed';
      }
    };
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
