import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Wallet } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { useNow } from '@/lib/hooks';
import { nextDeadline } from '@/domain/aa';
import { duration, fmtDateTime } from '@/lib/time';
import { Badge, ButtonLink, EmptyState, List, ListRow, Notice, PageHeader, Section, Tabs } from '@/components/ui';
import { EOC_TABS } from '../labels';
import { DECISION, DECL_STATUS, IMPACT } from './labels';

export function AaHomePage() {
  const { has } = useAuth();
  const now = useNow();
  const data = useLiveQuery(async () => ({
    decls: await db.declarations.orderBy('expected_impact_at').reverse().toArray(),
    pdras: (await db.pdra_sessions.orderBy('conducted_at').reverse().limit(20).toArray()),
    hazards: new Map((await db.hazards.toArray()).map((h) => [h.code, h.name])),
  }), []);
  const live = data?.decls.filter((d) => ['draft', 'requested', 'recommended', 'declared'].includes(d.status) || (d.status === 'lifted' && !d.report_submitted_at)) ?? [];
  const past = data?.decls.filter((d) => !live.includes(d)) ?? [];
  return (
    <div className="page">
      <PageHeader title="Anticipatory action" subtitle="RA 12287 and its IRR: pre-disaster risk assessment, State of Imminent Disaster, anticipatory actions, funds and reporting."
        actions={<>
          {has('cdrrmo_head', 'eoc_manager', 'eoc_staff') && <ButtonLink to="/eoc/aa/pdra/new" variant="primary" icon={Plus}>New PDRA</ButtonLink>}
          <ButtonLink to="/eoc/aa/funds" icon={Wallet}>AA funds</ButtonLink>
        </>} />
      <Tabs items={EOC_TABS} />
      <Notice tone="warn" title="Pending national guidelines">
        NDRRMC operational guidelines on hazard triggers and thresholds, and DBM–COA guidelines on AA funds, are still to be issued. The rules here follow the IRR signed 14 September 2026; an administrator updates them when the guidelines come out.
      </Notice>
      <Section title="Declarations needing attention">
        {live.length === 0 ? <EmptyState title="No declaration in progress" body="A declaration starts from a PDRA that finds severe impacts with at least 3 days of lead time." /> : (
          <List>{live.map((d) => {
            const dl = nextDeadline(d, now);
            return <ListRow key={d.id} to={`/eoc/aa/d/${d.id}`} tone={dl?.overdue ? 'bad' : undefined}
              title={`${data!.hazards.get(d.hazard_code) ?? d.hazard_code}`}
              meta={dl ? `${dl.label}: ${fmtDateTime(dl.due)} (${dl.overdue ? 'overdue by ' : 'in '}${duration(dl.hoursLeft)})` : `Expected impact ${fmtDateTime(d.expected_impact_at)}`}
              trailing={<Badge tone={d.status === 'declared' ? 'bad' : 'info'}>{DECL_STATUS[d.status]}</Badge>} />;
          })}</List>
        )}
      </Section>
      <Section title="Pre-disaster risk assessments">
        {data?.pdras.length === 0 ? <EmptyState title="No PDRA recorded" /> : (
          <List>{data?.pdras.map((p) => <ListRow key={p.id} to={`/eoc/aa/pdra/${p.id}`} title={`${data.hazards.get(p.hazard_code) ?? p.hazard_code}: ${p.forecast_source}`}
            meta={`${fmtDateTime(p.conducted_at)}. Impact ${IMPACT[p.impact_class].toLowerCase()}, expected ${fmtDateTime(p.expected_impact_at)}`}
            trailing={<Badge>{DECISION[p.decision].label}</Badge>} />)}</List>
        )}
      </Section>
      {past.length > 0 && (
        <Section title="Closed declarations">
          <List>{past.map((d) => <ListRow key={d.id} to={`/eoc/aa/d/${d.id}`} title={data!.hazards.get(d.hazard_code) ?? d.hazard_code}
            meta={d.eo_number ?? undefined} trailing={<Badge>{DECL_STATUS[d.status]}</Badge>} />)}</List>
        </Section>
      )}
    </div>
  );
}
