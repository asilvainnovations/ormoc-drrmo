// The interactive RACI board (ADR-033): search the Manual's RACI matrices (Annex 1-F and
// Chapters 1-10) and the manual document-governance matrix, see who is Responsible / Accountable / Consulted / Informed
// colour-coded, and — for the CDRRMO Head — adjust assignments online.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ListChecks, Pencil, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { tip } from '@/components/Tooltip';
import { Badge, EmptyState, Input, Loading, Notice, PageHeader, Section, TextLink } from '@/components/ui';
import type { RaciAssignment } from '@/types';
import { DUTIES, DUTY_ORDER, RACI_CAVEAT } from './labels';
import { buildBoard, searchBoard, type BoardActivity } from './raci';
import { EditAssignmentSheet, type AssignmentDraft } from './EditAssignmentSheet';

function Chip({ row, onEdit }: { row: RaciAssignment; onEdit?: () => void }) {
  const d = DUTIES[row.duty];
  const body = (
    <>
      <span className="font-bold">{row.actor}</span>
      {row.qualifier && <span className="block text-xs font-normal opacity-90">({row.qualifier})</span>}
    </>
  );
  const cls = `inline-flex min-h-tap flex-col justify-center rounded-control px-3 py-1.5 text-left text-sm ${d.chip}`;
  const label = `${d.label} — ${d.definition}`;
  return onEdit ? (
    <button type="button" onClick={onEdit} {...tip(`${label}. Change or remove (needs a connection)`)} className={cls}>
      {body}
      <Pencil className="mt-0.5 h-3 w-3 opacity-70" aria-hidden />
    </button>
  ) : (
    <span {...tip(label)} className={cls}>{body}</span>
  );
}

function ActivityRow({ item, canEdit, onEdit }: { item: BoardActivity; canEdit: boolean; onEdit: (d: AssignmentDraft) => void }) {
  return (
    <article className="rounded-card border border-line bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{item.activity.activity}</h3>
          {item.activity.note && <p className="mt-0.5 text-sm text-muted">{item.activity.note}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {item.template && (
              <Link to={`/drrm/${item.template.kind === 'workflow' ? '' : 'protocols'}`}
                {...tip('Open this protocol or workflow in the DRRM module')}
                className="inline-flex items-center gap-1 rounded-control bg-sky-soft px-2 py-0.5 text-xs font-semibold text-ink hover:border-sky">
                <ListChecks className="h-3.5 w-3.5" aria-hidden /> {item.template.code}
              </Link>
            )}
            {item.activity.sop_ref && <Badge tone="neutral">{item.activity.sop_ref}</Badge>}
            {item.accountableCount !== 1 && (
              <span {...tip('The Manual expects normally one Accountable per activity; check this assignment')}
                className="inline-flex items-center gap-1 rounded-control bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {item.accountableCount === 0 ? 'No Accountable' : `${item.accountableCount} Accountable`}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <button type="button" {...tip('Add a duty assignment to this activity (needs a connection)')}
            onClick={() => onEdit({ activity_id: item.activity.id, activityLabel: item.activity.activity })}
            className="inline-flex min-h-tap items-center gap-1 rounded-control border border-line px-2 text-sm font-semibold hover:border-sky hover:bg-sky-soft">
            <Plus className="h-4 w-4" aria-hidden /> Add
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {DUTY_ORDER.map((duty) => (
          <div key={duty} className="rounded-control bg-sunken/60 p-2">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{duty} · {DUTIES[duty].label}</p>
            <div className="flex flex-wrap gap-1.5">
              {item.byDuty[duty].length === 0 && <span className="text-xs text-muted">—</span>}
              {item.byDuty[duty].map((row) => (
                <Chip key={row.id} row={row}
                  onEdit={canEdit ? () => onEdit({ activity_id: item.activity.id, activityLabel: item.activity.activity, row }) : undefined} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function RaciboardPage() {
  const { has } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? params.get('template') ?? '';
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const canEdit = has('cdrrmo_head', 'admin');

  const data = useLiveQuery(async () => buildBoard(
    await db.raci_matrices.toArray(),
    await db.raci_activities.toArray(),
    await db.raci_assignments.toArray(),
    await db.protocol_templates.toArray(),
  ), []);
  const board = useMemo(() => searchBoard(data ?? [], q), [data, q]);

  if (!data) return <Loading />;
  return (
    <div className="page">
      <PageHeader title="RACI board" back="/today"
        subtitle="Who is Responsible, Accountable, Consulted and Informed — from the Manual’s RACI matrices (Annex 1-F and Chapters 1-10) and the manual review cycle." />
      <div className="mb-4 max-w-xl">
        <Input type="search" value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          placeholder="Search an activity, protocol code, office or role…" aria-label="Search the RACI board" {...tip('Type an activity, a protocol code like PR-PDRA, or an office')} />
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {DUTY_ORDER.map((d) => (
          <span key={d} {...tip(DUTIES[d].definition)} className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-bold ${DUTIES[d].chip}`}>
            {d} — {DUTIES[d].label}
          </span>
        ))}
      </div>
      <Notice tone="info">{RACI_CAVEAT}</Notice>
      {board.length === 0 && (
        <EmptyState title="No matching RACI entries" body="Try a protocol code (e.g. PR-PDRA), an activity (e.g. convene), or an office." />
      )}
      {board.map(({ matrix, activities }) => (
        <Section key={matrix.id} title={`${matrix.code} · ${matrix.title}`} className="mt-6">
          <p className="mb-3 text-sm text-muted">Source: {matrix.source_ref}.</p>
          <div className="space-y-3">
            {activities.map((a) => <ActivityRow key={a.activity.id} item={a} canEdit={canEdit} onEdit={setDraft} />)}
          </div>
        </Section>
      ))}
      <p className="mt-6 text-sm text-muted">
        Reviewing a manual document? See <TextLink to="/library" tip="Open the Library">the Library</TextLink> — each document shows its review and approval RACI.
      </p>
      <EditAssignmentSheet draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}
