// Design tokens — exact match to golden-master-v3.html Premium Frost system
// v2: Readability pass — solid text colors, real border colors, no opacity stacking

export const colors = {
  purple: { primary: '#4a3d75', bright: '#6b5a9e', accent: '#3d3262', glow: 'transparent' },
  bg: { deep: '#f5f5f7', panel: 'rgba(0,0,0,.025)' },
  accent: { green: '#16873e', amber: '#9e6e12', red: '#b43434' },
  text: { primary: '#0f121e', secondary: '#2b3040', tertiary: '#5a6070' },
  border: { glass: '#e2e5ea', subtle: '#eceef1' },
  status: {
    green: { border: 'rgba(22,135,62,.22)', text: 'rgba(22,135,62,.90)', bg: 'rgba(22,135,62,.06)' },
    amber: { border: 'rgba(158,110,18,.22)', text: 'rgba(158,110,18,.95)', bg: 'rgba(158,110,18,.06)' },
    red:   { border: 'rgba(180,52,52,.22)',  text: 'rgba(180,52,52,.95)',  bg: 'rgba(180,52,52,.06)' },
  },
};

export const fonts = {
  serif: "Georgia, 'Source Serif 4', serif",
  mono: "Consolas, 'IBM Plex Mono', monospace",
  sans: "Calibri, 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
};

// Premium Frost .hud-frame (golden-master-v3 line 2380)
export const panelStyle = {
  background: 'rgba(255,255,255,0.40)',
  border: '1px solid #e2e5ea',
  borderRadius: 16,
  backdropFilter: 'blur(18px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
  boxShadow: '0 1px 3px rgba(15,18,30,0.04), 0 8px 32px rgba(15,18,30,0.03)',
  padding: '20px 16px',
};

// .btn
export const buttonStyle = {
  appearance: 'none',
  border: '1px solid #d0d4db',
  background: 'transparent',
  backgroundImage: 'none',
  color: '#0f121e',
  padding: '12px 20px',
  borderRadius: 0,
  fontFamily: fonts.mono,
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'visible',
};

// .btn.primary
export const primaryButtonStyle = {
  ...buttonStyle,
  borderColor: 'rgba(74,61,117,0.60)',
  background: 'transparent',
  color: '#4a3d75',
};

// Flat property map — every component imports { styles }
export const styles = {
  // Colors
  purplePrimary: '#4a3d75',
  purpleBright: '#6b5a9e',
  purpleAccent: '#3d3262',
  purpleGlow: 'transparent',
  bgDeep: '#f5f5f7',
  bgPanel: 'rgba(0,0,0,.025)',
  accentGreen: '#16873e',
  accentAmber: '#9e6e12',
  accentRed: '#b43434',

  // Text — solid colors, no opacity stacking
  textPrimary:   '#0f121e',   // near-black, high contrast
  textSecondary: '#2b3040',   // solid mid-dark gray
  textTertiary:  '#5a6070',   // solid mid gray, still readable
  textDim:       '#8a909c',   // labels, timestamps

  // Borders — real colors, not transparent
  cardSurface:  'rgba(255,255,255,0.92)',  // uniform card background
  borderGlass:  '#e2e5ea',    // main panel borders
  borderSubtle: '#eceef1',    // inner dividers
  hairline:     '#d8dce3',    // table rows, tight hairlines
  hairline2:    '#cdd1d8',    // stronger hairlines

  // Glass system (premium-frost block)
  glassBg: 'rgba(255,255,255,0.58)',
  glassBorder: 'rgba(255,255,255,0.45)',
  glassInset: 'rgba(255,255,255,0.35)',
  glassShadow1: 'rgba(15,18,30,0.04)',
  glassShadow2: 'rgba(15,18,30,0.06)',

  // Frost tiers — exact from golden-master-v3 premium-frost
  frostChrome: 'blur(24px) saturate(1.4)',
  frostPanel:  'blur(18px) saturate(1.2)',
  frostGlass:  'blur(30px) saturate(1.45)',
  frostModal:  'blur(24px) saturate(1.4)',
  frostOverlay: 'blur(6px)',
  frostToast:  'blur(12px)',

  // Fonts
  serif: "Georgia, 'Source Serif 4', serif",
  mono:  "Consolas, 'IBM Plex Mono', monospace",
  sans:  "Calibri, 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",

  // Status
  statusGreen: { border: 'rgba(22,135,62,.22)',  text: '#16873e', bg: 'rgba(22,135,62,.06)' },
  statusAmber: { border: 'rgba(158,110,18,.22)', text: '#9e6e12', bg: 'rgba(158,110,18,.06)' },
  statusRed:   { border: 'rgba(180,52,52,.22)',  text: '#b43434', bg: 'rgba(180,52,52,.06)' },

  // Transitions
  transitionFast: 'all 0.15s ease',
  transitionBase: 'all 0.2s ease',
  transitionSlow: 'all 0.3s ease',
};

export default { colors, fonts, styles, panelStyle, buttonStyle, primaryButtonStyle };
