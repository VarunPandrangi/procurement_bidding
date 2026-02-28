/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          subtle: 'var(--bg-subtle)',
          overlay: 'var(--bg-overlay)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        blue: {
          DEFAULT: 'var(--blue)',
          hover: 'var(--blue-hover)',
          light: 'var(--blue-light)',
        },
        green: {
          DEFAULT: 'var(--green)',
          light: 'var(--green-light)',
        },
        yellow: {
          DEFAULT: 'var(--yellow)',
          light: 'var(--yellow-light)',
        },
        red: {
          DEFAULT: 'var(--red)',
          light: 'var(--red-light)',
        },
        orange: {
          DEFAULT: 'var(--orange)',
        },
        grey: {
          100: 'var(--grey-100)',
          200: 'var(--grey-200)',
          300: 'var(--grey-300)',
          400: 'var(--grey-400)',
          500: 'var(--grey-500)',
          600: 'var(--grey-600)',
          700: 'var(--grey-700)',
          800: 'var(--grey-800)',
          900: 'var(--grey-900)',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        full: '999px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        modal: '0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.10)',
        dropdown: '0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        focus: '0 0 0 3px rgba(0,113,227,0.30)',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.2', fontWeight: '400' }],
        sm: ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        base: ['15px', { lineHeight: '1.5', fontWeight: '400', letterSpacing: '0' }],
        md: ['17px', { lineHeight: '1.4', fontWeight: '500' }],
        lg: ['20px', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.02em' }],
        xl: ['24px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        '2xl': ['28px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        '3xl': ['34px', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
