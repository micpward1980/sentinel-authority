// Design tokens — exact match to sentinelauthority.org index.html source
// Every value below is copied verbatim from the website :root, sa-override, and frost-depth blocks

export const colors = {
  purple: { primary: '#4a3d75', bright: '#6b5a9e', accent: '#3d3262', glow: 'transparent' },
  bg: { deep: '#f5f5f7', panel: 'rgba(0,0,0,.025)' },
  accent: { green: '#16873e', amber: '#9e6e12', red: '#b43434' },
  text: { primary: 'rgba(15,18,30,.94)', secondary: 'rgba(15,18,30,.64)', tertiary: 'rgba(15,18,30,.44)' },
  border: { glass: 'rgba(0,0,0,.09)', subtle: 'rgba(0,0,0,.05)' },
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

// Website .hud-frame from frost-depth block
export const panelStyle = {
  background: 'rgba(255,255,255,0.40)',
  border: '1px solid rgba(15,18,30,0.08)',
  borderRadius: 16,
  backdropFilter: 'blur(18px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
  boxShadow: '0 1px 3px rgba(15,18,30,0.04), 0 8px 32px rgba(15,18,30,0.03)',
  padding: '20px 16px',
};

// Website .btn
export const buttonStyle = {
  appearance: 'none',
  border: '1px solid rgba(0,0,0,0.15)',
  background: 'transparent',
  backgroundImage: 'none',
  color: '#111318',
  padding: '12px 20px',
  borderRadius: 0,
  fontFamily: fonts.mono,
  fontSize: '10px',
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'visible',
};

// Website .btn.primary
export const primaryButtonStyle = {
  ...buttonStyle,
  borderColor: 'rgba(74,61,117,0.60)',
  background: 'transparent',
  color: 'rgba(74,61,117,1.00)',
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

  // Text — exact from sa-override + :root
  textPrimary: 'rgba(15,18,30,.94)',
  hairline: 'rgba(15,18,30,0.08)',
  hairline2: 'rgba(15,18,30,0.12)',
  textSecondary: 'rgba(15,18,30,.64)',
  textTertiary: 'rgba(15,18,30,.44)',
  textDim: 'rgba(15,18,30,.30)',

  // Borders
  borderGlass: 'rgba(0,0,0,.09)',
  borderSubtle: 'rgba(0,0,0,.05)',

  // Frost glass tiers (standardized blur levels)
  frostChrome: 'blur(24px) saturate(1.4)',    // persistent UI: sidebar, header
  frostPanel: 'blur(18px) saturate(1.2)',      // content panels, stat cards
  frostModal: 'blur(24px) saturate(1.4)',      // modals, dropdowns
  frostOverlay: 'blur(6px)',                   // dark backdrop behind modals
  frostToast: 'blur(12px)',                    // toasts, small ephemeral

  // Fonts — exact from :root
  serif: "Georgia, 'Source Serif 4', serif",
  mono: "Consolas, 'IBM Plex Mono', monospace",
  sans: "Calibri, 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",

  // Status — exact from website markup
  statusGreen: { border: 'rgba(22,135,62,.22)', text: 'rgba(22,135,62,.90)', bg: 'rgba(22,135,62,.06)' },
  statusAmber: { border: 'rgba(158,110,18,.22)', text: 'rgba(158,110,18,.95)', bg: 'rgba(158,110,18,.06)' },
  statusRed:   { border: 'rgba(180,52,52,.22)',  text: 'rgba(180,52,52,.95)',  bg: 'rgba(180,52,52,.06)' },

  // Transitions — standardized durations
  transitionFast: 'all 0.15s ease',      // hover feedback, toggles
  transitionBase: 'all 0.2s ease',       // general state changes
  transitionSlow: 'all 0.3s ease',       // layout shifts, panels

  // Tint opacity tiers (applied to any accent color)
  // 0.06 = badge/tag background
  // 0.10 = hover state, active tab
  // 0.22 = border on colored elements
  // 0.25 = button borders
  // 0.60 = active/focused borders
  // 1.00 = solid text/icons
};

export default { colors, fonts, styles, panelStyle, buttonStyle, primaryButtonStyle };
