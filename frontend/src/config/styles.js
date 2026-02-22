export const colors = {
  purple: { primary: '#1d1a3b', bright: '#1d1a3b', accent: '#1d1a3b', glow: 'transparent' },
  bg: { deep: '#f3f3f3', panel: 'rgba(0,0,0,.018)' },
  accent: { green: '#2e844a', amber: '#dd7a01', red: '#ea001b' },
  text: { primary: '#181818', secondary: '#444444', tertiary: '#666666' },
  border: { glass: '#dddbda', subtle: '#e8e8e8' },
  status: {
    green: { border: 'rgba(46,132,74,.25)',  text: '#2e844a', bg: 'rgba(46,132,74,.06)' },
    amber: { border: 'rgba(221,122,1,.28)',  text: '#dd7a01', bg: 'rgba(221,122,1,.07)' },
    red:   { border: 'rgba(234,0,27,.22)',   text: '#ea001b', bg: 'rgba(234,0,27,.05)'  },
  },
};
export const fonts = {
  serif: "Georgia, 'Source Serif 4', serif",
  mono:  "'IBM Plex Mono', Consolas, monospace",
  sans:  "'Inter', system-ui, sans-serif",
};
export const panelStyle = {
  background: '#ffffff', border: '1px solid #dddbda', borderRadius: 4,
  boxShadow: '0 2px 2px 0 rgba(0,0,0,0.05)', padding: '20px 24px',
};
export const buttonStyle = {
  appearance: 'none', border: '1px solid #dddbda', background: '#ffffff',
  backgroundImage: 'none', color: '#181818', padding: '8px 16px',
  borderRadius: 3, fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: '13px', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
};
export const primaryButtonStyle = {
  ...buttonStyle, background: '#1d1a3b', borderColor: '#1d1a3b', color: '#ffffff',
};
export const styles = {
  purplePrimary: '#1d1a3b', purpleBright: '#1d1a3b', purpleAccent: '#1d1a3b',
  purpleHover: '#2a2660', purpleGlow: 'transparent',
  bgDeep: '#f3f3f3', bgCoolWhite: '#f9f9fb', bgPanel: 'rgba(0,0,0,0.018)',
  accentGreen: '#2e844a', accentAmber: '#dd7a01', accentBlue: '#0176d3', accentRed: '#ea001b',
  textPrimary: '#181818', textSecondary: '#444444', textTertiary: '#666666', textDim: '#8a909c',
  cardSurface: '#ffffff', borderGlass: '#dddbda', borderSubtle: '#e8e8e8',
  hairline: '#c9c7c5', hairline2: '#b8b6b4',
  glassBg: 'rgba(255,255,255,0.92)', glassBorder: '#dddbda', glassInset: 'rgba(255,255,255,0.70)',
  glassShadow1: 'rgba(0,0,0,0.04)', glassShadow2: 'rgba(0,0,0,0.06)',
  frostChrome: 'blur(18px) saturate(1.2)', frostPanel: 'blur(14px) saturate(1.1)',
  frostGlass: 'blur(22px) saturate(1.3)', frostModal: 'blur(18px) saturate(1.2)',
  frostOverlay: 'blur(6px)', frostToast: 'blur(10px)',
  serif: "Georgia, 'Source Serif 4', serif",
  mono:  "'IBM Plex Mono', Consolas, monospace",
  sans:  "'Inter', system-ui, sans-serif",
  spacing: { xs: '4px', small: '8px', medium: '16px', large: '24px', xl: '32px', xxl: '48px' },
  statusGreen: { border: 'rgba(46,132,74,.25)',  text: '#2e844a', bg: 'rgba(46,132,74,.06)' },
  statusAmber: { border: 'rgba(221,122,1,.28)',  text: '#dd7a01', bg: 'rgba(221,122,1,.07)' },
  statusRed:   { border: 'rgba(234,0,27,.22)',   text: '#ea001b', bg: 'rgba(234,0,27,.05)'  },
  transitionFast: 'all 0.12s ease', transitionBase: 'all 0.18s ease', transitionSlow: 'all 0.28s ease',
};
export default { colors, fonts, styles, panelStyle, buttonStyle, primaryButtonStyle };
