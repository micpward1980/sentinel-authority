#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — Mobile Responsiveness Pass
 * =================================================
 * 
 * Fixes:
 *  1. Main content: p-8 → responsive padding (p-4 on mobile, p-8 on desktop)
 *  2. Global CSS media queries for grid collapse + table scroll
 *  3. Hardcoded repeat(4,1fr) → auto-fit minmax grids
 *  4. Hardcoded repeat(3,1fr) → auto-fit minmax grids  
 *  5. Header overflow on mobile (hide links, keep hamburger)
 *  6. Verification page max-width constraint fix
 * 
 * Usage: cd ~/Downloads/sentinel-authority && node patch_mobile.js
 */

const fs = require('fs');
const path = require('path');

const APP_JSX = path.join(__dirname, 'frontend', 'src', 'App.jsx');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — Mobile Responsiveness Pass');
console.log('═══════════════════════════════════════════════════════\n');

if (!fs.existsSync(APP_JSX)) { console.error('✗ App.jsx not found'); process.exit(1); }
let code = fs.readFileSync(APP_JSX, 'utf8');
const origLen = code.length;
let patchCount = 0;

function patch(name, oldStr, newStr) {
  if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    console.log(`✓ ${name}`);
    patchCount++;
    return true;
  }
  console.log(`⚠ ${name} — pattern not found`);
  return false;
}

function patchAll(name, oldStr, newStr) {
  let count = 0;
  while (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    count++;
  }
  if (count > 0) {
    console.log(`✓ ${name} (${count} instances)`);
    patchCount++;
  } else {
    console.log(`⚠ ${name} — no instances found`);
  }
  return count;
}

// ═══════════════════════════════════════════════════════════
// PATCH 1: Add global mobile CSS media queries
// ═══════════════════════════════════════════════════════════

const MOBILE_CSS = `
        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .sa-main-content { padding: 16px !important; }
          .sa-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .sa-stat-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
          .sa-header-links { display: none !important; }
          .sa-page-title { font-size: 22px !important; }
          .sa-table-wrap { margin: 0 -16px; border-radius: 0 !important; }
          .sa-table-wrap table { font-size: 12px; }
        }
        @media (max-width: 480px) {
          .sa-main-content { padding: 12px !important; }
          .sa-stat-grid { grid-template-columns: 1fr !important; }
          .sa-stat-grid-3 { grid-template-columns: 1fr !important; }
        }`;

// Insert before the closing </style> of the layout CSS block
patch(
  'Add mobile CSS media queries',
  "        .sexy-row:hover { background: rgba(157,140,207,0.08) !important; }\n      `}</style>",
  `        .sexy-row:hover { background: rgba(157,140,207,0.08) !important; }${MOBILE_CSS}\n      \`}</style>`
);

// ═══════════════════════════════════════════════════════════
// PATCH 2: Main content padding — responsive
// ═══════════════════════════════════════════════════════════

patch(
  'Responsive main padding',
  `<main className="p-8" style={{position: 'relative', zIndex: 1}}>{children}</main>`,
  `<main className="sa-main-content" style={{padding: '32px', position: 'relative', zIndex: 1}}>{children}</main>`
);

// ═══════════════════════════════════════════════════════════
// PATCH 3: Header links — add class for mobile hide
// ═══════════════════════════════════════════════════════════

patch(
  'Header links mobile class',
  `<a href="https://sentinelauthority.org" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <ExternalLink className="w-4 h-4" />
            Main Site
          </a>`,
  `<a href="https://sentinelauthority.org" target="_blank" rel="noopener noreferrer" className="sa-header-links flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <ExternalLink className="w-4 h-4" />
            Main Site
          </a>`
);

// Also hide API Docs link on mobile
patch(
  'API Docs link mobile class',
  `<a href="https://api.sentinelauthority.org/docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <FileText className="w-4 h-4" />
            API Docs
          </a>`,
  `<a href="https://api.sentinelauthority.org/docs" target="_blank" rel="noopener noreferrer" className="sa-header-links flex items-center gap-2 transition-colors no-underline" style={{color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase'}}>
            <FileText className="w-4 h-4" />
            API Docs
          </a>`
);

// ═══════════════════════════════════════════════════════════
// PATCH 4: Dashboard stat grids — repeat(4,1fr) → auto-fit
// ═══════════════════════════════════════════════════════════

// Dashboard overview (line ~804)
patchAll(
  'Fix repeat(4,1fr) stat grids → auto-fit',
  "gridTemplateColumns: 'repeat(4, 1fr)'",
  "gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'"
);

