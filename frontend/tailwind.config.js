/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Calibri', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Consolas', 'IBM Plex Mono', 'monospace'],
        serif: ['Georgia', 'Source Serif 4', 'serif'],
      },
    },
  },
  plugins: [],
}
