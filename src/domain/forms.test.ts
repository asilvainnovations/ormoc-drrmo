import { describe, expect, it } from 'vitest';
import { compactForm, fieldValue, formProblems } from './forms';
import type { FormSchema } from '@/types';

// The expected messages were checked against app.form_problems on Postgres 16 (see forms.cases.json).
import cases from './forms.cases.json';

const schema: FormSchema = { fields: [
  { key: 'outcome', label: 'Outcome', type: 'select', required: true, options: ['Done as written', 'Done with changes'] },
  { key: 'count', label: 'Count', type: 'integer', required: true, min: 0 },
  { key: 'channels', label: 'Channels', type: 'multiselect', options: ['SMS', 'Radio'] },
  { key: 'when', label: 'When', type: 'datetime' },
  { key: 'ack', label: 'Accepted', type: 'checkbox', required: true },
  { key: 'remarks', label: 'Remarks', type: 'textarea', max_length: 5 },
] };

describe('formProblems mirrors app.form_problems', () => {
  for (const c of cases as { name: string; data: unknown; expected: string | null }[]) {
    it(c.name, () => expect(formProblems(schema, c.data)).toBe(c.expected));
  }
  it('a step with no form has nothing to check', () => expect(formProblems(null, { x: 1 })).toBeNull());
});

describe('fieldValue', () => {
  const n = schema.fields[1]!;
  it('keeps a blank count blank, never 0', () => expect(fieldValue(n, '')).toBeNull());
  it('reads a number', () => expect(fieldValue(n, '12')).toBe(12));
  it('keeps unreadable text so the check names the field', () => expect(fieldValue(n, 'abc')).toBe('abc'));
  it('reads a checkbox', () => expect(fieldValue(schema.fields[4]!, true)).toBe(true));
});

describe('compactForm', () => {
  it('drops blanks', () => expect(compactForm({ a: null, b: '', c: [], d: false, e: 0, f: 'x' })).toEqual({ e: 0, f: 'x' }));
});
