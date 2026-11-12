import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge, Field, Input, List, ListRow, Notice, PageHeader, Section, Tabs, TextLink } from '@/components/ui';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { StatusBadge, StatusLegend } from '@/components/StatusBadge';
import { tip } from '@/components/Tooltip';
import { useT, type StringKey } from '@/lib/i18n';
import type { ManualArea, MooDocument } from '@/types';
import { DOC_KIND, LIB_TABS } from './labels';
import { PILLAR_CLASS, PILLAR_KEYS, pillarOfArea } from './pillars';
import type { ThematicArea } from '@/features/protocols/labels';

/** 1.10: find a section by code, title, old code (alias, ADR-012) or area number, e.g. "EOC Ch.2", "3-6", "area 4". */
export function matchesSection(d: MooDocument, q: string): boolean {
  const t = q.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return true;
  const area = /^area\s*(\d+)$/.exec(t);
  if (area) return d.area_no === Number(area[1]);
  const hay = [d.code, d.title, ...(d.aliases ?? []), d.area_no ? `area ${d.area_no}` : ''].join(' | ').toLowerCase();
  return t.split(' ').every((w) => hay.includes(w));
}

const GROUPS: { kind: MooDocument['kind']; label: string }[] = [{ kind: 'sop', label: 'SOPs' }, { kind: 'form', label: 'Forms' }, { kind: 'annex', label: 'Annexes' }];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const chapterNo = (d: MooDocument) => d.chapter_no ?? Number(/Chapter\s+(\d+)/.exec(d.code)?.[1] ?? 99);

/** One collapsible block: a header row that opens and closes, and its content. Callers re-key it on search so
 *  it opens with the results (uncontrolled, so a person can still close it).
 *  1.17 (ADR-031): `accent` tints the block with its DRRM pillar colour — the Library's visual separator. */
