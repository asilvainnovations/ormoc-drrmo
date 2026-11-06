// Renders a step's form from its snapshot schema (ADR-016). Values stay as typed until Done; the check is
// formProblems(), the mirror of app.form_problems, and the server checks again on save.
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui';
import { fieldValue } from '@/domain/forms';
import { fmtDateTime } from '@/lib/time';
import type { FormField, FormSchema, FormValue, FormValues } from '@/types';

const PRIVACY = 'Institutional records and counts only. No names of affected persons, evacuees, patients or informants.';

export function StepForm({ schema, value, onChange, hide = [] }: {
  schema: FormSchema; value: FormValues; onChange: (v: FormValues) => void; hide?: string[];
}) {
  const set = (f: FormField, raw: string | boolean | string[]) => onChange({ ...value, [f.key]: fieldValue(f, raw) });
  return (
    <div className="space-y-3">
      {schema.fields.filter((f) => !hide.includes(f.key)).map((f) => <FieldInput key={f.key} f={f} v={value[f.key] ?? null} set={(raw) => set(f, raw)} />)}
      <p className="text-xs text-muted">{PRIVACY}</p>
    </div>
  );
}

function FieldInput({ f, v, set }: { f: FormField; v: FormValue; set: (raw: string | boolean | string[]) => void }) {
  const optional = !f.required;
  const str = v === null || v === undefined ? '' : String(v);
  switch (f.type) {
    case 'checkbox':
      return <Checkbox tip={f.hint ?? f.label} checked={v === true} onChange={() => set(v !== true)}>{f.label}{optional ? ' (optional)' : ''}</Checkbox>;
    case 'multiselect': {
      const chosen = Array.isArray(v) ? v : [];
      return (
        <fieldset className="space-y-2">
          <legend className="font-semibold">{f.label}{optional && <span className="font-normal text-muted"> (optional)</span>}</legend>
          {f.hint && <p className="text-sm text-muted">{f.hint}</p>}
          <div className="flex flex-wrap gap-2">
            {(f.options ?? []).map((o) => (
              <Checkbox key={o} tip={`Tick if ${o} applies`} checked={chosen.includes(o)}
                onChange={() => set(chosen.includes(o) ? chosen.filter((x) => x !== o) : [...chosen, o])}>{o}</Checkbox>
            ))}
          </div>
        </fieldset>
      );
    }
    default:
      return (
        <Field label={f.label} optional={optional} hint={f.hint}>
          {(id, d) => {
            if (f.type === 'textarea') return <Textarea id={id} aria-describedby={d} rows={2} maxLength={f.max_length ?? 4000} value={str} onChange={(e) => set(e.target.value)} />;
            if (f.type === 'select') return (
              <Select id={id} aria-describedby={d} value={str} onChange={(e) => set(e.target.value)}>
                <option value="">Choose…</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            );
            const type = f.type === 'number' || f.type === 'integer' ? 'number' : f.type === 'datetime' ? 'datetime-local' : f.type === 'text' ? 'text' : f.type;
            return <Input id={id} aria-describedby={d} type={type} value={str} inputMode={f.type === 'integer' ? 'numeric' : f.type === 'number' ? 'decimal' : undefined}
              min={f.min} step={f.type === 'integer' ? 1 : f.type === 'number' ? 'any' : undefined} maxLength={f.type === 'text' ? f.max_length ?? 4000 : undefined}
              onChange={(e) => set(e.target.value)} />;
          }}
        </Field>
      );
  }
}

/** The filled form, read-only, for a closed step or the run record. */
export function FormRecord({ schema, value }: { schema: FormSchema; value: FormValues }) {
  const rows = schema.fields.filter((f) => value[f.key] !== undefined && value[f.key] !== null);
  if (rows.length === 0) return null;
  const show = (f: FormField, v: FormValue) =>
    Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : f.type === 'datetime' && typeof v === 'string' ? fmtDateTime(`${v}:00+08:00`) : String(v);
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-control bg-sunken px-3 py-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
      {rows.map((f) => <div key={f.key} className="contents"><dt className="text-muted">{f.label}</dt><dd className="font-data">{show(f, value[f.key]!)}</dd></div>)}
    </dl>
  );
}
