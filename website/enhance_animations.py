#!/usr/bin/env python3
"""
Enhance animations on Sentinel Authority website
- Staggered reveals for grid children
- Better hover effects
- Micro-interactions
"""

def enhance_animations(html):
    """Add enhanced animation CSS and JS"""
    
    # Enhanced CSS animations
    enhanced_css = '''
    /* ============================================
       ENHANCED ANIMATIONS
       ============================================ */
    
    /* Staggered reveal for grid children */
    .reveal.active > * {
      opacity: 0;
      animation: stagger-in 0.5s ease forwards;
    }
    .reveal.active > *:nth-child(1) { animation-delay: 0s; }
    .reveal.active > *:nth-child(2) { animation-delay: 0.08s; }
    .reveal.active > *:nth-child(3) { animation-delay: 0.16s; }
    .reveal.active > *:nth-child(4) { animation-delay: 0.24s; }
    .reveal.active > *:nth-child(5) { animation-delay: 0.32s; }
    .reveal.active > *:nth-child(6) { animation-delay: 0.4s; }
    .reveal.active > *:nth-child(7) { animation-delay: 0.48s; }
    .reveal.active > *:nth-child(8) { animation-delay: 0.56s; }
    
    @keyframes stagger-in {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Card hover lift effect */
    [style*="border-radius: 20px"],
    [style*="border-radius: 16px"],
    [style*="border-radius: 14px"] {
      transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease !important;
    }
    
    [style*="border-radius: 20px"]:hover,
    [style*="border-radius: 16px"]:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    
    /* Button glow on hover */
    .btn.primary {
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease !important;
    }
    
    .btn.primary::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
      transition: left 0.5s ease;
    }
    
    .btn.primary:hover::before {
      left: 100%;
    }
    
    .btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(91,75,138,0.4);
    }
    
    /* Icon hover rotation */
    .gate-icon svg,
    [style*="border-radius: 12px"] svg {
      transition: transform 0.3s ease;
    }
    
    [style*="border-radius: 20px"]:hover svg,
    [style*="border-radius: 16px"]:hover svg {
      transform: scale(1.1);
    }
    
    /* Badge hover */
    .badge {
      transition: all 0.2s ease !important;
    }
    
    .badge:hover {
      transform: translateY(-2px);
      background: rgba(255,255,255,0.08);
      border-color: var(--purple-bright);
    }
    
    /* Smooth section transitions */
    .section {
      transition: opacity 0.5s ease;
    }
    
    /* Link underline animation */
    a:not(.btn):not(.brand) {
      position: relative;
    }
    
    a:not(.btn):not(.brand)::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 0;
      height: 1px;
      background: var(--purple-bright);
      transition: width 0.3s ease;
    }
    
    a:not(.btn):not(.brand):hover::after {
      width: 100%;
    }
    
    /* Floating animation for hero elements */
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    /* Pulse glow for important elements */
    @keyframes glow-pulse {
      0%, 100% { box-shadow: 0 0 20px rgba(92,214,133,0.2); }
      50% { box-shadow: 0 0 40px rgba(92,214,133,0.4); }
    }
    
    /* Gate 3 (ENVELO) special glow */
    [style*="rgba(92,214,133,0.15)"] {
      animation: glow-pulse 3s ease-in-out infinite;
    }
    
    /* Smooth scroll indicator fade */
    .scroll-indicator {
      animation: bounce-fade 2s ease-in-out infinite;
    }
    
    @keyframes bounce-fade {
      0%, 100% { opacity: 0.5; transform: translateY(0); }
      50% { opacity: 1; transform: translateY(5px); }
    }
    
    /* Process step connector animation */
    @keyframes flow-right {
      0% { background-position: 0% 50%; }
      100% { background-position: 100% 50%; }
    }
    
    /* Typing cursor effect for terminal */
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    
    /* Number counter animation prep */
    .counter {
      display: inline-block;
    }
    
    /* Reduce motion for accessibility */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      .reveal { opacity: 1; transform: none; }
      .reveal.active > * { animation: none; opacity: 1; }
    }
    '''
    
    # Find the closing </style> tag in the main styles and insert before it
    # We need to be careful to insert in the right place
    import re
    
    # Find a good insertion point - before the last </style> in the head
    # Look for the mobile responsive styles section end
    insertion_marker = "/* ============================================\n       MOBILE RESPONSIVE STYLES"
    
    if insertion_marker in html:
        html = html.replace(insertion_marker, enhanced_css + "\n    " + insertion_marker)
    else:
        # Fallback: insert before </style>
        # Find the main style block's closing tag (first </style> after a large style block)
        html = html.replace("</style>\n  </head>", enhanced_css + "\n    </style>\n  </head>", 1)
    
    return html


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 enhance_animations.py <input.html> [output.html]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file
    
    with open(input_file, 'r') as f:
        html = f.read()
    
    original = html
    html = enhance_animations(html)
    
    with open(output_file, 'w') as f:
        f.write(html)
    
    if original != html:
        print(f"✓ Enhanced animations added to {output_file}")
    else:
        print(f"⚠ No changes made")
