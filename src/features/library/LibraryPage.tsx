import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Badge, List, ListRow, PageHeader, Section, Tabs } from '@/components/ui';
import { DOC_STATUS, LIB_TABS } from './labels';

export function LibraryPage() {
  const data = useLiveQuery(async () => {
    const docs = await db.moo_documents.orderBy('sort').toArray();
    const links = await db.moo_document_indicators.toArray();
    const count = new Map<string, number>();
    for (const l of links) count.set(l.document_id, (count.get(l.document_id) ?? 0) + 1);
    return { docs, count };
  }, []);
  const manuals: [string, string][] = [['MOO', 'CDRRMO Manual of Operations'], ['EOC', 'EOC Manual']];
  return (
    <div className="page">
      <PageHeader title="Library" subtitle="The two manuals, written chapter by chapter against the assessment findings." />
      <Tabs items={LIB_TABS} />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        {manuals.map(([m, title]) => (
          <Section key={m} title={title}>
            <List>
              {data?.docs.filter((d) => d.manual === m).map((d) => (
                <ListRow tip="Open this section: current text, versions and linked indicators" key={d.id} to={`/library/doc/${d.id}`} title={`${d.code} ${d.title}`}
                  meta={`${data.count.get(d.id) ?? 0} indicator gap(s) route here`}
                  trailing={<Badge tone={d.status === 'approved' ? 'ok' : d.status === 'in_review' ? 'info' : 'neutral'}>{DOC_STATUS[d.status]}</Badge>} />
              ))}
            </List>
          </Section>
        ))}
      </div>
    </div>
  );
}
