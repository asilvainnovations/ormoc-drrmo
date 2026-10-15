import { RefText } from '@/components/RefText';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Badge, PageHeader, Tabs } from '@/components/ui';
import { LIB_TABS } from './labels';

export function RequirementsPage() {
  const data = useLiveQuery(async () => {
    const mrs = await db.master_requirements.orderBy('sort').toArray();
    const links = await db.indicator_requirements.toArray();
    const n = new Map<string, number>(); for (const l of links) n.set(l.mr_id, (n.get(l.mr_id) ?? 0) + 1);
    return { mrs, n };
  }, []);
  return (
    <div className="page">
      <PageHeader title="Master requirements" subtitle="From the Master Requirements and Traceability workbook v1.1. Each requirement says what the assessment checks, what the manuals must contain and what this platform must do." />
      <Tabs items={LIB_TABS} />
      <div className="space-y-6">
        {data?.mrs.map((m) => (
          <article key={m.id} id={m.id} className="scroll-mt-24 border-b border-line pb-6">
            <h2 className="text-lg font-bold">{m.id} {m.title} <Badge tone={m.priority === 'Critical' ? 'bad' : m.priority === 'High' ? 'warn' : 'neutral'} className="ml-2 align-middle">{m.priority}</Badge></h2>
            <p className="mt-1 max-w-prose">{m.statement}</p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Indicators covered</dt><dd>{m.iat_coverage} ({data.n.get(m.id) ?? 0} linked)</dd></div>
              <div><dt className="text-muted">Source</dt><dd><RefText text={m.source_basis} /></dd></div>
              <div><dt className="text-muted">Manual output</dt><dd>{m.moo_output}</dd></div>
              <div><dt className="text-muted">Platform requirement</dt><dd>{m.platform_req}</dd></div>
              {m.escalation_rule && <div className="sm:col-span-2"><dt className="text-muted">Escalation rule</dt><dd>{m.escalation_rule}</dd></div>}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
