// Design tokens — matched to sentinelauthority.org institutional design
// Light theme, zero border-radius, bracket corners, flat panels

export const colors = {
  purple: { primary: '#4a3d75', bright: '#6b5a9e', glow: 'transparent', accent: '#3d3262' },
  bg: { deep: '#ffffff', panel: 'rgba(0,0,0,.025)' },
  accent: { green: '#16873e', amber: '#9e6e12', red: '#b43434' },
  text: { primary: 'rgba(15,18,30,.94)', secondary: 'rgba(15,18,30,.64)', tertiary: 'rgba(15,18,30,.44)', dim: 'rgba(15,18,30,.30)' },
  border: { glass: 'rgba(0,0,0,.09)', subtle: 'rgba(0,0,0,.05)' },
  nav: { bg: 'rgba(0,0,0,.85)', text: 'rgba(255,255,255,.86)', textDim: 'rgba(255,255,255,.50)' },
  status: {
    green: { border: 'rgba(22,135,62,.22)', text: '#16873e', bg: 'rgba(22,135,62,.06)' },
    amber: { border: 'rgba(158,110,18,.22)', text: '#9e6e12', bg: 'rgba(158,110,18,.06)' },
    red:   { border: 'rgba(180,52,52,.22)',  text: '#b43434',  bg: 'rgba(180,52,52,.06)' },
  },
};

export const fonts = {
  serif: "Georgia, 'Source Serif 4', serif",
  mono: "Consolas, 'IBM Plex Mono', monospace",
  sans: "Calibri, 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
};

export const panelStyle = {
  background: 'transparent',
  border: '1px solid ' + colors.border.glass,
  padding: '24px',
};

export const buttonStyle = {
  appearance: 'none',
  border: '1px solid rgba(0,0,0,.15)',
  background: 'transparent',
  backgroundImage: 'none',
  color: '#111318',
  padding: '12px 20px',
  fontFamily: fonts.mono,
  fontSize: '10px',
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

export const primaryButtonStyle = {
  ...buttonStyle,
  borderColor: 'rgba(74,61,117,.60)',
  color: '#4a3d75',
};

// Flat property map — every page imports { styles } and uses styles.bgDeep etc.
export const styles = {
  purplePrimary: '#4a3d75',
  purpleBright: '#6b5a9e',
  purpleAccent: '#3d3262',
  purpleGlow: 'transparent',
  bgDeep: '#ffffff',
  bgPanel: 'rgba(0,0,0,.025)',
  accentGreen: '#16873e',
  accentAmber: '#9e6e12',
  accentRed: '#b43434',

  textPrimary: 'rgba(15,18,30,.94)',
  textSecondary: 'rgba(15,18,30,.64)',
  textTertiary: 'rgba(15,18,30,.44)',
  textDim: 'rgba(15,18,30,.30)',

  borderGlass: 'rgba(0,0,0,.09)',
  borderSubtle: 'rgba(0,0,0,.05)',

  navBg: 'rgba(0,0,0,.85)',
  navText: 'rgba(255,255,255,.86)',
  navTextDim: 'rgba(255,255,255,.50)',

  serif: "Georgia, 'Source Serif 4', serif",
  mono: "Consolas, 'IBM Plex Mono', monospace",
  sans: "Calibri, 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",

  statusGreen: { border: 'rgba(22,135,62,.22)', text: '#16873e', bg: 'rgba(22,135,62,.06)' },
  statusAmber: { border: 'rgba(158,110,18,.22)', text: '#9e6e12', bg: 'rgba(158,110,18,.06)' },
  statusRed:   { border: 'rgba(180,52,52,.22)',  text: '#b43434',  bg: 'rgba(180,52,52,.06)' },
};

export default { colors, fonts, styles, panelStyle, buttonStyle, primaryButtonStyle };
