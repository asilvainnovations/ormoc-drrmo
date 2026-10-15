import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/time';
import { Badge, Button, EmptyState, Field, Input, List, ListRow, Loading, PageHeader, Section, Select, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { gapPriorityScore, priorityBand } from '@/domain/scoring';
import type { Action } from '@/types';
import { tip } from '@/components/Tooltip';
import { useCycleData, isEditable } from './data';

const STATUS: Record<Action['status'], string> = { not_started: 'Not started', ongoing: 'Ongoing', done: 'Done', dropped: 'Dropped' };

export function ActionPlanPage() {
  const { cycleId } = useParams();
  const data = useCycleData(cycleId);
  const { has } = useAuth();
  const toast = useToast();
  const actions = useLiveQuery(() => (cycleId ? db.actions.where('cycle_id').equals(cycleId).toArray() : []), [cycleId], []);
  const offices = useLiveQuery(() => db.offices.orderBy('code').toArray(), [], []);
  const [editing, setEditing] = useState<Action | null>(null);

  const gaps = useMemo(() => {
    if (!data) return [];
    const partOf = new Map(data.domains.map((d) => [d.code, d.part]));
    return data.indicators.map((i) => {
      const r = data.byIndicator.get(i.id);
      const gps = r && !r.is_na ? gapPriorityScore(r.score, i.weight, i.type, partOf.get(i.domain) ?? 'A') : null;
      return { i, r, gps, pr: priorityBand(gps) };
    }).filter((g) => g.pr === 'High' || g.pr === 'Medium').sort((a, b) => (b.gps ?? 0) - (a.gps ?? 0));
  }, [data]);

  if (!data) return <Loading />;
  const canEdit = has('assessor', 'validator', 'cdrrmo_head') && isEditable(data.cycle.status);
  const byInd = new Map<string, Action[]>();
  for (const a of actions) byInd.set(a.indicator_id, [...(byInd.get(a.indicator_id) ?? []), a]);

  const start = (indicatorId: string, text: string | null) => setEditing({ id: uuid(), cycle_id: data.cycle.id, indicator_id: indicatorId, action: text ?? '',
    responsible_office_id: null, responsible_person: null, target_date: null, budget_source: null, status: 'not_started', version: 0 });

  const persist = async () => {
    if (!editing) return;
    const isNew = editing.version === 0;
    await save('actions', isNew ? { ...editing, version: 1, _new: true } : editing, `${isNew ? 'Add' : 'Update'} action for ${editing.indicator_id}`);
    setEditing(null); toast('Action saved');
  };

  return (
    <div className="page">
      <PageHeader title="Improvement action plan" back={`/assess/${data.cycle.id}`}
        subtitle="High and medium gaps, highest priority first. Each action routes to the manual chapter that fixes it." />
      {gaps.length === 0 ? <EmptyState title="No high or medium gaps yet" body="Gaps appear here as indicators are scored." /> : (
        <Section>
          <List>
            {gaps.map(({ i, r, gps, pr }) => (
              <li key={i.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/assess/${data.cycle.id}/i/${encodeURIComponent(i.id)}`} {...tip('Open this indicator to review its evidence and score')} className="font-semibold underline-offset-2 hover:underline">
                      <span className="mr-2 text-muted">{i.id}</span>{i.statement}</Link>
                    <p className="mt-1 flex flex-wrap gap-1.5"><Badge tone={pr === 'High' ? 'bad' : 'warn'}>{pr}, {gps}</Badge><Badge>Score {r?.score}</Badge><Badge>{i.moo_chapter}</Badge></p>
                  </div>
                  {canEdit && <Button tip="Add an improvement action for this gap" variant="secondary" icon={Plus} onClick={() => start(i.id, r?.recommended_action ?? null)}>Action</Button>}
                </div>
                {(byInd.get(i.id) ?? []).length > 0 && (
                  <List className="ml-0 mt-2 border-l-2 border-line pl-3">
                    {byInd.get(i.id)!.map((a) => (
                      <ListRow tip={canEdit ? 'Edit this action: owner, target date and status' : undefined} key={a.id} onClick={canEdit ? () => setEditing(a) : undefined} title={a.action}
                        meta={[offices.find((o) => o.id === a.responsible_office_id)?.code, a.target_date && `by ${fmtDate(a.target_date)}`, a.budget_source].filter(Boolean).join(', ')}
                        trailing={<Badge tone={a.status === 'done' ? 'ok' : 'neutral'}>{STATUS[a.status]}</Badge>} />
                    ))}
                  </List>
                )}
              </li>
            ))}
          </List>
        </Section>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.version === 0 ? 'Add action' : 'Edit action'}
        footer={<><Button tip="Close without saving" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button tip="Save this action" disabled={!editing?.action.trim()} onClick={persist}>Save action</Button></>}>
        {editing && <>
          <Field label="Action">{(id) => <Textarea id={id} value={editing.action} onChange={(e) => setEditing({ ...editing, action: e.target.value })} />}</Field>
          <Field label="Responsible office">{(id) => (
            <Select id={id} value={editing.responsible_office_id ?? ''} onChange={(e) => setEditing({ ...editing, responsible_office_id: e.target.value || null })}>
              <option value="">Choose an office</option>{offices.map((o) => <option key={o.id} value={o.id}>{o.code}: {o.name}</option>)}
            </Select>)}</Field>
          <Field label="Responsible person" optional hint="Position title is enough.">{(id, d) => <Input id={id} aria-describedby={d} value={editing.responsible_person ?? ''} onChange={(e) => setEditing({ ...editing, responsible_person: e.target.value || null })} />}</Field>
          <Field label="Target date" optional>{(id) => <Input id={id} type="date" value={editing.target_date ?? ''} onChange={(e) => setEditing({ ...editing, target_date: e.target.value || null })} />}</Field>
          <Field label="Resources or budget source" optional>{(id) => <Input id={id} value={editing.budget_source ?? ''} onChange={(e) => setEditing({ ...editing, budget_source: e.target.value || null })} />}</Field>
          <Field label="Status">{(id) => (
            <Select id={id} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Action['status'] })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>)}</Field>
        </>}
      </Sheet>
    </div>
  );
}
