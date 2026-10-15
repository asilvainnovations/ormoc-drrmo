import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { RefText } from '@/components/RefText';
import { Check } from 'lucide-react';
import { save } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { canOperate } from '@/domain/eoc';
import { fmtTime } from '@/lib/time';
import { Badge, Button, Field, Section, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import type { AaAction, AaTiming } from '@/types';
import { TIMING, TIMING_ORDER } from './labels';

export function ChecklistSection({ actions, title = 'Anticipatory actions (IRR Rule IV)' }: { actions: AaAction[]; title?: string }) {
  const { roles } = useAuth();
  const [na, setNa] = useState<AaAction | null>(null);
  const [note, setNote] = useState('');
  const can = canOperate(roles);
  const basis = useLiveQuery(async () => new Map((await db.aa_action_templates.toArray()).map((t) => [t.id, t.irr_ref])), [], new Map<string, string | null>());
  const closed = actions.filter((a) => a.status === 'done' || a.status === 'not_applicable').length;
  const set = (a: AaAction, status: AaAction['status'], n?: string) =>
    save('aa_actions', { ...a, status, note: n ?? a.note, done_at: status === 'done' ? new Date().toISOString() : null }, `AA: ${a.title.slice(0, 40)}`);
  return (
    <Section title={title} action={<Badge tone={closed === actions.length ? 'ok' : 'neutral'}>{closed} of {actions.length} closed</Badge>}>
      {TIMING_ORDER.map((t) => {
        const group = actions.filter((a) => (a.timing as AaTiming) === t);
        if (!group.length) return null;
        return (
          <div key={t} className="mb-5">
            <h3 className="mb-1 font-bold">{TIMING[t]}</h3>
            <ul className="divide-y divide-line">
              {group.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={a.status === 'not_applicable' ? 'text-muted line-through' : 'font-semibold'}>{a.title}</p>
                    <p className="text-sm text-muted">{a.sector}. Lead: {a.lead_office}{a.note ? `. ${a.note}` : ''}</p>
                    {a.template_id && basis.get(a.template_id) && <p className="text-sm text-muted">Basis: <RefText text={basis.get(a.template_id)} context="aa" /></p>}
                  </div>
                  {a.status === 'done' ? <Badge tone="ok"><Check className="h-3 w-3" aria-hidden />Done {fmtTime(a.done_at)}</Badge>
                    : a.status === 'not_applicable' ? <Badge>Not applicable</Badge>
                      : can ? (
                        <span className="flex gap-2">
                          <Button tip="Mark this action as done. Your name and the time are recorded" variant="secondary" onClick={() => set(a, 'done')}>Done</Button>
                          <Button tip="Mark as not applicable here. You will be asked why" variant="quiet" onClick={() => { setNa(a); setNote(''); }}>Not applicable</Button>
                        </span>
                      ) : <Badge>Pending</Badge>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <Sheet open={!!na} onClose={() => setNa(null)} title="Not applicable"
        footer={<><Button tip="Close without changing the action" variant="secondary" onClick={() => setNa(null)}>Cancel</Button><Button tip="Save as not applicable with the reason given" disabled={!note.trim()} onClick={async () => { await set(na!, 'not_applicable', note.trim()); setNa(null); }}>Save</Button></>}>
        <p className="text-sm">{na?.title}</p>
        <Field label="Reason">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </Sheet>
    </Section>
  );
}
