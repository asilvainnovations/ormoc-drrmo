import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '@/lib/db';
import type { Cycle, EocCapItem, EocCapResponse } from '@/types';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ userId: 'u1', roles: ['assessor'], has: (...r: string[]) => r.includes('assessor') }) }));
const { EocCapabilityPage } = await import('./EocCapabilityPage');

async function seed() {
  await db.assessment_cycles.put({ id: 'cy1', name: 'Checklist test', cycle_year: 2026, iat_version: '1.7', status: 'fieldwork', version: 1 } as Cycle);
  const item = (id: string, no: number, iat: string[], text: string): EocCapItem => ({ id, section_group: 'Eoc Assessment and Siting / Site Selection',
    section: 'Site Selection', item_no: no, item: text, iat_indicators: iat, assess_locally: iat.length === 0, sort: no, source_ref: 'OCD', version: 1 });
  await db.eoc_cap_items.bulkPut([item('i1', 1, ['B2.1'], 'The EOC is outside the flood zone'), item('i2', 2, [], 'The EOC has a helicopter landing zone')]);
  await db.eoc_cap_responses.put({ id: 'r1', cycle_id: 'cy1', item_id: 'i1', site: 'primary', status: 'met', provenance: 'prefilled_iat', state: 'draft',
    evidence_observed: 'OBS', gap_remarks: null, recommended_action: null, vault_document_id: null, version: 1 } as EocCapResponse);
}

describe('EOC capability checklist (1.20.0)', () => {
  it('labels pre-filled answers and rolls items up to the Part B domains', async () => {
    await seed();
    render(<MemoryRouter initialEntries={['/assess/cy1/eoc-capability']}><Routes>
      <Route path="/assess/:cycleId/eoc-capability" element={<EocCapabilityPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('EOC capability checklist')).toBeTruthy();
    expect(screen.getByText(/1 of 2 answers for the primary eoc are pre-filled/i)).toBeTruthy();
    expect(screen.getAllByText('B2 Facility').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No IAT counterpart (assessed locally)').length).toBeGreaterThan(0);
    expect(screen.getByText(/pre-filled from IAT, to confirm/)).toBeTruthy();
    expect(screen.getByText(/No IAT counterpart: assess locally/)).toBeTruthy();
  });
});
