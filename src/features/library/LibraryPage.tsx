import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Badge, Field, Input, List, ListRow, Notice, PageHeader, Section, Tabs, TextLink } from '@/components/ui';
import { tip } from '@/components/Tooltip';
import type { ManualArea, ManualPart, MooDocument } from '@/types';
import { DOC_KIND, DOC_STATUS, LIB_TABS } from './labels';

/** 1.10: find a section by code, title, old code (alias, ADR-012) or area number, e.g. "EOC Ch.2", "3-6", "area 4". */
export function matchesSection(d: MooDocument, q: string): boolean {
  const t = q.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return true;
  const area = /^area\s*(\d+)$/.exec(t);
  if (area) return d.area_no === Number(area[1]);
  const hay = [d.code, d.title, ...(d.aliases ?? []), d.area_no ? `area ${d.area_no}` : ''].join(' | ').toLowerCase();
  return t.split(' ').every((w) => hay.includes(w));
}

interface AreaGroup { area: ManualArea; doc: MooDocument | undefined; rows: MooDocument[] }
interface PartGroup { part: ManualPart; areas: AreaGroup[]; loose: MooDocument[] }

/** 1.12: the Library organized the way the Manual reads — five Parts, ten functional areas,
 *  with chapters, SOPs, forms and annexes nested under their area. The legacy EOC Manual
 *  keeps its own section. */
export function LibraryPage() {
  const [q, setQ] = useState('');
  const data = useLiveQuery(async () => {
    const docs = await db.moo_documents.orderBy('sort').toArray();
    const links = await db.moo_document_indicators.toArray();
    const count = new Map<string, number>();
    for (const l of links) count.set(l.document_id, (count.get(l.document_id) ?? 0) + 1);
    const parts = await db.manual_parts.orderBy('sort').toArray();
    const areas = await db.manual_areas.orderBy('sort').toArray();
    return { docs, count, parts, areas };
  }, []);

  const all = data?.docs ?? [];
  const match = (d: MooDocument) => matchesSection(d, q);
  const groups: PartGroup[] = (data?.parts ?? []).map((part) => {
    const areas = (data?.areas ?? []).filter((a) => a.part_no === part.no).map((area) => {
      const rows = all.filter((d) => d.manual === 'MOO' && d.area_no === area.no && d.kind !== 'area' && match(d));
      return { area, doc: all.find((d) => d.manual === 'MOO' && d.kind === 'area' && d.area_no === area.no), rows };
    }).filter((g) => g.rows.length > 0 || (g.doc && match(g.doc)));
    const loose = all.filter((d) => d.manual === 'MOO' && !d.area_no && match(d));
    return { part, areas, loose };
  }).filter((g) => g.areas.length > 0 || g.loose.length > 0);
  const eoc = all.filter((d) => d.manual === 'EOC' && match(d));
  const docCount = (list: MooDocument[]) => list.filter((d) => d.status !== 'superseded').length;

  return (
    <div className="page">
      <PageHeader title="Library" subtitle="The CDRRMO Manual of Operations, organized by Part and functional area, with the EOC Manual alongside. The approved manuals remain the legal documents." />
      <Tabs items={LIB_TABS} />
      <div className="mb-6 max-w-md">
        <Field label="Find a section" tip="Type to narrow the list of chapters, SOPs, forms and annexes" hint="A code, a title word, an old chapter code, or “area 4”.">
          {(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. SOP 3-6, EOC Ch.2, contingency" />}
        </Field>
      </div>
      {data && q.trim() && groups.length === 0 && eoc.length === 0 && <Notice tone="info">No section matches “{q.trim()}”. Try a shorter word or an old chapter code.</Notice>}

      {groups.map(({ part, areas, loose }) => (
        <Section key={part.no} title={`Part ${part.no} · ${part.title}`}>
          {part.summary && <p className="mb-3 -mt-1 text-sm text-muted">{part.summary}</p>}
          {areas.map(({ area, doc, rows }) => (
            <div key={area.no} className="mb-6">
              <h3 className="mb-1 font-bold" {...tip(`Functional area ${area.no}: ${area.mcr_primary ?? 'Manual area'}`)}>
                Area {area.no} · {area.title}
              </h3>
              {area.scope && <p className="mb-2 text-xs leading-5 text-muted">{area.scope}</p>}
              {doc && (
                <p className="mb-1 text-sm" {...tip('The Manual’s own introduction to this area')}>
                  In the Manual: <TextLink size="sm" tip="Open the Manual’s introduction to this area" to={`/library/doc/${doc.id}`}>{doc.code} {doc.title}</TextLink>
                </p>
              )}
              {rows.length > 0 && (
                <List>
                  {rows.map((d) => (
                    <ListRow tip="Open this section: current text, versions and linked indicators" key={d.id} to={`/library/doc/${d.id}`} title={<>{d.code} {d.title}{d.kind !== 'chapter' && <Badge tone="neutral" className="ml-2">{DOC_KIND[d.kind]}</Badge>}</>}
                      meta={`${data!.count.get(d.id) ?? 0} indicator gap(s) route here`}
                      trailing={<Badge tone={d.status === 'approved' ? 'ok' : d.status === 'in_review' ? 'info' : 'neutral'}>{DOC_STATUS[d.status]}</Badge>} />
                  ))}
                </List>
              )}
            </div>
          ))}
          {loose.length > 0 && (
            <List>
              {loose.map((d) => (
                <ListRow tip="Open this section: current text, versions and linked indicators" key={d.id} to={`/library/doc/${d.id}`} title={<>{d.code} {d.title}{d.kind !== 'chapter' && <Badge tone="neutral" className="ml-2">{DOC_KIND[d.kind]}</Badge>}</>}
                  meta={`${data!.count.get(d.id) ?? 0} indicator gap(s) route here`}
                  trailing={<Badge tone={d.status === 'approved' ? 'ok' : d.status === 'in_review' ? 'info' : 'neutral'}>{DOC_STATUS[d.status]}</Badge>} />
              ))}
            </List>
          )}
        </Section>
      ))}

      {eoc.length > 0 && (
        <Section title={`EOC Manual (${docCount(eoc)} sections)`}>
          <p className="mb-3 -mt-1 text-sm text-muted">The legacy EOC Manual sections, kept alongside the unified Manual (ADR-012). Their aliases still work in the search above.</p>
          <List>
            {eoc.map((d) => (
              <ListRow tip="Open this section: current text, versions and linked indicators" key={d.id} to={`/library/doc/${d.id}`} title={<>{d.code} {d.title}{d.kind !== 'chapter' && <Badge tone="neutral" className="ml-2">{DOC_KIND[d.kind]}</Badge>}</>}
                meta={`${data!.count.get(d.id) ?? 0} indicator gap(s) route here`}
                trailing={<Badge tone={d.status === 'approved' ? 'ok' : d.status === 'in_review' ? 'info' : 'neutral'}>{DOC_STATUS[d.status]}</Badge>} />
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}
