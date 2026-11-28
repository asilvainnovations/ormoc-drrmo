// Validation Intelligence (1.36.0): the Validation Register as a radial picture of whole-Manual readiness.
// Chapters sit on the inner ring; each bar is one VR item, its length the derived Systems Impact (src/domain/validationIntel.ts).
// Colour can follow chapter, priority, impact level or validating stakeholder, so variations stand apart.
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Download } from 'lucide-react';
import { db } from '@/lib/db';
import { tip } from '@/components/Tooltip';
import { Button, Loading } from '@/components/ui';
import { download } from '@/features/tools/storage';
import {
  LEVEL_COLORS, PRIORITY_COLORS, STAKEHOLDER_COLORS, chapterColor, chapterSummary, intelCsv, intelRows, levelSummary, type ImpactLevel, type IntelRow,
} from '@/domain/validationIntel';
import type { GovernancePriority } from '@/types';
import { Panel, Pill, WorkspaceHead } from './kit';
import { PRIORITY } from './labels';

type ColourBy = 'chapter' | 'priority' | 'level' | 'stakeholder';
const COLOUR_BY: { v: ColourBy; label: string; tip: string }[] = [
  { v: 'chapter', label: 'Chapter', tip: 'One hue per Manual chapter' },
  { v: 'priority', label: 'Priority', tip: 'The tracker’s priority: critical & urgent, important, standard' },
  { v: 'level', label: 'Impact level', tip: 'Derived Systems Impact: high, medium, low' },
  { v: 'stakeholder', label: 'Stakeholder', tip: 'The first lead validator named for the item' },
];
const PRIORITIES: GovernancePriority[] = ['critical_urgent', 'important', 'standard'];

/** Dark or white text for a hex fill, by relative luminance. */
const inkOn = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.6 ? '#1F2933' : '#FFFFFF';
};

