#!/usr/bin/env python3
"""
Integrate custom icons into Sentinel Authority website
"""

# Icon SVG definitions
ICONS = {
    # Five Gates
    "gate-odd": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
      <line x1="12" y1="2" x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
    </svg>''',
    
    "gate-stable": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12h4l3-9 4 18 3-9h4"/>
    </svg>''',
    
    "gate-envelo": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <rect x="9" y="9" width="6" height="7" rx="1"/>
      <line x1="12" y1="12" x2="12" y2="14"/>
      <circle cx="12" cy="7" r="1" fill="currentColor"/>
    </svg>''',
    
    "gate-audit": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 15l2 2 4-4"/>
    </svg>''',
    
    "gate-revoke": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <line x1="12" y1="7" x2="12" y2="12"/>
      <line x1="12" y1="12" x2="15" y2="15"/>
    </svg>''',

    # Security - with red slash
    "no-commands": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
      <line x1="7" y1="10" x2="11" y2="10" stroke="currentColor" stroke-width="2"/>
      <circle cx="7" cy="14" r="1" fill="currentColor"/>
      <line x1="3" y1="22" x2="21" y2="2" stroke="#D65C5C" stroke-width="2.5"/>
    </svg>''',
    
    "no-code": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="8 6 3 12 8 18" stroke="currentColor" stroke-width="2"/>
      <polyline points="16 6 21 12 16 18" stroke="currentColor" stroke-width="2"/>
      <line x1="3" y1="22" x2="21" y2="2" stroke="#D65C5C" stroke-width="2.5"/>
    </svg>''',
    
    "no-network": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="5" r="2" stroke="currentColor" stroke-width="2"/>
      <circle cx="5" cy="19" r="2" stroke="currentColor" stroke-width="2"/>
      <circle cx="19" cy="19" r="2" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="7" x2="5" y2="17" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="7" x2="19" y2="17" stroke="currentColor" stroke-width="2"/>
      <line x1="7" y1="19" x2="17" y2="19" stroke="currentColor" stroke-width="2"/>
      <line x1="3" y1="22" x2="21" y2="2" stroke="#D65C5C" stroke-width="2.5"/>
    </svg>''',
    
    "no-actuator": '''<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="5" x2="12" y2="3" stroke="currentColor" stroke-width="2"/>
      <line x1="17" y1="7" x2="19" y2="5" stroke="currentColor" stroke-width="2"/>
      <line x1="19" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="17" y1="17" x2="19" y2="19" stroke="currentColor" stroke-width="2"/>
      <line x1="3" y1="22" x2="21" y2="2" stroke="#D65C5C" stroke-width="2.5"/>
    </svg>''',

    # Hero badges
    "badge-lock": '''<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 1 1 8 0v4"/>
    </svg>''',
    
    "badge-verify": '''<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>''',
    
    "badge-clock": '''<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>''',

    # ENVELO features
    "feature-nonbypass": '''<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 1 1 8 0v4"/>
      <line x1="12" y1="15" x2="12" y2="17"/>
    </svg>''',
    
    "feature-failclosed": '''<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>''',
    
    "feature-realtime": '''<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>''',
    
    "feature-tamper": '''<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 15l2 2 4-4"/>
    </svg>''',
}

