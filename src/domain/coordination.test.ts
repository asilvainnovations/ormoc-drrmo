import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '@/types';
import {
  allowedPriorities, canCallCheckin, CHECKIN_ANSWERS, CHECKIN_SPACING_MIN, checkinDue, checkinRoll, coordinationStats, nextCallAt, positionActiveAt,
} from './coordination';

const SQL = readFileSync('supabase/migrations/20261128003900_eoc_coordination.sql', 'utf8');
let n = 0;
const msg = (p: Partial<ConversationMessage>): ConversationMessage => ({
  id: `m${++n}`, thread_id: 't', body: 'x', in_reply_to: null, author_id: 'a', created_at: '2026-11-28T01:00:00Z', kind: 'message', priority: 'routine', ...p,
});

describe('coordination parity with the migration', () => {
  it('uses the same check-in answers as app.checkin_answers()', () => {
    const list = /array\[([^\]]+)\]::text\[\]/.exec(SQL)?.[1];
    expect(list?.split(',').map((s) => s.trim().replace(/^'|'$/g, ''))).toEqual([...CHECKIN_ANSWERS]);
  });
  it('uses the same spacing between calls', () => {
    expect(SQL).toContain(`interval '${CHECKIN_SPACING_MIN} minutes'`);
  });
});

describe('priorities', () => {
  it('gives urgent to the EOC Manager and the Head on EOC threads only', () => {
    expect(allowedPriorities(['eoc_manager'], 'eoc_activation')).toContain('urgent');
    expect(allowedPriorities(['cdrrmo_head'], 'protocol_run')).toContain('urgent');
    expect(allowedPriorities(['eoc_staff', 'duty_officer'], 'eoc_activation')).toEqual(['routine', 'priority']);
    expect(allowedPriorities(['cdrrmo_head'], 'response')).toEqual(['routine', 'priority']);
  });
  it('lets only the EOC Manager or the Head call a check-in', () => {
    expect(canCallCheckin(['eoc_manager'])).toBe(true);
    expect(canCallCheckin(['admin', 'eoc_staff'])).toBe(false);
  });
});

describe('check-in roll', () => {
  const call = msg({ kind: 'checkin_call', priority: 'urgent', author_id: 'mgr', created_at: '2026-11-28T02:00:00Z' });
  it('counts only answers since the latest call, one per person, latest wins', () => {
    const r = checkinRoll([
      msg({ kind: 'checkin', body: 'At the EOC', author_id: 'p1', created_at: '2026-11-28T01:30:00Z' }),  // before the call
      call,
      msg({ kind: 'checkin', body: 'On the way', author_id: 'p1', created_at: '2026-11-28T02:01:00Z' }),
      msg({ kind: 'checkin', body: 'At the EOC', author_id: 'p1', created_at: '2026-11-28T02:20:00Z' }),
      msg({ kind: 'checkin', body: 'In the field', author_id: 'p9', created_at: '2026-11-28T02:05:00Z' }),  // not designated
    ], ['p1', 'p2', 'p2']);
    expect(r.callAt).toBe(call.created_at);
    expect(r.answers.find((a) => a.personId === 'p1')?.answer).toBe('At the EOC');
    expect(r.answers).toHaveLength(2);
    expect(r).toMatchObject({ missing: ['p2'], answeredExpected: 1, expected: 2 });
  });
  it('ignores an answer that is not one of the fixed choices', () => {
    expect(checkinRoll([msg({ kind: 'checkin', body: 'home', author_id: 'p1' })], ['p1']).missing).toEqual(['p1']);
  });
  it('says a check-in is due until the person answers', () => {
    expect(checkinDue([], 'p1')).toBe(false);
    expect(checkinDue([call], 'p1')).toBe(true);
    expect(checkinDue([call, msg({ kind: 'checkin', body: 'On the way', author_id: 'p1', created_at: '2026-11-28T02:03:00Z' })], 'p1')).toBe(false);
  });
  it('spaces calls five minutes apart', () => {
    expect(nextCallAt([call], new Date('2026-11-28T02:03:00Z'))?.toISOString()).toBe('2026-11-28T02:05:00.000Z');
    expect(nextCallAt([call], new Date('2026-11-28T02:06:00Z'))).toBeNull();
    expect(nextCallAt([], new Date())).toBeNull();
  });
  it('staffs a position from its minimum level up', () => {
    expect(positionActiveAt('blue', 'blue')).toBe(true);
    expect(positionActiveAt('blue', 'red')).toBe(false);
    expect(positionActiveAt('red', 'white')).toBe(true);
  });
});

describe('stats', () => {
  it('counts people, messages and urgency, treating old rows without kind or priority as routine messages', () => {
    const old = { ...msg({ author_id: 'p3' }) } as ConversationMessage;
    delete old.kind; delete old.priority;
    const s = coordinationStats([old, msg({ priority: 'priority', author_id: 'p1' }), msg({ kind: 'checkin_call', priority: 'urgent', author_id: 'mgr' }),
      msg({ kind: 'checkin', body: 'At the EOC', author_id: 'p1' })]);
    expect(s).toEqual({ people: 3, messages: 2, priority: 1, urgent: 1, checkins: 1 });
  });
});
