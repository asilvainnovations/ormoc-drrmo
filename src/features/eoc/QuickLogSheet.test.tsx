import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { db } from '@/lib/db';
import { QuickLogSheet } from './QuickLogSheet';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ userId: 'u1', roles: ['eoc_staff'], has: () => true }) }));
vi.mock('@/components/Toast', () => ({ useToast: () => () => undefined }));
vi.mock('@/lib/sync', async (orig) => ({ ...(await orig<object>()), syncNow: async () => undefined }));

const btn = (name: string) => screen.getByText(name).closest('button') as HTMLButtonElement;

afterEach(async () => { cleanup(); localStorage.clear(); await db.logbook_entries.clear(); await db.outbox.clear(); });

describe('quick logbook entry', () => {
  it('writes a warning from chips and one short field, and remembers the choices', async () => {
    render(<QuickLogSheet open onClose={() => undefined} />);
    fireEvent.click(await screen.findByText('Warning received'));
    const log = btn('Log it');
    expect(log.disabled).toBe(true);                                      // required chips not chosen yet
    expect(screen.getByText(/Still needed: from, hazard/)).toBeTruthy();
    fireEvent.click(btn('PAGASA'));
    fireEvent.click(btn('Heavy rain'));
    fireEvent.change(screen.getByLabelText('Area covered'), { target: { value: 'Ormoc Bay' } });
    expect(screen.getByText('Warning received: Heavy rain from PAGASA · Area: Ormoc Bay.')).toBeTruthy();
    fireEvent.click(log);
    await waitFor(async () => expect(await db.logbook_entries.count()).toBe(1));
    const row = (await db.logbook_entries.toArray())[0]!;
    expect(row.category).toBe('warning');
    expect(row.entry).toBe('Warning received: Heavy rain from PAGASA · Area: Ormoc Bay.');
    expect(JSON.parse(localStorage.getItem('logtpl:warning')!).source).toBe('PAGASA');
  });

  it('keeps a free-text note for anything the forms do not cover', async () => {
    render(<QuickLogSheet open onClose={() => undefined} />);
    fireEvent.click(await screen.findByText(/Other note/));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Generator refuelled' } });
    fireEvent.click(btn('Log it'));
    await waitFor(async () => expect((await db.logbook_entries.toArray())[0]?.entry).toBe('Generator refuelled'));
  });
});
