// Board assembly and search for the RACI feature (ADR-033). Pure functions; the page
// reads the three tables from Dexie and passes them here. Mirrors no SQL rules — display only.
import type { ProtocolTemplate, RaciActivity, RaciAssignment, RaciDuty, RaciMatrix } from '@/types';

export interface BoardActivity {
  activity: RaciActivity;
  template?: ProtocolTemplate;
  byDuty: Record<RaciDuty, RaciAssignment[]>;
  /** Annex 1-F: "normally one accountable role for each activity" — shown as a warning, not a rule. */
  accountableCount: number;
}
export interface BoardMatrix {
  matrix: RaciMatrix;
  activities: BoardActivity[];
}

export function buildBoard(
  matrices: RaciMatrix[],
  activities: RaciActivity[],
  assignments: RaciAssignment[],
  templates: ProtocolTemplate[],
): BoardMatrix[] {
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const byActivity = new Map<string, RaciAssignment[]>();
  for (const a of assignments) {
    const list = byActivity.get(a.activity_id) ?? [];
    list.push(a);
    byActivity.set(a.activity_id, list);
  }
  return matrices
    .slice()
    .sort((x, y) => x.sort - y.sort)
    .map((matrix) => ({
      matrix,
      activities: activities
        .filter((a) => a.matrix_id === matrix.id)
        .sort((x, y) => x.sort - y.sort)
        .map((activity) => {
          const rows = byActivity.get(activity.id) ?? [];
          const byDuty: Record<RaciDuty, RaciAssignment[]> = { R: [], A: [], C: [], I: [] };
          for (const r of rows) byDuty[r.duty].push(r);
          for (const d of Object.keys(byDuty) as RaciDuty[]) byDuty[d].sort((x, y) => x.actor.localeCompare(y.actor));
          return {
            activity,
            template: activity.template_id ? templateById.get(activity.template_id) : undefined,
            byDuty,
            accountableCount: byDuty.A.length,
          };
        }),
    }))
    .filter((m) => m.activities.length > 0);
}

/** Case-insensitive search over the activity, actors, qualifiers, linked template and matrix title. */
export function searchBoard(board: BoardMatrix[], query: string): BoardMatrix[] {
  const q = query.trim().toLowerCase();
  if (!q) return board;
  const hit = (s: string | null | undefined) => !!s && s.toLowerCase().includes(q);
  return board
    .map(({ matrix, activities }) => ({
      matrix,
      activities: activities.filter(
        (a) =>
          hit(a.activity.activity) ||
          hit(a.activity.note) ||
          hit(a.activity.sop_ref) ||
          hit(matrix.title) ||
          hit(a.template?.code) ||
          hit(a.template?.title) ||
          Object.values(a.byDuty).flat().some((r) => hit(r.actor) || hit(r.qualifier)),
      ),
    }))
    .filter((m) => m.activities.length > 0);
}

/** Activities where the Accountable count is not the normal one (ADR-033: warning, not a rule). */
export function accountableIssues(board: BoardMatrix[]): BoardActivity[] {
  return board.flatMap((m) => m.activities).filter((a) => a.accountableCount !== 1);
}
