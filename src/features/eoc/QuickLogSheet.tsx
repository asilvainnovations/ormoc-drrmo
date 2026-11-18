// New logbook entry as a short form (1.24.0). Pick what happened, tap the chips, type little; the entry is written in a fixed
// shape. Each template remembers what you chose last time on this device. "Other note" keeps the free-text box.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { ArrowLeft, ClipboardList, Megaphone, MessageSquareText, PackageSearch, RadioTower, Scale, Siren, Truck, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { LOG_TEMPLATES, missingFields, renderLog, type LogTemplate } from '@/domain/logTemplates';
import { addLog } from './actions';

const ICON: Record<string, typeof Siren> = { warning: Siren, decision: Scale, advisory: Megaphone, barangay: Users, request: PackageSearch, resource: Truck, status: RadioTower, situation: ClipboardList, handover: Users };
const memKey = (id: string) => `logtpl:${id}`;
const recall = (id: string): Record<string, string> => { try { return JSON.parse(localStorage.getItem(memKey(id)) ?? '{}'); } catch { return {}; } };
const remember = (id: string, v: Record<string, string>) => { try { localStorage.setItem(memKey(id), JSON.stringify(v)); } catch { /* private mode: skip */ } };

export function QuickLogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId } = useAuth();
  const toast = useToast();
  const barangays = useLiveQuery(() => db.barangays.orderBy('name').toArray(), [], []);
  const [tpl, setTpl] = useState<LogTemplate | 'note' | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  useEffect(() => { if (!open) { setTpl(null); setVals({}); setNote(''); } }, [open]);

  const pick = (t: LogTemplate | 'note') => { setTpl(t); setVals(t === 'note' ? {} : recall(t.id)); };
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const missing = tpl && tpl !== 'note' ? missingFields(tpl, vals) : [];
  const text = tpl === 'note' ? note.trim() : tpl ? renderLog(tpl, vals) : '';
  const ready = tpl === 'note' ? note.trim().length > 0 : !!tpl && missing.length === 0;

  const save = async () => {
    if (!tpl || !ready) return;
    await addLog(text, tpl === 'note' ? 'general' : tpl.category, userId);
    if (tpl !== 'note') remember(tpl.id, vals);
    toast('Logged');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={tpl ? (tpl === 'note' ? 'Other note' : tpl.label) : 'What happened?'}
      footer={tpl ? <>
        <Button tip="Go back to the list" variant="secondary" icon={ArrowLeft} onClick={() => setTpl(null)}>Back</Button>
        <Button tip="Add this to the logbook. The time is recorded automatically" disabled={!ready} onClick={save}>Log it</Button>
      </> : undefined}>
      {!tpl ? (
        <div className="grid grid-cols-2 gap-2">
          {LOG_TEMPLATES.map((t) => {
            const Icon = ICON[t.id] ?? ClipboardList;
            return (
              <button key={t.id} type="button" onClick={() => pick(t)} className="flex min-h-[5rem] flex-col items-start justify-between rounded-sheet border border-line bg-surface p-3 text-left hover:border-sky hover:bg-sky-soft/50">
                <Icon className="h-5 w-5 text-sky" aria-hidden /><span><span className="block text-sm font-bold text-ink">{t.label}</span><span className="block text-xs text-muted">{t.hint}</span></span>
              </button>
            );
          })}
          <button type="button" onClick={() => pick('note')} className="col-span-2 flex min-h-tap items-center gap-2 rounded-sheet border border-dashed border-line p-3 text-sm font-semibold text-muted hover:border-sky hover:text-ink">
            <MessageSquareText className="h-5 w-5" aria-hidden />Other note, in your own words
          </button>
        </div>
      ) : tpl === 'note' ? (
        <Field label="Note" hint="Time is recorded automatically. No names of affected persons.">{(id, d) => <Textarea id={id} aria-describedby={d} rows={5} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      ) : (
        <div className="space-y-4">
          {tpl.fields.map((f) => (
            <div key={f.key}>
              <p className="mb-1.5 text-sm font-bold text-ink">{f.label}{!f.required && <span className="ml-1 text-xs font-normal text-muted">optional</span>}</p>
              {f.kind === 'chips' && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={f.label}>
                  {f.options!.map((o) => (
                    <button key={o} type="button" aria-pressed={vals[f.key] === o} onClick={() => set(f.key, vals[f.key] === o ? '' : o)}
                      className={clsx('min-h-tap rounded-full border px-4 text-sm font-semibold', vals[f.key] === o ? 'border-sky bg-sky text-on-strong' : 'border-line bg-surface text-ink hover:border-sky')}>{o}</button>
                  ))}
                </div>
              )}
              {f.kind === 'barangay' && (
                <Field label={f.label}>{(id) => <Select id={id} value={vals[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}><option value="">Choose a barangay</option>{barangays.map((b) => <option key={b.psgc} value={b.name}>{b.name}</option>)}</Select>}</Field>
              )}
              {(f.kind === 'text' || f.kind === 'number' || f.kind === 'time') && (
                <Input aria-label={f.label} type={f.kind === 'number' ? 'number' : f.kind === 'time' ? 'time' : 'text'} inputMode={f.kind === 'number' ? 'numeric' : undefined} min={f.kind === 'number' ? 0 : undefined}
                  placeholder={f.placeholder} value={vals[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </div>
          ))}
          <div className="rounded-control bg-sunken p-3 text-sm" aria-live="polite">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Will be logged as</p>
            <p className="mt-1 text-ink">{missing.length ? <span className="text-muted">Still needed: {missing.map((m) => m.label.toLowerCase()).join(', ')}.</span> : text}</p>
          </div>
        </div>
      )}
    </Sheet>
  );
}
