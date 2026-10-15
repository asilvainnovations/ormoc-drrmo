import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileUp, Plus, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { save, saveMany, queueUpload, evidenceFileUrl } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/time';
import { Badge, Button, ChoiceGroup, Field, Input, KeyValue, List, ListRow, Loading, Notice, PageHeader, Section, Select, Textarea, TextLink } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { EVIDENCE_CAP, EVIDENCE_LABEL, SCORE_LEVELS, complianceStatus, gapPriorityScore, priorityBand, scoreBlockReason } from '@/domain/scoring';
import type { Evidence, EvidenceKind, EvidenceStrength, Response } from '@/types';
import { useCycleData, isEditable } from './data';
import { tip } from '@/components/Tooltip';
import { RefText } from '@/components/RefText';
import { VaultForIndicator } from '@/features/vault/VaultPages';
import { EVIDENCE_KIND, RESPONSE_STATUS } from './labels';

const VERBAL_KINDS: EvidenceKind[] = ['interview', 'fgd'];

function newResponse(cycleId: string, indicatorId: string): Response & { _new: true } {
  return { _new: true, id: uuid(), cycle_id: cycleId, indicator_id: indicatorId, score: null, is_na: false, na_justification: null,
    gap_remarks: null, recommended_action: null, status: 'draft', version: 1 };
}

