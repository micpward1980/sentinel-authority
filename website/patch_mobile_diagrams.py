"""
Patch: Make ENVELO and Security diagrams vertical on mobile.
Adds CSS classes to diagram containers and proper mobile overrides.
"""

import re

with open('index.html', 'r') as f:
    html = f.read()

# ─── Step 1: Add class to ENVELO flow diagram container ───
# Find the ENVELO mechanism flow container (right after the "Mechanism Flow Diagram - Enterprise" comment)
old_envelo = '''<!-- Mechanism Flow Diagram - Enterprise -->
      <div class="reveal" style="display: flex; justify-content: center; margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap;">'''

new_envelo = '''<!-- Mechanism Flow Diagram - Enterprise -->
      <div class="reveal" style="display: flex; justify-content: center; margin-bottom: var(--space-4);">
        <div class="envelo-flow" style="display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap;">'''

assert old_envelo in html, "Could not find ENVELO diagram container"
html = html.replace(old_envelo, new_envelo, 1)
print("✓ Added class to ENVELO flow diagram")

# ─── Step 2: Add class to Security flow diagram container ───
old_security = '''<!-- Security Data Flow Diagram - Enterprise -->
      <div class="reveal" style="margin-bottom: 80px; padding-bottom: 40px;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap;">'''

new_security = '''<!-- Security Data Flow Diagram - Enterprise -->
      <div class="reveal" style="margin-bottom: 80px; padding-bottom: 40px;">
        <div class="security-flow" style="display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap;">'''

assert old_security in html, "Could not find Security diagram container"
html = html.replace(old_security, new_security, 1)
print("✓ Added class to Security flow diagram")

# ─── Step 3: Add connector classes for ENVELO ───
# ACTION connector
old_action = '''<!-- Connector: ACTION -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 80px;">
            <span style="font-family: var(--mono); font-size: 8px; color: rgba(92,214,133,0.6); letter-spacing: 1px;">ACTION</span>'''
new_action = '''<!-- Connector: ACTION -->
          <div class="envelo-connector" style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 80px;">
            <span class="connector-label" style="font-family: var(--mono); font-size: 8px; color: rgba(92,214,133,0.6); letter-spacing: 1px;">ACTION</span>'''
assert old_action in html, "Could not find ACTION connector"
html = html.replace(old_action, new_action, 1)

# VERDICT connector
old_verdict = '''<!-- Connector: VERDICT -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 80px;">
            <span style="font-family: var(--mono); font-size: 8px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">VERDICT</span>'''
new_verdict = '''<!-- Connector: VERDICT -->
          <div class="envelo-connector" style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 80px;">
            <span class="connector-label" style="font-family: var(--mono); font-size: 8px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">VERDICT</span>'''
assert old_verdict in html, "Could not find VERDICT connector"
html = html.replace(old_verdict, new_verdict, 1)

print("✓ Added classes to ENVELO connectors")

# ─── Step 4: Add connector classes for Security ───
# Connector 1 (REQUEST)
old_req = '''<!-- Connector 1 -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100px;">
            <span style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">REQUEST</span>'''
new_req = '''<!-- Connector 1 -->
          <div class="security-connector" style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100px;">
            <span class="connector-label" style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">REQUEST</span>'''
assert old_req in html, "Could not find REQUEST connector"
html = html.replace(old_req, new_req, 1)

# Connector 2 (TELEMETRY)
old_tel = '''<!-- Connector 2 -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100px;">
            <span style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">TELEMETRY</span>'''
new_tel = '''<!-- Connector 2 -->
          <div class="security-connector" style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100px;">
            <span class="connector-label" style="font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.35); letter-spacing: 1px;">TELEMETRY</span>'''
assert old_tel in html, "Could not find TELEMETRY connector"
html = html.replace(old_tel, new_tel, 1)

print("✓ Added classes to Security connectors")

# ─── Step 5: Add class to ENVELO branch (EXECUTE/BLOCKED) ───
old_branch = '''<!-- Branch: EXECUTE / BLOCKED -->
          <div style="display: flex; flex-direction: column; gap: 12px; margin-left: 16px;">'''
new_branch = '''<!-- Branch: EXECUTE / BLOCKED -->
          <div class="envelo-branch" style="display: flex; flex-direction: column; gap: 12px; margin-left: 16px;">'''
assert old_branch in html, "Could not find EXECUTE/BLOCKED branch"
html = html.replace(old_branch, new_branch, 1)
print("✓ Added class to ENVELO branch")

