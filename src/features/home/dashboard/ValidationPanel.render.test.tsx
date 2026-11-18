import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import { bootstrapReference } from '@/lib/bootstrap';
import ValidationPanel from './ValidationPanel';
import type { ManualReviewItem, OutstandingDecision, WorkshopSession } from '@/types';

const view = () => render(<MemoryRouter><ValidationPanel /></MemoryRouter>);
afterEach(async () => { cleanup(); await Promise.all([db.assessment_cycles.clear(), db.responses.clear(), db.manual_review_items.clear(), db.outstanding_decisions.clear(), db.workshop_sessions.clear()]); });


describe('validation panel on the Today page', () => {
  it('says plainly when the register has not arrived', async () => {
    await bootstrapReference();
    view();
    expect(await screen.findByText(/validation register arrives with the next reference-data sync/)).toBeTruthy();
    expect(screen.queryByText(/IAT/)).toBeNull();
  });

  it('shows progress, critical items, decisions and the next session, and nothing from the IAT', async () => {
    await bootstrapReference();
    await db.manual_review_items.bulkPut([
      { id: 'i1', version: 1, source_tracker_id: 'VR-001', title: 'a', priority: 'critical_urgent', review_status: 'open', validation_status: 'not_started' },
      { id: 'i2', version: 1, source_tracker_id: 'VR-002', title: 'b', priority: 'standard', review_status: 'closed', validation_status: 'validated' },
    ] as ManualReviewItem[]);
    await db.outstanding_decisions.bulkPut([{ id: 'd1', version: 1, source_decision_id: 'OD-01', question: 'q', priority: 'critical_urgent', accountable_owner_office: 'o', authority_status: 'to_be_confirmed', decision_status: 'open' }] as unknown as OutstandingDecision[]);
    await db.workshop_sessions.bulkPut([{ id: 's1', version: 1, source_session_key: 'WS-01', session_number: 1, title: 'Session 1', scheduled_date: '2026-12-01', status: 'planned' }] as WorkshopSession[]);
    view();
    expect(await screen.findByText('Validation')).toBeTruthy();
    expect(await screen.findByText('1 of 2')).toBeTruthy();
    expect(screen.getByText('Session 1')).toBeTruthy();
    expect(screen.queryByText(/maturity|IAT/i)).toBeNull();
  });
});
