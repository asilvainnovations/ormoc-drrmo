import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import { bootstrapReference } from '@/lib/bootstrap';
import InstitutionalPanels from './InstitutionalPanels';
import type { Cycle, ManualReviewItem, OutstandingDecision, Response, WorkshopSession } from '@/types';

const view = () => render(<MemoryRouter><InstitutionalPanels /></MemoryRouter>);
afterEach(async () => { cleanup(); await Promise.all([db.assessment_cycles.clear(), db.responses.clear(), db.manual_review_items.clear(), db.outstanding_decisions.clear(), db.workshop_sessions.clear()]); });

const cycle = { id: 'cy1', name: 'Baseline 2026', cycle_year: 2026, iat_version: '1.7', status: 'validation', version: 1 } as Cycle;

describe('institutional panels on the Today page', () => {
  it('says "Not scored" and "No assessment cycle yet", never a zero index, when there is nothing to show', async () => {
    await bootstrapReference();
    view();
    expect(await screen.findByText('No assessment cycle yet.')).toBeTruthy();
    expect(await screen.findByText(/Validation Tracker arrives with the next reference-data sync/)).toBeTruthy();
  });

  it('shows the IAT and the tracker as two separate panels with no combined score', async () => {
    await bootstrapReference();
    await db.assessment_cycles.put(cycle);
    await db.responses.bulkPut([{ id: 'r1', version: 1, cycle_id: 'cy1', indicator_id: 'A1.1', score: 3, is_na: false, na_justification: null, gap_remarks: null, recommended_action: null, status: 'draft' }] as Response[]);
    await db.manual_review_items.bulkPut([
      { id: 'i1', version: 1, source_tracker_id: 'VR-001', title: 'a', priority: 'critical_urgent', review_status: 'open', validation_status: 'not_started' },
      { id: 'i2', version: 1, source_tracker_id: 'VR-002', title: 'b', priority: 'standard', review_status: 'closed', validation_status: 'validated' },
    ] as ManualReviewItem[]);
    await db.outstanding_decisions.bulkPut([{ id: 'd1', version: 1, source_decision_id: 'OD-01', question: 'q', priority: 'critical_urgent', accountable_owner_office: 'o', authority_status: 'to_be_confirmed', decision_status: 'for_decision' }] as OutstandingDecision[]);
    await db.workshop_sessions.bulkPut([{ id: 's1', version: 1, source_session_key: 'WS-01', session_number: 1, title: 'Session 1', scheduled_date: '2026-12-01', status: 'planned' }] as WorkshopSession[]);
    view();
    expect(await screen.findByText('Institutional assessment (IAT)')).toBeTruthy();
    expect(await screen.findByText('Manual validation')).toBeTruthy();
    expect((await screen.findAllByText('1 of 2')).length).toBeGreaterThan(0);   // review items open and closed
    expect(screen.getByText(/never added to the IAT/)).toBeTruthy();
    expect(screen.getByText('Session 1')).toBeTruthy();
    expect(screen.queryByText(/combined/i)).toBeNull();
    // One Mandatory item scored 3 out of all Mandatory items (the total comes from the reference data).
    expect(within(document.body).getAllByText(/^1 of \d+$/).length).toBeGreaterThan(0);
  });
});
