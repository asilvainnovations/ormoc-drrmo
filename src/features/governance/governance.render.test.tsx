import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import type { ManualReviewItem, Office } from '@/types';

const auth = { userId: 'u1', roles: ['validator'] as string[], profile: { id: 'u1', office_id: 'o-cdrrmo' } };
vi.mock('@/lib/auth', () => ({ useAuth: () => auth }));
const { default: GovernanceRoutes } = await import('./routes');

afterEach(async () => { cleanup(); await db.manual_review_items.clear(); await db.offices.clear(); });
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><GovernanceRoutes /></MemoryRouter>);
const base = { id: 'i1', version: 1, source_tracker_id: 'VR-001', title: 'Confirm the EOC order', chapter_ref: 'Ch.1', priority: 'critical_urgent', review_status: 'open', validation_status: 'not_started' } as ManualReviewItem;
const as = async (roles: string[], office: string) => {
  auth.roles = roles; auth.profile = { id: 'u1', office_id: `o-${office}` };
  await db.offices.put({ id: `o-${office}`, code: office.toUpperCase(), name: office, kind: 'city_office' } as Office);
};

describe('validation workspace', () => {
  it('opens on the overview with tabs and the viewer’s own tasks', async () => {
    await as(['validator'], 'cdrrmo');
    await db.manual_review_items.put(base);
    at('/');
    expect(await screen.findByText('Validation workspace')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Validation workspace' })).toBeTruthy();
    expect(await screen.findByText('Validation load')).toBeTruthy();
    expect(await screen.findByText('Assign and set date')).toBeTruthy(); // the coordinator's step on an unassigned item
  });

  it('shows the register as a table and a prompt that names its gaps instead of guessing', async () => {
    await as(['validator'], 'cdrrmo');
    await db.manual_review_items.put(base);
    at('/reviews');
    expect(await screen.findByRole('table')).toBeTruthy();
    expect(screen.getAllByText('Critical & urgent').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Confirm the EOC order'));
    expect(await screen.findByText(/Missing\. Assign one lead office\./, {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText(/Missing\. Set the response date\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Assign', hidden: true })).toBeTruthy();
  });

  it('gives the lead office its own step, and a validator cannot verify their own recommendation', async () => {
    await as(['lead_office_focal'], 'cpdo');
    await db.manual_review_items.put({ ...base, lead_office: 'CPDO', lead_office_codes: ['CPDO'], due_date: '2099-12-01', assigned_at: '2026-11-28T00:00:00Z' });
    at('/reviews?item=VR-001');
    expect(await screen.findByRole('button', { name: 'Acknowledge', hidden: true })).toBeTruthy();
    expect(screen.getByText('Record your recommendation')).toBeTruthy();
    cleanup();
    await as(['validator'], 'cdrrmo');
    await db.manual_review_items.put({ ...base, lead_office: 'CPDO', lead_office_codes: ['CPDO'], due_date: '2099-12-01', recommendation: 'Accept', recommended_by: 'u1', evidence_ref: 'memo' });
    at('/reviews?item=VR-001');
    expect(await screen.findByText('Waiting for another validator to check the evidence.')).toBeTruthy();
    expect(screen.queryByText('Verify the evidence')).toBeNull();
  });
});
