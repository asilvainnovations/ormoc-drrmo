import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import { BoardPage } from './BoardPage';
import { BarangaysPage } from './BarangaysPage';
import { RequestsPage } from './RequestsPage';
import { ResourcesPage } from './ResourcesPage';
import { RosterPage } from './RosterPage';
import { AaHomePage } from './aa/AaHomePage';
import type { Barangay, EocPosition } from '@/types';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ userId: 'u1', roles: ['eoc_manager'], has: () => true }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => () => undefined }));
vi.mock('@/lib/sync', async (orig) => ({ ...(await orig<object>()), syncNow: async () => undefined }));

const brgy = (psgc: string, name: string): Barangay => ({ psgc, name, classification: [], population: null, lat: null, lng: null });
const btn = (name: string) => screen.getByText(name).closest('button') as HTMLButtonElement;
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

afterEach(async () => {
  cleanup();
  await Promise.all([db.barangays.clear(), db.barangay_reports.clear(), db.resource_requests.clear(), db.resources.clear(), db.eoc_positions.clear(),
    db.eoc_designations.clear(), db.declarations.clear(), db.outbox.clear()]);
});

describe('Barangays as a picture', () => {
  it('shows every barangay as a tile, counts silent ones, and records a report in two taps', async () => {
    await db.barangays.bulkPut([brgy('1', 'Cogon'), brgy('2', 'Linao'), brgy('3', 'Ipil')]);
    wrap(<BarangaysPage />);
    expect(await screen.findByText('Cogon')).toBeTruthy();
    expect(screen.getByLabelText('Cogon: No report')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Linao: No report'));
    fireEvent.click((await screen.findAllByText('Isolated')).at(-1)!);
    fireEvent.click(btn('Record report'));
    await waitFor(async () => expect(await db.barangay_reports.count()).toBe(1));
    const r = (await db.barangay_reports.toArray())[0]!;
    expect(r.barangay_psgc).toBe('2'); expect(r.condition).toBe('isolated');
    await waitFor(() => expect(screen.getByLabelText(/Linao: Isolated/)).toBeTruthy());
  });
});

describe('Board', () => {
  it('shows the picture and says when nothing needs attention', async () => {
    await db.barangays.bulkPut([brgy('1', 'Cogon'), brgy('2', 'Linao')]);
    wrap(<BoardPage />);
    expect(await screen.findByText('Barangay picture')).toBeTruthy();
    expect(screen.getByText('Needs attention now')).toBeTruthy();
    expect(await screen.findByText(/Nothing flagged/)).toBeTruthy();
    expect(screen.getByText('Barangays reporting')).toBeTruthy();
  });
});

describe('Requests', () => {
  it('records a request from chips and a number', async () => {
    wrap(<RequestsPage />);
    fireEvent.click(await screen.findByText('New request'));
    fireEvent.click(await screen.findByText('Blankets'));
    fireEvent.click(screen.getByText('+10'));
    fireEvent.click(screen.getByText('CHO'));
    fireEvent.click(screen.getByText('Life safety', { selector: 'button' }));
    fireEvent.click(btn('Record request'));
    await waitFor(async () => expect(await db.resource_requests.count()).toBe(1));
    const r = (await db.resource_requests.toArray())[0]!;
    expect(r).toMatchObject({ item: 'Blankets', unit: 'pcs', quantity: 11, requesting_party: 'CHO', priority: 'life_safety', status: 'requested' });
    expect(r.needed_by).toBeTruthy();
  });
});

describe('Resources', () => {
  it('says plainly when nothing is recorded and lists the national minimum', async () => {
    wrap(<ResourcesPage />);
    expect(await screen.findByText('Nothing recorded yet')).toBeTruthy();
    expect(screen.getByText('Generator set')).toBeTruthy();
    expect(screen.getByText(/8 of 8 items on the minimum list have no record yet/)).toBeTruthy();
  });
  it('marks a standard item as covered once recorded', async () => {
    await db.resources.put({ id: 'r1', name: 'Generator set 5 kVA', category: 'power', unit: 'units', quantity: 3, owner_office_id: null, location_text: 'CDRRMO', is_serviceable: true, version: 1 } as never);
    wrap(<ResourcesPage />);
    expect(await screen.findByText('3 recorded, 3 serviceable')).toBeTruthy();
  });
});

describe('Roster', () => {
  it('puts a name straight into a slot, no approval step', async () => {
    const p: EocPosition = { id: 'p1', code: 'EOC-MGR', title: 'EOC Manager', section: 'command', min_level: 'blue', cluster_code: null, required_depth: 3, sort: 1, is_active: true, version: 1 } as EocPosition;
    await db.eoc_positions.put(p);
    wrap(<RosterPage />);
    expect(await screen.findByText('EOC Manager')).toBeTruthy();
    fireEvent.click((await screen.findAllByText('Add name'))[0]!.closest('button')!);
    fireEvent.change(await screen.findByLabelText(/Name and position/), { target: { value: 'Juan Dela Cruz, Operations Officer' } });
    fireEvent.click(btn('Save'));
    await waitFor(async () => expect(await db.eoc_designations.count()).toBe(1));
    expect(await db.eoc_designations.toArray()).toMatchObject([{ designee_position: 'Juan Dela Cruz, Operations Officer', status: 'approved', rank: 1, position_id: 'p1' }]);
    expect(await screen.findByText('Juan Dela Cruz, Operations Officer')).toBeTruthy();
  });
});

describe('Anticipatory action', () => {
  it('shows a declaration with its six-step track', async () => {
    await db.declarations.put({ id: 'd1', pdra_id: null, hazard_code: 'tropical_cyclone', scope_barangays: [], expected_impact_at: '2099-01-01T00:00:00Z', origin: 'city_request', status: 'requested',
      requested_at: '2098-12-29T00:00:00Z', rdrrmc_due_at: '2098-12-30T00:00:00Z', rdrrmc_responded_at: null, rdrrmc_reference: null, eo_number: null, declared_at: null, lifted_at: null,
      lifting_ground: null, lifting_basis: null, report_due_at: null, report_submitted_at: null, report_reference: null, costs_minimized_note: null, version: 1 } as never);
    wrap(<AaHomePage />);
    expect(await screen.findByText('RDRRMC reply')).toBeTruthy();
    expect(screen.getByText('Report to OCD')).toBeTruthy();
    expect(screen.getByText('Declarations in progress')).toBeTruthy();
  });
});
