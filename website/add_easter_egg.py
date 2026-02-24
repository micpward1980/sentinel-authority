#!/usr/bin/env python3
"""Add SOS ABBA easter egg - click icon 3 times to play"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Find the hero icon and add click handler
old_icon = '''<div style="width: 70px; height: 70px; margin: 0 auto 32px; background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); border: 2px solid #9d8ccf; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 40px rgba(157,140,207,0.5);">
          <div style="width: 22px; height: 22px; background: radial-gradient(circle, #fff 0%, #c4b8e8 100%); border-radius: 50%; box-shadow: 0 0 15px rgba(255,255,255,0.5);"></div>
        </div>'''

new_icon = '''<div id="hero-icon" style="width: 70px; height: 70px; margin: 0 auto 32px; background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); border: 2px solid #9d8ccf; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 40px rgba(157,140,207,0.5); cursor: pointer; transition: transform 0.2s ease;">
          <div style="width: 22px; height: 22px; background: radial-gradient(circle, #fff 0%, #c4b8e8 100%); border-radius: 50%; box-shadow: 0 0 15px rgba(255,255,255,0.5);"></div>
        </div>
        <audio id="sos-audio" preload="none">
          <source src="https://www.soundboard.com/handler/DownLoadTrack.ashx?cliptitle=SOS+-+ABBA&filename=mz/Mzg1ODMxNTIzMzg1ODM4_JzthsfvUY24.mp3" type="audio/mpeg">
        </audio>'''

if old_icon in content:
    content = content.replace(old_icon, new_icon)
    print("Replaced icon with clickable version")
else:
    print("Could not find icon to replace")

# Add the easter egg script before </body>
easter_egg_script = '''
    <!-- Easter Egg -->
    <script>
      (function() {
        let clickCount = 0;
        let clickTimer = null;
        const icon = document.getElementById('hero-icon');
        const audio = document.getElementById('sos-audio');
        
        if (icon && audio) {
          icon.addEventListener('click', function() {
            clickCount++;
            icon.style.transform = 'scale(0.95)';
            setTimeout(() => icon.style.transform = 'scale(1)', 100);
            
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => clickCount = 0, 800);
            
            if (clickCount >= 3) {
              clickCount = 0;
              if (audio.paused) {
                audio.volume = 0.5;
                audio.play().catch(e => console.log('Audio play failed:', e));
                icon.style.boxShadow = '0 0 60px rgba(157,140,207,0.9), 0 0 100px rgba(92,214,133,0.5)';
              } else {
                audio.pause();
                audio.currentTime = 0;
                icon.style.boxShadow = '0 0 40px rgba(157,140,207,0.5)';
              }
            }
          });
        }
      })();
    </script>
'''

if 'sos-audio' not in content or 'Easter Egg' not in content:
    content = content.replace('</body>', easter_egg_script + '\n</body>')
    print("Added easter egg script")

with open(filepath, 'w') as f:
    f.write(content)

print("Done!")
