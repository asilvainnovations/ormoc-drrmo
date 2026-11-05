/**
 * The platform's name (5 Nov 2026). Use these everywhere a person sees the name, so the
 * screens, the installed app and the emails agree. index.html, vite.config.ts (manifest) and
 * supabase/email/*.html cannot import this file: keep them in step by hand.
 *
 * The on-device database keeps its old internal name ('ormoc-drrm-ops', src/lib/db.ts):
 * renaming it would strand every phone's offline records and unsent changes.
 */
export const PRODUCT = {
  /** The short name, as people say it. */
  short: 'MODE',
  /** What the letters stand for. */
  expansion: 'Manual of Operations for the DRRMO and EOC',
  /** The formal name, as on the City banner. */
  full: 'Ormoc City DRRMO & EOC Manual of Operations Development Platform',
} as const;
