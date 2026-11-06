// Step forms (ADR-016). Mirrors app.form_problems(schema, data) in
// supabase/migrations/20261106001700_step_forms.sql: same checks, same order, same words.
// The server is the authority; this copy only lets the screen say what is missing before saving.
import type { FormField, FormSchema, FormValue, FormValues } from '@/types';

const isEmpty = (f: FormField, v: unknown): boolean =>
  v === undefined || v === null
  || (typeof v === 'string' && v.trim() === '')
  || (Array.isArray(v) && v.length === 0)
  || (f.type === 'checkbox' && v === false);

const chars = (s: string) => [...s].length;   // Postgres length() counts characters, not UTF-16 units

function badValue(f: FormField, v: unknown): boolean {
  const t = f.type;
  const opts = f.options ?? [];
  if (['text', 'textarea', 'select', 'date', 'datetime', 'time'].includes(t) && typeof v !== 'string') return true;
  if ((t === 'number' || t === 'integer') && (typeof v !== 'number' || !Number.isFinite(v))) return true;
  if (t === 'integer' && !Number.isInteger(v)) return true;
  if (t === 'checkbox' && typeof v !== 'boolean') return true;
  if (t === 'multiselect' && !Array.isArray(v)) return true;
  if (typeof v === 'string') {
    if (t === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return true;
    if (t === 'time' && !/^\d{2}:\d{2}$/.test(v)) return true;
    if (t === 'datetime' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return true;
    if (t === 'select' && !opts.includes(v)) return true;
    if ((t === 'text' || t === 'textarea') && chars(v) > (f.max_length ?? 4000)) return true;
  }
  if (t === 'multiselect' && Array.isArray(v) && v.some((x) => typeof x !== 'string' || !opts.includes(x))) return true;
  if ((t === 'number' || t === 'integer') && typeof v === 'number' && f.min !== undefined && f.min !== null && v < f.min) return true;
  return false;
}

/** What is still missing or wrong, in the user's words; null when the form is complete. */
export function formProblems(schema: FormSchema | null | undefined, data: unknown): string | null {
  if (!schema) return null;
  const d = data ?? {};
  if (typeof d !== 'object' || Array.isArray(d)) return 'The form data is not valid';
  const values = d as Record<string, unknown>;
  const missing: string[] = [];
  const bad: string[] = [];
  const known = new Set<string>();
  for (const f of schema.fields) {
    known.add(f.key);
    const v = values[f.key];
    if (isEmpty(f, v)) { if (f.required) missing.push(f.label); continue; }
    if (badValue(f, v)) bad.push(f.label);
  }
  // Postgres jsonb_object_keys returns keys shortest first, then by bytes; match it so the message reads the same.
  const extra = Object.keys(values).filter((k) => !known.has(k))
    .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  if (extra.length) return `The form has fields it does not define: ${extra.join(', ')}`;
  if (missing.length) return `Complete the form first: ${missing.join(', ')}`;
  if (bad.length) return `Check these entries: ${bad.join(', ')}`;
  return null;
}

/** Turn what an input holds into the value the form stores (blank stays null, never 0). */
export function fieldValue(f: FormField, raw: string | boolean | string[]): FormValue {
  if (f.type === 'checkbox') return raw === true;
  if (f.type === 'multiselect') return Array.isArray(raw) ? raw : [];
  const s = typeof raw === 'string' ? raw : '';
  if (f.type === 'number' || f.type === 'integer') {
    if (s.trim() === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : s;   // keep what was typed so the check can name the field
  }
  return s === '' ? null : s;
}

/** Drop blank entries before saving, so the stored record holds only what was filled in. */
export function compactForm(data: FormValues): FormValues {
  return Object.fromEntries(Object.entries(data).filter(([, v]) =>
    v !== null && v !== '' && !(Array.isArray(v) && v.length === 0) && v !== false));
}

/** True when this step only needs the one-tap record (STEP-RECORD). */
export const isQuickRecord = (code: string | null | undefined) => code === 'STEP-RECORD';
