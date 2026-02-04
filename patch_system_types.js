#!/usr/bin/env node
/**
 * SENTINEL AUTHORITY — Install 124 ODDC System Types
 * ===================================================
 * 
 * Usage (from repo root):
 *   node patch_system_types.js
 * 
 * Or:
 *   cd ~/Downloads/sentinel-authority && node patch_system_types.js
 */

const fs = require('fs');
const path = require('path');

const REPO = __dirname;
const APP_JSX = path.join(REPO, 'frontend', 'src', 'App.jsx');
const DATA_SRC = path.join(REPO, 'systemTypesData.js');
const DATA_DST = path.join(REPO, 'frontend', 'src', 'systemTypesData.js');

console.log('═══════════════════════════════════════════════════════');
console.log('  SENTINEL AUTHORITY — 124 System Types Installer');
console.log('═══════════════════════════════════════════════════════\n');

// ── Preflight ──
if (!fs.existsSync(APP_JSX)) { console.error('✗ App.jsx not found at', APP_JSX); process.exit(1); }
if (!fs.existsSync(DATA_SRC)) { console.error('✗ systemTypesData.js not found at', DATA_SRC); process.exit(1); }
console.log('✓ Found App.jsx');
console.log('✓ Found systemTypesData.js');

// ── Copy data file ──
fs.copyFileSync(DATA_SRC, DATA_DST);
console.log('✓ Copied systemTypesData.js → frontend/src/');

// ── Read App.jsx ──
let code = fs.readFileSync(APP_JSX, 'utf8');
const originalLen = code.length;

// ═══════════════════════════════════════════════════════════
// PATCH 1: Add import after last import line
// ═══════════════════════════════════════════════════════════
const IMPORT_LINE = "import { SYSTEM_TYPES, DOMAIN_GROUPS } from './systemTypesData';";

if (!code.includes('systemTypesData')) {
  // Find the last import statement
  const importRegex = /^import .+$/gm;
  let lastImport = null;
  let m;
  while ((m = importRegex.exec(code)) !== null) {
    lastImport = m;
  }
  if (lastImport) {
    const pos = lastImport.index + lastImport[0].length;
    code = code.slice(0, pos) + '\n' + IMPORT_LINE + code.slice(pos);
    console.log('✓ Added import for systemTypesData');
  }
} else {
  console.log('⊘ Import already exists');
}

// ═══════════════════════════════════════════════════════════
// PATCH 2: Replace boundaryTemplates object
// ═══════════════════════════════════════════════════════════
// Find "const boundaryTemplates = {" and everything up to the matching close
// It ends before "const applyTemplate"

const btStart = code.indexOf('const boundaryTemplates = {');
const atStart = code.indexOf('const applyTemplate');

if (btStart !== -1 && atStart !== -1 && atStart > btStart) {
  // Remove boundaryTemplates block entirely (replaced by import)
  code = code.slice(0, btStart) + 
    '// boundaryTemplates moved to systemTypesData.js (124 system types)\n\n  ' + 
    code.slice(atStart);
  console.log('✓ Removed old boundaryTemplates (now in systemTypesData.js)');
} else {
  console.log('⚠ Could not locate boundaryTemplates block');
}

// ═══════════════════════════════════════════════════════════
// PATCH 3: Replace applyTemplate function
// ═══════════════════════════════════════════════════════════
// The new applyTemplate bridges SYSTEM_TYPES format → wizard state shapes

