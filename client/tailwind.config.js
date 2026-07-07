/*
 * AI maintenance note: Keep all code comments in English.
 */
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
        md: {
          bg: 'rgb(var(--md-bg) / <alpha-value>)',
          surface: 'rgb(var(--md-surface) / <alpha-value>)',
          surfaceVariant: 'rgb(var(--md-surface-variant) / <alpha-value>)',
          surfaceContainer: 'rgb(var(--md-surface-container) / <alpha-value>)',
          surfaceContainerHigh: 'rgb(var(--md-surface-container-high) / <alpha-value>)',
          primary: 'rgb(var(--md-primary) / <alpha-value>)',
          onPrimary: 'rgb(var(--md-on-primary) / <alpha-value>)',
          primaryContainer: 'rgb(var(--md-primary-container) / <alpha-value>)',
          onPrimaryContainer: 'rgb(var(--md-on-primary-container) / <alpha-value>)',
          secondary: 'rgb(var(--md-secondary) / <alpha-value>)',
          secondaryContainer: 'rgb(var(--md-secondary-container) / <alpha-value>)',
          onSecondaryContainer: 'rgb(var(--md-on-secondary-container) / <alpha-value>)',
          outline: 'rgb(var(--md-outline) / <alpha-value>)',
          success: 'rgb(var(--md-success) / <alpha-value>)',
          successContainer: 'rgb(var(--md-success-container) / <alpha-value>)',
          warning: 'rgb(var(--md-warning) / <alpha-value>)',
          warningContainer: 'rgb(var(--md-warning-container) / <alpha-value>)',
          error: 'rgb(var(--md-error) / <alpha-value>)',
          errorContainer: 'rgb(var(--md-error-container) / <alpha-value>)',
          terminal: 'rgb(var(--md-terminal) / <alpha-value>)',
          themeIcon: 'rgb(var(--md-theme-icon) / <alpha-value>)',
          onThemeIcon: 'rgb(var(--md-on-theme-icon) / <alpha-value>)',
        },
        mc: {
          green: '#55FF55',
          red: '#FF5555',
          gold: '#FFAA00',
          aqua: '#55FFFF',
          dark: '#1a1a2e',
          darker: '#0f0f23',
          panel: '#16213e',
          border: '#1e3a5f',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
