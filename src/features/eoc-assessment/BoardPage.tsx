// The EOC capability assessment board (ADR-035): the 154-item OCD/NDRRMC checklist grouped by its
// 15 sections, status chips from the mapped IAT B_EOC scores, summary counts, an item drawer for
// evidence / gap / recommended action and tool links, and run validation for the CDRRMO Head.
// Reads come from the local store (ADR-003); edits and validation go online only (ADR-006).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { CheckCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { Badge, Button, ChoiceGroup, EmptyState, Loading, Notice, PageHeader, Select, TextLink } from '@/components/ui';
import type { EocAssessmentSite, EocAssessmentStatus } from '@/types';
import { DERIVATION_NOTE, RUN_STATUS, SITE_LABEL, STATUS, VALIDATE_ROLES, WRITE_ROLES } from './labels';
import { buildBoard, type BoardSection } from './assessment';
import { validateRun } from './actions';
import { ItemSheet, type ItemDraft } from './ItemSheet';

function StatusChip({ status, count }: { status: EocAssessmentStatus; count?: number }) {
  const s = STATUS[status];
  return (
    <span {...tip(s.definition)} className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-data text-[0.8125rem] font-semibold leading-5 tracking-wide', s.chip)}>
      {s.label}{count !== undefined && <span aria-label={`${count} items`}> · {count}</span>}
    </span>
  );
}