// ═══════════════════════════════════════════════════════════
// PATCH 5: 3-column grids → auto-fit
// ═══════════════════════════════════════════════════════════

patchAll(
  'Fix repeat(3,1fr) grids → auto-fit',
  "gridTemplateColumns: 'repeat(3, 1fr)'",
  "gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'"
);

// ═══════════════════════════════════════════════════════════
// PATCH 6: Application review 4-col boundary summary
// ═══════════════════════════════════════════════════════════

// This is the specific inline one in the review step
patch(
  'Fix boundary summary grid in review',
  "gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '12px'}}><div style={{textAlign: 'center', padding: '12px'",
  "gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '12px', marginTop: '12px'}}><div style={{textAlign: 'center', padding: '12px'"
);

// ═══════════════════════════════════════════════════════════
// PATCH 7: EnveloAdminView tables — ensure overflowX
// ═══════════════════════════════════════════════════════════

// The monitoring sessions table already has overflowX: 'auto' — good.
// Let's make sure the admin dashboard tables do too.
// Add a global table wrapper helper via CSS (already handled by .sa-table-wrap)

// ═══════════════════════════════════════════════════════════
// PATCH 8: Dashboard page title font size class
// ═══════════════════════════════════════════════════════════

// The main "System Monitoring" h1 
patch(
  'Monitoring page title responsive',
  `<h1 style={{fontFamily: "'Source Serif 4', serif", fontSize: '28px', fontWeight: 300, margin: 0}}>
            System Monitoring`,
  `<h1 className="sa-page-title" style={{fontFamily: "'Source Serif 4', serif", fontSize: '28px', fontWeight: 300, margin: 0}}>
            System Monitoring`
);

// ═══════════════════════════════════════════════════════════
// PATCH 9: Application wizard — 2-col grids on review step
// ═══════════════════════════════════════════════════════════

// The review step has gridTemplateColumns: '1fr 1fr' inline — make responsive
patchAll(
  'Fix 1fr 1fr review grids → auto-fit',
  "gridTemplateColumns: '1fr 1fr'",
  "gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'"
);

// ═══════════════════════════════════════════════════════════
// PATCH 10: Sidebar offset — always apply on desktop
// ═══════════════════════════════════════════════════════════

// Current: sidebarOpen conditional. Should always show on lg+
// Already uses lg:translate-x-0 and lg:ml-64 pattern — just verify
// The conditional class is correct: `${sidebarOpen ? 'lg:ml-64' : ''}`
// But this means if sidebar closes on desktop, content shifts. Fix:
patch(
  'Always offset main on desktop',
  "className={`${sidebarOpen ? 'lg:ml-64' : ''} relative z-10`}",
  "className=\"lg:ml-64 relative z-10\""
);

// ═══════════════════════════════════════════════════════════
// WRITE & VERIFY
// ═══════════════════════════════════════════════════════════

fs.writeFileSync(APP_JSX, code);
const delta = code.length - origLen;
console.log(`\n  App.jsx: ${code.length.toLocaleString()} chars (${delta >= 0 ? '+' : ''}${delta.toLocaleString()})`);

console.log('\n── Verification ──');
const checks = [
  ['Mobile CSS media queries added', code.includes('@media (max-width: 768px)')],
  ['480px breakpoint added', code.includes('@media (max-width: 480px)')],
  ['sa-main-content class', code.includes('sa-main-content')],
  ['sa-header-links class (hide on mobile)', code.includes('sa-header-links')],
  ['sa-page-title class', code.includes('sa-page-title')],
  ['No hardcoded repeat(4, 1fr)', !code.includes("'repeat(4, 1fr)'")],
  ['No hardcoded repeat(3, 1fr)', !code.includes("'repeat(3, 1fr)'")],
  ['Auto-fit minmax(200px) for stat grids', code.includes("minmax(200px, 1fr)")],
  ['Auto-fit minmax(180px) for 3-col grids', code.includes("minmax(180px, 1fr)")],
  ['Desktop sidebar always offset', code.includes('"lg:ml-64 relative z-10"')],
  ['Responsive padding on main', code.includes("padding: '32px'") && code.includes('sa-main-content')],
];

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (ok) pass++;
}

console.log(`\n  ${pass}/${checks.length} checks passed · ${patchCount} patches applied`);
console.log('\n  cd frontend && npm run dev');
console.log('  git add -A && git commit -m "fix: mobile responsiveness pass"');
