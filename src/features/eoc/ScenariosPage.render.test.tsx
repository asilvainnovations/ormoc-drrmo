import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '@/lib/db';
import type { Activation, ContingencyPlan, CpActivationItem } from '@/types';
import { PlanPage, ScenariosPage } from './ScenariosPage';
import { ModulesPanel } from './ModulesPanel';

const auth = vi.hoisted(() => ({ userId: 'u1', roles: ['eoc_manager'] as string[] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ ...auth, has: (r: string) => auth.roles.includes(r) }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => () => undefined }));
vi.mock('@/lib/sync', async (orig) => ({ ...(await orig<object>()), syncNow: async () => undefined }));

const plan = (id: string, code: string, title: string, hazard: string, status: ContingencyPlan['status'] = 'to_prepare', codes: string[] = [hazard]): ContingencyPlan =>
  ({ id, version: 1, code, title, hazard_code: hazard, hazard_codes: codes, scenario: null, warning_time: 'Hours', activation_triggers: 'Red on an orange or red rainfall warning',
    status, adopted_ref: status === 'adopted' ? 'CDRRMC Res. No. 2-A, s. 2021' : null, adopted_on: null, valid_until: null, vault_document_id: null });
const it_ = (plan_id: string, kind: 'module' | 'cluster', code: string, state: 'on' | 'lead' | 'standby', min: 'blue' | 'red' = 'red'): CpActivationItem =>
  ({ id: `${plan_id}-${kind}-${code}`, version: 1, plan_id, item_kind: kind, item_code: code, state, min_level: min, note: code === 'CCCM' ? 'Lead. Anchored on the six CSWD districts' : null });

async function seed() {
  await db.contingency_plans.bulkPut([plan('pf', 'CP-FLASHFLOOD', 'Contingency plan for flash floods (Anilao-Malbasag system)', 'flash_flood'),
    plan('pl', 'CP-FLOOD-LUNOP', 'Enhanced Contingency Plan for flood-affected barangays', 'flood', 'adopted', ['tropical_cyclone', 'storm_surge', 'flood'])]);
  await db.cp_activation_items.bulkPut([it_('pf', 'module', 'operations', 'on'), it_('pf', 'module', 'planning', 'on', 'blue'), it_('pf', 'module', 'logistics', 'on', 'blue'),
    it_('pf', 'module', 'cluster_desks', 'lead'), it_('pf', 'cluster', 'SRR', 'lead'), it_('pf', 'cluster', 'CCCM', 'lead'), it_('pf', 'cluster', 'HEALTH', 'standby'),
    it_('pl', 'module', 'pdra_aa_desk', 'on', 'blue')]);
  await db.response_clusters.bulkPut([{ id: 'c1', version: 1, code: 'CCCM', name: 'Camp Coordination and Camp Management', national_lead: 'DSWD', lead_office_id: null, mandate: null, sort: 2, is_active: true },
    { id: 'c2', version: 1, code: 'SRR', name: 'Search, Rescue and Retrieval', national_lead: 'AFP', lead_office_id: null, mandate: null, sort: 8, is_active: true },
    { id: 'c3', version: 1, code: 'HEALTH', name: 'Health (WASH, nutrition, MHPSS)', national_lead: 'DOH', lead_office_id: null, mandate: null, sort: 4, is_active: true }]);
}
afterEach(async () => {
  cleanup(); auth.roles = ['eoc_manager'];
  await Promise.all([db.contingency_plans.clear(), db.cp_activation_items.clear(), db.response_clusters.clear(), db.activation_clusters.clear(), db.eoc_activations.clear(), db.hazards.clear()]);
});

