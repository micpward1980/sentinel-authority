#!/usr/bin/env python3
"""Replace the security flow diagram with cleaner enterprise version"""

import re

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

# Find the old diagram section
old_start = '<!-- Simple Data Flow Diagram -->'
old_end_marker = '<!-- No Inbound Banner -->'

NEW_DIAGRAM = '''<!-- Security Data Flow Diagram - Enterprise -->
      <div class="reveal" style="margin-bottom: 80px; padding-bottom: 40px;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap;">
          
          <!-- Node: MODEL -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <div style="width: 120px; height: 120px; background: rgba(92,214,133,0.06); border: 1px solid rgba(92,214,133,0.2); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(92,214,133,0.8)" stroke-width="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 1px; color: rgba(92,214,133,0.9);">MODEL</span>
            </div>
            <span style="font-size: 11px; color: var(--text-tertiary);">Autonomous System</span>
          </div>
          
          <!-- Connector 1 -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100px;">
            <span style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">REQUEST</span>
            <div style="width: 100%; height: 2px; background: rgba(157,140,207,0.15); position: relative;">
              <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 6px solid rgba(157,140,207,0.4); border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>
              <div class="flow-packet" style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; background: rgba(92,214,133,0.8); border-radius: 50%;"></div>
            </div>
          </div>
          
          <!-- Node: ENVELO - Brand Mark -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <div style="width: 140px; height: 140px; background: rgba(91,75,138,0.12); border: 2px solid rgba(157,140,207,0.4); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(91,75,138,0.25)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #5B4B8A 0%, #7B6BAA 100%); border: 2px solid #9d8ccf; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(91,75,138,0.4);">
                <div class="envelo-eye" style="width: 16px; height: 16px; background: radial-gradient(circle, #e8e0ff 0%, #c4b8e8 100%); border-radius: 50%;"></div>
              </div>
              <span style="font-family: var(--mono); font-size: 11px; letter-spacing: 1px; color: rgba(157,140,207,0.95);">ENVELO</span>
            </div>
            <span style="font-size: 11px; color: var(--text-tertiary);">Enforcement Agent</span>
            <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(92,214,133,0.08); border: 1px solid rgba(92,214,133,0.2); border-radius: 20px;">
              <div style="width: 5px; height: 5px; background: rgba(92,214,133,0.9); border-radius: 50%;"></div>
              <span style="font-family: var(--mono); font-size: 9px; letter-spacing: 1px; color: rgba(92,214,133,0.9);">ACTIVE</span>
            </div>
          </div>
          
          <!-- Connector 2 -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100px;">
            <span style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">TELEMETRY</span>
            <div style="width: 100%; height: 2px; background: rgba(157,140,207,0.15); position: relative;">
              <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-left: 6px solid rgba(157,140,207,0.4); border-top: 4px solid transparent; border-bottom: 4px solid transparent;"></div>
              <div class="flow-packet flow-packet-delayed" style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; background: rgba(92,214,133,0.8); border-radius: 50%;"></div>
            </div>
          </div>
          
          <!-- Node: Sentinel Registry -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <div style="width: 120px; height: 120px; background: rgba(157,140,207,0.06); border: 1px solid rgba(157,140,207,0.2); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(157,140,207,0.8)" stroke-width="1.5">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 5v6c0 1.66-4.03 3-9 3s-9-1.34-9-3V5"/>
                <path d="M21 11v6c0 1.66-4.03 3-9 3s-9-1.34-9-3v-6"/>
              </svg>
              <span style="font-family: var(--mono); font-size: 10px; letter-spacing: 1px; color: rgba(157,140,207,0.9);">SENTINEL</span>
            </div>
            <span style="font-size: 11px; color: var(--text-tertiary);">Authority Registry</span>
          </div>
          
        </div>
      </div>
      
      '''

# Use regex to find and replace the old diagram
pattern = r'<!-- Simple Data Flow Diagram -->.*?(?=<!-- No Inbound Banner -->)'
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, NEW_DIAGRAM, content, flags=re.DOTALL)
    
    # Add the animation CSS if not already present
    if '@keyframes flowPacket' not in content:
        css_addition = '''
    /* Security diagram animations */
    @keyframes flowPacket {
      0% { left: 0; opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { left: calc(100% - 6px); opacity: 0; }
    }
    .flow-packet { animation: flowPacket 2.5s ease-in-out infinite; }
    .flow-packet-delayed { animation-delay: 1.25s; }
    .envelo-eye { animation: eye-pulse 7s ease-in-out infinite; }
'''
        # Insert before closing </style> of main styles
        content = content.replace('/* ============================================\n       ENFORCEMENT DIAGRAM', css_addition + '/* ============================================\n       ENFORCEMENT DIAGRAM')
    
    with open(filepath, 'w') as f:
        f.write(content)
    print("✓ Replaced security diagram with enterprise version")
else:
    print("✗ Could not find diagram to replace")
