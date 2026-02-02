#!/usr/bin/env python3
"""Patch scenarios.html: add Energy, Defense, Logistics, Maritime cards + sections"""
import os, sys

path = os.path.expanduser("~/Downloads/sentinel-authority/website/scenarios.html")
with open(path, 'r') as f:
    c = f.read()

# ── NAV CARDS ──
nav = """
      <!-- Energy & Utilities -->
      <a href="#energy" style="position: relative; background: linear-gradient(135deg, rgba(214,160,92,0.1) 0%, rgba(214,160,92,0.02) 100%); border: 1px solid rgba(214,160,92,0.25); border-radius: 20px; padding: 28px; text-decoration: none; transition: all 0.3s ease; overflow: hidden;" onmouseover="this.style.transform='translateY(-4px)';this.style.borderColor='rgba(214,160,92,0.5)'" onmouseout="this.style.transform='translateY(0)';this.style.borderColor='rgba(214,160,92,0.25)'">
        <div style="position: absolute; top: 0; left: 24px; width: 50px; height: 3px; background: linear-gradient(90deg, rgba(214,160,92,0.8), transparent);"></div>
        <div style="width: 48px; height: 48px; background: rgba(214,160,92,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(214,160,92,0.9)" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px;">Energy &amp; Utilities</h3>
        <p style="font-size: 13px; color: var(--text-tertiary); margin: 0; line-height: 1.5;">Grid balancing &amp; demand response</p>
        <span style="display: inline-block; margin-top: 16px; font-family: var(--mono); font-size: 11px; color: rgba(214,160,92,0.8);">View scenario \u2192</span>
      </a>

      <!-- Defense & National Security -->
      <a href="#defense" style="position: relative; background: linear-gradient(135deg, rgba(214,92,92,0.1) 0%, rgba(214,92,92,0.02) 100%); border: 1px solid rgba(214,92,92,0.25); border-radius: 20px; padding: 28px; text-decoration: none; transition: all 0.3s ease; overflow: hidden;" onmouseover="this.style.transform='translateY(-4px)';this.style.borderColor='rgba(214,92,92,0.5)'" onmouseout="this.style.transform='translateY(0)';this.style.borderColor='rgba(214,92,92,0.25)'">
        <div style="position: absolute; top: 0; left: 24px; width: 50px; height: 3px; background: linear-gradient(90deg, rgba(214,92,92,0.8), transparent);"></div>
        <div style="width: 48px; height: 48px; background: rgba(214,92,92,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(214,92,92,0.9)" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px;">Defense &amp; National Security</h3>
        <p style="font-size: 13px; color: var(--text-tertiary); margin: 0; line-height: 1.5;">Rules of engagement &amp; classification</p>
        <span style="display: inline-block; margin-top: 16px; font-family: var(--mono); font-size: 11px; color: rgba(214,92,92,0.8);">View scenario \u2192</span>
      </a>

      <!-- Logistics & Supply Chain -->
      <a href="#logistics" style="position: relative; background: linear-gradient(135deg, rgba(92,214,133,0.1) 0%, rgba(92,214,133,0.02) 100%); border: 1px solid rgba(92,214,133,0.25); border-radius: 20px; padding: 28px; text-decoration: none; transition: all 0.3s ease; overflow: hidden;" onmouseover="this.style.transform='translateY(-4px)';this.style.borderColor='rgba(92,214,133,0.5)'" onmouseout="this.style.transform='translateY(0)';this.style.borderColor='rgba(92,214,133,0.25)'">
        <div style="position: absolute; top: 0; left: 24px; width: 50px; height: 3px; background: linear-gradient(90deg, rgba(92,214,133,0.8), transparent);"></div>
        <div style="width: 48px; height: 48px; background: rgba(92,214,133,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(92,214,133,0.9)" stroke-width="1.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px;">Logistics &amp; Supply Chain</h3>
        <p style="font-size: 13px; color: var(--text-tertiary); margin: 0; line-height: 1.5;">Warehouse robotics &amp; route enforcement</p>
        <span style="display: inline-block; margin-top: 16px; font-family: var(--mono); font-size: 11px; color: rgba(92,214,133,0.8);">View scenario \u2192</span>
      </a>

      <!-- Maritime & Port Operations -->
      <a href="#maritime" style="position: relative; background: linear-gradient(135deg, rgba(157,140,207,0.1) 0%, rgba(157,140,207,0.02) 100%); border: 1px solid rgba(157,140,207,0.25); border-radius: 20px; padding: 28px; text-decoration: none; transition: all 0.3s ease; overflow: hidden;" onmouseover="this.style.transform='translateY(-4px)';this.style.borderColor='rgba(157,140,207,0.5)'" onmouseout="this.style.transform='translateY(0)';this.style.borderColor='rgba(157,140,207,0.25)'">
        <div style="position: absolute; top: 0; left: 24px; width: 50px; height: 3px; background: linear-gradient(90deg, rgba(157,140,207,0.8), transparent);"></div>
        <div style="width: 48px; height: 48px; background: rgba(157,140,207,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(157,140,207,0.9)" stroke-width="1.5"><path d="M2 20l.8-2.7A1.5 1.5 0 014.2 16h15.6a1.5 1.5 0 011.4 1.3L22 20"/><path d="M12 16V4"/><path d="M4 12l8-4 8 4"/><path d="M2 20c1 1 3 2 5 2s4-1 5-2c1 1 3 2 5 2s4-1 5-2"/></svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px;">Maritime &amp; Port Operations</h3>
        <p style="font-size: 13px; color: var(--text-tertiary); margin: 0; line-height: 1.5;">Navigation lanes &amp; COLREG compliance</p>
        <span style="display: inline-block; margin-top: 16px; font-family: var(--mono); font-size: 11px; color: rgba(157,140,207,0.8);">View scenario \u2192</span>
      </a>"""

