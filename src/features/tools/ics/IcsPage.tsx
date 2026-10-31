import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Clock, Download, Lightbulb, Pause, Play, Printer, Radio, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth';
import { Badge, Button, ChoiceGroup, Field, Input, Notice, PageHeader, Section, Select } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import { download, loadTool, saveTool } from '../storage';
import {
  band, difficultyOf, doctrineFor, ICS, metrics, roleOf, scenarioOf, scoreDecision, shuffled, spotlight,
  TIMEOUT_OPTION, VERDICT, type Difficulty, type Option, type Pick, type RunRecord, type Scenario,
} from './engine';

type View = 'home' | 'setup' | 'play' | 'results' | 'learn' | 'quiz';
type Mode = 'single' | 'multi' | 'drill';

const OFFICES = ['CDRRMO Ormoc', 'CDRRMC member office', 'BDRRMC (barangay)', 'BFP', 'PNP', 'Philippine Coast Guard', 'City Health Office', 'CSWDO', 'City Engineering Office', 'Other'];
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const LEVEL_TONE: Record<string, string> = { white: 'bg-lvl-white text-lvl-white-ink', blue: 'bg-lvl-blue text-on-level', red: 'bg-lvl-red text-on-level' };

interface Setup { mode: Mode; participant: string; office: string; facilitator: string; role: string; scenario: string; difficulty: Difficulty['id'] }
interface Live {
  phase: number; order: number[]; chosen: number | null; locked: boolean; intel: boolean; hint: boolean;
  left: number; total: number; elapsed: number; paused: boolean; picks: Pick[]; log: { at: string; who: string; text: string; kind: 'system' | 'decision' | 'intel' | 'alert' }[];
}

