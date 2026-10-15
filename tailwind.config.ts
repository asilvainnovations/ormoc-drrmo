import type { Config } from 'tailwindcss';

// Colours come from CSS custom properties (src/styles/tokens.css) so light and
// dark themes share one set of names. Alert colours are reserved for the EOC
// activation level and are never used for decoration.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        paper: v('paper'), surface: v('surface'), sunken: v('sunken'),
        ink: v('ink'), muted: v('muted'), line: v('line'),
        action: v('action'), 'on-action': v('on-action'), sky: v('sky'), 'sky-soft': v('sky-soft'),
        accent: v('accent'), 'accent-bright': v('accent-bright'), 'accent-ink': v('accent-ink'), 'on-strong': v('on-strong'), 'on-level': v('on-level'), scrim: v('scrim'),
        focus: v('focus'),
        ok: v('ok'), warn: v('warn'), bad: v('bad'), info: v('info'),
        'ok-soft': v('ok-soft'), 'warn-soft': v('warn-soft'), 'bad-soft': v('bad-soft'), 'info-soft': v('info-soft'),
        lvl: { white: v('lvl-white'), 'white-ink': v('lvl-white-ink'), blue: v('lvl-blue'), red: v('lvl-red') },
        banner: '#022A4D',   // edge colour of the City banner artwork (letterbox behind it)
        mat: { 0: v('mat-0'), 1: v('mat-1'), 2: v('mat-2'), 3: v('mat-3'), 4: v('mat-4') },
      },
      fontFamily: {
        // Poppins for reading and controls, Montserrat for headings, Roboto Condensed for
        // compact data (status band, badges, times, figures).
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['"Montserrat Variable"', 'Montserrat', 'system-ui', 'sans-serif'],
        data: ['"Roboto Condensed Variable"', '"Roboto Condensed"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // modular scale 1.2 on a 16px base
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.1875rem', { lineHeight: '1.625rem' }],
        xl: ['1.4375rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.125rem' }],
        '3xl': ['2.0625rem', { lineHeight: '2.375rem' }],
      },
      borderRadius: { control: '0.5rem', sheet: '1rem' },
      spacing: { tap: '2.75rem', 'safe-b': 'env(safe-area-inset-bottom)' },
      maxWidth: { prose: '68ch', page: '72rem' },
      boxShadow: { sheet: '0 -8px 24px rgb(0 0 0 / 0.18)', raised: '0 1px 2px rgb(0 0 0 / 0.08), 0 2px 8px rgb(0 0 0 / 0.06)' },
    },
  },
  plugins: [],
} satisfies Config;
