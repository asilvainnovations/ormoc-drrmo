// Printable validation sheets (1.15.0): one domain per page, each indicator with its submitted score, evidence and
// gap, and boxes for the validator's decision. For sessions where not everyone has a device; decisions are then
// entered in the app by a validator (the sheet is the working record, the app is the official one).
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Button, Field, Loading, PageHeader, Select } from '@/components/ui';
import { EVIDENCE_CAP } from '@/domain/scoring';
import { useCycleData } from './data';
import { EVIDENCE_CHECK, EVIDENCE_KIND, RESPONSE_STATUS } from './labels';

const Box = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-4 w-4 border border-ink" aria-hidden />{label}</span>
);

export function ValidationSheets() {
  const { cycleId } = useParams();
  const data = useCycleData(cycleId);
  const [which, setWhich] = useState<string>('A1');
  const domains = useMemo(() => (data ? (which === 'all' ? data.domains : data.domains.filter((d) => d.code === which)) : []), [data, which]);
  if (data === undefined) return <Loading />;
  if (data === null) return <div className="page"><PageHeader title="Cycle not found" back="/assess" /></div>;

  return (
    <div className="page">
      <div className="print:hidden">
        <PageHeader title="Validation Sheets" back={`/assess/${data.cycle.id}/validate`}
          subtitle="Print one domain per sheet. Validators mark the boxes during the session; a validator then records each decision in the app." />
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="w-72"><Field label="Domain" tip="Print one domain, or all of them">{(id) => (
            <Select id={id} value={which} onChange={(e) => setWhich(e.target.value)}>
              {data.domains.map((d) => <option key={d.code} value={d.code}>{d.code} {d.name}</option>)}
              <option value="all">All domains (long)</option>
            </Select>)}</Field></div>
          <Button tip="Print these sheets or save them as PDF" icon={Printer} onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {domains.map((d) => {
        const inds = data.indicators.filter((i) => i.domain === d.code);
        return (
          <section key={d.code} className="mb-10 break-after-page text-[0.9rem] print:text-[10pt]" aria-label={`Validation sheet ${d.code}`}>
            <header className="mb-3 border-b-2 border-ink pb-2">
              <p className="text-xs uppercase tracking-wide text-muted">Ormoc City CDRRMO and EOC · Institutional Assessment Tool · Validation sheet</p>
              <h2 className="text-lg font-bold">{d.code} {d.name}</h2>
              <p className="text-xs">{data.cycle.name} · Session date ____________ · Facilitator ____________________ · Validators ______________________________</p>
            </header>
            {inds.map((i) => {
              const r = data.byIndicator.get(i.id);
              const ev = r ? data.evByResp.get(r.id) ?? [] : [];
              return (
                <article key={i.id} className="mb-2 break-inside-avoid border border-line px-2.5 py-2">
                  <p><span className="font-data font-bold">{i.id}</span> <span className="text-muted">({i.type === 'M' ? 'Mandatory' : 'Good practice'}, weight {i.weight})</span> {i.statement}</p>
                  <p className="mt-1"><strong>Submitted score:</strong> {r ? (r.is_na ? 'NA' : r.score ?? 'not scored') : 'not scored'}
                    {r && <> · {RESPONSE_STATUS[r.status]} · evidence check: {EVIDENCE_CHECK[r.evidence_check ?? 'pending']}</>}</p>
                  {ev.length > 0 && (
                    <ul className="mt-1 list-disc pl-5">
                      {ev.map((e) => <li key={e.id}>{EVIDENCE_KIND[e.kind]}: {e.title}{e.doc_date ? ` (${e.doc_date})` : ''} — supports up to {EVIDENCE_CAP[e.strength]}</li>)}
                    </ul>
                  )}
                  {r?.gap_remarks && <p className="mt-1"><strong>Gap:</strong> {r.gap_remarks}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Box label="Confirm" /><span className="inline-flex items-center gap-1.5"><Box label="Revise to" /><span className="inline-block w-8 border-b border-ink" aria-hidden /></span>
                    <span className="ml-2 font-semibold">Evidence:</span><Box label="Verified" /><Box label="Partly" /><Box label="Unverified" /><Box label="Missing" />
                  </div>
                  <p className="mt-2 flex items-end gap-2"><span className="shrink-0">Reason / evidence to obtain:</span><span className="flex-1 border-b border-ink" aria-hidden />
                    <span className="shrink-0">Initials</span><span className="w-16 border-b border-ink" aria-hidden /></p>
                </article>
              );
            })}
            <footer className="mt-4 text-xs">Validated by (name and signature) __________________________ Date ____________ · Scores stay provisional until a validator records the decision in MODE.</footer>
          </section>
        );
      })}
    </div>
  );
}
