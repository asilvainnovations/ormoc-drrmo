/**
 * Object-scoped conversation panel (ADR-040, 1.22.0).
 * Attach to IndicatorPage (response), CycleOverview (assessment_cycle),
 * and later EOC activation / protocol run screens.
 *
 * Messages: offline via save(). Resolve / reopen: updateOnline (authority).
 */
import { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MessageSquare, Send } from 'lucide-react';
import { db } from '@/lib/db';
import { save, updateOnline } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/time';
import { useToast } from '@/components/Toast';
import { Badge, Button, Loading, Notice, Section, Textarea } from '@/components/ui';
import type { ConversationMessage, ConversationParentKind, ConversationStatus, ConversationThread } from '@/types';

const PRIVACY =
  'Do not write names of affected persons, evacuees or informants. Prefer role or position. Aggregate counts only.';

const STATUS_TONE: Record<ConversationStatus, 'ok' | 'warn' | 'neutral'> = {
  open: 'ok',
  resolved: 'warn',
  locked: 'neutral',
};

type Props = {
  parentKind: ConversationParentKind;
  parentId: string;
  /** Short label shown in the header, e.g. indicator id or cycle name */
  label?: string;
};

export function ConversationPanel({ parentKind, parentId, label }: Props) {
  const { has } = useAuth();
  const online = useOnline();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const canPostAssessment = has('assessor') || has('validator') || has('cdrrmo_head') || has('admin') || has('lead_office_focal');
  const canPostEoc = has('eoc_manager') || has('eoc_staff') || has('duty_officer') || has('cdrrmo_head') || has('admin');
  const canPost =
    (parentKind === 'response' || parentKind === 'assessment_cycle') ? canPostAssessment : canPostEoc;
  const canResolve =
    (parentKind === 'response' || parentKind === 'assessment_cycle')
      ? (has('validator') || has('cdrrmo_head') || has('admin'))
      : (has('eoc_manager') || has('cdrrmo_head') || has('admin'));

  const data = useLiveQuery(async () => {
    const threads = await db.conversation_threads
      .where('[parent_kind+parent_id]')
      .equals([parentKind, parentId])
      .toArray();
    const active = threads.find((t: ConversationThread) => t.status !== 'locked')
      ?? threads.sort((a: ConversationThread, b: ConversationThread) =>
        (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0]
      ?? null;
    const messages = active
      ? await db.conversation_messages.where('thread_id').equals(active.id).sortBy('created_at')
      : [];
    const authors = await db.profiles.toArray();
    const byId = new Map(authors.map((p) => [p.id, p.full_name || p.position || 'Staff']));
    return { thread: active as ConversationThread | null, messages: messages as ConversationMessage[], byId };
  }, [parentKind, parentId]);

  const openThread = useCallback(async () => {
    if (!canPost) return;
    setBusy(true);
    try {
      const row: ConversationThread & { _new?: boolean } = {
        id: uuid(),
        parent_kind: parentKind,
        parent_id: parentId,
        title: label ? `Discussion — ${label}` : null,
        status: 'open',
        version: 1,
        _new: true,
      };
      await save('conversation_threads', row, 'Start conversation');
      toast('Conversation started');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }, [canPost, parentKind, parentId, label, toast]);

  const post = useCallback(async () => {
    const text = body.trim();
    if (!text || !data?.thread || data.thread.status !== 'open' || !canPost) return;
    setBusy(true);
    try {
      const row: ConversationMessage & { _new?: boolean } = {
        id: uuid(),
        thread_id: data.thread.id,
        body: text,
        in_reply_to: null,
        created_at: new Date().toISOString(),
        _new: true,
      };
      await save('conversation_messages', row, 'Post conversation message');
      setBody('');
      toast('Message saved');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }, [body, data, canPost, toast]);

  const setStatus = useCallback(async (status: 'resolved' | 'open') => {
    if (!data?.thread || !canResolve) return;
    if (!online) {
      toast('Resolving a conversation needs a connection', 'bad');
      return;
    }
    setBusy(true);
    try {
      await updateOnline(
        'conversation_threads',
        data.thread,
        { status } as Partial<ConversationThread>,
        status === 'resolved' ? 'Resolve conversation' : 'Reopen conversation',
      );
      toast(status === 'resolved' ? 'Conversation resolved' : 'Conversation reopened');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }, [data, canResolve, online, toast]);

  const profiles = data?.byId ?? new Map<string, string>();

  if (data === undefined) return <Loading />;

  return (
    <Section title="Conversation">
      <p className="mb-2 text-sm text-muted">
        Discuss this record with assessors, validators and authorised staff. Messages stay on this object only (ADR-040).
      </p>
      <Notice tone="info">{PRIVACY}</Notice>

      {!data.thread ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">No conversation yet.</span>
          {canPost && (
            <Button
              disabled={busy}
              onClick={() => void openThread()}
              tip="Start a discussion thread on this record. One open thread per record."
            >
              <MessageSquare className="mr-1 h-4 w-4" aria-hidden />
              Start conversation
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[data.thread.status]}>{data.thread.status}</Badge>
            {data.thread.status === 'open' && canResolve && (
              <Button
                variant="secondary"
                disabled={busy || !online}
                onClick={() => void setStatus('resolved')}
                tip="Mark resolved. Needs a connection. New messages are blocked until reopened."
              >
                Resolve
              </Button>
            )}
            {data.thread.status === 'resolved' && canResolve && (
              <Button
                variant="secondary"
                disabled={busy || !online}
                onClick={() => void setStatus('open')}
                tip="Reopen for further discussion. Needs a connection."
              >
                Reopen
              </Button>
            )}
            {data.thread.status === 'locked' && (
              <span className="text-sm text-muted">Locked with the parent record.</span>
            )}
          </div>

          <ul className="mt-4 space-y-3">
            {data.messages.length === 0 && (
              <li className="text-sm text-muted">No messages yet.</li>
            )}
            {data.messages.map((m) => (
              <li key={m.id} className="rounded-md border border-line bg-surface p-3">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
                  <span>{profiles.get(m.author_id ?? '') ?? 'Staff'}</span>
                  <span>{fmtDateTime(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              </li>
            ))}
          </ul>

          {data.thread.status === 'open' && canPost && (
            <div className="mt-4 space-y-2">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Write a message (no names of affected persons)…"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{body.trim().length}/2000</span>
                <Button
                  disabled={busy || !body.trim()}
                  onClick={() => void post()}
                  tip="Save the message to this device and queue it for sync."
                >
                  <Send className="mr-1 h-3.5 w-3.5" aria-hidden /> Post
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
