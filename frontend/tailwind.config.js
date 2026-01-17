/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-strong': 'rgb(var(--surface-strong) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--accent-strong) / <alpha-value>)',
        grok: {
          bg: '#020202',
          panel: '#0A0A0A',
          border: '#1F1F1F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        'space-grotesk': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'ibm-plex-mono': ['IBM Plex Mono', 'monospace'],
      },
      backgroundImage: {
        'glow-conic': 'conic-gradient(from 90deg at 50% 50%, #000000 0%, #1A1A1A 50%, #FFFFFF 100%)',
      },
    },
  },
  plugins: [],
}
