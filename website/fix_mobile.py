#!/usr/bin/env python3
"""Add comprehensive mobile responsive fixes"""

filepath = "index.html"

with open(filepath, 'r') as f:
    content = f.read()

MOBILE_CSS = '''
    /* ===== COMPREHENSIVE MOBILE FIXES ===== */
    @media (max-width: 768px) {
      /* Hero adjustments */
      .hero {
        min-height: 100vh;
        min-height: 100dvh;
        padding: 60px 16px 100px;
      }
      .hero h1 {
        font-size: 32px !important;
      }
      .hero p {
        font-size: 15px !important;
      }
      
      /* Hide scroll indicator on mobile */
      .scroll-line {
        display: none;
      }
      
      /* Mechanism diagram - stack vertically */
      .mechanism-flow-container {
        flex-direction: column !important;
        gap: 16px !important;
      }
      .mechanism-connector {
        width: 2px !important;
        height: 40px !important;
        flex-direction: row !important;
      }
      .mechanism-connector > div {
        transform: rotate(90deg) !important;
      }
    }
    
    @media (max-width: 600px) {
      /* Stack diagram nodes vertically */
      [style*="display: flex"][style*="align-items: center"][style*="gap: 0"] {
        flex-direction: column !important;
        gap: 12px !important;
      }
      
      /* Connectors become vertical */
      [style*="width: 80px"][style*="height: 2px"] {
        width: 2px !important;
        height: 40px !important;
      }
      
      /* Adjust connector arrows */
      [style*="border-left: 6px solid"] {
        border-left: none !important;
        border-top: 6px solid rgba(92,214,133,0.5) !important;
        border-left: 4px solid transparent !important;
        border-right: 4px solid transparent !important;
      }
      
      /* Branch items stack */
      [style*="margin-left: 16px"] {
        margin-left: 0 !important;
        margin-top: 12px !important;
      }
      
      /* Security diagram adjustments */
      .security-flow-container {
        flex-direction: column !important;
        gap: 16px !important;
      }
      
      /* Four pillars - single column */
      [style*="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))"] {
        grid-template-columns: 1fr !important;
      }
      
      /* Section padding */
      .section, section {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      
      /* Reduce large text */
      [style*="font-size: 22px"] {
        font-size: 18px !important;
      }
      [style*="font-size: 20px"] {
        font-size: 17px !important;
      }
      
      /* Fix horizontal overflow */
      body, html {
        overflow-x: hidden !important;
      }
      
      /* Timeline hide on mobile */
      .timeline-desktop {
        display: none !important;
      }
      
      /* Cards full width */
      [style*="min-width: 300px"] {
        min-width: 100% !important;
      }
      
      /* Certificate steps - stack */
      [style*="display: flex"][style*="gap: 24px"][style*="flex-wrap: wrap"] {
        flex-direction: column !important;
      }
      
      /* Flow connectors on mobile */
      [style*="flex-shrink: 0"][style*="width: 24px"] {
        transform: rotate(90deg);
        margin: 8px 0;
      }
    }
    
    @media (max-width: 480px) {
      /* Even smaller adjustments */
      .hero h1 {
        font-size: 28px !important;
      }
      
      /* Button stacking */
      [style*="display: flex"][style*="gap: 16px"][style*="justify-content: center"] {
        flex-direction: column !important;
        align-items: center !important;
      }
      
      /* Node boxes smaller */
      [style*="width: 100px"][style*="height: 100px"] {
        width: 80px !important;
        height: 80px !important;
      }
      [style*="width: 120px"][style*="height: 120px"] {
        width: 100px !important;
        height: 100px !important;
      }
      [style*="width: 80px"][style*="height: 80px"] {
        width: 70px !important;
        height: 70px !important;
      }
    }
    /* ===== END MOBILE FIXES ===== */
'''

# Find where to insert - before the closing </style> of the main styles
# Look for a good insertion point
if '/* ===== COMPREHENSIVE MOBILE FIXES =====' not in content:
    # Insert before /* Security diagram animations */
    if '/* Security diagram animations */' in content:
        content = content.replace('/* Security diagram animations */', MOBILE_CSS + '\n    /* Security diagram animations */')
    else:
        # Fallback - insert before first </style>
        content = content.replace('</style>', MOBILE_CSS + '\n  </style>', 1)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print("✓ Added comprehensive mobile fixes")
else:
    print("Mobile fixes already present")
