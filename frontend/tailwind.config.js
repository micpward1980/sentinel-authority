/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand:   { DEFAULT: '#1d1a3b', hover: '#2a2660' },
        surface: { DEFAULT: '#ffffff', deep: '#f3f3f3', cool: '#f9f9fb', panel: 'rgba(0,0,0,0.018)' },
        accent:  { green: '#2e844a', amber: '#dd7a01', blue: '#0176d3', red: '#ea001b' },
        txt:     { DEFAULT: '#181818', secondary: '#444444', tertiary: '#666666', dim: '#8a909c' },
        border:  { glass: '#dddbda', subtle: '#e8e8e8', hairline: '#c9c7c5' },
        glass:   { bg: 'rgba(255,255,255,0.92)', border: '#dddbda', inset: 'rgba(255,255,255,0.70)' },
        status:  {
          'green-bg': 'rgba(46,132,74,0.06)', 'green-border': 'rgba(46,132,74,0.25)', 'green-text': '#2e844a',
          'amber-bg': 'rgba(221,122,1,0.07)', 'amber-border': 'rgba(221,122,1,0.28)', 'amber-text': '#dd7a01',
          'red-bg': 'rgba(234,0,27,0.05)',     'red-border': 'rgba(234,0,27,0.22)',     'red-text': '#ea001b',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['IBM Plex Mono', 'Consolas', 'monospace'],
        serif: ['Georgia', 'Source Serif 4', 'serif'],
      },
      boxShadow: {
        panel: '0 2px 2px 0 rgba(0,0,0,0.05)',
        glass: '0 1px 3px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.06)',
      },
      backdropBlur: {
        chrome: '18px',
        panel:  '14px',
        glass:  '22px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
      },
      transitionDuration: {
        'fast': '120ms',
        'base': '180ms',
        'slow': '280ms',
      },
    },
  },
  plugins: [],
}
