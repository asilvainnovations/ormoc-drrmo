// Validation Intelligence (1.36.0): the Validation Register as a radial picture of whole-Manual readiness.
//
// Systems Impact is DERIVED here, not in the Validation Tracker. It scores (0–100) how much completing an item moves
// the whole Manual's readiness, from fields the tracker does carry:
//   priority      up to 40   critical & urgent 40, important 24, standard 12
//   breadth       up to 25   sections, SOPs, tables, forms and annexes cited (six or more = full)
//   cross-chapter 20         issue type says cross-chapter / conflicting / dependency, or it cites another chapter's item
//   authority     15         the issue needs a legal, authority or management decision before adoption
// Level: High ≥ 70, Medium 45–69, Low < 45. Share = score ÷ sum of all scores, so completing every item adds 100%.
// The same method made Validation_Radial_Dataset.csv (28 Nov 2026); validationIntel.test.ts holds the two together.
import type { GovernancePriority, ManualReviewItem } from '@/types';

export type ImpactLevel = 'High' | 'Medium' | 'Low';
const PRIORITY_POINTS: Record<GovernancePriority, number> = { critical_urgent: 40, important: 24, standard: 12 };
const AUTHORITY = /legal|authority|decision required|decision\/|management decision|institutional/i;
const CROSS = /cross-chapter|conflicting|dependency/i;

/** The corrected Manual chapter: the locator's chapter version ("Ch. 6 v1.1") wins over the register's chapter. */
export function chapterOf(i: Pick<ManualReviewItem, 'chapter_ref' | 'chapter_version'>): number | null {
  const m = /Ch\.?\s*(\d+)/i.exec(i.chapter_version ?? '') ?? /Ch\.?\s*(\d+)/i.exec(i.chapter_ref ?? '');
  return m ? Number(m[1]) : null;
}

export interface ImpactBreakdown { priority: number; breadth: number; cross: number; authority: number; score: number; refs: number; level: ImpactLevel; basis: string }
export function impactOf(i: ManualReviewItem): ImpactBreakdown {
  const ch = chapterOf(i);
  const text = [i.section_ref, i.sop_ref, i.artefact_ref].filter(Boolean).join('; ');
  const refs = text.split(';').map((s) => s.trim()).filter(Boolean).length;
  const others = [...text.matchAll(/(?:SOP|Annex|Ch\.?|Chapter|Table|Figure)\s*(\d+)[-–.]/g)].map((m) => Number(m[1]));
  const crossDep = CROSS.test(i.issue_type ?? '') || (ch != null && others.some((o) => o !== ch));
  const auth = AUTHORITY.test(i.issue_type ?? '');
  const priority = PRIORITY_POINTS[i.priority] ?? 12;
  const breadth = (Math.min(refs, 6) / 6) * 25;
  const score = Math.round(priority + breadth + (crossDep ? 20 : 0) + (auth ? 15 : 0));
  const level: ImpactLevel = score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low';
  const basis = [`${refs} provision${refs === 1 ? '' : 's'} cited`, crossDep ? 'cross-chapter dependency' : '', auth ? 'needs a legal or authority decision' : ''].filter(Boolean).join('; ');
  return { priority, breadth: Math.round(breadth * 10) / 10, cross: crossDep ? 20 : 0, authority: auth ? 15 : 0, score, refs, level, basis };
}

export interface IntelRow {
  item: ManualReviewItem; chapter: number | null; chapterLabel: string; impact: ImpactBreakdown; share: number; stakeholders: string[];
}
/** Lead validators named in a tracker cell ("City Budget Office / BAC Secretariat" → two). */
export const stakeholdersOf = (lead: string | null) => (lead ?? '').split(/\s*[/;]\s*/).map((s) => s.trim()).filter(Boolean);