def apply_icons(html):
    """Apply icon replacements to HTML"""
    
    # ============ FIVE GATES ============
    # Gate 01 - ODD
    html = html.replace(
        '<div class="gate-icon">01</div>',
        f'<div class="gate-icon">{ICONS["gate-odd"]}</div>'
    )
    
    # Gate 02 - STABLE  
    html = html.replace(
        '<div class="gate-icon">02</div>',
        f'<div class="gate-icon">{ICONS["gate-stable"]}</div>'
    )
    
    # Gate 03 - ENVELO
    html = html.replace(
        '<div class="gate-icon">03</div>',
        f'<div class="gate-icon">{ICONS["gate-envelo"]}</div>'
    )
    
    # Gate 04 - AUDIT
    html = html.replace(
        '<div class="gate-icon">04</div>',
        f'<div class="gate-icon">{ICONS["gate-audit"]}</div>'
    )
    
    # Gate 05 - REVOKE
    html = html.replace(
        '<div class="gate-icon">05</div>',
        f'<div class="gate-icon">{ICONS["gate-revoke"]}</div>'
    )
    
    # ============ SECURITY GUARANTEES ============
    # No Remote Commands
    html = html.replace(
        '''<div class="sec-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="12" x2="6" y2="12.01"/><path d="M10 12h8"/></svg>
              <svg class="slash" width="24" height="24" viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="var(--accent-red, #D65C5C)" stroke-width="2.5" stroke-linecap="round"/></svg>
            </div>''',
        f'<div class="sec-icon">{ICONS["no-commands"]}</div>'
    )
    
    # No Code Execution
    html = html.replace(
        '''<div class="sec-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <svg class="slash" width="24" height="24" viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="var(--accent-red, #D65C5C)" stroke-width="2.5" stroke-linecap="round"/></svg>
            </div>''',
        f'<div class="sec-icon">{ICONS["no-code"]}</div>'
    )
    
    # No Network Access
    html = html.replace(
        '''<div class="sec-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <svg class="slash" width="24" height="24" viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="var(--accent-red, #D65C5C)" stroke-width="2.5" stroke-linecap="round"/></svg>
            </div>''',
        f'<div class="sec-icon">{ICONS["no-network"]}</div>'
    )
    
    # No Actuator Control
    html = html.replace(
        '''<div class="sec-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
              <svg class="slash" width="24" height="24" viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4" stroke="var(--accent-red, #D65C5C)" stroke-width="2.5" stroke-linecap="round"/></svg>
            </div>''',
        f'<div class="sec-icon">{ICONS["no-actuator"]}</div>'
    )
    
    # ============ HERO BADGES ============
    # Non-Bypassable badge
    html = html.replace(
        '''<div class="badge"><span class="badge-icon">◆</span> Non-Bypassable</div>''',
        f'''<div class="badge">{ICONS["badge-lock"]} Non-Bypassable</div>'''
    )
    
    # Verifiable badge  
    html = html.replace(
        '''<div class="badge"><span class="badge-icon">◆</span> Verifiable</div>''',
        f'''<div class="badge">{ICONS["badge-verify"]} Verifiable</div>'''
    )
    
    # 72-Hour Test badge
    html = html.replace(
        '''<div class="badge"><span class="badge-icon">◆</span> 72-Hour Test</div>''',
        f'''<div class="badge">{ICONS["badge-clock"]} 72-Hour Test</div>'''
    )
    
    # ============ ENVELO FEATURE CARDS ============
    # Non-Bypassable feature
    html = html.replace(
        '''<h4>Non-Bypassable</h4>
                <p>Every action must pass through ENVELO. No backdoors, no overrides, no exceptions.</p>''',
        f'''{ICONS["feature-nonbypass"]}
                <h4>Non-Bypassable</h4>
                <p>Every action must pass through ENVELO. No backdoors, no overrides, no exceptions.</p>'''
    )
    
    # Fail-Closed feature
    html = html.replace(
        '''<h4>Fail-Closed</h4>
                <p>If validation fails or ENVELO errors, the action is blocked. Safe by default.</p>''',
        f'''{ICONS["feature-failclosed"]}
                <h4>Fail-Closed</h4>
                <p>If validation fails or ENVELO errors, the action is blocked. Safe by default.</p>'''
    )
    
    # Real-Time feature
    html = html.replace(
        '''<h4>Real-Time</h4>
                <p>Validation happens at execution time. No stale checks, no delayed enforcement.</p>''',
        f'''{ICONS["feature-realtime"]}
                <h4>Real-Time</h4>
                <p>Validation happens at execution time. No stale checks, no delayed enforcement.</p>'''
    )
    
    # Tamper-Evident feature
    html = html.replace(
        '''<h4>Tamper-Evident</h4>
                <p>Every check is logged with cryptographic signatures. Full audit trail.</p>''',
        f'''{ICONS["feature-tamper"]}
                <h4>Tamper-Evident</h4>
                <p>Every check is logged with cryptographic signatures. Full audit trail.</p>'''
    )
    
    return html


def update_gate_icon_css(html):
    """Update CSS for gate icons to display SVGs properly"""
    
    old_css = '''.gate-icon{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--purple-primary) 0%,rgba(91,75,138,0.4) 100%);border:2px solid var(--purple-bright);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:14px;font-weight:600;color:#fff;margin-bottom:14px}'''
    
    new_css = '''.gate-icon{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--purple-primary) 0%,rgba(91,75,138,0.4) 100%);border:2px solid var(--purple-bright);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:14px;font-weight:600;color:#fff;margin-bottom:14px}.gate-icon svg{width:24px;height:24px;stroke:rgba(255,255,255,0.9)}'''
    
    html = html.replace(old_css, new_css)
    return html


def update_feature_card_css(html):
    """Add CSS for feature card icons"""
    
    # Find existing feature card CSS and add icon styling
    old_css = '''.envelo-features .feature-card{background:rgba(255,255,255,0.03);border:1px solid var(--border-glass);border-radius:14px;padding:20px;text-align:left}'''
    
    new_css = '''.envelo-features .feature-card{background:rgba(255,255,255,0.03);border:1px solid var(--border-glass);border-radius:14px;padding:20px;text-align:left}.envelo-features .feature-card svg{color:var(--purple-bright);margin-bottom:12px}'''
    
    html = html.replace(old_css, new_css)
    return html


def update_badge_css(html):
    """Update badge CSS for icons"""
    
    old_css = '''.badge{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:rgba(255,255,255,0.04);border:1px solid var(--border-glass);border-radius:30px;font-family:var(--mono);font-size:11px;letter-spacing:1px;color:var(--text-secondary)}'''
    
    new_css = '''.badge{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:rgba(255,255,255,0.04);border:1px solid var(--border-glass);border-radius:30px;font-family:var(--mono);font-size:11px;letter-spacing:1px;color:var(--text-secondary)}.badge svg{color:var(--purple-bright);flex-shrink:0}'''
    
    html = html.replace(old_css, new_css)
    return html


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 integrate_icons.py <input.html> [output.html]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file
    
    with open(input_file, 'r') as f:
        html = f.read()
    
    # Apply all icon replacements
    html = apply_icons(html)
    html = update_gate_icon_css(html)
    html = update_feature_card_css(html)
    html = update_badge_css(html)
    
    with open(output_file, 'w') as f:
        f.write(html)
    
    print(f"✓ Icons integrated into {output_file}")
