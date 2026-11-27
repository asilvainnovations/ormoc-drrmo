/**
 * Object-scoped conversation panel (ADR-040, 1.22.0; priorities and check-ins 1.32.0).
 * Mounted on IndicatorPage (response), RunPage (protocol_run) and the EOC Coordination screen (eoc_activation).
 *
 * Messages: offline via save(). Resolve / reopen: updateOnline (authority). A check-in call is made only on the
 * Coordination screen (eoc_call_checkin, online); here it shows as an urgent row.
 */
import { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { BellRing, MessageSquare, Send, UserCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { save, updateOnline } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/time';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { Badge, Button, Field, Loading, Notice, Section, Textarea } from '@/components/ui';
import { allowedPriorities, PRIORITY_HELP, PRIORITY_LABEL, PRIORITY_TONE } from '@/domain/coordination';
import type { ConversationMessage, ConversationParentKind, ConversationStatus, ConversationThread, MessagePriority } from '@/types';

export const PRIVACY_REMINDER =
  'Do not write names of affected persons, evacuees, patients or informants. Use a role or position. Counts only.';

const STATUS_TONE: Record<ConversationStatus, 'ok' | 'warn' | 'neutral'> = { open: 'ok', resolved: 'warn', locked: 'neutral' };
const STATUS_LABEL: Record<ConversationStatus, string> = { open: 'Open', resolved: 'Resolved', locked: 'Locked' };
const SHOW = 50;

const assessmentKind = (k: ConversationParentKind) => k === 'response' || k === 'assessment_cycle';

/** The active thread on a record (open or resolved), else its latest locked one, with its messages. */
export function useThread(parentKind: ConversationParentKind, parentId: string | null | undefined) {
  return useLiveQuery(async () => {
    if (!parentId) return { thread: null, messages: [] as ConversationMessage[] };
    const threads = await db.conversation_threads.where('[parent_kind+parent_id]').equals([parentKind, parentId]).toArray();
    const thread = threads.find((t) => t.status !== 'locked')
      ?? [...threads].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null;
    const messages = thread ? await db.conversation_messages.where('thread_id').equals(thread.id).sortBy('created_at') : [];
    return { thread, messages };
  }, [parentKind, parentId]);
}

/**
 * The record's open thread, or a new one. Online, it asks the server first: another device may have opened the
 * thread before this one pulled it, and a second open thread on one record is refused (one per record).
 */
export async function ensureThread(parentKind: ConversationParentKind, parentId: string, title: string | null): Promise<ConversationThread> {
  const local = (await db.conversation_threads.where('[parent_kind+parent_id]').equals([parentKind, parentId]).toArray())
    .find((t) => t.status !== 'locked');
  if (local) return local;
  if (navigator.onLine) {
    const { data } = await supabase.from('conversation_threads').select('*')
      .eq('parent_kind', parentKind).eq('parent_id', parentId).in('status', ['open', 'resolved']).maybeSingle();
    if (data) { await db.conversation_threads.put(data as ConversationThread); return data as ConversationThread; }
  }
  return save('conversation_threads', {
    id: uuid(), parent_kind: parentKind, parent_id: parentId, title, status: 'open', version: 1, _new: true,
  } as ConversationThread & { _new: boolean }, 'Start conversation');
}

type Props = {
  parentKind: ConversationParentKind;
  parentId: string;
  /** Short label for the thread title, e.g. indicator id, run title */
  label?: string;
  /** Section title. Default "Conversation". */
  title?: string;
  /** Text under the title. */
  about?: string;
};

export function ConversationPanel({ parentKind, parentId, label, title = 'Conversation', about }: Props) {
  const { has, roles, userId } = useAuth();
  const online = useOnline();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<MessagePriority>('routine');
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  const canPost = assessmentKind(parentKind)
    ? has('assessor') || has('validator') || has('cdrrmo_head') || has('admin') || has('lead_office_focal')
    : has('eoc_manager') || has('eoc_staff') || has('duty_officer') || has('cdrrmo_head') || has('admin');
  const canResolve = assessmentKind(parentKind)
    ? has('validator') || has('cdrrmo_head') || has('admin')
    : has('eoc_manager') || has('cdrrmo_head') || has('admin');
  const priorities = allowedPriorities(roles, parentKind);

  const data = useThread(parentKind, parentId);
  const people = useLiveQuery(async () => new Map((await db.profiles.toArray()).map((p) => [p.id, p.full_name || p.position || 'Staff'])), [], new Map<string, string>());

  const openThread = useCallback(async () => {
    if (!canPost) return;
    setBusy(true);
    try {
      await ensureThread(parentKind, parentId, label ? `Discussion: ${label}` : null);
      toast('Conversation started');
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  }, [canPost, parentKind, parentId, label, toast]);

  const post = useCallback(async () => {
    const text = body.trim();
    if (!text || !data?.thread || data.thread.status !== 'open' || !canPost) return;
    setBusy(true);
    try {
      await save('conversation_messages', {
        // author_id is omitted from the upload (tables.ts); kept on the device so the author shows before sync.
        id: uuid(), thread_id: data.thread.id, body: text, in_reply_to: null, author_id: userId, created_at: new Date().toISOString(),
        priority: priorities.includes(priority) ? priority : 'routine', kind: 'message', _new: true,
      } as ConversationMessage & { _new: boolean }, `${PRIORITY_LABEL[priority]} message`);
      setBody(''); setPriority('routine');
      toast('Message posted');
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  }, [body, data, canPost, priority, priorities, toast, userId]);

  const setStatus = useCallback(async (status: 'resolved' | 'open') => {
    if (!data?.thread || !canResolve) return;
    if (!online) { toast('Resolving a conversation needs a connection', 'bad'); return; }
    setBusy(true);
    try {
      await updateOnline('conversation_threads', data.thread, { status } as Partial<ConversationThread>,
        status === 'resolved' ? 'Resolve conversation' : 'Reopen conversation');
      toast(status === 'resolved' ? 'Conversation resolved' : 'Conversation reopened');
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  }, [data, canResolve, online, toast]);

  if (data === undefined) return <Loading />;
  const shown = all ? data.messages : data.messages.slice(-SHOW);
  const hidden = data.messages.length - shown.length;

  return (
    <Section title={title}>
      <p className="mb-2 text-sm text-muted">{about ?? 'Discuss this record with the people who work on it. Messages stay on this record only.'}</p>
      <Notice tone="info">{PRIVACY_REMINDER}</Notice>

      {!data.thread ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">No conversation yet.</span>
          {canPost && (
            <Button disabled={busy} icon={MessageSquare} onClick={() => void openThread()}
              tip="Start a discussion on this record. Works offline; it sends when there is a connection">Start conversation</Button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[data.thread.status]}>{STATUS_LABEL[data.thread.status]}</Badge>
            {data.thread.status === 'open' && canResolve && (
              <Button variant="secondary" disabled={busy || !online} onClick={() => void setStatus('resolved')}
                tip="Mark resolved. Needs a connection. New messages are blocked until it is reopened">Resolve</Button>
            )}
            {data.thread.status === 'resolved' && canResolve && (
              <Button variant="secondary" disabled={busy || !online} onClick={() => void setStatus('open')}
                tip="Reopen for further discussion. Needs a connection">Reopen</Button>
            )}
            {data.thread.status === 'locked' && <span className="text-sm text-muted">Locked with its record. It is kept as the record of the discussion.</span>}
          </div>

          {hidden > 0 && (
            <Button className="mt-3" variant="quiet" onClick={() => setAll(true)} tip="Show the earlier messages on this record">Show {hidden} earlier</Button>
          )}
          <ul className="mt-3 space-y-2" aria-live="polite">
            {data.messages.length === 0 && <li className="text-sm text-muted">No messages yet.</li>}
            {shown.map((m) => <MessageRow key={m.id} m={m} who={people.get(m.author_id ?? '') ?? 'Staff'} />)}
          </ul>

          {data.thread.status === 'open' && canPost && (
            <div className="mt-4 space-y-2">
              <div role="group" aria-label="Priority" className="flex flex-wrap gap-2">
                {priorities.map((p) => (
                  <button key={p} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)} {...tip(PRIORITY_HELP[p])}
                    className={clsx('min-h-tap rounded-full border px-4 text-sm font-bold',
                      priority === p ? (p === 'urgent' ? 'border-bad bg-bad text-on-level' : p === 'priority' ? 'border-warn bg-warn-soft text-ink' : 'border-accent bg-accent text-on-accent')
                        : 'border-line bg-surface text-ink hover:border-sky')}>
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
              <Field label="Message" tip="What the team needs to know. Short and factual">
                {(id) => <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000}
                  placeholder="Short and factual. No names of affected persons." />}
              </Field>
              <div className="flex items-center justify-between gap-2">
                <span className="font-data text-xs text-muted">{body.trim().length}/2000</span>
                <Button disabled={busy || !body.trim()} icon={Send} onClick={() => void post()}
                  tip="Post the message. It saves on this device and sends when there is a connection">Post</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function MessageRow({ m, who }: { m: ConversationMessage; who: string }) {
  const kind = m.kind ?? 'message';
  const pr = m.priority ?? 'routine';
  if (kind === 'checkin') {
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-sunken px-3 py-1.5 text-sm">
        <UserCheck className="h-4 w-4 text-ok" aria-hidden /><span className="font-semibold">{who}</span><span>checked in: {m.body}</span>
        <span className="ml-auto font-data text-xs text-muted">{fmtDateTime(m.created_at)}</span>
      </li>
    );
  }
  return (
    <li className={clsx('rounded-control border border-l-4 bg-surface p-3',
      pr === 'urgent' ? 'border-bad' : pr === 'priority' ? 'border-warn' : 'border-line')}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          {kind === 'checkin_call' && <BellRing className="h-4 w-4 text-bad" aria-hidden />}
          <span className="font-semibold text-ink">{who}</span>
          {pr !== 'routine' && <Badge tone={PRIORITY_TONE[pr]}>{kind === 'checkin_call' ? 'Check-in call' : PRIORITY_LABEL[pr]}</Badge>}
        </span>
        <span className="font-data">{fmtDateTime(m.created_at)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{m.body}</p>
    </li>
  );
}