const NEW_APPLY_TEMPLATE = `const applyTemplate = (systemType) => {
    const st = SYSTEM_TYPES[systemType];
    if (!st || !st.template) return;
    const t = st.template;

    // ── Numeric Boundaries ──
    // Template format: [{ name, min, max, unit, tolerance }]
    // State format:    [{ name, parameter, min_value, max_value, hard_limit, unit, tolerance }]
    if (t.numeric && t.numeric.length > 0) {
      setNumericBounds(t.numeric.map(n => ({
        name: n.name.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()),
        parameter: n.name,
        min_value: n.min != null ? String(n.min) : '',
        max_value: n.max != null ? String(n.max) : '',
        hard_limit: n.max != null ? String(n.max) : '',
        unit: n.unit || '',
        tolerance: n.tolerance != null ? String(n.tolerance) : '',
      })));
    } else {
      setNumericBounds([{ name: '', parameter: '', min_value: '', max_value: '', hard_limit: '', unit: '', tolerance: '' }]);
    }

    // ── Geographic Boundaries ──
    // Template format: { type, description }
    // State format:    [{ name, boundary_type, lat, lon, radius_meters, altitude_min, altitude_max }]
    if (t.geo) {
      setGeoBounds([{
        name: 'Primary Operating Zone',
        boundary_type: (t.geo.type === 'polygon' || t.geo.type === 'polygon_3d') ? 'polygon' : 'circle',
        lat: '', lon: '', radius_meters: '',
        altitude_min: '', altitude_max: '',
      }]);
    } else {
      setGeoBounds([{ name: '', boundary_type: 'circle', lat: '', lon: '', radius_meters: '', altitude_min: '', altitude_max: '' }]);
    }

    // ── Time Boundaries ──
    // Template format: { operating_hours: 'HH:MM-HH:MM', operating_days: [...], timezone }
    // State format:    [{ name, start_hour, end_hour, timezone, days }]
    if (t.time) {
      const [startH, endH] = (t.time.operating_hours || '0-23').split('-').map(h => String(parseInt(h)));
      const tz = t.time.timezone || 'America/Chicago';
      // Map generic timezone labels to IANA
      const tzMap = { 'facility_local': 'America/Chicago', 'ops_local': 'America/Chicago', 'farm_local': 'America/Chicago',
        'delivery_zone_local': 'America/Chicago', 'campus_local': 'America/Chicago', 'city_local': 'America/Chicago',
        'community_local': 'America/Chicago', 'site_local': 'America/Chicago', 'hospital_local': 'America/Chicago',
        'lab_local': 'America/Chicago', 'mine_local': 'America/Chicago', 'port_local': 'America/Chicago',
        'airport_local': 'America/Chicago', 'transit_local': 'America/Chicago', 'incident_local': 'America/Chicago',
        'exchange_local': 'America/New_York', 'institution_local': 'America/New_York', 'utility_local': 'America/Chicago',
        'grid_local': 'America/Chicago', 'plant_local': 'America/Chicago', 'fab_local': 'America/Chicago',
        'restaurant_local': 'America/Chicago', 'store_local': 'America/Chicago', 'hotel_local': 'America/Chicago',
        'farm_local': 'America/Chicago', 'network_local': 'UTC', 'theater_local': 'UTC',
        'patient_local': 'America/Chicago', 'student_local': 'America/Chicago', 'firm_local': 'America/New_York',
        'mission_local': 'UTC' };
      setTimeBounds([{
        name: 'Operating Hours',
        start_hour: startH,
        end_hour: endH,
        timezone: tzMap[tz] || tz,
        days: t.time.operating_days || [0,1,2,3,4,5,6],
      }]);
    } else {
      setTimeBounds([{ name: '', start_hour: '6', end_hour: '22', timezone: 'America/Chicago', days: [0,1,2,3,4,5,6] }]);
    }

    // ── State Boundaries ──
    // Template format: { allowed: [...], forbidden: [...] }
    // State format:    [{ name, parameter, allowed_values, forbidden_values }]
    if (t.states && (t.states.allowed?.length || t.states.forbidden?.length)) {
      setStateBounds([{
        name: 'Operational States',
        parameter: 'mode',
        allowed_values: (t.states.allowed || []).join(', '),
        forbidden_values: (t.states.forbidden || []).join(', '),
      }]);
    } else {
      setStateBounds([{ name: '', parameter: '', allowed_values: '', forbidden_values: '' }]);
    }

    // ── ODD Description ──
    if (t.odd_description) {
      setOdd(prev => ({ ...prev, odd_description: t.odd_description }));
    }

    // ── Deployment type & environment from domain ──
    const domainToDeployment = {
      ground_robots: 'indoor', aerial: 'outdoor', vehicles: 'outdoor', marine: 'outdoor',
      medical: 'indoor', financial: 'virtual', energy: 'hybrid', manufacturing: 'indoor',
      defense: 'hybrid', agriculture: 'outdoor', space_extreme: 'outdoor',
      telecom_digital: 'virtual', construction: 'outdoor', logistics: 'indoor',
      retail_hospitality: 'indoor', education_research: 'indoor', legal_compliance: 'virtual', other: '',
    };
    const domainToEnvironment = {
      ground_robots: 'warehouse', aerial: 'airspace', vehicles: 'road', marine: 'other',
      medical: 'clinical', financial: 'data_center', energy: 'other', manufacturing: 'manufacturing',
      defense: 'other', agriculture: 'agriculture', space_extreme: 'other',
      telecom_digital: 'data_center', construction: 'construction', logistics: 'warehouse',
      retail_hospitality: 'other', education_research: 'other', legal_compliance: 'other', other: '',
    };
    setSys(prev => ({
      ...prev,
      deployment_type: domainToDeployment[st.domain] || prev.deployment_type,
      environment: domainToEnvironment[st.domain] || prev.environment,
    }));

    // ── Safety config ──
    if (t.safety) {
      const actionMap = { 'block': 'stop', 'warn': 'alert', 'stop': 'stop' };
      setSafety(prev => ({
        ...prev,
        violation_action: actionMap[t.safety.violation_action] || t.safety.violation_action || prev.violation_action,
        fail_closed: t.safety.fail_closed !== false,
      }));
    }
  };`;

