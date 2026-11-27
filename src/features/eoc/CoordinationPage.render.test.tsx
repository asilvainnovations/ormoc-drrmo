import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import { CoordinationPage } from './CoordinationPage';
import type { Activation, ConversationMessage, ConversationThread, EocDesignation, EocPosition } from '@/types';

const auth = vi.hoisted(() => ({ userId: 'u2', roles: ['eoc_staff'] as string[] }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ ...auth, has: (r: string) => auth.roles.includes(r) }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => () => undefined }));
vi.mock('@/lib/sync', async (orig) => ({ ...(await orig<object>()), syncNow: async () => undefined }));

const wrap = () => render(<MemoryRouter><CoordinationPage /></MemoryRouter>);
const act: Activation = { id: 'a1', version: 1, level: 'blue', reason: 'Typhoon', hazard_code: null, authority_ref: null, started_at: '2026-01-02T00:00:00Z', ended_at: null };
const thread: ConversationThread = { id: 't1', version: 1, parent_kind: 'eoc_activation', parent_id: 'a1', title: 'EOC coordination', status: 'open' };
const call: ConversationMessage = { id: 'm1', thread_id: 't1', body: 'Check-in: every EOC member, answer with where you are.', in_reply_to: null,
  author_id: 'mgr', created_at: '2026-01-02T01:00:00Z', kind: 'checkin_call', priority: 'urgent' };
const pos: EocPosition = { id: 'p1', version: 1, code: 'EOC-MGR', title: 'EOC Manager', section: 'command', min_level: 'blue', cluster_code: null, required_depth: 3, sort: 1, is_active: true };
const des = (id: string, person: string): EocDesignation => ({ id, version: 1, position_id: 'p1', rank: 1, person_id: person, office_id: null, designee_position: null,
  status: 'approved', valid_from: '2026-01-01', valid_until: null, note: null, proposed_by: null, approved_by: null, approved_at: null });

afterEach(async () => {
  cleanup();
  auth.roles = ['eoc_staff'];
  await Promise.all([db.eoc_activations.clear(), db.conversation_threads.clear(), db.conversation_messages.clear(), db.eoc_positions.clear(),
    db.eoc_designations.clear(), db.profiles.clear(), db.outbox.clear()]);
});

describe('Coordination (1.32.0)', () => {
  it('stays closed at White level', async () => {
    wrap();
    expect(await screen.findByText('The EOC is at White level')).toBeTruthy();
  });

  it('asks a staff member to answer a call, records the answer offline, and updates the roll', async () => {
    await db.eoc_activations.put(act);
    await db.conversation_threads.put(thread);
    await db.conversation_messages.put(call);
    await db.eoc_positions.put(pos);
    await db.eoc_designations.bulkPut([des('d1', 'u2'), des('d2', 'u3')]);
    await db.profiles.bulkPut([{ id: 'u2', full_name: 'Duty Staff', position: null, office_id: null, is_active: true },
      { id: 'u3', full_name: 'Planning Officer', position: null, office_id: null, is_active: true }]);
    wrap();
    expect(await screen.findByText('The EOC called a check-in')).toBeTruthy();
    expect(screen.queryByText('Check-In Call')).toBeNull();                 // staff cannot call
    expect(screen.queryByRole('button', { name: 'Urgent' })).toBeNull();    // nor post urgent
    expect(await screen.findByText('0/2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'At the EOC' }));
    await waitFor(async () => expect(await db.outbox.count()).toBe(1));
    const sent = (await db.conversation_messages.toArray()).filter((m) => m.kind === 'checkin');
    expect(sent[0]).toMatchObject({ thread_id: 't1', body: 'At the EOC', priority: 'routine', author_id: 'u2' });
    const out = (await db.outbox.toArray())[0]!;
    expect(out.row).not.toHaveProperty('author_id');                         // the server stamps the author
    expect(await screen.findByText('1/2')).toBeTruthy();
    expect(screen.queryByText('The EOC called a check-in')).toBeNull();
    expect(screen.getByText('Planning Officer')).toBeTruthy();               // still to answer
  });

  it('gives the EOC Manager the call, with a two-tap confirm, and urgent', async () => {
    auth.roles = ['eoc_manager'];
    await db.eoc_activations.put(act);
    await db.conversation_threads.put(thread);
    wrap();
    expect(await screen.findByText('Check-In Call')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Urgent' })).toBeTruthy();
    const b = screen.getByRole('button', { name: 'Call a check-in' });
    fireEvent.click(b);
    expect(screen.getByRole('button', { name: 'Select again to confirm and send' })).toBeTruthy();
    fireEvent.blur(screen.getByRole('button', { name: 'Select again to confirm and send' }));
    expect(screen.getByRole('button', { name: 'Call a check-in' })).toBeTruthy();
  });
});