# ─── Step 6: Remove old Security mobile CSS and replace with comprehensive version ───
old_security_css = '''    /* Security Section Mobile - Vertical Flow */
    @media (max-width: 768px) {
      #security .section-head {
        padding: 0 16px;
      }
      
      /* Make the data flow vertical on mobile */
      #security [style*="display: flex"][style*="align-items: center"][style*="gap: 16px"] {
        flex-direction: column !important;
        gap: 8px !important;
      }
      
      /* Hide the arrow label text on mobile */
      #security [style*="flex-direction: column"][style*="align-items: center"][style*="gap: 4px"] > span {
        display: none !important;
      }
      
      /* Rotate arrows to point down and fix size */
      #security [style*="flex-direction: column"][style*="align-items: center"][style*="gap: 4px"] {
        height: 30px !important;
        width: 30px !important;
        justify-content: center !important;
      }
      
      #security [style*="flex-direction: column"][style*="align-items: center"][style*="gap: 4px"] svg {
        transform: rotate(90deg) !important;
        width: 30px !important;
        height: 20px !important;
      }
      
      /* Shrink the boxes */
      #security [style*="min-width: 140px"] {
        min-width: 160px !important;
        padding: 18px 22px !important;
      }
      
      /* No inbound banner - smaller text */
      #security [style*="letter-spacing: 2px"][style*="NO INBOUND"],
      #security span[style*="letter-spacing: 2px"] {
        font-size: 8px !important;
        letter-spacing: 1px !important;
      }
      
      #security [style*="display: inline-flex"][style*="padding: 12px 24px"] {
        padding: 10px 14px !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
        text-align: center !important;
      }
    }
    
    @media (max-width: 480px) {
      #security [style*="min-width: 140px"] {
        min-width: 140px !important;
        padding: 14px 18px !important;
      }
    }'''

new_mobile_css = '''    /* ===== ENVELO + SECURITY DIAGRAMS — MOBILE VERTICAL FLOW ===== */
    @media (max-width: 768px) {

      /* ── ENVELO Diagram ── */
      .envelo-flow {
        flex-direction: column !important;
        gap: 0 !important;
        align-items: center !important;
      }

      /* Connectors become vertical arrows */
      .envelo-connector {
        width: auto !important;
        height: 50px !important;
        flex-direction: row !important;
        gap: 8px !important;
      }
      .envelo-connector .connector-label {
        order: 2;
      }
      /* Hide the horizontal line, replace with vertical arrow */
      .envelo-connector > div[style*="width: 100%"] {
        width: 2px !important;
        height: 30px !important;
        position: relative !important;
      }
      .envelo-connector > div[style*="width: 100%"] > div[style*="border-left: 6px"] {
        /* Arrow now points down */
        border-left: 4px solid transparent !important;
        border-right: 4px solid transparent !important;
        border-top: 6px solid rgba(157,140,207,0.5) !important;
        border-bottom: none !important;
        right: auto !important;
        top: auto !important;
        bottom: 0 !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
      }
      .envelo-connector > div[style*="width: 100%"] > .flow-packet-green,
      .envelo-connector > div[style*="width: 100%"] > .flow-packet-purple {
        display: none !important;
      }

      /* Branch EXECUTE/BLOCKED: horizontal row centered under gate */
      .envelo-branch {
        flex-direction: row !important;
        margin-left: 0 !important;
        margin-top: 8px !important;
        gap: 16px !important;
        justify-content: center !important;
      }
      .envelo-branch svg[width="40"] {
        display: none !important;
      }

      /* ── SECURITY Diagram ── */
      .security-flow {
        flex-direction: column !important;
        gap: 0 !important;
        align-items: center !important;
      }

      /* Connectors become vertical */
      .security-connector {
        width: auto !important;
        height: 50px !important;
        flex-direction: row !important;
        gap: 8px !important;
      }
      .security-connector .connector-label {
        order: 2;
      }
      .security-connector > div[style*="width: 100%"] {
        width: 2px !important;
        height: 30px !important;
        position: relative !important;
      }
      .security-connector > div[style*="width: 100%"] > div[style*="border-left: 6px"] {
        border-left: 4px solid transparent !important;
        border-right: 4px solid transparent !important;
        border-top: 6px solid rgba(157,140,207,0.5) !important;
        border-bottom: none !important;
        right: auto !important;
        top: auto !important;
        bottom: 0 !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
      }
      .security-connector > div[style*="width: 100%"] > .flow-packet,
      .security-connector > div[style*="width: 100%"] > .flow-packet-delayed {
        display: none !important;
      }

      /* Security section general mobile */
      #security .section-head {
        padding: 0 16px;
      }
      #security [style*="display: inline-flex"][style*="padding: 12px 24px"] {
        padding: 10px 14px !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
        text-align: center !important;
      }
      #security [style*="letter-spacing: 2px"] {
        font-size: 9px !important;
        letter-spacing: 1px !important;
      }
    }
    /* ===== END DIAGRAM MOBILE FIXES ===== */'''

assert old_security_css in html, "Could not find old Security mobile CSS"
html = html.replace(old_security_css, new_mobile_css)
print("✓ Replaced mobile CSS with vertical flow overrides")

with open('index.html', 'w') as f:
    f.write(html)

print("\n✅ Done — ENVELO and Security diagrams will now stack vertically on mobile")