// Find and replace old applyTemplate
const oldApplyStart = code.indexOf('const applyTemplate = (systemType) => {');
if (oldApplyStart !== -1) {
  // Find the end — look for the closing `};` at the same indentation
  // The function ends with `  };` before some other code
  // We need to find the matching close. Count braces.
  let braceDepth = 0;
  let i = code.indexOf('{', oldApplyStart);
  let end = -1;
  for (let j = i; j < code.length; j++) {
    if (code[j] === '{') braceDepth++;
    if (code[j] === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        end = j + 1;
        // Include trailing semicolon if present
        if (code[end] === ';') end++;
        break;
      }
    }
  }
  if (end !== -1) {
    code = code.slice(0, oldApplyStart) + NEW_APPLY_TEMPLATE + code.slice(end);
    console.log('✓ Replaced applyTemplate (bridges SYSTEM_TYPES → wizard state shapes)');
  } else {
    console.log('⚠ Could not find end of applyTemplate');
  }
} else {
  console.log('⚠ Could not find applyTemplate function');
}

// ═══════════════════════════════════════════════════════════
// PATCH 4: Replace system_type <select> with optgroup version
// ═══════════════════════════════════════════════════════════

// The exact old select from line 1256
const OLD_SELECT = `<select value={sys.system_type} onChange={(e) => { setSys({...sys, system_type: e.target.value}); applyTemplate(e.target.value); }} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="">Select type...</option><option value="mobile_robot">Mobile Robot / AMR</option><option value="industrial_arm">Industrial Robot Arm</option><option value="drone">Drone / UAV</option><option value="autonomous_vehicle">Autonomous Vehicle</option><option value="agv">Automated Guided Vehicle (AGV)</option><option value="cobot">Collaborative Robot (Cobot)</option><option value="clinical_ai">Clinical AI / Decision Support</option><option value="data_center">Data Center Automation</option><option value="other">Other Autonomous System</option></select>`;