describe('Scenarios (Figure 1.7)', () => {
  it('draws each plan as a row of the figure, typhoon first', async () => {
    await seed();
    render(<MemoryRouter><ScenariosPage /></MemoryRouter>);
    const rows = await screen.findAllByRole('row');
    expect(within(rows[1]!).getByRole('link').textContent).toBe('Typhoon with flood and storm surge');
    const flash = rows.find((r) => /Flash flood \(Anilao–Malbasag\)/.test(r.textContent ?? ''))!;
    expect(within(flash).getByText('Lead clusters')).toBeTruthy();
    expect(within(flash).getAllByText('On')).toHaveLength(3);
  });

  it('opens a plan with its modules, lead clusters and the template download', async () => {
    await seed();
    render(<MemoryRouter initialEntries={['/eoc/plans/CP-FLASHFLOOD']}><Routes><Route path="/eoc/plans/:code" element={<PlanPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Contingency plan for flash floods (Anilao-Malbasag system)' })).toBeTruthy();
    expect(screen.getByText('Lead. Anchored on the six CSWD districts')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Download/ }).length).toBeGreaterThan(0);
    expect(screen.getByText('Families Stay Together')).toBeTruthy();
  });
});

describe('Modules on now', () => {
  const act: Activation = { id: 'a1', version: 1, level: 'blue', reason: 'Flash flood watch', hazard_code: 'flash_flood', authority_ref: null, started_at: '2026-01-01T00:00:00Z', ended_at: null, plan_id: null };
  it('asks for a plan when none is active, suggests the flash flood plan, and confirms in two taps with an authority', async () => {
    await seed();
    await db.hazards.put({ code: 'flash_flood', name: 'Flash flood (Anilao–Malbasag system)', forecastable: true, typical_lead_hours: 3, declaration_eligible: false, note: null, sort: 4 });
    render(<MemoryRouter><ModulesPanel activation={act} /></MemoryRouter>);
    expect(await screen.findByText('No contingency plan activated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Activate plan' }));
    expect(await screen.findByText('For Flash flood (Anilao–Malbasag system)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Contingency plan for flash floods/));
    // The sheet's own button (the dialog is not "open" in jsdom, so ask for hidden elements too).
    const go = () => screen.getAllByRole('button', { name: /Activate plan|Select again to activate/, hidden: true }).at(-1)! as HTMLButtonElement;
    expect(go().disabled).toBe(true);                                       // authority required
    fireEvent.change(screen.getByLabelText(/Authority/), { target: { value: 'Mayor’s instruction, 08:10' } });
    expect(go().disabled).toBe(false);
    fireEvent.click(go());
    expect(go().textContent).toBe('Select again to activate');               // first tap only arms it
  });

  it('shows the live module set and the seated clusters', async () => {
    await seed();
    await db.contingency_plans.update('pf', {});
    await db.activation_clusters.bulkPut([
      { id: 'x1', version: 1, activation_id: 'a1', item_kind: 'module', item_code: 'operations', state: 'standby', changed_by: null, changed_at: 'x' },
      { id: 'x2', version: 1, activation_id: 'a1', item_kind: 'module', item_code: 'planning', state: 'on', changed_by: null, changed_at: 'x' },
      { id: 'x3', version: 1, activation_id: 'a1', item_kind: 'module', item_code: 'cluster_desks', state: 'standby', changed_by: null, changed_at: 'x' },
      { id: 'x4', version: 1, activation_id: 'a1', item_kind: 'cluster', item_code: 'SRR', state: 'standby', changed_by: null, changed_at: 'x' },
    ]);
    render(<MemoryRouter><ModulesPanel activation={{ ...act, plan_id: 'pf' }} /></MemoryRouter>);
    expect(await screen.findByLabelText('Operations: Standby')).toBeTruthy();
    expect(screen.getByLabelText('Planning (situation): On')).toBeTruthy();
    expect(screen.getByLabelText('PDRA and AA desk: –')).toBeTruthy();
    expect(screen.getByText('Search, Rescue and Retrieval')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Change plan' })).toBeTruthy();
  });

  it('staff see the modules but cannot activate a plan', async () => {
    auth.roles = ['eoc_staff'];
    await seed();
    render(<MemoryRouter><ModulesPanel activation={act} /></MemoryRouter>);
    expect(await screen.findByText(/The EOC Manager or the CDRRMO Head activates it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate plan' })).toBeNull();
  });
});
