import { useParams } from 'react-router-dom';
import { Download, ListTodo } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { save } from '@/lib/store';
import { Badge, Button, ButtonLink, Loading, Meter, Notice, PageHeader, Section } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { complianceStatus, gapPriorityScore, priorityBand, type ResultRow } from '@/domain/scoring';
import { MaturityChart } from './MaturityChart';
import { useCycleData } from './data';
import { CYCLE_NEXT, CYCLE_NEXT_LABEL, CYCLE_STATUS } from './labels';

function Readout({ label, row, note }: { label: string; row: ResultRow; note?: string }) {
  return (
    <div className="py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold">{row.maturityIndex === null ? '—' : row.maturityIndex.toFixed(2)}
        <span className="ml-2 text-base font-semibold text-muted">{row.band ?? 'Not scored'}</span></p>
      <p className="text-sm text-muted">
        {row.scored} of {row.indicators} scored
        {row.mandatoryCompliance !== null && `. Mandatory met: ${Math.round(row.mandatoryCompliance * 100)}%`}
        {note && `. ${note}`}
      </p>
    </div>
  );
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function CycleOverview() {
  const { cycleId } = useParams();
  const data = useCycleData(cycleId);
  const { has } = useAuth();
  const toast = useToast();
  if (data === undefined) return <Loading />;
  if (data === null) return <div className="page"><PageHeader title="Cycle not found" back="/assess" /></div>;
  const { cycle, domains, results, indicators, byIndicator } = data;
  const next = CYCLE_NEXT[cycle.status];
  const canAdvance = next && (next === 'final' ? has('validator', 'cdrrmo_head') : has('assessor', 'validator', 'cdrrmo_head'));
  const unvalidated = data.responses.filter((r) => r.status !== 'validated' && (r.score !== null || r.is_na)).length;

  const advance = async () => {
    if (!next) return;
    if (next === 'final' && unvalidated > 0) { toast(`${unvalidated} scored indicator(s) are not yet validated.`, 'bad'); return; }
    await save('assessment_cycles', { ...cycle, status: next }, `Move cycle to ${CYCLE_STATUS[next]}`);
    toast(`Cycle moved to ${CYCLE_STATUS[next].toLowerCase()}`);
  };

  const exportCsv = () => {
    const partOf = new Map(domains.map((d) => [d.code, d.part]));
    const head = ['Indicator', 'Part', 'Domain', 'Type', 'Weight', 'Score', 'NA', 'Status', 'Gap priority score', 'Priority', 'Compliance', 'Gap / remarks', 'Recommended action', 'Manual chapter'];
    const lines = indicators.map((i) => {
      const r = byIndicator.get(i.id); const part = partOf.get(i.domain) ?? '';
      const gps = r && !r.is_na ? gapPriorityScore(r.score, i.weight, i.type, part) : null;
      return [i.id, part, i.domain, i.type, i.weight, r?.score ?? '', r?.is_na ? 'NA' : '', r?.status ?? '', gps ?? '', priorityBand(gps) ?? '',
        complianceStatus(r, i.type, part), r?.gap_remarks ?? '', r?.recommended_action ?? '', i.moo_chapter ?? ''].map(csvCell).join(',');
    });
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${cycle.name.replace(/\W+/g, '_')}_results.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const ab = domains.filter((d) => d.part !== 'C');
  const c = domains.filter((d) => d.part === 'C');
  return (
    <div className="page">
      <PageHeader title={cycle.name} back="/assess"
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge>{CYCLE_STATUS[cycle.status]}</Badge>{`${results.answered} of ${results.total} answered`}</span>}
        actions={<>
          <ButtonLink tip="The improvement plan: every gap ranked by priority, with owners and dates" to={`/assess/${cycle.id}/actions`} icon={ListTodo}>Action plan</ButtonLink>
          <Button tip="Download all scores, evidence counts and gaps as a spreadsheet file" variant="secondary" icon={Download} onClick={exportCsv}>Export CSV</Button>
          {canAdvance && <Button tip="Move the cycle to its next stage" onClick={advance}>{CYCLE_NEXT_LABEL[cycle.status]}</Button>}
        </>} />
      <Meter value={results.answered} max={results.total} label="Indicators answered" />
      {cycle.status === 'final' && <Notice tone="ok" title="Final results">This cycle is closed. Open a new cycle for the next annual self-assessment.</Notice>}

      <Section title="Results" className="mt-6">
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 lg:grid-cols-4">
          <Readout label="Institutional Maturity Index (A+B)" row={results.imi} />
          <Readout label="Part A, CDRRMO" row={results.partA} />
          <Readout label="Part B, EOC" row={results.partB} />
          <Readout label="Part C, Interface Index" row={results.interface} note="Reported separately" />
        </div>
        {results.imi.highGaps + results.interface.highGaps > 0 && (
          <p className="mt-2 font-semibold text-bad">{results.imi.highGaps + results.interface.highGaps} high-priority gap(s). Raise mandatory weight-3 gaps with the Mayor and CDRRMC now.</p>
        )}
      </Section>

      <Section title="Parts A and B by domain">
        <MaturityChart domains={ab} results={results.domains} hrefFor={(d) => `/assess/${cycle.id}/d/${d}`}
          caption="Domain Maturity Index, 0 to 4. Lines mark the band edges at 0.5, 1.5, 2.5 and 3.5." />
      </Section>
      <Section title="Part C interface, by domain">
        <p className="mb-3 text-sm text-muted">These are owned by other offices. They form the separate Interface Index and do not change the CDRRMO's maturity index.</p>
        <MaturityChart domains={c} results={results.domains} hrefFor={(d) => `/assess/${cycle.id}/d/${d}`} caption="Interface maturity, 0 to 4." />
      </Section>
    </div>
  );
}