function SectionGroup({ sec, open, onToggle, onOpen, runId, site, canAnswer }: {
  sec: BoardSection; open: boolean; onToggle: () => void; onOpen: (d: ItemDraft) => void;
  runId: string; site: EocAssessmentSite; canAnswer: boolean;
}) {
  return (
    <section className="rounded-card border border-line bg-surface">
      <button type="button" onClick={onToggle} aria-expanded={open}
        {...tip(open ? 'Collapse this section' : 'Expand this section')}
        className="flex min-h-tap w-full items-center gap-2 rounded-card px-3 py-2 text-left hover:bg-sky-soft/60">
        {open ? <ChevronDown className="h-5 w-5 shrink-0 text-muted" aria-hidden /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{sec.sort}. {sec.section}</span>
          <span className="block text-sm text-muted">{sec.items.length} items</span>
        </span>
        <span className="hidden flex-wrap justify-end gap-1 sm:flex">
          {(Object.keys(STATUS) as EocAssessmentStatus[]).filter((k) => sec.counts[k] > 0).map((k) => <StatusChip key={k} status={k} count={sec.counts[k]} />)}
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {sec.items.map(({ item, response }) => (
            <li key={item.id}>
              {response || canAnswer ? (
                <button type="button" onClick={() => onOpen({ item, response, runId, site })} {...tip('Open this item: status on site, evidence, gap, recommended action and tool links')}
                  className="flex min-h-[3.25rem] w-full items-start gap-3 px-3 py-3 text-left hover:bg-sky-soft/70">
                  <span className="w-8 shrink-0 pt-0.5 text-right font-data text-sm font-semibold text-muted">{item.item_no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{item.item_text}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {item.iat_links.length > 0 ? `IAT ${item.iat_links.join(', ')}` : 'No IAT counterpart'}
                      {response?.provenance === 'prefilled_iat' && ' · pre-filled from IAT, to confirm'}
                      {response?.state === 'validated' && ' · validated'}
                    </span>
                  </span>
                  <StatusChip status={response?.status ?? 'not_assessed'} />
                </button>
              ) : (
                <div className="flex min-h-[3.25rem] items-start gap-3 px-3 py-3 opacity-70">
                  <span className="w-8 shrink-0 pt-0.5 text-right font-data text-sm font-semibold text-muted">{item.item_no}</span>
                  <span className="min-w-0 flex-1 font-semibold leading-snug">{item.item_text}</span>
                  <Badge tone="neutral">Not answered</Badge>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EocAssessmentBoardPage() {
  const { has } = useAuth();
  const toast = useToast();
  const online = useOnline();
  const [runId, setRunId] = useState<string | null>(null);
  const [site, setSite] = useState<EocAssessmentSite>('primary');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const data = useLiveQuery(async () => {
    const runs = (await db.eoc_assessment_runs.toArray()).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    return {
      runs,
      items: await db.eoc_assessment_items.toArray(),
      responses: await db.eoc_assessment_responses.toArray(),
    };
  }, []);

  const run = useMemo(() => {
    if (!data || data.runs.length === 0) return null;
    return data.runs.find((r) => r.id === runId) ?? data.runs[0]!;
  }, [data, runId]);
  const board = useMemo(() => (data && run ? buildBoard(run, data.items, data.responses, site) : null), [data, run, site]);
  // A run is validated only when no answer (either site) is still pre-filled from the IAT; the SQL guard enforces it.
  const prefilledInRun = useMemo(() => (data && run ? data.responses.filter((r) => r.run_id === run.id && r.provenance === 'prefilled_iat').length : 0), [data, run]);

  if (!data) return <Loading />;
  const canWrite = has(...WRITE_ROLES);
  const canValidate = has(...VALIDATE_ROLES);
  const editable = canWrite && board?.run.status === 'draft';

  const toggle = (section: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });

  const validate = async () => {
    if (!board) return;
    setBusy(true);
    try {
      await validateRun(board.run);
      toast('Run validated. It is now locked for the record.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The run was not validated.');
    } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <PageHeader title="EOC capability assessment" back="/today"
        subtitle="The 154-item EOC Capability Assessment Checklist (OCD/NDRRMC TWG, Dec 2017) in 15 sections, answered from the IAT v1-7 B_EOC evidence."
        actions={board && canValidate && board.run.status === 'draft' ? (
          <Button variant="primary" icon={CheckCheck} busy={busy} disabled={!online || prefilledInRun > 0} onClick={validate}
            tip={prefilledInRun > 0
              ? `${prefilledInRun} answers are still pre-filled from the IAT. Confirm them on site before validating the run`
              : 'Validate this run: locks it and its answers for the record (CDRRMO Head; needs a connection)'}>
            Validate run
          </Button>
        ) : undefined} />

      {board ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span {...tip(RUN_STATUS[board.run.status].definition)} className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', RUN_STATUS[board.run.status].chip)}>
              {RUN_STATUS[board.run.status].label}
            </span>
            {data.runs.length > 1 ? (
              <Select value={board.run.id} onChange={(e) => setRunId(e.target.value)} className="w-auto" aria-label="Choose the assessment run"
                {...tip('Choose which assessment run to view')}>
                {data.runs.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </Select>
            ) : (
              <span className="font-semibold">{board.run.title}</span>
            )}
            <span className="text-sm text-muted">{board.answered} of {board.sections.reduce((n, s) => n + s.items.length, 0)} items answered for the {SITE_LABEL[site].toLowerCase()}:
              {' '}{board.observed} observed · {board.prefilled} pre-filled from the IAT · {board.validated} validated</span>
          </div>
          <div className="mb-4 max-w-xl">
            <ChoiceGroup legend="Site" value={site} onChange={setSite} columns={2}
              options={(['primary', 'alternate'] as EocAssessmentSite[]).map((st) => ({ value: st, label: SITE_LABEL[st],
                tip: st === 'alternate' ? 'The alternate EOC (IAT B2.7). Not assessed until one is designated' : 'The primary EOC at the CDRRM Office' }))} />
          </div>
          <div className="mb-4 flex flex-wrap gap-2" aria-label="Status summary">
            {(Object.keys(STATUS) as EocAssessmentStatus[]).map((k) => <StatusChip key={k} status={k} count={board.counts[k]} />)}
          </div>
          <Notice tone="info">{DERIVATION_NOTE}</Notice>
          {board.run.status === 'validated' && <Notice tone="ok" title="Validated run">This run is locked for the record. Open a new run to reassess.</Notice>}
          {!online && editable && <Notice tone="warn" title="You are offline">Reading works offline; saving evidence, gaps, actions and tool links needs a connection.</Notice>}
          <div className="space-y-3">
            {board.sections.map((sec) => (
              <SectionGroup key={sec.section} sec={sec} open={!collapsed.has(sec.section)} onToggle={() => toggle(sec.section)} onOpen={setDraft}
                runId={board.run.id} site={site} canAnswer={!!editable} />
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            Risk picture: <TextLink to="/eoc/risk" tip="Open the DDRiVE risk dashboard">DDRiVE Risk</TextLink> stays the risk-intelligence source; this board links out and never re-scores.
            The scores behind these statuses live in <TextLink to="/assess" tip="Open the institutional assessment">Assess</TextLink> (IAT B_EOC), and who maintains what is on the{' '}
            <TextLink to="/raci" tip="Open the RACI board">RACI board</TextLink>.
          </p>
        </>
      ) : (
        <EmptyState title="No capability assessment run yet"
          body="The baseline run (IAT v1-7, Oct 2026) arrives with reference-data sync. Ask the CDRRMO Head to run the reference-data loader."
          action={<Link to="/today" {...tip('Back to Today')} className="font-semibold text-info underline">Back to Today</Link>} />
      )}

      <ItemSheet draft={draft} canEdit={!!editable} canValidate={canValidate && board?.run.status === 'draft'} onClose={() => setDraft(null)} />
    </div>
  );
}
