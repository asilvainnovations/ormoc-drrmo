// Board assembly for the EOC capability assessment (ADR-035). Pure functions; the page reads
// the three tables from Dexie and passes them here. The status rule itself lives in
// src/domain/eoc_assessment.ts (the SQL mirror); this file only groups and counts.
import { statusCounts } from '@/domain/eoc_assessment';
import type { EocAssessmentItem, EocAssessmentResponse, EocAssessmentRun, EocAssessmentStatus } from '@/types';

export interface BoardItem {
  item: EocAssessmentItem;
  /** Undefined while the run has not answered this item. */
  response?: EocAssessmentResponse;
}
export interface BoardSection {
  section: string;
  sort: number;
  items: BoardItem[];
  counts: Record<EocAssessmentStatus, number>;
}
export interface Board {
  run: EocAssessmentRun;
  sections: BoardSection[];
  counts: Record<EocAssessmentStatus, number>;
  /** Responses the run holds (of 154 seeded items). */
  answered: number;
}

export function buildBoard(run: EocAssessmentRun, items: EocAssessmentItem[], responses: EocAssessmentResponse[]): Board {
  const byItem = new Map(responses.filter((r) => r.run_id === run.id).map((r) => [r.item_id, r]));
  const sections: BoardSection[] = [];
  for (const item of items.slice().sort((a, b) => a.section_sort - b.section_sort || a.item_no - b.item_no)) {
    let sec = sections[sections.length - 1];
    if (!sec || sec.section !== item.section) {
      sec = { section: item.section, sort: item.section_sort, items: [], counts: statusCounts([]) };
      sections.push(sec);
    }
    const response = byItem.get(item.id);
    sec.items.push({ item, response });
    if (response) sec.counts[response.status] += 1;
  }
  const runResponses = responses.filter((r) => r.run_id === run.id);
  return { run, sections, counts: statusCounts(runResponses.map((r) => r.status)), answered: runResponses.length };
}