/** An SVG ring segment; angle 0 is at the top, clockwise. */
function arc(r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${(r * Math.sin(a)).toFixed(2)},${(-r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r0, a0)}L${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

export function IntelligencePage() {
  const data = useLiveQuery(async () => {
    const [items, docs] = [await db.manual_review_items.toArray(), await db.moo_documents.toArray()];
    const titles = new Map(docs.filter((d) => d.chapter_no != null && /^Chapter \d+$/.test(d.code)).map((d) => [d.chapter_no as number, d.title]));
    return intelRows(items, titles);
  }, []);
  const [prio, setPrio] = useState<Set<GovernancePriority>>(new Set(PRIORITIES));
  const [colourBy, setColourBy] = useState<ColourBy>('chapter');
  const [who, setWho] = useState('');
  const [chapter, setChapter] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  const rows = data ?? [];
  const stakeholders = useMemo(() => {
    const n = new Map<string, number>();
    rows.forEach((r) => r.stakeholders.forEach((s) => n.set(s, (n.get(s) ?? 0) + 1)));
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
  }, [rows]);
  const chapters = useMemo(() => [...new Map(rows.map((r) => [r.chapterLabel, r.chapter])).entries()], [rows]);
  const shown = (r: IntelRow) => prio.has(r.item.priority) && (!who || r.stakeholders.includes(who)) && (!chapter || r.chapterLabel === chapter);
  const colourOf = (r: IntelRow) => colourBy === 'chapter' ? chapterColor(r.chapter)
    : colourBy === 'priority' ? PRIORITY_COLORS[r.item.priority]
    : colourBy === 'level' ? LEVEL_COLORS[r.impact.level]
    : STAKEHOLDER_COLORS[Math.max(0, stakeholders.indexOf(r.stakeholders[0] ?? '')) % STAKEHOLDER_COLORS.length]!;

  if (!data) return <Loading />;
  const levels = levelSummary(rows);
  const chs = chapterSummary(rows);
  const high = levels.find((l) => l.level === 'High');
  const view = rows.filter(shown);
  const viewShare = Math.round(10 * view.reduce((a, r) => a + r.share, 0)) / 10;
  const picked = rows.find((r) => r.item.source_tracker_id === sel) ?? [...view].sort((a, b) => b.impact.score - a.impact.score)[0] ?? null;

  return (
    <div>
      <WorkspaceHead eyebrow="Where completing validation moves the Manual most" title="Validation Intelligence"
        subtitle="Each Validation Register item by chapter, its priority, its validating stakeholder and its Systems Impact on whole-Manual readiness."
        aside={<Button variant="secondary" icon={Download} tip="Download this dataset as CSV (the same columns as the radial dataset)" onClick={() => download('Validation_Radial_Dataset.csv', intelCsv(rows), 'text/csv')}>CSV</Button>} />
      {rows.length === 0 ? <Panel title="Nothing loaded yet">The Validation Tracker arrives with the next reference-data sync.</Panel> : <>
        <p className="mb-4 max-w-4xl leading-relaxed">
          The <b>{high?.items ?? 0}</b> high-impact items carry <b>{high?.share ?? 0}%</b> of weighted Manual readiness.
          {chs[0] && <> <b>{chs[0].label}</b> carries the most, at <b>{chs[0].share}%</b> across {chs[0].items} items.</>}
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          <span className="text-xs font-bold text-muted">Priority</span>
          {PRIORITIES.map((p) => (
            <button key={p} type="button" aria-pressed={prio.has(p)} {...tip(`Show or hide ${PRIORITY[p].label.toLowerCase()} items`)}
              onClick={() => setPrio((s) => { const n = new Set(s); if (n.has(p) && n.size > 1) n.delete(p); else n.add(p); return n; })}
              className={clsx('inline-flex min-h-tap items-center gap-1.5 rounded-full border px-3 text-sm font-semibold', prio.has(p) ? 'border-ink text-ink' : 'border-line text-muted opacity-60')}>
              <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PRIORITY_COLORS[p] }} />{PRIORITY[p].label}
            </button>
          ))}
          <select aria-label="Validating stakeholder" value={who} onChange={(e) => setWho(e.target.value)} {...tip('Show one validating stakeholder’s items')}
            className="min-h-tap rounded-control border border-line bg-surface px-3 text-sm">
            <option value="">All stakeholders</option>{stakeholders.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} {...tip('Show one chapter’s items')}
            className="min-h-tap max-w-[18rem] rounded-control border border-line bg-surface px-3 text-sm">
            <option value="">All chapters</option>{chapters.map(([l]) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title="Radial readiness map" note="Inner ring: chapters (select one to focus). Each bar is one item; a longer bar adds more to whole-Manual readiness when completed. Select a bar for its details.">
            <div className="mb-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colour by">
              <span className="text-xs font-bold text-muted">Colour by</span>
              {COLOUR_BY.map((c) => (
                <button key={c.v} type="button" role="radio" aria-checked={colourBy === c.v} onClick={() => setColourBy(c.v)} {...tip(c.tip)}
                  className={clsx('min-h-tap rounded-full border px-3 text-sm font-semibold', colourBy === c.v ? 'border-action bg-sky-soft text-ink ring-1 ring-action' : 'border-line bg-surface text-muted')}>{c.label}</button>
              ))}
            </div>
            <Radial rows={rows} shown={shown} colourOf={colourOf} sel={picked?.item.source_tracker_id ?? null} onSel={setSel}
              chapterFocus={chapter} onChapter={(l) => setChapter((c) => (c === l ? '' : l))} viewShare={viewShare} viewCount={view.length} />
            <Legend colourBy={colourBy} chapters={chapters} stakeholders={stakeholders} />
          </Panel>
          <Panel title="Selected item">
            {picked ? <Detail r={picked} colour={colourOf(picked)} /> : <p className="text-sm text-muted">No item matches these filters.</p>}
          </Panel>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Highest Systems Impact in this view" note={`${view.length} of ${rows.length} items shown, ${viewShare}% of weighted readiness. Completing these first moves the Manual most.`}>
            <ol className="space-y-1.5">
              {[...view].sort((a, b) => b.impact.score - a.impact.score || a.item.source_tracker_id.localeCompare(b.item.source_tracker_id)).slice(0, 10).map((r) => (
                <li key={r.item.id}>
                  <button type="button" onClick={() => setSel(r.item.source_tracker_id)} {...tip(`Show ${r.item.source_tracker_id}`)}
                    className="grid min-h-tap w-full grid-cols-[4rem_minmax(0,1fr)_5.5rem] items-center gap-2 rounded-control px-1 text-left text-xs hover:bg-sky-soft/40">
                    <span className="font-data text-muted">{r.item.source_tracker_id}</span>
                    <span className="min-w-0"><span className="block truncate font-semibold text-ink">{r.item.title}</span>
                      <span className="mt-0.5 block h-2 overflow-hidden rounded-full bg-sunken"><span className="block h-full rounded-full" style={{ width: `${r.impact.score}%`, background: colourOf(r) }} /></span></span>
                    <span className="text-right font-data">{r.impact.score} · {r.share}%</span>
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Readiness weight by chapter" note="Each chapter’s share of weighted readiness, from its items’ Systems Impact.">
            {chs.map((c) => (
              <button key={c.label} type="button" onClick={() => setChapter((x) => (x === c.label ? '' : c.label))} {...tip(`Focus on ${c.label}`)}
                className={clsx('grid min-h-tap w-full grid-cols-[minmax(0,1fr)_7rem_3.5rem] items-center gap-2 rounded-control px-1 text-left text-xs hover:bg-sky-soft/40', chapter === c.label && 'bg-sky-soft')}>
                <span className="truncate font-semibold text-ink"><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: chapterColor(c.chapter) }} />{c.label}</span>
                <span className="block h-2.5 overflow-hidden rounded-full bg-sunken"><span className="block h-full rounded-full" style={{ width: `${(100 * c.share) / (chs[0]?.share || 1)}%`, background: chapterColor(c.chapter) }} /></span>
                <span className="text-right font-data">{c.share}%</span>
              </button>
            ))}
            <div className="mt-3 flex flex-wrap gap-2">
              {levels.map((l) => <Pill key={l.level} tone={l.level === 'High' ? 'red' : l.level === 'Medium' ? 'orange' : 'grey'}>{l.level}: {l.items} items · {l.share}%</Pill>)}
            </div>
          </Panel>
        </div>

        <details className="rounded-sheet border border-line bg-surface p-4 text-sm leading-relaxed">
          <summary className="min-h-tap cursor-pointer font-bold" {...tip('How the Systems Impact score is worked out')}>How Systems Impact is worked out</summary>
          <p className="mt-2">The tracker gives each item a priority, its exact Manual sections, SOPs and forms, and an issue type. It does not score impact on the whole Manual, so MODE derives a score (0–100) from those fields:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>Priority (up to 40):</b> critical &amp; urgent 40, important 24, standard 12.</li>
            <li><b>Breadth (up to 25):</b> how many sections, SOPs, tables, forms and annexes it cites; six or more scores full.</li>
            <li><b>Cross-chapter dependency (20):</b> the issue type says cross-chapter, conflicting or dependency, or it cites another chapter’s SOP, table or annex.</li>
            <li><b>Authority dependency (15):</b> it needs a legal, authority or management decision before the text can be adopted.</li>
          </ul>
          <p className="mt-2">High 70 and above, Medium 45–69, Low below 45. An item’s share is its score over the sum of all scores, so completing every item adds 100%. The weights are a proposal for workshop planning, not a City standard. Priorities, sections, SOPs and stakeholders are the tracker’s, and stay proposed until validated.</p>
        </details>
      </>}
    </div>
  );
}

function Radial({ rows, shown, colourOf, sel, onSel, chapterFocus, onChapter, viewShare, viewCount }: {
  rows: IntelRow[]; shown: (r: IntelRow) => boolean; colourOf: (r: IntelRow) => string; sel: string | null; onSel: (id: string) => void;
  chapterFocus: string; onChapter: (label: string) => void; viewShare: number; viewCount: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ r: IntelRow; x: number; y: number } | null>(null);
  const S = 640, R = S / 2 - 12, r0 = R * 0.2, ringW = R * 0.1, r1 = r0 + ringW + 6;
  const groups = [...new Map(rows.map((r) => [r.chapterLabel, r.chapter])).entries()];
  const gap = 1.6, slot = (2 * Math.PI) / (rows.length + gap * groups.length);
  const len = (score: number) => r1 + ((R - r1) * Math.max(0, Math.min(100, score))) / 100;
  let a = 0;
  const pos = new Map<string, number>(); const arcs: { label: string; chapter: number | null; start: number; end: number }[] = [];
  for (const [label, chapter] of groups) {
    const start = a;
    rows.filter((r) => r.chapterLabel === label).forEach((r) => { pos.set(r.item.id, a); a += slot; });
    arcs.push({ label, chapter, start, end: a }); a += gap * slot;
  }
  const move = (r: IntelRow) => (e: React.MouseEvent) => {
    const b = box.current?.getBoundingClientRect();
    if (b) setHover({ r, x: e.clientX - b.left, y: e.clientY - b.top });
  };
  return (
    <div ref={box} className="relative">
      <svg viewBox={`${-S / 2} ${-S / 2} ${S} ${S}`} className="mx-auto block w-full max-w-[40rem]" role="img"
        aria-label={`Radial chart of ${rows.length} validation items in ${groups.length} chapters; bar length is the derived Systems Impact score`}>
        {[25, 50, 75, 100].map((v) => <g key={v}><circle r={len(v)} fill="none" stroke="currentColor" className="text-line" />
          <text y={-len(v) - 3} textAnchor="middle" className="fill-muted text-[10px]">{v}</text></g>)}
        {arcs.map((c) => {
          const active = !chapterFocus || chapterFocus === c.label;
          const mid = (c.start + c.end - slot) / 2, rr = r0 + ringW / 2;
          return (
            <g key={c.label} onClick={() => onChapter(c.label)} className="cursor-pointer">
              <path d={arc(r0, r0 + ringW, c.start - slot * 0.2, c.end - slot * 0.8)} fill={chapterColor(c.chapter)} opacity={active ? 1 : 0.3}><title>{c.label}</title></path>
              <text x={rr * Math.sin(mid)} y={-rr * Math.cos(mid)} dy="0.35em" textAnchor="middle" fill={inkOn(chapterColor(c.chapter))} className="pointer-events-none text-[10px] font-extrabold">{c.chapter ?? '–'}</text>
            </g>
          );
        })}
        {rows.map((r) => {
          const t = pos.get(r.item.id) ?? 0; const on = shown(r); const isSel = sel === r.item.source_tracker_id;
          return (
            <path key={r.item.id} d={arc(r1, len(r.impact.score), t, t + slot * 0.82)} fill={colourOf(r)} opacity={on ? (isSel ? 1 : 0.9) : 0.12}
              stroke={isSel ? 'currentColor' : 'none'} strokeWidth={isSel ? 2.5 : 0} className="cursor-pointer text-ink"
              onMouseMove={move(r)} onMouseLeave={() => setHover(null)} onClick={() => onSel(r.item.source_tracker_id)}>
              <title>{`${r.item.source_tracker_id} ${r.item.title}: ${r.impact.score}/100`}</title>
            </path>
          );
        })}
        <text textAnchor="middle" dy="-0.15em" className="fill-ink font-display text-[22px] font-extrabold">{viewShare}%</text>
        <text textAnchor="middle" dy="1.5em" className="fill-muted text-[10px]">{viewCount} items shown</text>
      </svg>
      {hover && (
        <div className="pointer-events-none absolute z-10 max-w-[17rem] rounded-control border border-line bg-surface p-2 text-xs shadow-raised"
          style={{ left: Math.min(hover.x + 12, (box.current?.clientWidth ?? 300) - 280), top: hover.y + 12 }}>
          <p className="font-bold text-ink">{hover.r.item.source_tracker_id} · {hover.r.item.title}</p>
          <p className="text-muted">{hover.r.chapterLabel}</p>
          <p>{hover.r.item.lead_office ?? 'No lead'} · {PRIORITY[hover.r.item.priority].label}</p>
          <p className="font-data">Systems Impact {hover.r.impact.score}/100 · {hover.r.share}% of readiness</p>
        </div>
      )}
    </div>
  );
}

function Legend({ colourBy, chapters, stakeholders }: { colourBy: ColourBy; chapters: [string, number | null][]; stakeholders: string[] }) {
  const items: [string, string][] = colourBy === 'chapter' ? chapters.map(([l, n]) => [l.replace(/ — .*/, ''), chapterColor(n)])
    : colourBy === 'priority' ? PRIORITIES.map((p) => [PRIORITY[p].label, PRIORITY_COLORS[p]])
    : colourBy === 'level' ? (['High', 'Medium', 'Low'] as ImpactLevel[]).map((l) => [l, LEVEL_COLORS[l]])
    : stakeholders.slice(0, STAKEHOLDER_COLORS.length).map((s, i) => [s, STAKEHOLDER_COLORS[i]!]);
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold" aria-label="Legend">
      {items.map(([l, c]) => <li key={l} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />{l}</li>)}
    </ul>
  );
}

function Detail({ r, colour }: { r: IntelRow; colour: string }) {
  const i = r.item;
  const parts: [string, number, number][] = [['Priority', r.impact.priority, 40], ['Breadth', r.impact.breadth, 25], ['Cross-chapter', r.impact.cross, 20], ['Authority', r.impact.authority, 15]];
  const fields: [string, string | null | undefined][] = [
    ['Chapter', r.chapterLabel], ['Sections & subsections requiring focused review', i.section_ref], ['SOPs / protocols / forms', [i.sop_ref, i.artefact_ref].filter(Boolean).join('; ')],
    ['Validating stakeholder', i.lead_office], ['Level of priority', PRIORITY[i.priority].label],
  ];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-2"><i className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: colour }} />
        <div><p className="font-data text-xs text-muted">{i.source_tracker_id}</p><p className="font-extrabold text-ink">{i.title}</p></div></div>
      <dl className="space-y-2">
        {fields.map(([k, v]) => <div key={k}><dt className="text-xs font-bold text-muted">{k}</dt><dd className="leading-relaxed">{v || 'Not given in the tracker'}</dd></div>)}
      </dl>
      <div>
        <p className="text-xs font-bold text-muted">Systems Impact</p>
        <p className="font-data"><b>{r.impact.score}</b>/100 · {r.impact.level} · {r.share}% of weighted readiness</p>
        <div className="mt-1 space-y-1">{parts.map(([k, v, max]) => (
          <div key={k} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-xs">
            <span className="text-muted">{k}</span>
            <span className="h-2 overflow-hidden rounded-full bg-sunken"><span className="block h-full rounded-full" style={{ width: `${(100 * v) / max}%`, background: colour }} /></span>
            <span className="text-right font-data">{v}/{max}</span>
          </div>))}</div>
        <p className="mt-1 text-xs text-muted">{r.impact.basis}</p>
      </div>
      <Link to={`/governance/reviews?item=${i.source_tracker_id}`} className="inline-block text-sm font-bold text-sky underline" {...tip('Open the item in the register to act on it')}>Open in the register</Link>
    </div>
  );
}
