import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Badge, Field, Input, List, ListRow, Notice, PageHeader, Section, Tabs } from '@/components/ui';
import type { MooDocument } from '@/types';
import { DOC_STATUS, LIB_TABS } from './labels';

/** 1.10: find a section by code, title, old code (alias, ADR-012) or area number, e.g. "EOC Ch.2", "3-6", "area 4". */
export function matchesSection(d: MooDocument, q: string): boolean {
  const t = q.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return true;
  const area = /^area\s*(\d+)$/.exec(t);
  if (area) return d.area_no === Number(area[1]);
  const hay = [d.code, d.title, ...(d.aliases ?? []), d.area_no ? `area ${d.area_no}` : ''].join(' | ').toLowerCase();
  return t.split(' ').every((w) => hay.includes(w));
}

export function LibraryPage() {
  const [q, setQ] = useState('');
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
      <div className="mb-6 max-w-md">
        <Field label="Find a section" tip="Type to narrow the list of chapters, SOPs and annexes" hint="A code, a title word, an old chapter code, or “area 4”.">
          {(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. SOP 3-6, EOC Ch.2, contingency" />}
        </Field>
      </div>
      {data && q.trim() && !data.docs.some((d) => matchesSection(d, q)) && <Notice tone="info">No section matches “{q.trim()}”. Try a shorter word or an old chapter code.</Notice>}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        {manuals.map(([m, title]) => (
          <Section key={m} title={title}>
            <List>
              {data?.docs.filter((d) => d.manual === m && matchesSection(d, q)).map((d) => (
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
