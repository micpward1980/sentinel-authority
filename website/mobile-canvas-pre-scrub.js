/*
 * ═══════════════════════════════════════════════════
 * Sentinel Authority — Canvas Orientation & Resize
 * ═══════════════════════════════════════════════════
 * Handles all 5 animated canvases during:
 *   - Device rotation (portrait ↔ landscape)
 *   - Window resize (desktop browser)
 *   - iOS visual viewport changes
 *
 * Each canvas exposes _saResize() on its element.
 * This script calls those on orientation/resize events.
 */
(function() {
  'use strict';

  var IDS = [
    'hero-canvas',
    'envelo-canvas',
    'security-canvas',
    'cat72-canvas',
    'process-canvas'
  ];

  var timer = null;
  var prevW = window.innerWidth;
  var prevH = window.innerHeight;

  function resizeAll() {
    IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (el && typeof el._saResize === 'function') {
        try { el._saResize(); } catch(e) { /* silent */ }
      }
    });
  }

  function scheduleResize(delay) {
    clearTimeout(timer);
    timer = setTimeout(resizeAll, delay);
  }

  // ── Orientation Change ──
  // iOS is unreliable — fire multiple times
  window.addEventListener('orientationchange', function() {
    scheduleResize(80);
    setTimeout(resizeAll, 300);
    setTimeout(resizeAll, 600);
    setTimeout(resizeAll, 1200);
  });

  // ── Window Resize ──
  // Filter out iOS URL bar changes (small height delta, same width)
  window.addEventListener('resize', function() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var dw = Math.abs(w - prevW);
    var dh = Math.abs(h - prevH);

    // Width changed: real resize or rotation
    if (dw > 15) {
      prevW = w;
      prevH = h;
      scheduleResize(100);
      return;
    }

    // Height changed significantly without width change: might be URL bar
    // Only resize if height change is dramatic (>150px = probably rotation or keyboard)
    if (dh > 150) {
      prevW = w;
      prevH = h;
      scheduleResize(200);
    }
  });

  // ── Visual Viewport (iOS Safari) ──
  if (window.visualViewport) {
    var vpW = window.visualViewport.width;
    window.visualViewport.addEventListener('resize', function() {
      var w = window.visualViewport.width;
      if (Math.abs(w - vpW) > 15) {
        vpW = w;
        scheduleResize(150);
      }
    });
  }

  // ── Page Visibility ──
  // Recalc when tab becomes visible (dimensions may have changed)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      var w = window.innerWidth;
      if (Math.abs(w - prevW) > 15) {
        prevW = w;
        scheduleResize(200);
      }
    }
  });
})();
