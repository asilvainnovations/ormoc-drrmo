// Tools → ECHO → Exercise report (1.16.0): a printable record of the exercise on this device. Training only.
import { useLiveQuery } from 'dexie-react-hooks';
import { Printer } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge, Button, PageHeader, Section } from '@/components/ui';
import { exerciseAlerts, exercisePhase, fmt, movement, scenarioPopulation, selectedSite, spaceCheck, toiletCheck, waterCheck } from '@/domain/echo';
import { CLOSURE_CHECKS, EVAC_CHECKS, MONITOR_CHECKS, PROTECT_CHECKS, SERVICE_CHECKS } from './EchoSimulator';
import { useExercise } from './useExercise';

const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

export function EchoReport() {
  const { ex } = useExercise();
  const names = useLiveQuery(async () => new Map((await db.barangays.toArray()).map((b) => [b.psgc, b.name])), [], new Map<string, string>());
  const site = selectedSite(ex);
  const p = scenarioPopulation(ex);
  const w = waterCheck(ex.scenario.persons, ex.camp.water_l_day);
  const sp = spaceCheck(ex.scenario.persons, site?.area_m2 ?? null);
  const t = toiletCheck(p, { male: ex.camp.toilets_male, female: ex.camp.toilets_female, accessible: ex.camp.toilets_accessible }, ex.camp.phase);
  const mv = movement(ex.scenario.persons, ex.movement.vehicles, ex.movement.per_trip, ex.movement.round_trip_min);
  const lists: [string, string, readonly string[]][] = [['Evacuation control', 'evac', EVAC_CHECKS], ['Service delivery', 'service', SERVICE_CHECKS],
    ['Protection and inclusion', 'protect', PROTECT_CHECKS], ['Monitoring', 'monitor', MONITOR_CHECKS], ['Closure readiness', 'closure', CLOSURE_CHECKS]];
  return (
    <div className="page max-w-4xl">
      <PageHeader title={ex.title} back="/tools/echo" subtitle={`ECHO exercise report. Started ${when(ex.started_at)}; last change ${when(ex.updated_at)} (Asia/Manila).`}
        actions={<Button icon={Printer} tip="Print or save as PDF" onClick={() => window.print()}>Print</Button>} />
      <p className="mb-6 rounded-control border border-line p-3 text-sm"><strong>Training only.</strong> Figures are exercise inputs, not real evacuees. ECHO does not order evacuations, certify centres as safe or replace the City DRRMC, the City Government, DSWD or other agencies.</p>
      <Section title="Scenario">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {[['Hazard', ex.scenario.hazard], ['Lead time', ex.scenario.lead], ['Barangays', ex.scenario.barangays.map((b) => names.get(b) ?? b).join(', ') || 'Not set'],
            ['Phase reached', exercisePhase(ex).label], ['Families / persons', `${fmt(ex.scenario.families)} / ${fmt(ex.scenario.persons)}`],
            ['Women and girls / children', `${fmt(ex.scenario.female)} / ${fmt(ex.scenario.children)}`], ['Older persons / persons with disability', `${fmt(ex.scenario.older)} / ${fmt(ex.scenario.pwd)}`],
            ['Outside centres', fmt(ex.scenario.outside_centres)]].map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
        </dl>
        {ex.scenario.notes && <p className="mt-2 text-sm">{ex.scenario.notes}</p>}
      </Section>
      <Section title="Movement and reception">
        <p className="text-sm">{ex.movement.mode}. Route: <strong>{ex.movement.route === 'validated' ? 'validated by an authorised team' : ex.movement.route === 'blocked' ? 'blocked or unsafe' : 'not yet validated'}</strong>. {fmt(mv.loads)} vehicle loads; {mv.cycles === null ? 'no transport units set' : `${mv.cycles} cycle(s) with ${fmt(ex.movement.vehicles)} units`}. Received {fmt(ex.movement.received)}, en route {fmt(ex.movement.en_route)}, not accounted for {fmt(ex.movement.unaccounted)}.</p>
      </Section>
      <Section title={`Centre: ${site?.name ?? 'none selected'}`}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-1">Indicator</th><th className="py-1">Exercise</th><th className="py-1">Reference</th></tr></thead>
          <tbody className="divide-y divide-line">
            <tr><td className="py-1">Capacity</td><td className="py-1">{fmt(site?.capacity)}</td><td className="py-1">Projected {fmt(ex.scenario.persons)}</td></tr>
            <tr><td className="py-1">Water</td><td className="py-1">{fmt(ex.camp.water_l_day)} L/day</td><td className="py-1">{fmt(w.needSphere)} L (Sphere 15 L); {fmt(w.needJmc)} L (JMC 52 L, prolonged)</td></tr>
            <tr><td className="py-1">Covered space</td><td className="py-1">{fmt(site?.area_m2)} m²</td><td className="py-1">{fmt(sp.need)} m² (Sphere 3.5 m²)</td></tr>
            <tr><td className="py-1">Toilets M / F / accessible</td><td className="py-1">{fmt(ex.camp.toilets_male)} / {fmt(ex.camp.toilets_female)} / {fmt(ex.camp.toilets_accessible)}</td>
              <td className="py-1">RA 12076: {fmt(t.ra.male)} / {fmt(t.ra.female)} / {fmt(t.ra.accessible)}; JMC 1:{t.jmcRatio}: {t.jmc} in all</td></tr>
          </tbody>
        </table>
      </Section>
      <Section title={`Alerts at the end of the exercise (${exerciseAlerts(ex).length})`}>
        <ul className="space-y-1 text-sm">{exerciseAlerts(ex).map((a, i) => <li key={i}><Badge tone={a.tone === 'bad' ? 'bad' : a.tone === 'warn' ? 'warn' : 'info'}>{a.tone === 'bad' ? 'Critical' : a.tone === 'warn' ? 'Gap' : 'Note'}</Badge> <strong>{a.title}.</strong> {a.body}</li>)}</ul>
      </Section>
      <Section title="Checklists">
        {lists.map(([title, prefix, items]) => {
          const done = items.filter((_, i) => ex.checks[`${prefix}-${i}`]);
          const open = items.filter((_, i) => !ex.checks[`${prefix}-${i}`]);
          return <div key={prefix} className="mb-3 text-sm"><p className="font-semibold">{title}: {done.length} of {items.length}</p>
            {open.length > 0 && <p className="text-muted">Not done: {open.join('; ')}.</p>}</div>;
        })}
      </Section>
      <Section title={`Feedback log (${ex.feedback.length})`}>
        <ul className="space-y-1 text-sm">{ex.feedback.map((f) => <li key={f.id}><strong>{f.category}</strong> ({f.status}){f.office ? `, ${f.office}` : ''}: {f.summary}</li>)}</ul>
      </Section>
      <Section title={`Decisions (${ex.decisions.length})`}>
        <ul className="space-y-1 text-sm">{ex.decisions.map((d) => <li key={d.id}>{when(d.at)}: <strong>{d.action}.</strong> {d.reason}</li>)}</ul>
      </Section>
      <p className="text-xs text-muted">Sources kept distinct: Sphere Handbook 2018; DSWD-DILG-DOH-DepEd JMC No. 02 s. 2021; RA 12076 Sec. 4. The official texts govern.</p>
    </div>
  );
}