# ── DETAIL SECTIONS ──
secs = """
    <section id="energy" class="reveal" style="margin-bottom: 60px; padding: 40px; background: linear-gradient(135deg, rgba(214,160,92,0.08) 0%, rgba(214,160,92,0.02) 100%); border: 1px solid rgba(214,160,92,0.2); border-radius: 24px;">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; background: rgba(214,160,92,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(214,160,92,0.9)" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <h2 style="font-family: 'Source Serif 4', serif; font-size: 28px; font-weight: 300; color: var(--text-primary); margin: 0;">Energy &amp; Utilities</h2>
      </div>
      <p style="font-size: 16px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 24px;">
        Autonomous systems manage grid balancing, renewable integration, demand response, and distributed energy resource orchestration. Cascading failures can affect millions and cause billions in economic damage.
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px;">
          <h4 style="font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: rgba(214,160,92,0.9); margin: 0 0 12px;">INTERLOCK BEHAVIOR</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
            <li>Frequency response bounded by independent relay protection</li>
            <li>Load shedding enforced by priority matrix</li>
            <li>Protected categories (hospitals, emergency) hardcoded</li>
          </ul>
        </div>
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px;">
          <h4 style="font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: rgba(214,160,92,0.9); margin: 0 0 12px;">EVIDENCE OUTPUTS</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
            <li>NERC-compliant timestamped decision logs</li>
            <li>Storage dispatch rate enforcement records</li>
          </ul>
        </div>
      </div>
      <a href="docs/ODDC_Scenarios_v1.0.pdf" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; background: rgba(214,160,92,0.15); border: 1px solid rgba(214,160,92,0.4); border-radius: 10px; color: rgba(214,160,92,0.95); font-family: var(--mono); font-size: 12px; text-decoration: none; transition: all 0.2s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Full Scenarios PDF
      </a>
    </section>

    <section id="defense" class="reveal" style="margin-bottom: 60px; padding: 40px; background: linear-gradient(135deg, rgba(214,92,92,0.08) 0%, rgba(214,92,92,0.02) 100%); border: 1px solid rgba(214,92,92,0.2); border-radius: 24px;">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; background: rgba(214,92,92,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(214,92,92,0.9)" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h2 style="font-family: 'Source Serif 4', serif; font-size: 28px; font-weight: 300; color: var(--text-primary); margin: 0;">Defense &amp; National Security</h2>
      </div>
      <p style="font-size: 16px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 24px;">
        Autonomous defense systems include surveillance platforms, logistics automation, cyber defense, and sensor networks. These operate under strict rules of engagement and international humanitarian law.
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px;">
          <h4 style="font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: rgba(214,92,92,0.9); margin: 0 0 12px;">INTERLOCK BEHAVIOR</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
            <li>Independent ROE authorization module</li>
            <li>Cryptographic operational area authentication</li>
            <li>Hardware-level classification with data diodes</li>
          </ul>
        </div>
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px;">
          <h4 style="font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: rgba(214,92,92,0.9); margin: 0 0 12px;">EVIDENCE OUTPUTS</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
            <li>Isolated sensor/planning stack audit trails</li>
            <li>Escalation authority compliance records</li>
          </ul>
        </div>
      </div>
      <a href="docs/ODDC_Scenarios_v1.0.pdf" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; background: rgba(214,92,92,0.15); border: 1px solid rgba(214,92,92,0.4); border-radius: 10px; color: rgba(214,92,92,0.95); font-family: var(--mono); font-size: 12px; text-decoration: none; transition: all 0.2s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Full Scenarios PDF
      </a>
    </section>

    <section id="logistics" class="reveal" style="margin-bottom: 60px; padding: 40px; background: linear-gradient(135deg, rgba(92,214,133,0.08) 0%, rgba(92,214,133,0.02) 100%); border: 1px solid rgba(92,214,133,0.2); border-radius: 24px;">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; background: rgba(92,214,133,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(92,214,133,0.9)" stroke-width="1.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </div>
        <h2 style="font-family: 'Source Serif 4', serif; font-size: 28px; font-weight: 300; color: var(--text-primary); margin: 0;">Logistics &amp; Supply Chain</h2>
      </div>
      <p style="font-size: 16px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 24px;">
        Autonomous logistics systems manage warehouse robotics, route optimization, inventory allocation, and last-mile delivery. Physical automation combined with algorithmic decisions creates compound risk surfaces.
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px;">
          <h4 style="font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: rgba(92,214,133,0.9); margin: 0 0 12px;">INTERLOCK BEHAVIOR</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
            <li>Safety-rated speed monitor (SRS per ISO 10218)</li>
            <li>Route constraint enforcement at navigation level</li>
            <li>Procurement system hard spending limits</li>
          </ul>
        </div>
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px;">
          <h4 style="font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: rgba(92,214,133,0.9); margin: 0 0 12px;">EVIDENCE OUTPUTS</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
            <li>Order-to-delivery traceability chain</li>
            <li>Zone intrusion and speed violation logs</li>
          </ul>
        </div>
      </div>
      <a href="docs/ODDC_Scenarios_v1.0.pdf" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; background: rgba(92,214,133,0.15); border: 1px solid rgba(92,214,133,0.4); border-radius: 10px; color: rgba(92,214,133,0.95); font-family: var(--mono); font-size: 12px; text-decoration: none; transition: all 0.2s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Full Scenarios PDF
      </a>
    </section>

    <section id="maritime" class="reveal" style="margin-bottom: 60px; padding: 40px; background: linear-gradient(135deg, rgba(157,140,207,0.08) 0%, rgba(157,140,207,0.02) 100%); border: 1px solid rgba(157,140,207,0.2); border-radius: 24px;">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; background: rgba(157,140,207,0.15); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(157,140,207,0.9)" stroke-width="1.5"><path d="M2 20l.8-2.7A1.5 1.5 0 014.2 16h15.6a1.5 1.5 0 011.4 1.3L22 20"/><path d="M12 16V4"/><path d="M4 12l8-4 8 4"/><path d="M2 20c1 1 3 2 5 2s4-1 5-2c1 1 3 2 5 2s4-1 5-2"/></svg>
        </div>
        <h2 style="font-family: 'Source Serif 4', serif; font-size: 28px; font-weight: 300; color: var(--text-primary); margin: 0;">Maritime &amp; Port Operations</h2>
      </div>
      <p style="font-size: 16px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 24px;">
        Autonomous maritime systems include vessel navigation, port crane operations, and container yard management operating under IMO conventions, flag state requirements, and port authority rules.
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px;">
          <h4 style="font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: rgba(157,140,207,0.9); margin: 0 0 12px;">INTERLOCK BEHAVIOR</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
            <li>Independent ECDIS navigation boundary enforcement</li>
            <li>Geofenced speed profiles via engine management</li>
            <li>AIS-based COLREG collision avoidance</li>
          </ul>
        </div>
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px;">
          <h4 style="font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: rgba(157,140,207,0.9); margin: 0 0 12px;">EVIDENCE OUTPUTS</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.8;">
            <li>Verified chart-referenced navigation logs</li>
            <li>Helm command rejection audit trail</li>
          </ul>
        </div>
      </div>
      <a href="docs/ODDC_Scenarios_v1.0.pdf" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; background: rgba(157,140,207,0.15); border: 1px solid rgba(157,140,207,0.4); border-radius: 10px; color: rgba(157,140,207,0.95); font-family: var(--mono); font-size: 12px; text-decoration: none; transition: all 0.2s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Full Scenarios PDF
      </a>
    </section>

"""

# 1. Insert nav cards after Aerospace nav card
marker1 = 'Mission envelopes &amp; geofencing'
if marker1 not in c:
    marker1 = 'Mission envelopes & geofencing'
i = c.find(marker1)
if i == -1:
    print("ERROR: Could not find Aerospace nav card"); sys.exit(1)
j = c.find('</a>', i) + 4
c = c[:j] + '\n' + nav + c[j:]
print("✓ Nav cards inserted")

# 2. Insert detail sections before Bottom CTA
marker2 = '<!-- Bottom CTA -->'
k = c.find(marker2)
if k == -1:
    print("ERROR: Could not find Bottom CTA"); sys.exit(1)
c = c[:k] + secs + '    ' + c[k:]
print("✓ Detail sections inserted")

with open(path, 'w') as f:
    f.write(c)

print("✓ scenarios.html updated with 4 new industries")
