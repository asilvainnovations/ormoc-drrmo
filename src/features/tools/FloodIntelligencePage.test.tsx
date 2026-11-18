import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import { FloodIntelligencePage } from './FloodIntelligencePage';
import type { Barangay, DdriveFlood } from '@/types';

// The map library needs a real browser; the page logic around it is what is tested here.
vi.mock('./flood/FloodMap', () => ({ default: ({ onSelect }: { onSelect: (p: string) => void }) => <button type="button" onClick={() => onSelect('2')}>fake map</button> }));
vi.mock('@/components/Toast', () => ({ useToast: () => () => undefined }));

const brgy = (psgc: string, name: string): Barangay => ({ psgc, name, classification: [], population: null, lat: null, lng: null });
const fl = (psgc: string, cls: string | null, exposed: number | null, pct: number | null): DdriveFlood => ({ psgc, susceptibility_class: cls, hazard_source: 'MGB', prone_area_ha: null, land_area_ha: null,
  prone_pct: null, exposed_population: exposed, exposure_base_population: null, exposure_base_year: null, exposure_pct: pct, depth_scenario: null, confidence: null, validation_status: null });
const wrap = () => render(<MemoryRouter><FloodIntelligencePage /></MemoryRouter>);

afterEach(async () => { cleanup(); await Promise.all([db.barangays.clear(), db.ddrive_flood.clear(), db.ddrive_exposure.clear(), db.ddrive_priority.clear()]); });

async function seed() {
  await db.barangays.bulkPut([brgy('1', 'Cogon'), brgy('2', 'Linao'), brgy('3', 'Ipil'), brgy('4', 'Dry')]);
  await db.ddrive_flood.bulkPut([fl('1', 'Moderate', 900, 20), fl('2', 'Very high', 50, 40), fl('3', 'High', 400, 10), fl('4', null, null, null)]);
}

describe('Flood intelligence', () => {
  it('counts barangays by class and opens one from the map', async () => {
    await seed();
    wrap();
    await waitFor(() => expect(screen.getAllByText('1').length).toBeGreaterThan(0));
    expect(screen.getByText('Very high')).toBeTruthy();
    fireEvent.click(await screen.findByText('fake map'));
    expect(await screen.findByRole('heading', { name: 'Linao' })).toBeTruthy();
    expect(screen.getAllByText('Not reported').length).toBeGreaterThan(0);
  });

  it('lists the watch barangays in class order and never ranks by rainfall', async () => {
    await seed();
    wrap();
    fireEvent.click(await screen.findByText('Watch list'));
    await waitFor(() => expect(screen.getByText('2 barangays')).toBeTruthy());
    const names = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
    expect(names[0]).toContain('Linao'); expect(names[1]).toContain('Ipil');
    fireEvent.change(screen.getByLabelText(/24-hour rainfall/), { target: { value: '250' } });
    const after = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
    expect(after[0]).toContain('Linao');
    fireEvent.click(screen.getByText('Moderate and above'));
    expect(await screen.findByText('3 barangays')).toBeTruthy();
  });

  it('asks for numbers first, then ranks measures from the planner\'s own figures', async () => {
    await seed();
    wrap();
    fireEvent.click(await screen.findByText('Compare measures'));
    expect(screen.getByText(/Still needed: assets exposed, damage share, events per year/)).toBeTruthy();
    fireEvent.click(screen.getByText('Load example numbers'));
    expect(await screen.findByText(/lean/)).toBeTruthy();
    expect(screen.getAllByText(/: 1$/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Flood events a year'), { target: { value: '' } });
    expect(await screen.findByText(/Still needed: events per year/)).toBeTruthy();
  });
});
