/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral scale (warm-tinted, ElevenLabs/Notion style)
        surface: {
          // Light mode
          0:   '#FFFFFF',
          50:  '#FAFAFA',
          100: '#F5F5F3',
          200: '#EBEBEA',
          300: '#E0E0DE',
          400: '#C7C7C5',
          // Dark mode
          500: '#787774',
          600: '#55534E',
          700: '#3A3937',
          800: '#2C2C2A',
          850: '#232321',
          900: '#1C1C1A',
          950: '#141413',
        },
        // Primary (black in light, white in dark — like Notion/ElevenLabs buttons)
        primary: {
          DEFAULT: '#171717',
          foreground: '#FFFFFF',
        },
        // Subtle accent for interactive elements (warm neutral)
        accent: {
          DEFAULT: '#171717',
          muted: '#6B6B6B',
          subtle: '#E8E8E6',
        },
        // Text
        text: {
          primary: '#171717',
          secondary: '#6B6B6B',
          tertiary: '#9B9B97',
          inverted: '#FFFFFF',
          // Dark mode overrides via CSS variables
        },
        // Status colors
        success: {
          DEFAULT: '#2EA043',
          light: '#ECFDF3',
          dark: '#166534',
        },
        warning: {
          DEFAULT: '#D97706',
          light: '#FFFBEB',
          dark: '#92400E',
        },
        danger: {
          DEFAULT: '#DC2626',
          light: '#FEF2F2',
          dark: '#991B1B',
        },
        info: {
          DEFAULT: '#2563EB',
          light: '#EFF6FF',
          dark: '#1E40AF',
        },
        // Tier colors
        tier: {
          bronze: '#CD7F32',
          silver: '#9CA3AF',
          gold: '#EAB308',
          ready: '#2EA043',
        },
        // Feature accents (subtle, used sparingly for differentiation)
        feature: {
          learn: '#2563EB',
          place: '#7C3AED',
          college: '#059669',
          crash: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'stat': ['2.25rem', { lineHeight: '1', fontWeight: '700' }],
        'label': ['0.6875rem', { lineHeight: '1', fontWeight: '500', letterSpacing: '0.05em' }],
      },
      borderRadius: {
        'card': '0.75rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.06)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.08)',
        'card-hover-dark': '0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        'elevated': '0 8px 24px rgba(0,0,0,0.12)',
        'elevated-dark': '0 8px 24px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
