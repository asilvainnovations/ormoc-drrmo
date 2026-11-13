// "Save run record" / "File as evidence" for the readiness tools (1.21.0, ADR-037): after a run,
// the assessment team saves a server-side training record (positions and counts only) and can
// file it as evidence for B7.2–B7.4 or B2.7. Both are authority actions — online only (ADR-006).
// Filing never changes a score; it adds the evidence the assessor asked for.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { Badge, Button, ChoiceGroup, Notice } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { useToast } from '@/components/Toast';
import { EVIDENCE_LABEL } from '@/domain/scoring';
import type { EvidenceStrength, TrainingRun, TrainingTool } from '@/types';
import { EVIDENCE_INDICATORS, fileAsEvidence, saveRunRecord, type RunCounts } from './runActions';

export function RunFiling({ tool, title, runAt, summary, counts }: {
  tool: TrainingTool; title: string; runAt: string; summary: string; counts: RunCounts;
}) {
  const { has } = useAuth();
  const online = useOnline();
  const toast = useToast();
  const [run, setRun] = useState<TrainingRun | null>(null);
  const [indicator, setIndicator] = useState<string>(EVIDENCE_INDICATORS[0]);
  const [strength, setStrength] = useState<EvidenceStrength>('approved_in_use');
  const [busy, setBusy] = useState(false);
  const canFile = has('assessor', 'validator', 'cdrrmo_head');
  if (!canFile) return null;   // an authority action: hidden for everyone else (RLS refuses the rest)

  const err = (e: unknown) => toast(e instanceof Error ? e.message : 'Not saved.', 'bad');
  const saveRun = async () => {
    setBusy(true);
    try { setRun(await saveRunRecord({ tool, title, run_at: runAt, summary, counts })); toast('Run record saved. It can now be filed as evidence.'); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const file = async () => {
    if (!run) return;
    setBusy(true);
    try { const cycle = await fileAsEvidence(run, indicator, strength); setRun({ ...run, filed_evidence: true, filed_to_indicator: indicator }); toast(`Filed as evidence for ${indicator} in "${cycle}". The score itself is unchanged.`); }
    catch (e) { err(e); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-control border border-line bg-sky-soft/40 p-3">
      <p className="text-sm font-semibold">Keep this run on record</p>
      <p className="mb-2 mt-0.5 text-sm text-muted">
        The tool keeps its history in this browser. A run record is kept on the server as training
        evidence — positions and counts only, never names. It supports the IAT score; it never sets one.
      </p>
      {!run ? (
        <Button variant="secondary" icon={Save} busy={busy} disabled={!online} onClick={saveRun}
          tip="Save this run as a server-side training record (assessment team; needs a connection)">
          Save run record
        </Button>
      ) : run.filed_evidence ? (
        <Notice tone="ok" title="Filed as evidence">
          <span className="inline-flex items-center gap-1"><FileCheck className="h-4 w-4" aria-hidden /> Filed for {run.filed_to_indicator}.</span>
          {' '}See it on the <Link to="/assess" {...tip('Open the institutional assessment')} className="font-semibold text-info underline">Assess indicator page</Link>. The score stays with the assessors.
        </Notice>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm"><Badge tone="ok">Record saved</Badge> File it as evidence for an indicator:</p>
          <ChoiceGroup legend="Indicator" value={indicator} onChange={setIndicator} columns={2}
            options={EVIDENCE_INDICATORS.map((i) => ({ value: i, label: i }))} />
          <ChoiceGroup legend="What the record shows" value={strength} onChange={setStrength}
            options={(Object.keys(EVIDENCE_LABEL) as EvidenceStrength[]).filter((s) => s !== 'verbal').map((s) => ({ value: s, label: EVIDENCE_LABEL[s] }))} />
          <Button variant="secondary" icon={FileCheck} busy={busy} disabled={!online} onClick={file}
            tip="Add this run record to the indicator's evidence (needs a connection). It does not change the score">
            File as evidence
          </Button>
        </div>
      )}
    </div>
  );
}