/** DDRiVE-M ICS exercise: Philippine ICS doctrine on Ormoc hazards, as drills, tabletops and position drills. */
export function IcsPage() {
  const { userId, profile } = useAuth();
  const [view, setView] = useState<View>('home');
  const [setup, setSetup] = useState<Setup>({ mode: 'single', participant: profile?.full_name ?? '', office: OFFICES[0]!, facilitator: '', role: 'ic', scenario: 'typhoon', difficulty: 'intermediate' });
  const [live, setLive] = useState<Live | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>(() => loadTool<RunRecord[]>(userId, 'ics-runs', []));
  const [last, setLast] = useState<RunRecord | null>(null);

  const scenario: Scenario | undefined = useMemo(() => scenarioOf(setup.mode === 'drill' ? `drill-${setup.role}` : setup.scenario), [setup.mode, setup.role, setup.scenario]);
  const diff = difficultyOf(setup.difficulty);

  const start = () => {
    if (!scenario) return;
    const ph = scenario.phases[0]!;
    const secs = setup.mode === 'multi' ? diff.ttx : diff.limit;
    setLive({ phase: 0, order: shuffled(ph.opts.map((_, i) => i)), chosen: null, locked: false, intel: false, hint: false, left: secs, total: secs, elapsed: 0, paused: false, picks: [],
      log: [{ at: ph.clock, who: 'EOC', kind: 'system', text: `Exercise started. ${setup.mode === 'multi' ? `Team tabletop${setup.facilitator ? `, facilitator ${setup.facilitator}` : ''}.` : `${setup.participant || 'Participant'} as ${roleOf(setup.role).name}.`} Operational period 1: ${ph.name}.` }] });
    setView('play');
  };

  const finish = useCallback((l: Live) => {
    if (!scenario) return;
    const rec: RunRecord = {
      id: crypto.randomUUID(), at: new Date().toISOString(), participant: setup.participant.trim(), office: setup.office,
      facilitator: setup.mode === 'multi' ? setup.facilitator.trim() || undefined : undefined, mode: setup.mode === 'multi' ? 'multi' : 'single',
      role: setup.role, scenario: scenario.id, scenarioName: scenario.name, difficulty: setup.difficulty, seconds: l.elapsed, scores: metrics(l.picks), picks: l.picks,
    };
    const next = [rec, ...runs].slice(0, 30);
    setRuns(next); saveTool(userId, 'ics-runs', next); setLast(rec); setLive(null); setView('results');
  }, [runs, scenario, setup, userId]);

  if (view === 'learn') return <LearnView onBack={() => setView('home')} />;
  if (view === 'quiz') return <QuizView onBack={() => setView('home')} />;
  if (view === 'results' && last) return <Results run={last} onAgain={() => setView('setup')} onHome={() => setView('home')} />;
  if (view === 'play' && live && scenario) return <PlayView scenario={scenario} setup={setup} diff={diff} live={live} setLive={setLive} onFinish={finish} onQuit={() => { setLive(null); setView('home'); }} />;
  if (view === 'setup') return <SetupView setup={setup} setSetup={setSetup} onBack={() => setView('home')} onStart={start} />;

  return (
    <div className="page">
      <PageHeader title="ICS exercise simulator" back="/tools" subtitle="Practise the Philippine Incident Command System on Ormoc hazards. Every decision is scored against national doctrine and explained." />
      <Notice tone="info" title="Training tool">
        Scenario names, figures and events are fictional. The procedures follow the cited laws and guidelines; their official text governs. Validate local procedures against the approved Manual of Operations.
      </Notice>
      <Section title="Choose an exercise">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModeCard title="Individual drill" text="Take one position in the Incident Management Team and run four operational periods, with a timer and feedback after each decision."
            onClick={() => { setSetup({ ...setup, mode: 'single' }); setView('setup'); }} tip="Set up a solo exercise in one ICS position" />
          <ModeCard title="Facilitated tabletop (TTX)" text="For CDRRMC, EOC and BDRRMC drills. The spotlight position rotates every operational period, with discussion prompts and longer timers."
            onClick={() => { setSetup({ ...setup, mode: 'multi' }); setView('setup'); }} tip="Set up a team tabletop exercise with a facilitator" />
          <ModeCard title="Position drills" text="Three quick decisions for one ICS or EOC position: where the Mayor stands, resource requests through the EOC, the 2-hour report, AA tranches and more."
            onClick={() => { setSetup({ ...setup, mode: 'drill' }); setView('setup'); }} tip="Set up a short drill for one position" />
          <ModeCard title="Learn the framework" text="ICS in the Philippines, who leads where, the EOC, harmonized reporting, anticipatory action and Ormoc's risk profile."
            onClick={() => setView('learn')} tip="Open the ICS learning module" />
          <ModeCard title="Quick quiz" text={`${ICS.QUIZ.length} questions on ICS, EOC and anticipatory action, with the reason for each answer.`}
            onClick={() => setView('quiz')} tip="Take the ICS knowledge check" />
        </div>
      </Section>
      <Section title="Your recent exercises">
        {runs.length === 0 ? <p className="text-muted">None yet on this device.</p> : (
          <ul className="divide-y divide-line">
            {runs.slice(0, 8).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="font-semibold">{r.scenarioName}</span> <span className="text-sm text-muted">{r.mode === 'multi' ? 'Tabletop' : roleOf(r.role).abbr}, {new Date(r.at).toLocaleDateString('en-PH')}</span></span>
                <span className="flex items-center gap-2"><Badge tone={r.scores.total >= 70 ? 'ok' : r.scores.total >= 55 ? 'warn' : 'bad'}>{r.scores.total}% {band(r.scores.total)}</Badge>
                  <Button variant="secondary" onClick={() => { setLast(r); setView('results'); }} tip="Open the after-action review of this exercise">AAR</Button></span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-muted">Results are kept on this device only. Print or export the after-action review to keep it as a training record (IAT A2.6, B7.2, B7.3).</p>
      </Section>
      <Section title="Who decides what">
        <dl className="grid gap-3 sm:grid-cols-2">
          {[['City Mayor (Responsible Official)', 'Sets policy and priorities and delegates authority to the Incident Commander.'],
            ['Incident Commander', 'Manages the on-scene response from the Incident Command Post under a delegation of authority.'],
            ['Incident Management Team', 'Command Staff (Safety, PIO, Liaison) and General Staff (Operations, Planning, Logistics, Finance/Admin).'],
            ['EOC / CDRRMO Operations Center', 'The coordination hub: information, resources, links to the CDRRMC, clusters and RDRRMC 8. It coordinates; it does not command on scene.']]
            .map(([k, v]) => <div key={k} className="rounded-control border border-line bg-surface p-3"><dt className="font-semibold">{k}</dt><dd className="text-sm text-muted">{v}</dd></div>)}
        </dl>
      </Section>
    </div>
  );
}

function ModeCard({ title, text, onClick, tip: t }: { title: string; text: string; onClick: () => void; tip: string }) {
  return (
    <button type="button" onClick={onClick} {...tip(t)} className="rounded-sheet border border-line bg-surface p-4 text-left shadow-raised hover:border-action">
      <span className="block text-lg font-bold">{title}</span>
      <span className="mt-1 block text-sm text-muted">{text}</span>
    </button>
  );
}

function SetupView({ setup, setSetup, onBack, onStart }: { setup: Setup; setSetup: (s: Setup) => void; onBack: () => void; onStart: () => void }) {
  const ttx = setup.mode === 'multi';
  const ok = setup.participant.trim().length > 1 && (setup.mode === 'drill' || !!setup.scenario);
  return (
    <div className="page">
      <PageHeader title={ttx ? 'Set up a tabletop' : setup.mode === 'drill' ? 'Set up a position drill' : 'Set up an individual drill'} />
      <button type="button" onClick={onBack} className="mb-4 font-semibold underline" {...tip('Back to the list of exercises')}>Back</button>
      <div className="max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={ttx ? 'Team or group name' : 'Your name'} hint="Shown on the after-action review. Staff names only, never affected persons.">
            {(id, d) => <Input id={id} aria-describedby={d} value={setup.participant} onChange={(e) => setSetup({ ...setup, participant: e.target.value })} />}
          </Field>
          <Field label="Office or agency">
            {(id) => <Select id={id} value={setup.office} onChange={(e) => setSetup({ ...setup, office: e.target.value })}>{OFFICES.map((o) => <option key={o}>{o}</option>)}</Select>}
          </Field>
          {ttx && <Field label="Facilitator" optional>{(id) => <Input id={id} value={setup.facilitator} onChange={(e) => setSetup({ ...setup, facilitator: e.target.value })} />}</Field>}
        </div>
        <ChoiceGroup legend={ttx ? 'Starting spotlight position' : 'Your position'} columns={2} value={setup.role} onChange={(v) => setSetup({ ...setup, role: v })}
          options={ICS.ROLES.map((r) => ({ value: r.id, label: `${r.abbr}: ${r.name}`, detail: r.who }))} />
        {setup.mode !== 'drill' && (
          <ChoiceGroup legend="Scenario" columns={2} value={setup.scenario} onChange={(v) => setSetup({ ...setup, scenario: v })}
            options={ICS.SCENARIOS.map((s) => ({ value: s.id, label: `${s.icon} ${s.name}`, detail: `${s.type}. ${s.blurb}` }))} />
        )}
        <ChoiceGroup legend="Difficulty" columns={3} value={setup.difficulty} onChange={(v) => setSetup({ ...setup, difficulty: v })}
          options={ICS.DIFFICULTY.map((d) => ({ value: d.id, label: d.name, detail: ttx ? `${Math.round(d.ttx / 60)} min per decision for discussion` : d.desc }))} />
        <Button size="lg" disabled={!ok} onClick={onStart} icon={Play} tip={ok ? 'Read the briefing and start the first operational period' : 'Enter a name first'}>Start exercise</Button>
      </div>
    </div>
  );
}

function PlayView({ scenario, setup, diff, live, setLive, onFinish, onQuit }: {
  scenario: Scenario; setup: Setup; diff: Difficulty; live: Live; setLive: (f: (l: Live | null) => Live | null) => void; onFinish: (l: Live) => void; onQuit: () => void;
}) {
  const ph = scenario.phases[live.phase]!;
  const role = spotlight(setup.mode === 'multi' ? 'multi' : 'single', setup.role, live.phase);
  const last = live.picks[live.picks.length - 1];
  const decided = live.locked && last?.phase === live.phase;
  const tickRef = useRef<() => void>();

  const commit = useCallback((timeout: boolean) => {
    setLive((l) => {
      if (!l || l.locked || (!timeout && l.chosen === null)) return l;
      const opt: Option = timeout ? TIMEOUT_OPTION : ph.opts[l.chosen!]!;
      const best = ph.opts.find((o) => o.v === 'best')!;
      const used = l.total - l.left;
      const pick: Pick = {
        phase: l.phase, name: ph.name, clock: ph.clock, choice: opt.t, verdict: opt.v, why: opt.why, best: best.t, bestWhy: best.why,
        scores: scoreDecision(opt, used, l.total, { intel: l.intel, hint: l.hint, expert: diff.id === 'expert' }),
        secs: used, intel: l.intel, hint: l.hint, timeout, role: role.id, refs: doctrineFor(opt.t, opt.why, best.t, best.why, ph.situation.join(' ')),
        fx: opt.fx ? Object.values(opt.fx) : [],
      };
      const log = [...l.log, { at: ph.clock, who: role.abbr, kind: 'decision' as const, text: `${timeout ? 'Time ran out. ' : ''}${opt.t}` },
        ...pick.fx.map((c) => ({ at: ph.clock, who: 'Consequence', kind: 'alert' as const, text: c }))];
      return { ...l, locked: true, picks: [...l.picks, pick], log };
    });
  }, [ph, role, diff.id, setLive]);

  tickRef.current = () => setLive((l) => {
    if (!l || l.paused) return l;
    if (l.locked) return { ...l, elapsed: l.elapsed + 1 };
    return { ...l, elapsed: l.elapsed + 1, left: l.left - 1 };
  });
  useEffect(() => { const t = setInterval(() => tickRef.current?.(), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!live.locked && live.left <= 0) commit(true); }, [live.left, live.locked, commit]);

  const nextPhase = () => {
    const n = live.phase + 1;
    if (n >= scenario.phases.length) { onFinish(live); return; }
    const p = scenario.phases[n]!;
    setLive((l) => l && ({ ...l, phase: n, order: shuffled(p.opts.map((_, i) => i)), chosen: null, locked: false, intel: false, hint: false, left: l.total, log: [...l.log,
      ...(p.eoc !== ph.eoc ? [{ at: p.clock, who: 'EOC', kind: 'alert' as const, text: `Alert level changed to ${p.eoc.toUpperCase()}.` }] : []),
      { at: p.clock, who: 'EOC', kind: 'system' as const, text: `Operational period ${n + 1}: ${p.name}. ${p.warn.t}.` }] }));
  };
  const askIntel = () => setLive((l) => l && !l.intel && !l.locked ? { ...l, intel: true, log: [...l.log, { at: ph.clock, who: 'Intel', kind: 'intel', text: ph.intel }] } : l);
  const askHint = () => setLive((l) => l && !l.hint && !l.locked ? { ...l, hint: true, log: [...l.log, { at: ph.clock, who: 'Hint', kind: 'intel', text: ph.hint }] } : l);
  const report = ICS.STAGE_REPORT[ph.stage];

  return (
    <div className="page">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold">{scenario.icon} {scenario.name}</span>
        <span className={clsx('rounded-full px-2 py-0.5 font-data text-sm font-bold uppercase', LEVEL_TONE[ph.eoc])} {...tip(DOMPurify.sanitize(ICS.ALERT_INFO[ph.eoc] ?? '', { ALLOWED_TAGS: [] }))}>EOC {ph.eoc}</span>
        <Badge tone="warn">{ph.warn.t}</Badge>
        <Badge>{ph.clock}</Badge>
        <span className="ml-auto flex items-center gap-2 font-data text-sm">
          <Clock className="h-4 w-4" aria-hidden />{fmt(live.elapsed)}
          <Button variant="secondary" onClick={() => setLive((l) => l && { ...l, paused: !l.paused })} icon={live.paused ? Play : Pause} tip={live.paused ? 'Resume the clock' : 'Pause the clock (facilitator discussion)'}>{live.paused ? 'Resume' : 'Pause'}</Button>
          <Button variant="secondary" onClick={() => { if (window.confirm('End this exercise without saving?')) onQuit(); }} tip="End the exercise without saving a result">End</Button>
        </span>
      </div>
      <ol className="mb-4 grid grid-cols-4 gap-1" aria-label="Operational periods">
        {scenario.phases.map((p, i) => (
          <li key={i} className={clsx('rounded-control px-2 py-1 text-center text-xs font-semibold', i < live.phase ? 'bg-ok-soft text-ok' : i === live.phase ? 'bg-sky-soft text-ink ring-1 ring-action' : 'bg-sunken text-muted')}>
            OP {i + 1}<span className="hidden sm:inline">: {ICS.STAGES[p.stage]}</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <Section title={`Operational period ${live.phase + 1}: ${ph.name}`}>
            <p className="mb-2 text-sm font-semibold text-muted">{setup.mode === 'multi' ? 'Spotlight' : 'You are'}: {role.abbr}, {role.name}</p>
            {ph.situation.map((t, i) => <p key={i} className="mb-2 max-w-prose leading-7">{t}</p>)}
            {ph.stats && ph.sl && (
              <dl className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['a', 'b', 'c', 'd'] as const).map((k, i) => <div key={k} className="rounded-control bg-sunken p-2"><dt className="text-xs text-muted">{ph.sl![i]}</dt><dd className="font-data text-lg font-bold">{ph.stats![k]}</dd></div>)}
              </dl>
            )}
            {setup.mode === 'multi' && <Notice tone="info" title="Discuss">{ph.discuss}</Notice>}
          </Section>
          <fieldset className="space-y-2" disabled={live.locked}>
            <legend className="mb-1 font-semibold">What do you do?</legend>
            {live.order.map((oi) => {
              const o = ph.opts[oi]!; const chosen = live.chosen === oi;
              const show = decided && (o.v === 'best' || chosen);
              return (
                <label key={oi} className={clsx('flex cursor-pointer items-start gap-3 rounded-control border px-3 py-3',
                  chosen ? 'border-action bg-sky-soft ring-1 ring-action' : 'border-line bg-surface hover:border-sky',
                  decided && !show && 'opacity-50', decided && o.v === 'best' && 'border-ok ring-1 ring-ok')}>
                  <input type="radio" name="ics-opt" className="mt-1 h-4 w-4" checked={chosen} onChange={() => setLive((l) => l && !l.locked ? { ...l, chosen: oi } : l)} />
                  <span className="flex-1">{o.t}{show && <span className="ml-2"><Badge tone={VERDICT[o.v].tone}>{o.v === 'best' ? 'Best' : VERDICT[o.v].label}</Badge></span>}</span>
                </label>
              );
            })}
          </fieldset>
          {!live.locked && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="lg" disabled={live.chosen === null} onClick={() => commit(false)} tip="Commit to this decision">Decide</Button>
              <Button variant="secondary" disabled={live.intel} onClick={askIntel} icon={Radio} tip={`Ask Planning for more information. Costs ${diff.id === 'expert' ? 4 : 2} timeliness points`}>Request intel</Button>
              {diff.hint && <Button variant="secondary" disabled={live.hint} onClick={askHint} icon={Lightbulb} tip="Show a doctrine hint. Costs 3 timeliness points">Hint</Button>}
              <span role="timer" aria-live="off" className={clsx('ml-auto font-data text-lg font-bold', live.left <= 15 && 'text-bad')}>{fmt(Math.max(0, live.left))}</span>
            </div>
          )}
          {decided && last && (
            <div className="mt-4 rounded-sheet border border-line bg-surface p-4 shadow-raised" role="status">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={VERDICT[last.verdict].tone}>{last.timeout ? 'Time expired: ' : ''}{VERDICT[last.verdict].label}</Badge>
                <span className="text-sm text-muted">Decided in {fmt(last.secs)}{last.intel ? ', intel used' : ''}{last.hint ? ', hint used' : ''}</span>
              </div>
              <p className="mt-2 max-w-prose">{last.why}</p>
              {last.verdict !== 'best' && <p className="mt-2 max-w-prose text-sm"><span className="font-semibold">Better: </span>{last.bestWhy}</p>}
              {last.fx.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{last.fx.map((c) => <Badge key={c} tone="bad">{c}</Badge>)}</div>}
              <p className="mt-2 text-sm text-muted">Basis: {last.refs.join('; ')}</p>
              <Button className="mt-3" onClick={nextPhase} tip={live.phase + 1 >= scenario.phases.length ? 'Close the incident and see the after-action review' : 'Move to the next operational period'}>
                {live.phase + 1 >= scenario.phases.length ? 'Close incident and review' : 'Next operational period'}
              </Button>
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <Section title="Position duties">
            <ul className="list-disc space-y-1 pl-5 text-sm">{(ICS.ROLE_TASKS[role.id] ?? role.duties).map((t) => <li key={t}>{t}</li>)}</ul>
          </Section>
          <Section title="Forms this period">
            <ul className="space-y-1 text-sm">
              {ph.forms.map((f) => <li key={f}><span className="font-data font-semibold">ICS {f}</span> {ICS.FORMS[f]}</li>)}
              {report && <li className="pt-1"><span className="font-semibold">{report.r}:</span> harmonized Forms {report.f.join(', ')} ({report.f.map((f) => ICS.HFORMS[f]?.[0]).join('; ')})</li>}
            </ul>
          </Section>
          <Section title="Log">
            <ol className="max-h-80 space-y-2 overflow-y-auto text-sm" aria-live="polite">
              {[...live.log].reverse().map((e, i) => (
                <li key={i} className={clsx(e.kind === 'alert' && 'text-bad', e.kind === 'intel' && 'text-info')}><span className="font-data text-xs text-muted">{e.at} {e.who}</span><br />{e.text}</li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Results({ run, onAgain, onHome }: { run: RunRecord; onAgain: () => void; onHome: () => void }) {
  const exportRun = () => download(`ICS-AAR_${run.scenario}_${(run.participant || 'run').replace(/\W+/g, '-')}_${run.at.slice(0, 10)}.json`,
    JSON.stringify({ tool: 'DDRiVE-M ICS, Ormoc City DRRM platform', ...run }, null, 2));
  return (
    <div className="page">
      <PageHeader title="After-action review" subtitle={`${run.participant || 'Participant'}, ${run.mode === 'multi' ? 'team tabletop' : roleOf(run.role).name}, ${run.scenarioName}, ${difficultyOf(run.difficulty).name}, ${fmt(run.seconds)}`} />
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Button onClick={() => window.print()} icon={Printer} tip="Print or save as PDF for the training record">Print AAR</Button>
        <Button variant="secondary" onClick={exportRun} icon={Download} tip="Download the full record as a JSON file">Export</Button>
        <Button variant="secondary" onClick={onAgain} icon={RotateCcw} tip="Run another exercise">Run again</Button>
        <Button variant="secondary" onClick={onHome} tip="Back to the exercise list">Done</Button>
      </div>
      <Section title={`Overall: ${run.scores.total}%, ${band(run.scores.total)}`}>
        <div className="space-y-3">
          {ICS.RUBRIC.map((c) => {
            const v = run.scores[c.id];
            return (
              <div key={c.id}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{c.name} <span className="font-normal text-muted">({Math.round(c.w * 100)}%)</span></span><span className="font-data">{v}%</span></div>
                <div className="h-2 rounded-full bg-sunken"><div className={clsx('h-2 rounded-full', v >= 70 ? 'bg-ok' : v >= 55 ? 'bg-warn' : 'bg-bad')} style={{ width: `${v}%` }} /></div>
                <p className="text-xs text-muted">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="Decisions">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr className="text-left"><th className="border-b border-line p-2">OP</th><th className="border-b border-line p-2">Decision taken</th><th className="border-b border-line p-2">Rating</th><th className="border-b border-line p-2">What doctrine expects</th><th className="border-b border-line p-2">Basis</th></tr></thead>
            <tbody>
              {run.picks.map((p) => (
                <tr key={p.phase} className="align-top">
                  <td className="border-b border-line p-2"><span className="font-semibold">{p.phase + 1}</span><br /><span className="text-xs text-muted">{p.clock}<br />{p.name}</span></td>
                  <td className="border-b border-line p-2">{p.choice}<div className="text-xs text-muted">{roleOf(p.role).abbr}, {fmt(p.secs)}{p.intel ? ', intel' : ''}{p.hint ? ', hint' : ''}</div></td>
                  <td className="border-b border-line p-2"><Badge tone={VERDICT[p.verdict].tone}>{VERDICT[p.verdict].label}</Badge></td>
                  <td className="border-b border-line p-2">{p.verdict === 'best' ? p.why : p.bestWhy}</td>
                  <td className="border-b border-line p-2 text-xs">{p.refs.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Lessons to carry into the Manual of Operations">
        <ul className="list-disc space-y-1 pl-5">
          {run.picks.filter((p) => p.verdict === 'weak' || p.verdict === 'unsafe').map((p) => <li key={p.phase}>{p.name}: {p.bestWhy}</li>)}
          {run.picks.every((p) => p.verdict === 'best' || p.verdict === 'good') && <li>No weak or unsafe decisions. Test the same scenario at a harder level, or run it as a tabletop with the CDRRMC.</li>}
        </ul>
      </Section>
      <p className="text-xs text-muted">Exercise tool. Scenario names, figures and events are fictional. The official text of each law or guideline governs.</p>
    </div>
  );
}

function LearnView({ onBack }: { onBack: () => void }) {
  const [i, setI] = useState(0);
  const item = ICS.LEARN[i]!;
  const html = useMemo(() => DOMPurify.sanitize(item.h), [item]);
  const glossary = useMemo(() => Object.entries(ICS.GLOSSARY).sort(([a], [b]) => a.localeCompare(b)), []);
  return (
    <div className="page">
      <PageHeader title="Learn the framework" subtitle="Philippine ICS, the EOC, reporting and anticipatory action, localized for Ormoc." />
      <button type="button" onClick={onBack} className="mb-4 font-semibold underline" {...tip('Back to the list of exercises')}>Back</button>
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Topics"><ul className="space-y-1">
          {ICS.LEARN.map((l, k) => <li key={l.id}><button type="button" onClick={() => setI(k)} {...tip(`Open: ${l.t}`)} className={clsx('w-full rounded-control px-3 py-2 text-left font-semibold', k === i ? 'bg-sky-soft ring-1 ring-action' : 'hover:bg-sky-soft/60')}>{l.t}</button></li>)}
        </ul></nav>
        <article>
          <h2 className="mb-3 text-xl font-bold">{item.t}</h2>
          <div className="prose-doc ics-learn" dangerouslySetInnerHTML={{ __html: html }} />
          <h3 className="mb-2 mt-8 text-lg font-bold">Glossary</h3>
          <dl className="grid gap-2 sm:grid-cols-2">{glossary.map(([k, v]) => <div key={k}><dt className="font-data font-bold">{k}</dt><dd className="text-sm text-muted">{v}</dd></div>)}</dl>
          <h3 className="mb-2 mt-8 text-lg font-bold">References</h3>
          <ul className="space-y-2 text-sm">{ICS.REFERENCES.map(([k, v]) => <li key={k}><span className="font-semibold">{k}.</span> {v}</li>)}</ul>
        </article>
      </div>
    </div>
  );
}

function QuizView({ onBack }: { onBack: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => ICS.QUIZ.map(() => null));
  const done = answers.every((a) => a !== null);
  const right = answers.filter((a, i) => a === ICS.QUIZ[i]!.a).length;
  return (
    <div className="page">
      <PageHeader title="Quick quiz" subtitle="Choose an answer to see whether it is right and why." />
      <button type="button" onClick={onBack} className="mb-4 font-semibold underline" {...tip('Back to the list of exercises')}>Back</button>
      <div className="max-w-3xl space-y-6">
        {ICS.QUIZ.map((q, qi) => (
          <div key={qi}>
            <ChoiceGroup legend={`${qi + 1}. ${q.q}`} value={answers[qi] ?? null} onChange={(v) => setAnswers((a) => a.map((x, k) => (k === qi && x === null ? v : x)))}
              options={q.o.map((o, oi) => ({ value: oi, label: o, disabled: answers[qi] !== null && answers[qi] !== oi, disabledReason: 'Already answered' }))} />
            {answers[qi] !== null && <p className={clsx('mt-2 text-sm font-semibold', answers[qi] === q.a ? 'text-ok' : 'text-bad')}>{answers[qi] === q.a ? 'Right. ' : `Not quite: the answer is "${q.o[q.a]}". `}<span className="font-normal text-ink">{q.w}</span></p>}
          </div>
        ))}
        {done && <Notice tone={right >= 6 ? 'ok' : 'warn'} title={`${right} of ${ICS.QUIZ.length} right`}>{right >= 6 ? 'Ready for a full exercise.' : 'Read the learning module, then try again.'}</Notice>}
        <Button variant="secondary" onClick={() => setAnswers(ICS.QUIZ.map(() => null))} tip="Clear the answers and start again">Start again</Button>
      </div>
    </div>
  );
}