export function intelRows(items: ManualReviewItem[], chapterTitles: Map<number, string> = new Map()): IntelRow[] {
  const scored = items.map((item) => ({ item, impact: impactOf(item), chapter: chapterOf(item) }));
  const total = scored.reduce((a, r) => a + r.impact.score, 0) || 1;
  return scored.map(({ item, impact, chapter }) => ({
    item, impact, chapter, share: Math.round((10000 * impact.score) / total) / 100,
    chapterLabel: chapter == null ? 'No chapter' : `Ch. ${chapter}${chapterTitles.get(chapter) ? ` — ${chapterTitles.get(chapter)}` : ''}`,
    stakeholders: stakeholdersOf(item.lead_office),
  })).sort((a, b) => (a.chapter ?? 99) - (b.chapter ?? 99) || b.impact.score - a.impact.score);
}

export function levelSummary(rows: IntelRow[]) {
  return (['High', 'Medium', 'Low'] as ImpactLevel[]).map((level) => {
    const r = rows.filter((x) => x.impact.level === level);
    return { level, items: r.length, share: Math.round(10 * r.reduce((a, x) => a + x.share, 0)) / 10 };
  });
}
export function chapterSummary(rows: IntelRow[]) {
  const m = new Map<string, { chapter: number | null; label: string; items: number; share: number }>();
  for (const r of rows) {
    const c = m.get(r.chapterLabel) ?? { chapter: r.chapter, label: r.chapterLabel, items: 0, share: 0 };
    c.items += 1; c.share += r.share; m.set(r.chapterLabel, c);
  }
  return [...m.values()].map((c) => ({ ...c, share: Math.round(10 * c.share) / 10 })).sort((a, b) => b.share - a.share);
}

const PRIORITY_LABEL: Record<GovernancePriority, string> = { critical_urgent: 'Critical & Urgent', important: 'Important', standard: 'Standard review' };
const q = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** The dataset as CSV, with the columns of Validation_Radial_Dataset.csv. */
export function intelCsv(rows: IntelRow[]): string {
  const head = ['ID', 'Validation Item', 'Chapter', 'Sections & subsections requiring focused review', 'SOPs/Protocols/Forms', 'Validating Stakeholder',
    'Level of Priority', 'Systems Impact (Impact to the whole manual readiness if completed)', 'Impact Score (0-100)', 'Share of Weighted Readiness (%)', 'Impact Basis'];
  const body = [...rows].sort((a, b) => a.item.source_tracker_id.localeCompare(b.item.source_tracker_id, undefined, { numeric: true })).map((r) => [
    r.item.source_tracker_id, r.item.title, r.chapterLabel, r.item.section_ref, [r.item.sop_ref, r.item.artefact_ref].filter(Boolean).join('; '),
    r.item.lead_office, PRIORITY_LABEL[r.item.priority], `${r.impact.level}: completing it adds ${r.share}% of weighted manual readiness`,
    r.impact.score, r.share, `priority ${PRIORITY_LABEL[r.item.priority].toLowerCase()}; ${r.impact.basis}`,
  ].map(q).join(','));
  return [head.join(','), ...body].join('\n') + '\n';
}

// ------------------------------------------------------------------ palettes (distinct hues, readable on light and dark)
/** Ten chapter hues (Tableau 10 family) plus two for chapters beyond. */
export const CHAPTER_COLORS = ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#5D6D7E', '#17BECF', '#BCBD22'];
export const PRIORITY_COLORS: Record<GovernancePriority, string> = { critical_urgent: '#D7263D', important: '#F4A259', standard: '#3F88C5' };
export const LEVEL_COLORS: Record<ImpactLevel, string> = { High: '#7B2CBF', Medium: '#2A9D8F', Low: '#A8B5C3' };
/** Stakeholder hues: a wide set so neighbouring offices differ. */
export const STAKEHOLDER_COLORS = ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF',
  '#AEC7E8', '#FFBB78', '#98DF8A', '#FF9896', '#C5B0D5', '#C49C94', '#F7B6D2', '#DBDB8D', '#9EDAE5', '#393B79'];
export const chapterColor = (n: number | null) => (n == null ? '#9AA5B1' : CHAPTER_COLORS[(n - 1 + CHAPTER_COLORS.length) % CHAPTER_COLORS.length]!);
