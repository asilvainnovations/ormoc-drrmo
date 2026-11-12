import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '@/lib/db';
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ userId: 'u1', roles: ['eoc_manager'], has: () => true }) }));
const { EchoSimulator } = await import('./EchoSimulator');
const { EchoDashboard } = await import('./EchoDashboard');

const at = (path: string, el: JSX.Element, route: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={el} /></Routes></MemoryRouter>);

describe('ECHO screens (1.16)', () => {
  it('opens the simulator on the overview with its alerts and the training label', async () => {
    at('/tools/echo', <EchoSimulator />, '/tools/echo');
    expect(await screen.findByText('Simulation: training only')).toBeTruthy();
    expect(screen.getByText('Route not validated')).toBeTruthy();
    expect(screen.getByText('Centre capacity exceeded')).toBeTruthy();
    cleanup();
  });
  it('keeps the JMC 52 L and the Sphere 15 L apart on Standards', async () => {
    at('/tools/echo?m=standards', <EchoSimulator />, '/tools/echo');
    expect(await screen.findByText('52 L per person per day')).toBeTruthy();
    expect(screen.getByText('15 L per person per day')).toBeTruthy();
    cleanup();
  });
  it('totals open centres on the dashboard from the latest report', async () => {
    const now = Date.now(); const iso = (h: number) => new Date(now - h * 3600_000).toISOString();
    await db.eoc_activations.put({ id: 'a1', level: 'blue', reason: 'test', hazard_code: null, authority_ref: null, started_at: iso(5), ended_at: null, version: 1 });
    await db.evacuation_centers.put({ id: 'c1', version: 1, code: null, name: 'Hall', barangay_psgc: null, kind: 'multipurpose', capacity_persons: 100, covered_area_m2: 350,
      toilets_male: null, toilets_female: null, toilets_accessible: null, bathing: null, water_l_day: null, is_school: false, is_permanent: false, accessible: null,
      hazard_screening: null, structural_ref: null, ra12076: {}, verification_status: 'field_verified', custodian_office_id: null, point_id: null, lat: null, lng: null, note: null });
    const base = { activation_id: 'a1', centre_id: 'c1', phase: 'open' as const, female: null, male: null, children: null, older: null, pwd: null, pregnant_lactating: null, ip: null,
      arrivals: null, departures: null, water_l_day: 1000, toilets_functional: null, bathing_functional: null, services: {}, referrals_cp: null, referrals_gbv: null,
      referrals_health: null, unmet_needs: null, authority_ref: null, remarks: null };
    await db.camp_reports.bulkPut([{ ...base, id: 'x1', reported_at: iso(3), families: 20, persons: 80, created_at: iso(3) },
      { ...base, id: 'x2', reported_at: iso(1), families: 30, persons: 120, created_at: iso(1) }]);
    at('/tools/echo/dashboard', <EchoDashboard />, '/tools/echo/dashboard');
    expect(await screen.findByText('120')).toBeTruthy();            // latest report only
    expect(screen.getByText('1 over capacity')).toBeTruthy();
    cleanup();
  });
});
