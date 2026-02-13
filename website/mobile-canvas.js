/*
 * Sentinel Authority — Canvas Resize & Orientation Handler
 * Ensures all 5 canvases properly resize on rotation and window resize.
 */
(function() {
  'use strict';

  var CANVAS_IDS = ['hero-canvas','envelo-canvas','security-canvas','cat72-canvas','process-canvas'];
  var debounceTimer = null;
  var lastWidth = window.innerWidth;
  var lastHeight = window.innerHeight;

  function triggerAllResize() {
    CANVAS_IDS.forEach(function(id) {
      var canvas = document.getElementById(id);
      if (canvas && canvas._saResize) {
        try { canvas._saResize(); } catch(e) {}
      }
    });
  }

  function debouncedResize(delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(triggerAllResize, delay);
  }

  // Orientation change — needs multiple fires because iOS is unreliable
  window.addEventListener('orientationchange', function() {
    // Reset hero lock so it recalculates from scratch
    var heroCanvas = document.getElementById('hero-canvas');
    if (heroCanvas && heroCanvas._saResize) {
      // The _saResize function resets locks before calling resize
    }
    debouncedResize(100);
    debouncedResize(300);
    setTimeout(triggerAllResize, 600);
    setTimeout(triggerAllResize, 1000);
  });

  // Window resize — only trigger on actual dimension changes
  // Ignore iOS URL bar show/hide (small height changes, same width)
  window.addEventListener('resize', function() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var widthChanged = Math.abs(w - lastWidth) > 10;
    var heightChanged = Math.abs(h - lastHeight) > 80;
    
    if (widthChanged || heightChanged) {
      lastWidth = w;
      lastHeight = h;
      debouncedResize(150);
    }
  });

  // Visual viewport resize (handles iOS keyboard, URL bar properly)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
      var w = window.visualViewport.width;
      if (Math.abs(w - lastWidth) > 10) {
        lastWidth = w;
        debouncedResize(200);
      }
    });
  }
})();