export function IndicatorPage() {
  const { cycleId, indicatorId: rawId } = useParams();
  const indicatorId = decodeURIComponent(rawId ?? '');
  const data = useCycleData(cycleId);
  const { has, profile } = useAuth();
  const toast = useToast();
  // Open the tab inside the click so pop-up blockers allow it, then point it at the file.
  const openFile = async (e: Evidence) => {
    const tab = window.open('', '_blank');
    try { const url = await evidenceFileUrl(e.id, e.storage_path!); if (tab) tab.location.href = url; else window.location.assign(url); }
    catch (err) { tab?.close(); toast((err as Error).message, 'bad'); }
  };
  const links = useLiveQuery(async () => ({
    mrs: await db.indicator_requirements.where('indicator_id').equals(indicatorId).toArray(),
    docs: await Promise.all((await db.moo_document_indicators.where('indicator_id').equals(indicatorId).toArray()).map((l) => db.moo_documents.get(l.document_id))),
    leads: await db.indicator_lead_offices.where('indicator_id').equals(indicatorId).toArray(),
  }), [indicatorId]);

  const ind = data?.indicators.find((i) => i.id === indicatorId);
  const domain = data?.domains.find((d) => d.code === ind?.domain);
  const resp = data?.byIndicator.get(indicatorId);
  const evidence = useMemo(() => (resp ? data?.evByResp.get(resp.id) ?? [] : []), [resp, data]);
  const cap = data?.capOf(resp?.id) ?? 0;

  const [score, setScore] = useState<number | 'NA' | null>(null);
  const [naWhy, setNaWhy] = useState('');
  const [gap, setGap] = useState('');
  const [action, setAction] = useState('');
  const [evOpen, setEvOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScore(resp ? (resp.is_na ? 'NA' : resp.score) : null);
    setNaWhy(resp?.na_justification ?? ''); setGap(resp?.gap_remarks ?? ''); setAction(resp?.recommended_action ?? '');
  }, [resp?.id, resp?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !ind || !domain) return <Loading />;

  const isC = domain.part === 'C';
  const myOfficeLeads = links?.leads.some((l) => l.office_id === profile?.office_id);
  const canAnswer = has('assessor', 'validator', 'cdrrmo_head') || (isC && has('lead_office_focal') && myOfficeLeads);
  const locked = resp?.status === 'validated' && !has('validator', 'cdrrmo_head');
  const editable = isEditable(data.cycle.status) && canAnswer && !locked;
  const blocked = typeof score === 'number' ? scoreBlockReason(score, cap) : null;
  const gps = typeof score === 'number' ? gapPriorityScore(score, ind.weight, ind.type, domain.part) : null;

  const persist = async (status?: Response['status']) => {
    setError(null);
    if (blocked) { setError(blocked); return; }
    if (score === 'NA' && !naWhy.trim()) { setError('Write why this indicator does not apply to Ormoc.'); return; }
    if (status === 'validated' && score === null) { setError('Score the indicator or mark it not applicable before validating.'); return; }
    setBusy(true);
    const base = resp ?? newResponse(data.cycle.id, ind.id);
    const next: Response = { ...base, score: typeof score === 'number' ? score : null, is_na: score === 'NA', na_justification: score === 'NA' ? naWhy.trim() : null,
      gap_remarks: gap.trim() || null, recommended_action: action.trim() || null, status: status ?? (base.status === 'validated' ? 'provisional' : base.status) };
    await save('responses', next, `${status === 'validated' ? 'Validate' : 'Score'} ${ind.id}`);
    setBusy(false);
    toast(status === 'validated' ? `${ind.id} validated` : status === 'provisional' ? `${ind.id} submitted for validation` : `${ind.id} saved`);
  };

  const scoreOptions = [
    ...SCORE_LEVELS.map((l) => {
      const reason = scoreBlockReason(l.score, cap);
      return { value: l.score as number | 'NA', label: `${l.score} ${l.label}`, detail: l.text, disabled: !editable || Boolean(reason), disabledReason: reason ?? undefined };
    }),
    { value: 'NA' as const, label: 'Not applicable', detail: 'Does not apply to Ormoc. Needs a written reason.', disabled: !editable },
  ];

  return (
    <div className="page">
      <PageHeader title={ind.id} back={`/assess/${data.cycle.id}/d/${domain.code}`}
        subtitle={<span className="flex flex-wrap gap-1.5">
          <Badge>{isC ? 'Interface' : ind.type === 'M' ? 'Mandatory' : 'Good practice'}</Badge><Badge>Weight {ind.weight}</Badge>
          {resp && <Badge tone={resp.status === 'validated' ? 'ok' : 'neutral'}>{RESPONSE_STATUS[resp.status]}</Badge>}
          {ind.tags.map((t) => <Badge key={t} tone="info">{t}</Badge>)}
        </span>} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div>
          <p className="mb-4 max-w-prose text-lg leading-7">{ind.statement}</p>
          <KeyValue items={[
            ['Standard or reference', <RefText key="ref" text={ind.reference} />], ['Means of verification', ind.means_of_verification],
            ['Methods', ind.methods], [isC ? 'Lead office' : 'Feeds manual chapter', isC ? ind.lead_office : ind.moo_chapter],
          ]} />

          <Section title="Evidence" className="mt-8" action={editable && <Button tip="Record a document, observation, test or interview that supports the score" variant="secondary" icon={Plus} onClick={() => setEvOpen(true)}>Add evidence</Button>}>
            <p className="mb-3 text-sm text-muted">The score cannot exceed what the strongest evidence supports. Interviews alone cap it at 2.</p>
            {evidence.length === 0 ? <p className="text-muted">No evidence recorded. Add the document, observation or interview that supports the score.</p> : (
              <List>
                {evidence.map((e) => (
                  <ListRow tip={e.storage_path ? 'Open the attached file' : undefined} key={e.id} title={e.title} onClick={e.storage_path ? () => openFile(e) : undefined}
                    meta={`${EVIDENCE_KIND[e.kind]}${e.doc_date ? `, dated ${fmtDate(e.doc_date)}` : ''}${e.source ? `, from ${e.source}` : ''}${e.storage_path ? '. Open the attached file' : ''}`}
                    trailing={<Badge tone={EVIDENCE_CAP[e.strength] >= 3 ? 'ok' : 'neutral'}>Supports up to {EVIDENCE_CAP[e.strength]}</Badge>} />
                ))}
              </List>
            )}
          </Section>

          <VaultForIndicator indicatorId={ind.id} />

          <Section title="Score">
            {!canAnswer && <Notice tone="info">{isC ? `Scored by the lead office (${ind.lead_office}) or the assessment team.` : 'Only the assessment team scores this indicator.'}</Notice>}
            {locked && <Notice tone="info" title="Validated">Ask a validator to reopen this score if it needs to change.</Notice>}
            {!isEditable(data.cycle.status) && <Notice tone="info">This cycle is {data.cycle.status}. Scores are read-only.</Notice>}
            <ChoiceGroup legend="Maturity level" value={score} onChange={setScore} options={scoreOptions}
              hint={`Evidence so far supports up to ${cap}.`} />
            {score === 'NA' && (
              <div className="mt-4"><Field label="Why it does not apply">{(id) => <Textarea id={id} value={naWhy} onChange={(e) => setNaWhy(e.target.value)} disabled={!editable} />}</Field></div>
            )}
            <div className="mt-4 space-y-4">
              <Field label="Gap or remarks" optional>{(id) => <Textarea id={id} value={gap} onChange={(e) => setGap(e.target.value)} disabled={!editable} />}</Field>
              <Field label="Recommended action" optional hint={`Routes to ${ind.moo_chapter ?? 'the manual'}.`}>{(id, d) => <Textarea id={id} aria-describedby={d} value={action} onChange={(e) => setAction(e.target.value)} disabled={!editable} />}</Field>
            </div>
            {error && <p role="alert" className="mt-3 font-semibold text-bad">{error}</p>}
            {editable && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button tip="Save your score and notes as a draft" busy={busy} onClick={() => persist()}>Save</Button>
                {has('assessor', 'lead_office_focal') && resp?.status !== 'validated' && <Button tip="Send this score to a validator to check against the evidence" variant="secondary" onClick={() => persist('provisional')}>Submit for validation</Button>}
                {has('validator', 'cdrrmo_head') && <Button tip="Confirm this score. Validated scores are locked" variant="secondary" icon={ShieldCheck} onClick={() => persist('validated')}>Validate</Button>}
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-control border border-line bg-surface p-4">
            <p className="text-sm text-muted">Result if saved</p>
            <p className="mt-1 text-xl font-bold">{typeof score === 'number' ? `${priorityBand(gps)} priority` : score === 'NA' ? 'Not applicable' : 'Not scored'}</p>
            <p className="text-sm text-muted">{typeof score === 'number'
              ? `Gap priority ${gps} = (4 − ${score}) × weight ${ind.weight}${ind.type === 'M' && !isC ? ' × 1.5' : ''}. ${complianceStatus({ score, is_na: false }, ind.type, domain.part)}.`
              : 'Choose a level to see the gap priority.'}</p>
          </div>
          <div>
            <h2 className="mb-2 font-bold">Traceability</h2>
            <p className="text-sm text-muted">Master requirements</p>
            <p className="mb-3 flex flex-wrap gap-1.5 pt-1">{links?.mrs.map((m) => <Link key={m.mr_id} to={`/library/requirements#${m.mr_id}`} {...tip(`Open master requirement ${m.mr_id}`)}><Badge>{m.mr_id}</Badge></Link>)}</p>
            <p className="text-sm text-muted">Manual sections that must answer this gap</p>
            <ul className="mt-1 space-y-1">{links?.docs.filter(Boolean).map((d) => (
              <li key={d!.id}><TextLink tip="Open the manual section this indicator feeds" to={`/library/doc/${d!.id}`}>{d!.code} {d!.title}</TextLink></li>
            ))}</ul>
          </div>
        </aside>
      </div>

      <EvidenceSheet open={evOpen} onClose={() => setEvOpen(false)} cycleId={data.cycle.id} indicatorId={ind.id} existing={resp} />
    </div>
  );
}

function EvidenceSheet({ open, onClose, cycleId, indicatorId, existing }: { open: boolean; onClose: () => void; cycleId: string; indicatorId: string; existing?: Response }) {
  const toast = useToast();
  const [kind, setKind] = useState<EvidenceKind>('document');
  const [strength, setStrength] = useState<EvidenceStrength>('approved_in_use');
  const [title, setTitle] = useState('');
  const [docDate, setDocDate] = useState('');
  const [source, setSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const verbal = VERBAL_KINDS.includes(kind);

  useEffect(() => { if (verbal) setStrength('verbal'); }, [verbal]);

  const add = async () => {
    setBusy(true);
    const resp = existing ?? newResponse(cycleId, indicatorId);
    const evId = uuid();
    const path = file ? `${cycleId}/${resp.id}/${evId}-${file.name.replace(/[^\w.-]+/g, '_')}` : null;
    const ev: Evidence & { _new: true } = { _new: true, id: evId, response_id: resp.id, kind, strength: verbal ? 'verbal' : strength, title: title.trim(),
      doc_date: docDate || null, source: source.trim() || null, storage_path: path, note: null, version: 1 };
    // Order matters: the response must exist before its evidence and file.
    if (!existing) await saveMany([{ table: 'responses', row: resp, label: `Open ${indicatorId}` }]);
    if (file && path) await queueUpload(file, path, evId);
    await save('evidence', ev, `Evidence for ${indicatorId}: ${ev.title}`);
    setBusy(false); setTitle(''); setDocDate(''); setSource(''); setFile(null); onClose();
    toast('Evidence added');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add evidence"
      footer={<><Button tip="Close without adding" variant="secondary" onClick={onClose}>Cancel</Button><Button tip="Add this evidence. The score cap updates at once" busy={busy} disabled={!title.trim()} onClick={add}>Add evidence</Button></>}>
      <Field label="Type of evidence">{(id) => (
        <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)}>
          {Object.entries(EVIDENCE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>)}
      </Field>
      {!verbal && (
        <ChoiceGroup legend="What it shows" value={strength} onChange={setStrength}
          options={(Object.keys(EVIDENCE_LABEL) as EvidenceStrength[]).filter((s) => s !== 'verbal').map((s) => ({ value: s, label: EVIDENCE_LABEL[s], detail: `Supports a score up to ${EVIDENCE_CAP[s]}` }))} />
      )}
      {verbal && <Notice tone="info">Interviews and focus groups support a score of 2 at most.</Notice>}
      <Field label="Title" hint="For example: EO No. 12 s. 2024 creating the CDRRMO; or KII with the Operations chief.">{(id, d) => <Input id={id} aria-describedby={d} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      <Field label="Document date" optional>{(id) => <Input id={id} type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />}</Field>
      <Field label="Source office or position" optional hint="Never the name of an informant.">{(id, d) => <Input id={id} aria-describedby={d} value={source} onChange={(e) => setSource(e.target.value)} />}</Field>
      <Field label="File" optional hint="PDF, Word, Excel or photo up to 15 MB. Kept on this device until it uploads.">{(id, d) => (
        <label htmlFor={id} className="flex min-h-tap cursor-pointer items-center gap-2 rounded-control border border-dashed border-line px-3 py-2 text-sm">
          <FileUp className="h-5 w-5" aria-hidden />{file ? file.name : 'Choose a file or take a photo'}
          <input id={id} aria-describedby={d} type="file" className="sr-only" accept=".pdf,.docx,.xlsx,image/*"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f && f.size > 15 * 1024 * 1024) { toast('That file is over 15 MB.', 'bad'); return; } setFile(f); }} />
        </label>)}
      </Field>
    </Sheet>
  );
}