function Block({ title, meta, badge, open, children, tipText, accent }: { title: ReactNode; meta?: ReactNode; badge?: ReactNode; open?: boolean; children: ReactNode; tipText: string; accent?: ThematicArea | null }) {
  const classes = accent ? PILLAR_CLASS[accent] : null;
  return (
    <Collapsible defaultOpen={open} className={`rounded-card border border-line bg-surface${classes ? ` border-l-4 ${classes.edge}` : ''}`}>
      <CollapsibleTrigger className={`group flex min-h-tap w-full items-start gap-3 rounded-card p-4 text-left hover:bg-sky-soft${classes ? ` ${classes.band}` : ''}`} {...tip(tipText)}>
        <span className="flex-1">
          <span className="block font-bold text-ink">{title}</span>
          {meta && <span className="mt-1 block text-sm text-muted">{meta}</span>}
        </span>
        {badge}
        <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** 1.17: a pillar pill (dot + translated label) used on chapters, areas and the legend. */
function PillarChip({ pillar, t }: { pillar: ThematicArea; t: (k: StringKey) => string }) {
  const c = PILLAR_CLASS[pillar];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${c.chip}`} {...tip(`DRRM pillar: ${t(`pillar.${pillar}`)}. The Library groups chapters and files under the four pillars, from prevention to recovery.`)}>
      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />{t(`pillar.${pillar}`)}
    </span>
  );
}

function DocRows({ docs, count, chips = true }: { docs: MooDocument[]; count: Map<string, number>; chips?: boolean }) {
  return (
    <List>
      {docs.map((d) => (
        <ListRow tip="Open this section: current text, versions and linked indicators" key={d.id} to={`/library/doc/${d.id}`}
          title={<>{d.code} {d.title}{chips && d.kind !== 'chapter' && d.kind !== 'area' && <Badge tone="neutral" className="ml-2">{DOC_KIND[d.kind]}</Badge>}</>}
          meta={`${count.get(d.id) ?? 0} indicator gap(s) route here`} trailing={<StatusBadge status={d.status} />} />
      ))}
    </List>
  );
}

/** 1.14: the Library reads like the Manual — one block per written chapter with its SOPs, forms and annexes,
 *  then the functional areas still waiting for a chapter, superseded sections and the legacy EOC Manual.
 *  "Functional area" is the IAT's grouping of indicators (ADR-012); a chapter can cover part of an area. */
export function LibraryPage() {
  const t = useT();
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

  const searching = q.trim().length > 0;
  const all = data?.docs ?? [];
  const count = data?.count ?? new Map<string, number>();
  const areaOf = (no: number | null | undefined) => (data?.areas ?? []).find((a) => a.no === no);
  const moo = all.filter((d) => d.manual === 'MOO');
  const live = moo.filter((d) => d.status !== 'superseded');
  const chapters = live.filter((d) => d.kind === 'chapter').sort((a, b) => chapterNo(a) - chapterNo(b));
  const childrenOf = (ch: MooDocument) => live.filter((d) => d.kind !== 'chapter' && d.kind !== 'area' && (d.parent_id === ch.id || (d.chapter_no != null && d.chapter_no === ch.chapter_no)));
  const inChapter = new Set(chapters.flatMap((c) => childrenOf(c).map((d) => d.id)));
  const chapterBlocks = chapters.map((ch) => {
    const kids = childrenOf(ch);
    const shown = searching ? kids.filter((d) => matchesSection(d, q)) : kids;
    return { ch, kids, shown, hit: matchesSection(ch, q) || shown.length > 0 };
  }).filter((b) => !searching || b.hit);
  const areaBlocks = (data?.areas ?? []).map((area: ManualArea) => {
    const intro = live.find((d) => d.kind === 'area' && d.area_no === area.no);
    const loose = live.filter((d) => d.area_no === area.no && d.kind !== 'area' && d.kind !== 'chapter' && !inChapter.has(d.id));
    const hasChapter = chapters.some((c) => c.area_no === area.no);
    const rows = [intro, ...loose].filter((d): d is MooDocument => !!d && matchesSection(d, q));
    return { area, rows, hasChapter };
  }).filter((b) => !b.hasChapter && b.rows.length > 0);
  const superseded = moo.filter((d) => d.status === 'superseded' && matchesSection(d, q));
  const eoc = all.filter((d) => d.manual === 'EOC' && matchesSection(d, q));
  const partTitle = (no: number) => data?.parts.find((p) => p.no === no)?.title ?? '';
  const nothing = searching && chapterBlocks.length === 0 && areaBlocks.length === 0 && superseded.length === 0 && eoc.length === 0;

  return (
    <div className="page">
      <PageHeader title="Library" subtitle="The CDRRMO Manual of Operations chapter by chapter, with each chapter's SOPs, forms and annexes, and the EOC Manual alongside. The approved manuals remain the legal documents." />
      <Tabs items={LIB_TABS} />
      <div className="mb-6 max-w-md">
        <Field label="Find a section" tip="Type to narrow the list of chapters, SOPs, forms and annexes" hint="A code, a title word, an old chapter code, or “area 4”.">
          {(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. SOP 3-6, EOC Ch.2, contingency" />}
        </Field>
      </div>
      <StatusLegend subject="Manual text" />
      {/* 1.17 (ADR-031): pillar legend — the four DRRM areas the block colours and chips refer to. */}
      <div className="mb-6 flex flex-wrap items-center gap-2" role="list" aria-label={t('library.pillars')}>
        <span className="text-sm text-muted">{t('library.pillars')}:</span>
        {PILLAR_KEYS.map(({ key }) => (
          <span key={key} role="listitem"><PillarChip pillar={key} t={t} /></span>
        ))}
      </div>
      {data && nothing && <Notice tone="info">No section matches “{q.trim()}”. Try a shorter word or an old chapter code.</Notice>}

      {chapterBlocks.length > 0 && (
        <Section title={t('library.chapters')}>
          <p className="mb-3 -mt-1 max-w-prose text-sm text-muted">Each chapter opens to show its SOPs, forms and annexes. The functional area is the IAT grouping of indicators the chapter answers; a chapter can cover part of an area.</p>
          <div className="space-y-3">
            {chapterBlocks.map(({ ch, kids, shown }) => {
              const area = areaOf(ch.area_no);
              const n = (k: MooDocument['kind']) => kids.filter((d) => d.kind === k).length;
              return (
                <Block key={`${ch.id}-${searching}`} open={searching} tipText={`Show or hide the sections of ${ch.code}`}
                  accent={pillarOfArea(ch.area_no)}
                  title={<>{ch.code} · {ch.title}</>}
                  meta={<>{area && <span {...tip(`IAT functional area ${area.no}: ${area.title}. Part ${area.part_no}: ${partTitle(area.part_no)}`)}>Functional area {area.no} · {area.title}</span>}
                    <span className="ml-2">· {plural(n('sop'), 'SOP')} · {plural(n('form'), 'form')} · {plural(n('annex'), 'annex', 'annexes')}</span></>}
                  badge={<span className="flex items-center gap-2"><PillarChip pillar={pillarOfArea(ch.area_no) ?? 'preparedness'} t={t} /><StatusBadge status={ch.status} className="mt-0.5" /></span>}>
                  <p className="mb-2 text-sm"><TextLink size="sm" tip="Open the chapter text, its versions and linked indicators" to={`/library/doc/${ch.id}`}>Open {ch.code}</TextLink>
                    <span className="text-muted"> · {count.get(ch.id) ?? 0} indicator gap(s) route here</span></p>
                  {GROUPS.map(({ kind, label }) => {
                    const rows = shown.filter((d) => d.kind === kind);
                    if (!rows.length) return null;
                    return (
                      <div key={kind}>
                        <Separator className="my-3" />
                        <h4 className="mb-1 text-sm font-semibold text-muted">{label} ({rows.length})</h4>
                        <DocRows docs={rows} count={count} chips={false} />
                      </div>
                    );
                  })}
                </Block>
              );
            })}
          </div>
        </Section>
      )}

      {areaBlocks.length > 0 && (
        <>
          <Separator className="my-6" />
          <Section title={t('library.areas')}>
            <p className="mb-3 -mt-1 max-w-prose text-sm text-muted">The Manual's introduction to each remaining area, and any section already drafted for it. The chapters follow the sequence set in Chapter 1.</p>
            <div className="space-y-3">
              {areaBlocks.map(({ area, rows }) => (
                <Block key={`${area.no}-${searching}`} open={searching} tipText={`Show or hide functional area ${area.no}`}
                  accent={pillarOfArea(area.no)}
                  title={<span className="flex flex-wrap items-center gap-2">Area {area.no} · {area.title}<PillarChip pillar={pillarOfArea(area.no) ?? 'preparedness'} t={t} /></span>}
                  meta={`Part ${area.part_no} · ${partTitle(area.part_no)}`}>
                  {area.scope && <p className="mb-2 max-w-prose text-xs leading-5 text-muted">{area.scope}</p>}
                  <DocRows docs={rows} count={count} />
                </Block>
              ))}
            </div>
          </Section>
        </>
      )}

      {superseded.length > 0 && (
        <>
          <Separator className="my-6" />
          <Block key={`sup-${searching}`} open={searching} tipText="Show or hide sections replaced by later chapters" title={`Superseded sections (${superseded.length})`}
            meta="Earlier drafts replaced by the chapters above. Kept for the record; their old codes still work in the search.">
            <DocRows docs={superseded} count={count} />
          </Block>
        </>
      )}

      {eoc.length > 0 && (
        <>
          <Separator className="my-6" />
          <Block key={`eoc-${searching}`} open={searching} tipText="Show or hide the legacy EOC Manual sections" title={`EOC Manual (${eoc.filter((d) => d.status !== 'superseded').length} sections)`}
            meta="The legacy EOC Manual sections, kept alongside the unified Manual (ADR-012). Their aliases still work in the search above.">
            <DocRows docs={eoc} count={count} />
          </Block>
        </>
      )}
    </div>
  );
}
