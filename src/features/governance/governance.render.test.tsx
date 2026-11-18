import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import GovernanceRoutes from './routes';
import type { ManualReviewItem } from '@/types';

afterEach(async () => { cleanup(); await db.manual_review_items.clear(); });
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><GovernanceRoutes /></MemoryRouter>);

describe('validation workspace', () => {
  it('opens on the overview with tabs, not on a flat list', async () => {
    await db.manual_review_items.put({ id: 'i1', version: 1, source_tracker_id: 'VR-001', title: 'Confirm the EOC order', chapter_ref: 'Ch.1', priority: 'critical_urgent', review_status: 'open', validation_status: 'not_started' } as ManualReviewItem);
    at('/');
    expect(await screen.findByText('Validation overview')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Validation workspace' })).toBeTruthy();
    expect(await screen.findByText('Validation load')).toBeTruthy();
  });
  it('shows the register as a table with a priority pill per row', async () => {
    await db.manual_review_items.put({ id: 'i1', version: 1, source_tracker_id: 'VR-001', title: 'Confirm the EOC order', chapter_ref: 'Ch.1', priority: 'critical_urgent', review_status: 'open', validation_status: 'not_started' } as ManualReviewItem);
    at('/reviews');
    expect(await screen.findByRole('table')).toBeTruthy();
    expect(await screen.findByText('Confirm the EOC order')).toBeTruthy();
    expect(screen.getAllByText('Critical & urgent').length).toBeGreaterThan(0);
  });
});
