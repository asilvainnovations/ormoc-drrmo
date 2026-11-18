import { describe, expect, it } from 'vitest';
import { AA_STAGES, declarationStage } from './aaStages';

describe('declarationStage', () => {
  it('walks the statuses in order', () => {
    expect(['draft', 'requested', 'recommended', 'declared'].map((status) => declarationStage({ status, report_submitted_at: null } as never))).toEqual([1, 2, 3, 4]);
  });
  it('lifted waits on the report, then completes', () => {
    expect(declarationStage({ status: 'lifted', report_submitted_at: null })).toBe(5);
    expect(declarationStage({ status: 'lifted', report_submitted_at: '2026-12-01T00:00:00Z' })).toBe(6);
  });
  it('has no stage for a refused or withdrawn declaration', () => {
    expect(declarationStage({ status: 'not_recommended', report_submitted_at: null })).toBeNull();
    expect(declarationStage({ status: 'withdrawn', report_submitted_at: null })).toBeNull();
    expect(AA_STAGES).toHaveLength(6);
  });
});
