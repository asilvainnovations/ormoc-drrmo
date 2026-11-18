// Validation Workshop Agenda — ADR-043 Slice 1.
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Badge, EmptyState, Loading } from '@/components/ui';
import type { WorkshopSession } from '@/types';
import { WorkspaceHead } from './kit';
import { GOVERNANCE_CAVEAT, WORKSHOP_STATUS } from './labels';

export function WorkshopPage() {
  const sessions = useLiveQuery(
    () => db.workshop_sessions.orderBy('session_number').toArray(),
    [],
  );

  if (sessions === undefined) return <Loading />;

  return (
    <div className="space-y-4">
      <WorkspaceHead eyebrow="Workshop agenda" title="Validation Workshop" subtitle="Twelve-session agenda for the Manual validation window. Session times and venue to be confirmed by the Secretariat." />

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge>{sessions.length} sessions</Badge>
        <Badge tone="ok">{sessions.filter((s: WorkshopSession) => s.status === 'completed').length} completed</Badge>
        <Badge>{sessions.filter((s: WorkshopSession) => s.status === 'planned').length} planned</Badge>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="text-primary underline" to="/governance/reviews">Reviews</Link>
        <span aria-hidden>·</span>
        <Link className="text-primary underline" to="/governance/decisions">Decisions</Link>
        <span aria-hidden>·</span>
        <Link className="text-primary underline" to="/governance/stakeholders">Stakeholders</Link>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No workshop sessions"
          body="Import seed part 40 after applying the migration."
        />
      ) : (
        <ol className="space-y-3">
          {sessions.map((s: WorkshopSession) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-muted">{GOVERNANCE_CAVEAT}</p>
    </div>
  );
}

function SessionCard({ session }: { session: WorkshopSession }) {
  return (
    <li className="rounded-panel border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted">{session.source_session_key}</span>
        <Badge>Session {session.session_number}</Badge>
        <Badge>{WORKSHOP_STATUS[session.status]}</Badge>
        {session.scheduled_date_raw && (
          <span className="text-xs text-muted" {...tip('Date as recorded in the tracker')}>
            {session.scheduled_date_raw}
          </span>
        )}
      </div>
      <h3 className="mt-2 font-medium leading-snug">{session.title}</h3>
      {session.lead_office && (
        <p className="mt-1 text-sm text-muted">Lead: {session.lead_office}</p>
      )}
      {session.manual_coverage && (
        <p className="text-sm text-muted">Coverage: {session.manual_coverage}</p>
      )}
      {session.key_questions && (
        <p className="mt-2 text-sm" {...tip('Key validation questions for this session')}>
          <span className="font-medium">Questions: </span>
          {session.key_questions}
        </p>
      )}
      {session.expected_output && (
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-fg">Expected output: </span>
          {session.expected_output}
        </p>
      )}
      {session.outcome_summary && (
        <p className="mt-2 rounded-control bg-muted/30 p-2 text-sm">
          <span className="font-medium">Outcome: </span>
          {session.outcome_summary}
        </p>
      )}
    </li>
  );
}
