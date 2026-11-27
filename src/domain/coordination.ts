/** EOC coordination (1.32.0): message priority, check-in answers and the check-in roll.
 *
 *  Mirrors supabase/migrations/20261128003900_eoc_coordination.sql:
 *  - app.checkin_answers()            → CHECKIN_ANSWERS
 *  - app.guard_conversation_message() → allowedPriorities()
 *  - public.eoc_call_checkin()        → CHECKIN_SPACING_MIN, nextCallAt()
 *  The server is authoritative; these only decide what the screen offers. */
import type { ConversationMessage, ConversationParentKind, EocLevel, MessagePriority, Role } from '@/types';

export const CHECKIN_ANSWERS = ['At the EOC', 'On the way', 'In the field', 'Not available'] as const;
export type CheckinAnswer = (typeof CHECKIN_ANSWERS)[number];

/** Minutes between two check-in calls on one activation. */
export const CHECKIN_SPACING_MIN = 5;

export const PRIORITY_LABEL: Record<MessagePriority, string> = { routine: 'Routine', priority: 'Priority', urgent: 'Urgent' };
export const PRIORITY_TONE: Record<MessagePriority, 'neutral' | 'warn' | 'bad'> = { routine: 'neutral', priority: 'warn', urgent: 'bad' };
export const PRIORITY_HELP: Record<MessagePriority, string> = {
  routine: 'Information for the team. No action expected now',
  priority: 'Needs attention this shift',
  urgent: 'Needs action now. EOC Manager or CDRRMO Head only',
};

const isEocKind = (k: ConversationParentKind) => k === 'eoc_activation' || k === 'protocol_run';

/** Priorities this person may choose on this kind of thread (same rule as the message guard). */
export function allowedPriorities(roles: readonly Role[], kind: ConversationParentKind): MessagePriority[] {
  const urgent = isEocKind(kind) && roles.some((r) => r === 'eoc_manager' || r === 'cdrrmo_head');
  return urgent ? ['routine', 'priority', 'urgent'] : ['routine', 'priority'];
}

/** Only the EOC Manager or the CDRRMO Head call a check-in. */
export const canCallCheckin = (roles: readonly Role[]) => roles.some((r) => r === 'eoc_manager' || r === 'cdrrmo_head');

const kindOf = (m: ConversationMessage) => m.kind ?? 'message';
const priorityOf = (m: ConversationMessage): MessagePriority => m.priority ?? 'routine';
const byTime = (a: ConversationMessage, b: ConversationMessage) => a.created_at.localeCompare(b.created_at);

export function latestCall(messages: readonly ConversationMessage[]): ConversationMessage | null {
  return [...messages].filter((m) => kindOf(m) === 'checkin_call').sort(byTime).at(-1) ?? null;
}

/** When the next call is allowed, or null if one is allowed now. */
export function nextCallAt(messages: readonly ConversationMessage[], now: Date): Date | null {
  const last = latestCall(messages);
  if (!last) return null;
  const at = new Date(new Date(last.created_at).getTime() + CHECKIN_SPACING_MIN * 60_000);
  return at > now ? at : null;
}

const LEVEL_RANK: Record<EocLevel, number> = { white: 0, blue: 1, red: 2 };
/** A position is staffed from its minimum level upward (White < Blue < Red). */
export const positionActiveAt = (level: EocLevel, minLevel: EocLevel) => LEVEL_RANK[minLevel] <= LEVEL_RANK[level];

export interface RollEntry { personId: string; answer: CheckinAnswer; at: string }
export interface CheckinRoll {
  /** The latest call, or null when none was made on this activation. */
  callAt: string | null;
  /** Each person's latest answer since the latest call (or ever, when no call was made). */
  answers: RollEntry[];
  /** Expected people with no answer since the call. */
  missing: string[];
  /** Expected people who answered. */
  answeredExpected: number;
  expected: number;
}

/** The check-in roll for one activation thread. `expected` = person ids designated to positions active at this level. */
export function checkinRoll(messages: readonly ConversationMessage[], expected: readonly string[]): CheckinRoll {
  const call = latestCall(messages);
  const since = call?.created_at ?? '';
  const latest = new Map<string, RollEntry>();
  for (const m of [...messages].sort(byTime)) {
    if (kindOf(m) !== 'checkin' || !m.author_id || m.created_at < since) continue;
    if (!(CHECKIN_ANSWERS as readonly string[]).includes(m.body)) continue;
    latest.set(m.author_id, { personId: m.author_id, answer: m.body as CheckinAnswer, at: m.created_at });
  }
  const want = [...new Set(expected)];
  const missing = want.filter((p) => !latest.has(p));
  return {
    callAt: call?.created_at ?? null,
    answers: [...latest.values()].sort((a, b) => b.at.localeCompare(a.at)),
    missing, answeredExpected: want.length - missing.length, expected: want.length,
  };
}

/** True when a check-in was called and this person has not answered since. */
export function checkinDue(messages: readonly ConversationMessage[], userId: string | null): boolean {
  if (!userId) return false;
  const call = latestCall(messages);
  if (!call) return false;
  return !messages.some((m) => kindOf(m) === 'checkin' && m.author_id === userId && m.created_at >= call.created_at);
}

export interface CoordinationStats { people: number; messages: number; priority: number; urgent: number; checkins: number }

/** Counts for the current activation only (invariant: EOC boards count the current event). */
export function coordinationStats(messages: readonly ConversationMessage[]): CoordinationStats {
  const msgs = messages.filter((m) => kindOf(m) === 'message');
  return {
    people: new Set(messages.map((m) => m.author_id).filter(Boolean)).size,
    messages: msgs.length,
    priority: msgs.filter((m) => priorityOf(m) === 'priority').length,
    urgent: messages.filter((m) => priorityOf(m) === 'urgent').length,
    checkins: messages.filter((m) => kindOf(m) === 'checkin').length,
  };
}
