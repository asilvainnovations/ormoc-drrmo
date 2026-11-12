import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Colours come from CSS custom properties (src/styles/tokens.css) so light and
// dark themes share one set of names. Alert colours are reserved for the EOC
// activation level and are never used for decoration.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 1.11: the theme follows the device unless the person picks Light or Dark (ThemeProvider sets .light or .dark
  // on <html>). Both the CSS tokens and `dark:` utilities read the same rule.
  darkMode: ['variant', ['@media (prefers-color-scheme: dark) { &:not(.light *) }', '&:is(.dark *)']],
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
        // 1.17 (ADR-031): the four DRRM pillar accents (Library separators only). Kept clear of the EOC alert colours.
        'pillar-prevention': v('pillar-prevention'), 'pillar-prevention-soft': v('pillar-prevention-soft'),
        'pillar-preparedness': v('pillar-preparedness'), 'pillar-preparedness-soft': v('pillar-preparedness-soft'),
        'pillar-response': v('pillar-response'), 'pillar-response-soft': v('pillar-response-soft'),
        'pillar-recovery': v('pillar-recovery'), 'pillar-recovery-soft': v('pillar-recovery-soft'),
        // 1.14: the shadcn/ui kit in src/components/ui/ reads these names. They map onto the MODE tokens so the
        // kit follows the design system (and dark mode) instead of rendering without colour. "accent" is not
        // remapped: in MODE it is the orange active mark, so kit hover fills use sky-soft (see ui/*.tsx).
        primary: { DEFAULT: v('action'), foreground: v('on-action') },
        secondary: { DEFAULT: v('sunken'), foreground: v('ink') },
        background: v('surface'), foreground: v('ink'),
        border: v('line'), input: v('line'), ring: v('focus'),
        card: { DEFAULT: v('surface'), foreground: v('ink') },
        popover: { DEFAULT: v('surface'), foreground: v('ink') },
        destructive: { DEFAULT: v('bad'), foreground: v('on-strong') },
        'muted-foreground': v('muted'),
        sidebar: { DEFAULT: v('surface'), foreground: v('ink'), accent: v('sky-soft'), 'accent-foreground': v('ink'),
          border: v('line'), ring: v('focus'), primary: v('action'), 'primary-foreground': v('on-action') },
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
      borderColor: { DEFAULT: v('line') },
      borderRadius: { control: '0.5rem', sheet: '1rem' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: { 'accordion-down': 'accordion-down 0.2s ease-out', 'accordion-up': 'accordion-up 0.2s ease-out' },
      spacing: { tap: '2.75rem', 'safe-b': 'env(safe-area-inset-bottom)' },
      maxWidth: { prose: '68ch', page: '72rem' },
      boxShadow: { sheet: '0 -8px 24px rgb(0 0 0 / 0.18)', raised: '0 1px 2px rgb(0 0 0 / 0.08), 0 2px 8px rgb(0 0 0 / 0.06)' },
    },
  },
  plugins: [animate],
} satisfies Config;
