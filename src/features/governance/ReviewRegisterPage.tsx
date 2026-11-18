// Validation register (1.24.0): searchable table with a detail panel. Reads Dexie; closing an item is an online action.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { EmptyState, Loading } from '@/components/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { GovernancePriority, ManualReviewItem, ReviewStatus } from '@/types';
import { Pill, WorkspaceHead, type PillTone } from './kit';
import { GOVERNANCE_CAVEAT, PRIORITY, REVIEW_STATUS, VALIDATION_STATUS } from './labels';

const PRIORITY_TONE: Record<GovernancePriority, PillTone> = { critical_urgent: 'red', important: 'orange', standard: 'grey' };
const STATUS_TONE: Record<ReviewStatus, PillTone> = { open: 'blue', in_review: 'blue', pending_evidence: 'orange', pending_decision: 'orange', closed: 'green', deferred: 'grey' };
const select = 'min-h-tap min-w-[9rem] flex-1 rounded-control border border-line bg-surface px-3 text-sm text-ink';

export function ReviewRegisterPage() {
  const items = useLiveQuery(() => db.manual_review_items.orderBy('source_tracker_id').toArray(), []);
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ReviewStatus | 'all'>('all');
  const [priority, setPriority] = useState<GovernancePriority | 'all'>('all');
  const [chapter, setChapter] = useState(params.get('chapter') ?? 'all');
  const [open, setOpen] = useState<ManualReviewItem | null>(null);

  const chapters = useMemo(() => [...new Set((items ?? []).map((i) => i.chapter_ref ?? 'No chapter'))].sort(), [items]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((r) =>
      (status === 'all' || r.review_status === status) && (priority === 'all' || r.priority === priority) &&
      (chapter === 'all' || (r.chapter_ref ?? 'No chapter') === chapter) &&
      (!needle || [r.source_tracker_id, r.title, r.description, r.required_action, r.lead_office, r.closure_test, r.source_used].filter(Boolean).join(' ').toLowerCase().includes(needle)));
  }, [items, q, status, priority, chapter]);

  if (!items) return <Loading />;
  return (
    <div>
      <WorkspaceHead eyebrow={`${items.length} consolidated items · baseline`} title="Validation register" subtitle="One accountable lead per row. Status is never presumed validated."
        aside={<Pill tone="blue">{rows.length} shown</Pill>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the register" placeholder="Search ID, issue, action, source, owner…" className="min-h-tap min-w-[12rem] flex-[2] rounded-control border border-line bg-surface px-3 text-sm text-ink" />
        <select aria-label="Chapter" className={select} value={chapter} onChange={(e) => setChapter(e.target.value)}><option value="all">All chapters</option>{chapters.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Priority" className={select} value={priority} onChange={(e) => setPriority(e.target.value as GovernancePriority | 'all')}><option value="all">All priorities</option>{(Object.keys(PRIORITY) as GovernancePriority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}</select>
        <select aria-label="Status" className={select} value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus | 'all')}><option value="all">All statuses</option>{(Object.keys(REVIEW_STATUS) as ReviewStatus[]).map((s) => <option key={s} value={s}>{REVIEW_STATUS[s]}</option>)}</select>
      </div>
      {rows.length === 0 ? <EmptyState title="No review items match" body={items.length === 0 ? 'The Validation Tracker arrives with the next reference-data sync.' : 'Clear the search or the filters.'} /> : (
        <div className="overflow-hidden rounded-sheet border border-line bg-surface shadow-raised">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <thead><tr className="bg-sunken/60 text-[10px] uppercase tracking-wider text-muted">{['Item / issue', 'Chapter', 'Lead', 'Priority', 'Status', 'Workshop'].map((h) => <th key={h} scope="col" className="px-3 py-3 font-bold">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top hover:bg-sky-soft/40">
                    <td className="px-3 py-3"><button type="button" onClick={() => setOpen(r)} className="min-h-tap text-left"><span className="font-data text-xs text-muted">{r.source_tracker_id}</span><strong className="block text-ink underline-offset-4 hover:underline">{r.title}</strong></button></td>
                    <td className="px-3 py-3 text-muted">{r.chapter_ref ?? '—'}</td>
                    <td className="px-3 py-3 text-muted">{r.lead_office ?? '—'}</td>
                    <td className="px-3 py-3"><Pill tone={PRIORITY_TONE[r.priority]}>{PRIORITY[r.priority].label}</Pill></td>
                    <td className="px-3 py-3"><Pill tone={STATUS_TONE[r.review_status]}>{REVIEW_STATUS[r.review_status]}</Pill></td>
                    <td className="px-3 py-3 text-muted">{r.workshop_slot ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">{GOVERNANCE_CAVEAT}</p>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {open && <>
            <DialogHeader>
              <p className="font-data text-xs text-muted">{open.source_tracker_id}</p>
              <DialogTitle className="text-xl font-extrabold">{open.title}</DialogTitle>
              <DialogDescription className="flex flex-wrap gap-2 pt-1"><Pill tone={PRIORITY_TONE[open.priority]}>{PRIORITY[open.priority].label}</Pill><Pill tone={STATUS_TONE[open.review_status]}>{REVIEW_STATUS[open.review_status]}</Pill><Pill>{VALIDATION_STATUS[open.validation_status]}</Pill></DialogDescription>
            </DialogHeader>
            <dl className="space-y-3 text-sm">
              {([['Issue', open.description], ['Required action', open.required_action], ['Closure test', open.closure_test], ['Chapter and section', [open.chapter_ref, open.section_ref].filter(Boolean).join(', ')], ['Lead', [open.lead_office, open.lead_position].filter(Boolean).join(', ')], ['Source', [open.source_register, open.source_used].filter(Boolean).join(' · ')], ['Workshop', open.workshop_slot], ['Notes', open.notes]] as const).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="border-t border-line pt-3"><dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted">{k}</dt><dd className="mt-1 leading-relaxed text-ink">{v}</dd></div>
              ))}
            </dl>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
