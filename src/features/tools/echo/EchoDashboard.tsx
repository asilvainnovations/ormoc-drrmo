// Tools → ECHO → EOC dashboard (1.16.0, ADR-030): one accountable picture of evacuation and camps for the EOC.
// Consolidated status from the latest camp report per centre in this activation, capacity, WASH gaps, unmet needs,
// open feedback, resource requests and the SitRep text. A resource request raised here enters the EOC's own request
// workflow (approval stays with the EOC Manager); a SitRep started here is an ordinary draft for the EOC to complete.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, PackagePlus, Printer } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canOperate, currentLevel, currentReportWindow, evacuationTotals, latestPerBarangay } from '@/domain/eoc';
import { LEVEL_INFO } from '@/domain/eoc';
import { campTotals, fmt, latestPerCentre, sitrepCampText, toiletCheck, utilisation, waterCheck } from '@/domain/echo';
import { fmtDateTime, relative } from '@/lib/time';
import { Badge, Button, EmptyState, Field, Input, Loading, Meter, Notice, PageHeader, Section, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { ResourceRequest, Sitrep } from '@/types';
import { ECHO_TABS, PHASE, PHASE_TONE } from './labels';

const STALE_HOURS = 12;

export function EchoDashboard() {
  const { roles } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [req, setReq] = useState<{ party: string; item: string; quantity: string; unit: string; priority: ResourceRequest['priority'] } | null>(null);
  const data = useLiveQuery(async () => {
    const [centres, reports, feedback, activations, bReports, requests] = await Promise.all([db.evacuation_centers.toArray(), db.camp_reports.toArray(),
      db.camp_feedback.toArray(), db.eoc_activations.toArray(), db.barangay_reports.toArray(), db.resource_requests.toArray()]);
    const window = currentReportWindow(activations);
    const { level, activation } = currentLevel(activations);
    const latest = latestPerCentre(reports, window.from);
    const brgy = evacuationTotals(latestPerBarangay(bReports, window));
    return { centres, latest, feedback, activation, level, window, brgy, requests: requests.filter((r) => !activation || r.activation_id === activation.id) };
  }, []);
  const view = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.centres.map((c) => [c.id, c]));
    const capacity = new Map(data.centres.map((c) => [c.id, c.capacity_persons]));
    const totals = campTotals(data.latest, capacity);
    const rows = data.latest.filter((r) => r.phase !== 'closed').map((r) => {
      const c = byId.get(r.centre_id)!;
      const u = utilisation(r.persons, c?.capacity_persons ?? null);
      const w = waterCheck(r.persons, r.water_l_day);
      const t = toiletCheck(r, { male: null, female: null, accessible: null, total: r.toilets_functional }, 'short');
      const ageH = (Date.now() - Date.parse(r.reported_at)) / 3_600_000;
      return { r, c, u, w, t, stale: ageH > STALE_HOURS };
    }).sort((a, b) => (b.u ?? 0) - (a.u ?? 0));
    const gaps: { party: string; text: string }[] = [];
    for (const x of rows) {
      const name = x.c?.name ?? 'A centre';
      const add = (text: string) => gaps.push({ party: name, text });
      if (x.u !== null && x.u > 1) add(`${name} is over capacity (${fmt(x.r.persons)} of ${fmt(x.c?.capacity_persons)}).`);
      if (x.w.meetsSphere === false) add(`${name}: water ${x.w.perPerson!.toFixed(1)} L per person, below 15 L (Sphere).`);
      if (x.t.available.total !== null && x.r.persons && x.t.available.total < x.t.jmc) add(`${name}: ${x.t.available.total} working toilets, ${x.t.jmc} needed at 1:50 (JMC).`);
      if (x.r.unmet_needs) add(`${name}: ${x.r.unmet_needs}`);
    }
    const openFb = data.feedback.filter((f) => f.status !== 'closed' && (!data.activation || f.activation_id === data.activation.id));
    const openReq = data.requests.filter((r) => !['delivered', 'demobilized', 'rejected'].includes(r.status));
    const outside = data.brgy.notReported === 0 && data.brgy.persons >= totals.persons && totals.personsNotReported === 0 ? data.brgy.persons - totals.persons : null;
    return { totals, rows, gaps, openFb, openReq, outside };
  }, [data]);
  if (!data || !view) return <Loading />;
  const can = canOperate(roles);
  const { totals } = view;

  const startSitrep = async () => {
    const t = sitrepCampText(totals, view.gaps.map((g) => g.text));
    const s: Sitrep & { _new: true } = { _new: true, id: uuid(), activation_id: data.activation?.id ?? null, seq: null,
      period_start: new Date(Date.now() - 6 * 3600_000).toISOString(), period_end: new Date().toISOString(), status: 'draft',
      situation: t.situation, actions_taken: null, needs: t.needs || null, affected_families: null, affected_persons: null,
      evacuated_families: data.brgy.families, evacuated_persons: data.brgy.persons, dead: null, injured: null, missing: null, submitted_at: null, approved_at: null,
      report_type: 'during_disaster', incident_type: null, affected_barangays: null, damaged_houses_totally: null, damaged_houses_partially: null,
      lifelines_status: null, assistance_provided: null, cost_of_assistance: null, version: 1 };
    await save('sitreps', s, 'New SitRep draft from ECHO');
    toast('SitRep draft started with the ECHO camp figures', 'info');
    nav(`/eoc/sitreps/${s.id}`);
  };
  const raise = async () => {
    if (!req) return;
    const q = Number(req.quantity);
    if (!req.item.trim() || !Number.isFinite(q) || q <= 0) { toast('Give the item and a quantity above 0.', 'bad'); return; }
    const r: ResourceRequest & { _new: true } = { _new: true, id: uuid(), activation_id: data.activation?.id ?? null, requesting_party: req.party.trim(), item: req.item.trim(),
      quantity: q, unit: req.unit.trim() || 'unit', priority: req.priority, needed_by: null, status: 'requested', decision_note: null,
      requested_at: new Date().toISOString(), approved_at: null, mobilized_at: null, delivered_at: null, demobilized_at: null, version: 1 };
    await save('resource_requests', r, `Request ${r.item} for ${r.requesting_party}`);
    toast('Request recorded. The EOC Manager decides on it in EOC → Requests.');
    setReq(null);
  };

  return (
    <div className="page">
      <PageHeader title="ECHO" subtitle="Evacuation and Camp Handling Operations"
        actions={<div className="flex flex-wrap gap-2">
          {can && <Button icon={FileText} tip="Start a SitRep draft with the camp figures and gaps from ECHO" onClick={startSitrep}>Start a SitRep</Button>}
          <Button variant="secondary" icon={Printer} tip="Print this dashboard" onClick={() => window.print()}>Print</Button>
        </div>} />
      <Tabs items={ECHO_TABS} />

      <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface px-3 py-2">
        <Badge tone={data.level === 'white' ? 'neutral' : data.level === 'blue' ? 'info' : 'bad'}>EOC {LEVEL_INFO[data.level].name}</Badge>
        <span className="text-sm text-muted">{data.activation ? `Activation since ${fmtDateTime(data.window.from)}` : 'No activation: reports from the last 24 hours'}</span>
        {totals.overCapacity > 0 && <Badge tone="bad">{totals.overCapacity} over capacity</Badge>}
        {totals.waterBelowSphere > 0 && <Badge tone="warn">{totals.waterBelowSphere} below 15 L water</Badge>}
        {view.rows.some((x) => x.stale) && <Badge tone="warn">{view.rows.filter((x) => x.stale).length} report{view.rows.filter((x) => x.stale).length > 1 ? 's' : ''} older than {STALE_HOURS} h</Badge>}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[['Open centres', String(totals.centresOpen), `${data.centres.filter((c) => c.verification_status !== 'superseded' && c.verification_status !== 'training').length} in the inventory`],
          ['Persons inside centres', fmt(totals.persons), totals.personsNotReported ? `${totals.personsNotReported} centre(s) not reported` : `${fmt(totals.families)} families`],
          ['Evacuated, all barangay reports', fmt(data.brgy.persons), view.outside !== null ? `About ${fmt(view.outside)} outside centres (with relatives or host families)` : 'Barangay totals not complete'],
          ['Open feedback and requests', `${view.openFb.length} / ${view.openReq.length}`, 'Feedback items / resource requests']].map(([k, v, n]) => (
          <div key={k} className="rounded-sheet border border-line bg-surface p-4 shadow-raised">
            <p className="text-sm text-muted">{k}</p><p className="font-data text-3xl font-bold">{v}</p><p className="mt-1 text-xs text-muted">{n}</p>
          </div>
        ))}
      </div>

      <Section title="Centres">
        {view.rows.length === 0 ? <EmptyState title="No open centre in this activation" body={<>Centres appear here when a camp report is filed. Open <Link className="font-semibold underline" to="/tools/echo/camps">Camp management</Link> to add centres and file reports.</>} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Centre</th><th className="py-2">Phase</th><th className="py-2">Occupancy</th>
                <th className="py-2 text-right">Water L/person</th><th className="py-2 text-right">Toilets (JMC 1:50)</th><th className="py-2">Last report</th></tr></thead>
              <tbody className="divide-y divide-line">
                {view.rows.map(({ r, c, u, w, t, stale }) => (
                  <tr key={r.id}>
                    <td className="py-2"><Link className="font-semibold underline" to={`/tools/echo/camps/${r.centre_id}`}>{c?.name ?? 'Unknown centre'}</Link></td>
                    <td className="py-2"><Badge tone={PHASE_TONE[r.phase]}>{PHASE[r.phase]}</Badge></td>
                    <td className="py-2"><span className="font-data">{fmt(r.persons)} / {fmt(c?.capacity_persons)}</span>
                      {u !== null && <span className="block w-32"><Meter value={Math.min(u, 1)} label={`${c?.name} occupancy`} tone={u > 1 ? 'bad' : u > 0.9 ? 'warn' : 'action'} /></span>}</td>
                    <td className={`py-2 text-right font-data ${w.meetsSphere === false ? 'font-bold text-bad' : ''}`}>{w.perPerson === null ? '—' : w.perPerson.toFixed(1)}</td>
                    <td className="py-2 text-right font-data">{t.available.total === null ? '—' : `${t.available.total} / ${t.jmc}`}</td>
                    <td className={`py-2 ${stale ? 'font-semibold text-warn' : ''}`}>{relative(r.reported_at, Date.now())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`Gaps and unmet needs (${view.gaps.length})`}>
          {view.gaps.length === 0 ? <p className="text-sm text-muted">No gaps in the latest reports. Missing reports are not gaps cleared.</p> : (
            <ul className="divide-y divide-line">
              {view.gaps.map((g, i) => (
                <li key={i} className="flex flex-wrap items-start gap-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">{g.text}</span>
                  {can && <Button variant="quiet" icon={PackagePlus} tip="Raise a resource request for this gap; the EOC Manager decides on it"
                    onClick={() => setReq({ party: g.party, item: '', quantity: '1', unit: 'unit', priority: 'urgent' })}>Request</Button>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Population inside centres (aggregate)">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['Children', totals.children], ['Older persons', totals.older], ['Persons with disability', totals.pwd], ['Women and girls', totals.female], ['Pregnant or lactating', totals.pregnant]].map(([k, v]) => (
              <div key={k as string}><dt className="text-muted">{k}</dt><dd className="font-data text-lg font-semibold">{fmt(v as number)}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted">Sum of reported values; a centre that left a group blank adds nothing for it. Not a substitute for DAFAC data, which stay with the CSWDO.</p>
          <p className="mt-3 text-sm"><Link className="font-semibold underline" to="/eoc/requests">Resource requests in this activation: {view.openReq.length} open</Link></p>
        </Section>
      </div>

      <Notice tone="info">ECHO supports decisions; it does not take them. Opening, closing and relocating centres, evacuation orders and approvals stay with the authorities in the law, the City issuances and the EOC.</Notice>

      {req && (
        <Sheet open onClose={() => setReq(null)} title="Raise a resource request"
          footer={<><Button variant="secondary" tip="Close without raising a request" onClick={() => setReq(null)}>Cancel</Button><Button tip="Record the request for the EOC" onClick={raise}>Record request</Button></>}>
          <div className="space-y-3">
            <Field label="Requesting party">{(id) => <Input id={id} maxLength={160} value={req.party} onChange={(e) => setReq({ ...req, party: e.target.value })} />}</Field>
            <Field label="Item or service">{(id) => <Input id={id} maxLength={160} value={req.item} onChange={(e) => setReq({ ...req, item: e.target.value })} placeholder="For example water bladder 5,000 L" />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity">{(id) => <Input id={id} type="number" min={1} value={req.quantity} onChange={(e) => setReq({ ...req, quantity: e.target.value })} />}</Field>
              <Field label="Unit">{(id) => <Input id={id} maxLength={30} value={req.unit} onChange={(e) => setReq({ ...req, unit: e.target.value })} />}</Field>
            </div>
            <Field label="Priority">{(id) => <Select id={id} value={req.priority} onChange={(e) => setReq({ ...req, priority: e.target.value as ResourceRequest['priority'] })}>
              <option value="life_safety">Life safety</option><option value="urgent">Urgent</option><option value="routine">Routine</option></Select>}</Field>
            <Field label="Note" optional hint="Chapter 5 governs expenditure and procurement.">{(id, d) => <Textarea id={id} aria-describedby={d} rows={2} disabled value="Raised from the ECHO dashboard." />}</Field>
          </div>
        </Sheet>
      )}
    </div>
  );
}
