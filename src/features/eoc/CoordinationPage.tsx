/**
 * EOC Coordination (1.32.0): the team's messages, check-ins and the check-in call for the current activation.
 *
 * Adapted from the DDRiVE-M Monitoring Module (team hub, priority, emergency message, instant reports) and its
 * Organisation settings (member list, two-tap confirm), to MODE's rules:
 * - one thread per activation (ADR-040); it locks when the activation ends, so counts are this activation only;
 * - messages and check-ins save offline; the check-in call is an authority action (online RPC, never queued);
 * - urgent and the call are for the EOC Manager and the CDRRMO Head (guard in SQL, mirrored in domain/coordination);
 * - the expected people are the roster's approved designations for positions staffed at this level;
 * - "reports" open MODE's own records (SitReps, logbook, requests), not placeholders.
 */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { BellRing, ClipboardList, FileText, ListChecks, RadioTower, Truck, Users } from 'lucide-react';
import { db } from '@/lib/db';
import { callOnline, save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { useEocStatus, useNow, useOnline, useProfiles } from '@/lib/hooks';
import { fmtTime, relative } from '@/lib/time';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { ButtonLink, EmptyState, Field, Input, List, ListRow, Notice, PageHeader, Tabs } from '@/components/ui';
import { ConversationPanel, ensureThread, useThread } from '@/components/ConversationPanel';
import { manilaToday } from '@/domain/structure';
import { activeSections, hasModuleSet, liveModules } from '@/domain/scenarios';
import { LEVEL_INFO } from '@/domain/eoc';
import {
  canCallCheckin, CHECKIN_ANSWERS, checkinDue, checkinRoll, coordinationStats, nextCallAt, positionActiveAt, type CheckinAnswer,
} from '@/domain/coordination';
import type { ConversationMessage } from '@/types';
import { Block, Ring, Tile } from './kit';
import { EOC_TABS } from './labels';

const EOC_ROLES = ['eoc_manager', 'eoc_staff', 'duty_officer', 'cdrrmo_head', 'admin'] as const;

export function CoordinationPage() {
  const { level, activation } = useEocStatus();
  return (
    <div className="page">
      <PageHeader title="Coordination"
        subtitle="Messages, check-ins and the check-in call for the current activation. They lock when the activation ends." />
      <Tabs items={EOC_TABS} />
      {!activation ? (
        <EmptyState title="The EOC is at White level"
          body="Coordination opens with an activation. Messages and check-ins belong to that activation, so the counts here are for the current event only."
          action={<ButtonLink to="/eoc" icon={RadioTower} tip="Open the EOC board to see or change the alert level">Open the EOC board</ButtonLink>} />
      ) : (
        <ActivationCoordination activationId={activation.id} level={level} startedAt={activation.started_at} />
      )}
    </div>
  );
}

function ActivationCoordination({ activationId, level, startedAt }: { activationId: string; level: 'blue' | 'red' | 'white'; startedAt: string }) {
  const { roles, userId } = useAuth();
  const people = useProfiles();
  const now = useNow(15_000);
  const data = useThread('eoc_activation', activationId);
  const messages = useMemo(() => data?.messages ?? [], [data]);
  const roster = useLiveQuery(async () => {
    const today = manilaToday();
    // 1.33.0: with a plan activated, only the sections of the modules it switched on are expected; otherwise the level rule.
    const items = await db.activation_clusters.where('activation_id').equals(activationId).toArray();
    const sections = hasModuleSet(items) ? activeSections(liveModules(items)) : null;
    const positions = (await db.eoc_positions.toArray()).filter((p) => p.is_active
      && (sections ? sections.has(p.section) && positionActiveAt(level, p.min_level) : positionActiveAt(level, p.min_level)));
    const open = new Set(positions.map((p) => p.id));
    const designations = (await db.eoc_designations.toArray())
      .filter((d) => d.status === 'approved' && (d.valid_until === null || d.valid_until >= today) && open.has(d.position_id) && d.person_id);
    return { positions: positions.length, expected: [...new Set(designations.map((d) => d.person_id!))], byPlan: !!sections };
  }, [level, activationId], { positions: 0, expected: [] as string[], byPlan: false });
  const running = useLiveQuery(() => db.protocol_runs.where('status').equals('running').toArray(), [], []);

  const stats = coordinationStats(messages);
  const roll = checkinRoll(messages, roster.expected);
  const isEoc = roles.some((r) => (EOC_ROLES as readonly string[]).includes(r));
  const due = checkinDue(messages, userId);
  const name = (id: string | null | undefined) => (id && (people.get(id)?.full_name || people.get(id)?.position)) || 'Staff';
  const info = LEVEL_INFO[level];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Checked in" value={roll.expected ? `${roll.answeredExpected}/${roll.expected}` : roll.answers.length}
          tone={roll.callAt && roll.missing.length ? 'warn' : roll.expected && !roll.missing.length ? 'ok' : undefined}
          hint={roll.callAt ? `Since the call at ${fmtTime(roll.callAt)}` : roll.expected ? 'Designated for positions staffed at this level' : 'No designations for this level yet'} />
        <Tile label="People who posted" value={stats.people} hint={`On this ${info.name} activation, since ${fmtTime(startedAt)}`} />
        <Tile label="Messages" value={stats.messages} hint={stats.priority ? `${stats.priority} priority` : 'None marked priority'} tone={stats.priority ? 'warn' : undefined} />
        <Tile label="Urgent" value={stats.urgent} tone={stats.urgent ? 'bad' : undefined} hint="Urgent messages and check-in calls" />
      </div>

      {due && isEoc && (
        <Notice tone="bad" title="The EOC called a check-in">
          Answer below with where you are. The call was made {relative(roll.callAt, now.getTime())}.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ConversationPanel parentKind="eoc_activation" parentId={activationId} label={`EOC ${info.name} level`} title="Team Coordination"
            about="One conversation for this activation. Use Priority for what needs attention this shift. Decisions still go in the logbook." />
        </div>
        <div className="space-y-6">
          {isEoc && <CheckInBlock activationId={activationId} due={due} />}
          {canCallCheckin(roles) && <CallBlock activationId={activationId} messages={messages} now={now} />}
          <Block title="Check-In Roll" action={<ButtonLink to="/eoc/roster" icon={Users} variant="quiet" tip="Open the roster: who staffs each EOC position">Roster</ButtonLink>}>
            <div className="mb-3 flex items-center gap-3">
              <Ring value={roll.answeredExpected} max={Math.max(roll.expected, 1)} size={72} tone={roll.missing.length ? 'warn' : 'ok'}>
                {roll.expected ? Math.round((roll.answeredExpected / roll.expected) * 100) : 0}%
              </Ring>
              <p className="text-sm text-muted">
                {roll.expected
                  ? `${roll.expected} people are designated to the ${roster.positions} positions ${roster.byPlan ? 'in the modules the plan switched on' : `staffed at ${info.name} level`}.`
                  : `No approved designations for positions staffed at ${info.name} level. Answers still show here.`}
              </p>
            </div>
            {roll.answers.length > 0 && (
              <ul className="space-y-1 text-sm">
                {roll.answers.map((a) => (
                  <li key={a.personId} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{name(a.personId)}</span>
                    <span className={clsx('shrink-0 rounded-full px-2 text-xs font-bold', a.answer === 'Not available' ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok')}>{a.answer}</span>
                  </li>
                ))}
              </ul>
            )}
            {roll.callAt && roll.missing.length > 0 && (
              <>
                <p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-muted">No answer yet ({roll.missing.length})</p>
                <ul className="mt-1 space-y-1 text-sm">{roll.missing.map((p) => <li key={p} className="truncate">{name(p)}</li>)}</ul>
              </>
            )}
          </Block>
          <Block title="Records for This Activation">
            <List>
              <ListRow to="/eoc/sitreps" leading={<FileText className="h-5 w-5 text-action" aria-hidden />} title="Situation reports" meta="Pre-filled from the EOC records, for OCD VIII and the Province" tip="Open the SitReps for this activation" />
              <ListRow to="/eoc/log" leading={<ClipboardList className="h-5 w-5 text-action" aria-hidden />} title="Logbook" meta="Decisions and significant events; the check-in call is logged here" tip="Open the EOC logbook" />
              <ListRow to="/eoc/requests" leading={<Truck className="h-5 w-5 text-action" aria-hidden />} title="Resource requests" meta="From request to delivery" tip="Open resource requests" />
            </List>
          </Block>
          {running.length > 0 && (
            <Block title="Running Protocols">
              <List>
                {running.map((r) => (
                  <ListRow key={r.id} to={`/drrm/run/${r.id}`} leading={<ListChecks className="h-5 w-5 text-action" aria-hidden />}
                    title={r.title} meta={`Started ${relative(r.started_at, now.getTime())}. Each run has its own conversation`} tip="Open the run to continue its steps or discuss it" />
                ))}
              </List>
            </Block>
          )}
        </div>
      </div>
    </div>
  );
}

/** Every EOC member answers a call with one tap. Saves offline. */
function CheckInBlock({ activationId, due }: { activationId: string; due: boolean }) {
  const toast = useToast();
  const { userId } = useAuth();
  const [busy, setBusy] = useState<CheckinAnswer | null>(null);
  const answer = async (a: CheckinAnswer) => {
    setBusy(a);
    try {
      const thread = await ensureThread('eoc_activation', activationId, 'EOC coordination');
      if (thread.status !== 'open') { toast('This conversation is resolved. Ask the EOC Manager to reopen it or call a check-in.', 'bad'); return; }
      await save('conversation_messages', {
        // author_id is in the omit list: it shows here at once and the server stamps the real author.
        id: uuid(), thread_id: thread.id, body: a, in_reply_to: null, author_id: userId, created_at: new Date().toISOString(), kind: 'checkin', priority: 'routine', _new: true,
      } as ConversationMessage & { _new: boolean }, `Check in: ${a}`);
      toast(`Checked in: ${a}`);
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(null); }
  };
  return (
    <Block title="Check In" className={due ? 'border-bad' : undefined}>
      <p className="mb-3 text-sm text-muted">Tap where you are. It saves on this device and sends when there is a connection.</p>
      <div role="group" aria-label="Check in" className="grid grid-cols-2 gap-2">
        {CHECKIN_ANSWERS.map((a) => (
          <button key={a} type="button" disabled={busy !== null} onClick={() => void answer(a)} {...tip(`Check in as: ${a}`)}
            className={clsx('min-h-tap rounded-control border px-3 text-sm font-bold disabled:opacity-50',
              a === 'Not available' ? 'border-line bg-surface text-ink hover:border-warn' : 'border-accent bg-sky-soft text-ink hover:bg-accent hover:text-on-accent')}>
            {a}
          </button>
        ))}
      </div>
    </Block>
  );
}

/** The check-in call: an authority action, two taps, online only, five minutes apart. */
function CallBlock({ activationId, messages, now }: { activationId: string; messages: ConversationMessage[]; now: Date }) {
  const toast = useToast();
  const online = useOnline();
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const wait = nextCallAt(messages, now);
  const call = async () => {
    if (!armed) { setArmed(true); return; }
    setArmed(false); setBusy(true);
    try {
      await callOnline<string>('eoc_call_checkin', { p_activation_id: activationId, p_note: note.trim() || null }, 'Calling a check-in');
      setNote('');
      toast('Check-in called. Every EOC member sees it on Coordination and the bell');
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-sheet border border-bad bg-bad-soft p-4 shadow-raised">
      <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink"><BellRing className="h-5 w-5 text-bad" aria-hidden />Check-In Call</h2>
      <p className="mt-1 text-sm">Ask every EOC member on this activation to answer with where they are. It is written in the logbook.</p>
      <Field label="Note" optional hint="For example: report to your desk by 18:00. Up to 300 characters.">
        {(id, d) => <Input id={id} aria-describedby={d} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <button type="button" onClick={() => void call()} onBlur={() => setArmed(false)} disabled={!online || busy || wait !== null}
        {...tip(armed ? 'Select again to send the check-in call now' : 'Call a check-in. You are asked to select again to confirm. Needs a connection')}
        className={clsx('mt-2 min-h-tap w-full rounded-control px-4 font-bold disabled:cursor-not-allowed disabled:opacity-50',
          armed ? 'bg-bad text-on-level' : 'border border-bad bg-surface text-bad hover:bg-bad hover:text-on-level')}>
        {armed ? 'Select again to confirm and send' : 'Call a check-in'}
      </button>
      <p className="mt-2 text-xs text-muted">
        {!online ? 'Needs a connection.' : wait ? `The next call is possible at ${fmtTime(wait.toISOString())}.` : 'Reaches EOC members in MODE only. It is not a public warning.'}
      </p>
    </section>
  );
}
