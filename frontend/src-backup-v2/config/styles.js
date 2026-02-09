// Design tokens — mirrors sentinelauthority.org exactly

export const colors = {
  purple: { primary: '#5B4B8A', bright: '#9d8ccf', glow: 'rgba(157,140,207,.20)' },
  bg: { deep: '#2a2f3d', panel: 'rgba(255,255,255,.05)' },
  accent: { green: '#5CD685', amber: '#D6A05C', red: '#D65C5C' },
  text: { primary: 'rgba(255,255,255,.94)', secondary: 'rgba(255,255,255,.75)', tertiary: 'rgba(255,255,255,.50)' },
  border: { glass: 'rgba(255,255,255,.10)', subtle: 'rgba(255,255,255,.06)' },
  status: {
    green: { border: 'rgba(92,214,133,.22)', text: 'rgba(92,214,133,.90)', bg: 'rgba(92,214,133,.06)' },
    amber: { border: 'rgba(214,160,92,.22)', text: 'rgba(214,160,92,.95)', bg: 'rgba(214,160,92,.06)' },
    red:   { border: 'rgba(214,92,92,.22)',  text: 'rgba(214,92,92,.95)',  bg: 'rgba(214,92,92,.06)' },
  },
};

export const fonts = {
  serif: "'Source Serif 4', serif",
  mono: "'IBM Plex Mono', monospace",
  sans: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
};

// Matches .panel on the website
export const panelStyle = {
  background: colors.bg.panel,
  border: '1px solid ' + colors.border.glass,
  borderRadius: '18px',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  padding: '30px 28px',
  position: 'relative',
  overflow: 'hidden',
};

// Matches .btn on the website
export const buttonStyle = {
  appearance: 'none',
  border: '1px solid rgba(255,255,255,.18)',
  background: 'transparent',
  color: colors.text.primary,
  padding: '14px 18px',
  borderRadius: '14px',
  fontFamily: fonts.mono,
  fontSize: '10px',
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
};

// Matches .btn.primary on the website
export const primaryButtonStyle = {
  ...buttonStyle,
  borderColor: 'rgba(157,140,207,.55)',
  background: 'rgba(91,75,138,.18)',
  boxShadow: '0 18px 50px rgba(0,0,0,.30)',
};

// Flat property map — every page imports { styles } and uses styles.bgDeep etc.
export const styles = {
  // Colors
  purplePrimary: '#5B4B8A',
  purpleBright: '#9d8ccf',
  purpleGlow: 'rgba(157,140,207,.20)',
  bgDeep: '#2a2f3d',
  bgPanel: 'rgba(255,255,255,.05)',
  accentGreen: '#5CD685',
  accentAmber: '#D6A05C',
  accentRed: '#D65C5C',

  // Text
  textPrimary: 'rgba(255,255,255,.94)',
  textSecondary: 'rgba(255,255,255,.75)',
  textTertiary: 'rgba(255,255,255,.50)',

  // Borders
  borderGlass: 'rgba(255,255,255,.10)',
  borderSubtle: 'rgba(255,255,255,.06)',

  // Fonts
  serif: "'Source Serif 4', serif",
  mono: "'IBM Plex Mono', monospace",
  sans: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",

  // Status
  statusGreen: { border: 'rgba(92,214,133,.22)', text: 'rgba(92,214,133,.90)', bg: 'rgba(92,214,133,.06)' },
  statusAmber: { border: 'rgba(214,160,92,.22)', text: 'rgba(214,160,92,.95)', bg: 'rgba(214,160,92,.06)' },
  statusRed:   { border: 'rgba(214,92,92,.22)',  text: 'rgba(214,92,92,.95)',  bg: 'rgba(214,92,92,.06)' },
};

export default { colors, fonts, styles, panelStyle, buttonStyle, primaryButtonStyle };
