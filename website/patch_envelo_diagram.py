#!/usr/bin/env python3
"""Replace the ENVELO mechanism flow diagram with enterprise version"""

filepath = "index.html"

with open(filepath, 'r') as f:
    lines = f.readlines()

# Find start and end
start_line = None
end_line = None

for i, line in enumerate(lines):
    if '<!-- Mechanism Flow Diagram -->' in line:
        start_line = i
    if start_line and '<!-- Tagline -->' in line:
        end_line = i
        break

if start_line is None or end_line is None:
    print(f"✗ Could not find boundaries: start={start_line}, end={end_line}")
    exit(1)

print(f"Found diagram at lines {start_line+1}-{end_line}")

NEW_DIAGRAM = '''      <!-- Mechanism Flow Diagram - Enterprise -->
      <div class="reveal" style="display: flex; justify-content: center; margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap;">
          
          <!-- Node: MODEL -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="width: 100px; height: 100px; background: rgba(92,214,133,0.06); border: 1px solid rgba(92,214,133,0.2); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(92,214,133,0.8)" stroke-width="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 1px; color: rgba(92,214,133,0.9);">MODEL</span>
            </div>
          </div>
          
          <!-- Connector: ACTION -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 80px;">
            <span style="font-family: var(--mono); font-size: 8px; color: rgba(92,214,133,0.6); letter-spacing: 1px;">ACTION</span>
            <div style="width: 100%; height: 2px; background: rgba(92,214,133,0.2); position: relative;">
              <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 6px solid rgba(92,214,133,0.5); border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>
              <div class="flow-packet-green" style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: rgba(92,214,133,0.8);"></div>
            </div>
          </div>
          
          <!-- Node: ENVELO -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="width: 120px; height: 120px; background: rgba(91,75,138,0.12); border: 2px solid rgba(157,140,207,0.4); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(91,75,138,0.25)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
              <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); border: 2px solid #9d8ccf; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(91,75,138,0.4);">
                <div class="envelo-eye" style="width: 14px; height: 14px; background: radial-gradient(circle, #e8e0ff 0%, #c4b8e8 100%); border-radius: 50%;"></div>
              </div>
              <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 1px; color: rgba(157,140,207,0.95);">ENVELO</span>
            </div>
            <span style="font-size: 10px; color: var(--text-tertiary);">Interlock</span>
          </div>
          
          <!-- Connector: VERDICT -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 80px;">
            <span style="font-family: var(--mono); font-size: 8px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">VERDICT</span>
            <div style="width: 100%; height: 2px; background: rgba(157,140,207,0.15); position: relative;">
              <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 6px solid rgba(157,140,207,0.4); border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>
              <div class="flow-packet-purple" style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: rgba(157,140,207,0.8);"></div>
            </div>
          </div>
          
          <!-- Node: GATE -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
                <line x1="12" y1="4" x2="12" y2="20" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
              </svg>
              <span style="font-family: var(--mono); font-size: 9px; letter-spacing: 1px; color: rgba(255,255,255,0.5);">GATE</span>
            </div>
          </div>
          
          <!-- Branch: EXECUTE / BLOCKED -->
          <div style="display: flex; flex-direction: column; gap: 12px; margin-left: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="40" height="24" viewBox="0 0 40 24">
                <path d="M 0 12 L 30 12" stroke="rgba(92,214,133,0.4)" stroke-width="1.5"/>
                <polygon points="35,12 28,8 28,16" fill="rgba(92,214,133,0.6)"/>
              </svg>
              <div style="padding: 10px 16px; background: rgba(92,214,133,0.08); border: 1px solid rgba(92,214,133,0.25); border-radius: 8px;">
                <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 1px; color: rgba(92,214,133,0.9);">EXECUTE</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="40" height="24" viewBox="0 0 40 24">
                <path d="M 0 12 L 30 12" stroke="rgba(214,92,92,0.4)" stroke-width="1.5"/>
                <polygon points="35,12 28,8 28,16" fill="rgba(214,92,92,0.6)"/>
              </svg>
              <div style="padding: 10px 16px; background: rgba(214,92,92,0.08); border: 1px solid rgba(214,92,92,0.25); border-radius: 8px;">
                <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 1px; color: rgba(214,92,92,0.9);">BLOCKED</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      <!-- Audit trail -->
      <div class="reveal" style="display: flex; justify-content: center; margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <path d="M14 2v6h6M16 13H8M16 17H8"/>
          </svg>
          <span style="font-family: var(--mono); font-size: 9px; letter-spacing: 1px; color: rgba(255,255,255,0.4);">AUDIT TRAIL</span>
          <span style="font-size: 10px; color: rgba(255,255,255,0.3);">Every decision logged</span>
        </div>
      </div>

'''

# Replace lines
new_lines = lines[:start_line] + [NEW_DIAGRAM] + lines[end_line:]

with open(filepath, 'w') as f:
    f.writelines(new_lines)

# Add CSS if needed
with open(filepath, 'r') as f:
    content = f.read()

if '.flow-packet-green' not in content:
    css = '''
    /* ENVELO mechanism animations */
    @keyframes mechFlowPacket {
      0% { left: 0; opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { left: calc(100% - 6px); opacity: 0; }
    }
    .flow-packet-green { animation: mechFlowPacket 2.5s ease-in-out infinite; }
    .flow-packet-purple { animation: mechFlowPacket 2.5s ease-in-out infinite; animation-delay: 1.2s; }
'''
    content = content.replace('/* Security diagram animations */', css + '\n    /* Security diagram animations */')
    with open(filepath, 'w') as f:
        f.write(content)
    print("✓ Added animation CSS")

print("✓ Replaced ENVELO mechanism diagram")
