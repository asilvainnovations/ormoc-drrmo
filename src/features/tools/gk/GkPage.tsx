import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Printer, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Notice, PageHeader, Section, Textarea } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { download, loadTool, saveTool } from '../storage';
import { GK_CRITERIA, GK_RATING, gkResult, suggestFromIat, type GkScores } from './gk';

interface GkDraft { scores: GkScores; notes: Record<string, string>; savedAt: string | null }
const EMPTY: GkDraft = { scores: {}, notes: {}, savedAt: null };

/** Gawad KALASAG Seal (LDRRMCO category) readiness self-check, with suggestions from the IAT cycle. */
export function GkPage() {
  const { userId } = useAuth();
  const [draft, setDraft] = useState<GkDraft>(() => loadTool(userId, 'gk-draft', EMPTY));
  const update = (d: GkDraft) => { const next = { ...d, savedAt: new Date().toISOString() }; setDraft(next); saveTool(userId, 'gk-draft', next); };
  const result = useMemo(() => gkResult(draft.scores), [draft.scores]);

  // Latest assessment cycle on this device, to suggest ratings from IAT scores.
  const iat = useLiveQuery(async () => {
    const cycles = (await db.assessment_cycles.toArray()).filter((c) => c.status !== 'archived').sort((a, b) => b.cycle_year - a.cycle_year || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const cycle = cycles[0];
    if (!cycle) return null;
    const rows = await db.responses.where('cycle_id').equals(cycle.id).toArray();
    return { cycle, byInd: new Map(rows.map((r) => [r.indicator_id, r.is_na ? null : r.score])) };
  }, []);

  const suggestion = (iatIds: string[]) => (iat ? suggestFromIat(iatIds.map((i) => iat.byInd.get(i))) : null);
  const fillFromIat = () => {
    if (!iat) return;
    const scores = { ...draft.scores };
    for (const c of GK_CRITERIA) for (const i of c.indicators) if (scores[i.id] == null) scores[i.id] = suggestion(i.iat);
    update({ ...draft, scores });
  };

  return (
    <div className="page">
      <PageHeader title="Gawad KALASAG Seal readiness" back="/tools"
        subtitle="Self-check for the Seal for Local DRRM Councils and Offices: six criteria, indicators rated 0 to 3, weighted mean and adjectival rating." />
      <Notice tone="warn" title="For preparation only">
        The six criteria, their weights (Structure 25%, Competency 35%, Management Systems 15%, Enabling Policies 5%, Knowledge Management and Advocacy 10%, Partnership and Participation 10%) and the bands (2.50–3.00 Beyond Compliant, 1.50–2.49 Fully Compliant) follow the published NDRRMC–OCD Seal. The indicator wording is this platform's, not the OCD toolkit. Score the official toolkit for the submission, with its minimum requirements and means of verification.
      </Notice>

      <Section title="Result">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-sm text-muted">Weighted mean</p>
            <p className="font-data text-4xl font-bold">{result.mean === null ? '—' : result.mean.toFixed(2)}</p>
          </div>
          {result.band && <Badge tone={result.band === 'Beyond Compliant' ? 'ok' : result.band === 'Fully Compliant' ? 'info' : 'bad'}>{result.band}</Badge>}
          {!result.complete && <span className="text-sm text-muted">Not all indicators rated yet; the mean covers rated ones only.</span>}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.perCriterion.map((c) => (
            <div key={c.id} className="rounded-control border border-line bg-surface p-3">
              <div className="flex justify-between"><span className="font-semibold">{c.name}</span><span className="text-sm text-muted">{Math.round(c.weight * 100)}%</span></div>
              <p className="font-data text-xl font-bold">{c.mean === null ? '—' : c.mean.toFixed(2)}</p>
              <p className="text-xs text-muted">{c.rated} of {c.total} rated</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <Button onClick={fillFromIat} icon={Wand2} disabled={!iat} tip={iat ? `Fill unrated indicators from "${iat.cycle.name}". IAT 3 becomes 2 and IAT 4 becomes 3; check each one` : 'No assessment cycle on this device yet'}>Suggest from the IAT</Button>
          <Button variant="secondary" onClick={() => window.print()} icon={Printer} tip="Print or save as PDF">Print</Button>
          <Button variant="secondary" onClick={() => download(`GK-Seal-self-check_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ tool: 'Gawad KALASAG Seal readiness, Ormoc DRRM platform', ...draft, result }, null, 2))} icon={Download} tip="Download the ratings and notes">Export</Button>
          <Button variant="secondary" onClick={() => { if (window.confirm('Clear all ratings and notes on this device?')) update(EMPTY); }} tip="Clear every rating and note">Clear</Button>
        </div>
        {iat && <p className="mt-2 text-sm text-muted">Suggestions use "{iat.cycle.name}". Scores still provisional in the IAT stay provisional here.</p>}
      </Section>

      {GK_CRITERIA.map((c) => (
        <Section key={c.id} title={`${c.name} (${Math.round(c.weight * 100)}%)`}>
          <ol className="space-y-4">
            {c.indicators.map((i) => {
              const v = draft.scores[i.id];
              const s = suggestion(i.iat);
              return (
                <li key={i.id} className="rounded-control border border-line bg-surface p-3">
                  <p className="font-semibold"><span className="font-data">{i.id}</span> {i.text}</p>
                  <p className="text-sm text-muted">Means of verification: {i.mov}. IAT: {i.iat.join(', ')}{s !== null ? `. IAT suggests ${s}.` : '.'}</p>
                  <div role="radiogroup" aria-label={`Rating for ${i.id}`} className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
                    {GK_RATING.map((r) => (
                      <button key={r.value} type="button" role="radio" aria-checked={v === r.value} {...tip(r.detail)}
                        onClick={() => update({ ...draft, scores: { ...draft.scores, [i.id]: v === r.value ? null : r.value } })}
                        className={clsx('min-h-tap rounded-control border px-2 text-sm font-semibold', v === r.value ? 'border-action bg-sky-soft ring-1 ring-action' : 'border-line hover:border-sky')}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <Textarea aria-label={`Evidence and notes for ${i.id}`} rows={2} className="mt-2 text-sm" placeholder="Evidence on file, gaps, who to ask"
                    value={draft.notes[i.id] ?? ''} onChange={(e) => update({ ...draft, notes: { ...draft.notes, [i.id]: e.target.value } })} />
                </li>
              );
            })}
          </ol>
        </Section>
      ))}
      <p className="text-sm text-muted">Saved on this device{draft.savedAt ? `, last at ${new Date(draft.savedAt).toLocaleString('en-PH')}` : ''}. Export it to share with the CDRRMO Head.</p>
    </div>
  );
}