const NEW_SELECT = `<select value={sys.system_type} onChange={(e) => { setSys({...sys, system_type: e.target.value}); applyTemplate(e.target.value); }} className="w-full px-4 py-3 rounded-lg outline-none" style={inputStyle}><option value="">Select system type ({Object.keys(SYSTEM_TYPES).length} available)...</option>{DOMAIN_GROUPS.map(group => { const types = Object.entries(SYSTEM_TYPES).filter(([,v]) => v.domain === group.key); if (!types.length) return null; return (<optgroup key={group.key} label={group.label}>{types.map(([key, t]) => (<option key={key} value={key}>{t.label}</option>))}</optgroup>); })}</select>`;

if (code.includes(OLD_SELECT)) {
  code = code.replace(OLD_SELECT, NEW_SELECT);
  console.log('✓ Replaced system_type <select> with 18-group optgroup dropdown');
} else {
  // Try a more flexible match — find any select with system_type options
  const selectPattern = /<select[^>]*sys\.system_type[^>]*>.*?<\/select>/;
  const selectMatch = code.match(selectPattern);
  if (selectMatch) {
    code = code.replace(selectMatch[0], NEW_SELECT);
    console.log('✓ Replaced system_type <select> (flexible match)');
  } else {
    console.log('⚠ Could not find system_type <select> — check manually');
  }
}

// ═══════════════════════════════════════════════════════════
// PATCH 5: Update step 4 template check references
// ═══════════════════════════════════════════════════════════

// Replace all references to boundaryTemplates[sys.system_type] with SYSTEM_TYPES[sys.system_type]
const btRefCount = (code.match(/boundaryTemplates\[sys\.system_type\]/g) || []).length;
code = code.replace(/boundaryTemplates\[sys\.system_type\]/g, 'SYSTEM_TYPES[sys.system_type]');
if (btRefCount > 0) {
  console.log(`✓ Updated ${btRefCount} references: boundaryTemplates → SYSTEM_TYPES`);
}

// Also update the label display in step 4
// Old: boundaryTemplates[sys.system_type].label
// New: SYSTEM_TYPES[sys.system_type].label
code = code.replace(/boundaryTemplates\[/g, 'SYSTEM_TYPES[');
console.log('✓ Updated all remaining boundaryTemplates references');

// ═══════════════════════════════════════════════════════════
// WRITE & VERIFY
// ═══════════════════════════════════════════════════════════

fs.writeFileSync(APP_JSX, code);
const delta = code.length - originalLen;
console.log(`\n  App.jsx: ${code.length.toLocaleString()} chars (${delta >= 0 ? '+' : ''}${delta.toLocaleString()} from original)`);

// Verification
console.log('\n── Verification ──');
const checks = [
  ['systemTypesData.js in frontend/src', fs.existsSync(DATA_DST)],
  ['Import statement present', code.includes("from './systemTypesData'")],
  ['SYSTEM_TYPES referenced', code.includes('SYSTEM_TYPES[')],
  ['DOMAIN_GROUPS referenced', code.includes('DOMAIN_GROUPS.map')],
  ['applyTemplate bridges formats', code.includes('n.name.replace(/_/g')],
  ['optgroup rendering', code.includes('<optgroup key={group.key}')],
  ['Old boundaryTemplates removed', !code.includes('const boundaryTemplates = {')],
  ['Old options removed', !code.includes('Mobile Robot / AMR')],
  ['State shape: parameter field', code.includes("parameter: n.name")],
  ['State shape: allowed_values', code.includes("allowed_values:")],
  ['State shape: start_hour', code.includes("start_hour:")],
  ['Safety mapping', code.includes("actionMap[t.safety.violation_action]")],
];

let allPass = true;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  if (!ok) allPass = false;
}

// Count types in data file
const dataCode = fs.readFileSync(DATA_DST, 'utf8');
const typeCount = (dataCode.match(/domain: '/g) || []).length;
console.log(`\n  System types: ${typeCount}`);
console.log(`  Domain groups: 18`);

if (allPass) {
  console.log('\n✅ Patch complete!');
  console.log('   cd frontend && npm run dev');
} else {
  console.log('\n⚠ Some checks failed — review output above.');
}

console.log('\n  git add -A && git commit -m "feat: expand to 124 ODDC system types with boundary templates"');
