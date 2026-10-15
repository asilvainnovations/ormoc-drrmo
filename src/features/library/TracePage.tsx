import { tip } from '@/components/Tooltip';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Badge, Field, Input, PageHeader, Select, Tabs, TextLink } from '@/components/ui';
import { LIB_TABS } from './labels';

export function TracePage() {
  const [q, setQ] = useState('');
  const [mr, setMr] = useState('');
  const [tag, setTag] = useState('');
  const data = useLiveQuery(async () => {
    const [indicators, links, docLinks, docs, mrs] = await Promise.all([db.iat_indicators.orderBy('sort').toArray(), db.indicator_requirements.toArray(),
      db.moo_document_indicators.toArray(), db.moo_documents.toArray(), db.master_requirements.orderBy('sort').toArray()]);
    const cycle = (await db.assessment_cycles.orderBy('cycle_year').reverse().toArray())[0];
    const responses = cycle ? await db.responses.where('cycle_id').equals(cycle.id).toArray() : [];
    const docById = new Map(docs.map((d) => [d.id, d]));
    const mrBy = new Map<string, string[]>(); for (const l of links) mrBy.set(l.indicator_id, [...(mrBy.get(l.indicator_id) ?? []), l.mr_id]);
    const docBy = new Map<string, typeof docs>(); for (const l of docLinks) { const d = docById.get(l.document_id); if (d) docBy.set(l.indicator_id, [...(docBy.get(l.indicator_id) ?? []), d]); }
    return { indicators, mrBy, docBy, mrs, cycle, byInd: new Map(responses.map((r) => [r.indicator_id, r])) };
  }, []);
  const rows = useMemo(() => (data?.indicators ?? []).filter((i) =>
    (!q || `${i.id} ${i.statement} ${i.reference}`.toLowerCase().includes(q.toLowerCase())) &&
    (!mr || data!.mrBy.get(i.id)?.includes(mr)) && (!tag || i.tags.includes(tag))), [data, q, mr, tag]);

  return (
    <div className="page">
      <PageHeader title="Traceability" subtitle="Indicator → master requirements → manual sections → latest score. Every gap has a place in the manuals." />
      <Tabs items={LIB_TABS} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Search">{(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, words or law" />}</Field>
        <Field label="Master requirement">{(id) => <Select id={id} value={mr} onChange={(e) => setMr(e.target.value)}>
          <option value="">All</option>{data?.mrs.map((m) => <option key={m.id} value={m.id}>{m.id} {m.title}</option>)}</Select>}</Field>
        <Field label="Theme">{(id) => <Select id={id} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All</option><option value="RA 12287 / anticipatory action">RA 12287 / anticipatory action</option>
          <option value="UNDRR Scorecard">UNDRR Scorecard</option><option value="Interface">Part C interface</option></Select>}</Field>
      </div>
      <p className="mb-2 text-sm text-muted">{rows.length} indicator(s){data?.cycle ? `. Scores from ${data.cycle.name}.` : '.'}</p>
      <div className="overflow-x-auto rounded-control" tabIndex={0} role="region" aria-label="Traceability table" {...tip('Scroll sideways to see every column')}>
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">Indicator traceability</caption>
          <thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">Indicator</th><th className="py-2 pr-3">Requirements</th><th className="py-2 pr-3">Manual sections</th><th className="py-2">Score</th></tr></thead>
          <tbody>
            {rows.map((i) => {
              const r = data!.byInd.get(i.id);
              return (
                <tr key={i.id} className="border-b border-line align-top">
                  <td className="py-2 pr-3"><span className="font-bold">{i.id}</span> <span className="text-muted">{i.type === 'M' ? 'M' : 'GP'}, w{i.weight}</span><span className="block max-w-md">{i.statement}</span></td>
                  <td className="py-2 pr-3"><span className="flex max-w-[12rem] flex-wrap gap-1">{data!.mrBy.get(i.id)?.map((m) => <Badge key={m}>{m}</Badge>)}</span></td>
                  <td className="py-2 pr-3">{data!.docBy.get(i.id)?.map((d) => <TextLink tip="Open this manual section" block key={d.id} to={`/library/doc/${d.id}`}>{d.code}</TextLink>)}</td>
                  <td className="py-2">{r ? (r.is_na ? 'NA' : r.score ?? '–') : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
