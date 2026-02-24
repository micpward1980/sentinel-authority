#!/usr/bin/env python3
"""Fix easter egg - single click to stop"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

old_script = '''
    <!-- Easter Egg: Triple-click hero icon for SOS -->
    <div id="sos-player" style="position: fixed; top: -9999px; left: -9999px; width: 1px; height: 1px; overflow: hidden;"></div>
    <script>
      (function() {
        let clickCount = 0;
        let clickTimer = null;
        let player = null;
        let isPlaying = false;
        const icon = document.getElementById('hero-icon');
        
        if (icon) {
          icon.addEventListener('click', function() {
            clickCount++;
            icon.style.transform = 'scale(0.95)';
            setTimeout(() => icon.style.transform = 'scale(1)', 100);
            
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => clickCount = 0, 800);
            
            if (clickCount >= 3) {
              clickCount = 0;
              
              if (!isPlaying) {
                // Create YouTube iframe
                const container = document.getElementById('sos-player');
                container.innerHTML = '<iframe width="1" height="1" src="https://www.youtube.com/embed/cvChjHcABPA?autoplay=1&start=0" frameborder="0" allow="autoplay"></iframe>';
                isPlaying = true;
                icon.style.boxShadow = '0 0 60px rgba(157,140,207,0.9), 0 0 100px rgba(92,214,133,0.5)';
                icon.style.animation = 'pulse 1s ease-in-out infinite';
              } else {
                // Stop
                const container = document.getElementById('sos-player');
                container.innerHTML = '';
                isPlaying = false;
                icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';
                icon.style.animation = 'none';
              }
            }
          });
        }
      })();
    </script>'''

new_script = '''
    <!-- Easter Egg: Triple-click hero icon for SOS, single click to stop -->
    <div id="sos-player" style="position: fixed; top: -9999px; left: -9999px; width: 1px; height: 1px; overflow: hidden;"></div>
    <script>
      (function() {
        let clickCount = 0;
        let clickTimer = null;
        let isPlaying = false;
        const icon = document.getElementById('hero-icon');
        
        if (icon) {
          icon.addEventListener('click', function() {
            icon.style.transform = 'scale(0.95)';
            setTimeout(() => icon.style.transform = 'scale(1)', 100);
            
            // If playing, single click stops
            if (isPlaying) {
              const container = document.getElementById('sos-player');
              container.innerHTML = '';
              isPlaying = false;
              icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';
              icon.style.animation = 'none';
              clickCount = 0;
              return;
            }
            
            // Count clicks for triple-click to start
            clickCount++;
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => clickCount = 0, 800);
            
            if (clickCount >= 3) {
              clickCount = 0;
              const container = document.getElementById('sos-player');
              container.innerHTML = '<iframe width="1" height="1" src="https://www.youtube.com/embed/cvChjHcABPA?autoplay=1&start=0" frameborder="0" allow="autoplay"></iframe>';
              isPlaying = true;
              icon.style.boxShadow = '0 0 60px rgba(157,140,207,0.9), 0 0 100px rgba(92,214,133,0.5)';
              icon.style.animation = 'pulse 1s ease-in-out infinite';
            }
          });
        }
      })();
    </script>'''

content = content.replace(old_script, new_script)

with open(filepath, 'w') as f:
    f.write(content)

print("Fixed - single click to stop")
