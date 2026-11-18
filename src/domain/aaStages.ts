// Where a State of Imminent Disaster stands, as six steps (RA 12287 and its IRR, signed 14 Sep 2026): the PDRA, the City's request, the
// RDRRMC recommendation (24 h), the Mayor's declaration, lifting, and the 45-day report to OCD. This only shows progress; the rules and
// deadlines stay in aa.ts and the server.
import type { Declaration } from '@/types';

export const AA_STAGES = ['PDRA', 'Request sent', 'RDRRMC reply', 'Declared', 'Lifted', 'Report to OCD'] as const;

/** Index of the step now in progress (0-5), or 6 when everything is done. null when the declaration was not recommended or was withdrawn. */
export function declarationStage(d: Pick<Declaration, 'status' | 'report_submitted_at'>): number | null {
  switch (d.status) {
    case 'draft': return 1;
    case 'requested': return 2;
    case 'recommended': return 3;
    case 'declared': return 4;
    case 'lifted': return d.report_submitted_at ? 6 : 5;
    default: return null;
  }
}
