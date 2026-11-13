import { describe, expect, it } from 'vitest';
import type { ProtocolTemplate, RaciActivity, RaciAssignment, RaciMatrix } from '@/types';
import { accountableIssues, buildBoard, searchBoard } from './raci';

const matrices: RaciMatrix[] = [
  { id: 'm2', code: '6.2', title: 'CDRRMO–EOC Operational RACI', source_ref: 'MOO Annex 1-F', sort: 2, version: 1 },
  { id: 'm1', code: '6.1', title: 'CDRRMC Governance RACI', source_ref: 'MOO Annex 1-F', sort: 1, version: 1 },
];
const activities: RaciActivity[] = [
  { id: 'a1', matrix_id: 'm1', activity: 'Convene regular CDRRMC meeting', note: null, template_id: 't1', sop_ref: null, sort: 1, version: 1 },
  { id: 'a2', matrix_id: 'm2', activity: 'Convene PDRA', note: 'As prescribed by law.', template_id: 't2', sop_ref: 'SOP GOV-05', sort: 1, version: 1 },
  { id: 'a3', matrix_id: 'm2', activity: 'Maintain common operating picture', note: null, template_id: null, sop_ref: null, sort: 2, version: 1 },
];
const assignments: RaciAssignment[] = [
  { id: 's1', activity_id: 'a1', actor: 'CDRRMO Secretariat', duty: 'R', qualifier: null, version: 1 },
  { id: 's2', activity_id: 'a1', actor: 'City Mayor', duty: 'A', qualifier: null, version: 1 },
  { id: 's3', activity_id: 'a2', actor: 'CDRRMO', duty: 'A', qualifier: null, version: 1 },
  { id: 's4', activity_id: 'a2', actor: 'CDRRMO', duty: 'R', qualifier: null, version: 1 },
  { id: 's5', activity_id: 'a2', actor: 'EOC', duty: 'R', qualifier: null, version: 1 },
  // a3 deliberately has two A's: the warning case (shared mandate).
  { id: 's6', activity_id: 'a3', actor: 'CDRRMO', duty: 'A', qualifier: null, version: 1 },
  { id: 's7', activity_id: 'a3', actor: 'EOC Manager / team', duty: 'A', qualifier: 'within mandate', version: 1 },
];
const templates = [
  { id: 't1', code: 'PR-CDRRMC-MEETING', title: 'CDRRMC meeting' },
  { id: 't2', code: 'PR-PDRA', title: 'Pre-Disaster Risk Assessment' },
] as ProtocolTemplate[];

const board = buildBoard(matrices, activities, assignments, templates);

describe('buildBoard', () => {
  it('orders matrices and activities by sort and drops empty matrices', () => {
    expect(board.map((m) => m.matrix.code)).toEqual(['6.1', '6.2']);
    expect(board[1]!.activities.map((a) => a.activity.activity)).toEqual(['Convene PDRA', 'Maintain common operating picture']);
  });
  it('groups assignments by duty and counts the Accountable entries', () => {
    const pdra = board[1]!.activities[0]!;
    expect(pdra.byDuty.A.map((r) => r.actor)).toEqual(['CDRRMO']);
    expect(pdra.byDuty.R.map((r) => r.actor)).toEqual(['CDRRMO', 'EOC']);
    expect(pdra.accountableCount).toBe(1);
  });
  it('joins the linked template', () => {
    expect(board[0]!.activities[0]!.template?.code).toBe('PR-CDRRMC-MEETING');
    expect(board[1]!.activities[1]!.template).toBeUndefined();
  });
  it('flags activities whose Accountable count is not one', () => {
    const issues = accountableIssues(board);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.activity.activity).toBe('Maintain common operating picture');
  });
});

describe('searchBoard', () => {
  it('matches activity text, actors, qualifiers and template codes, case-insensitive', () => {
    expect(searchBoard(board, 'pdra')[0]!.activities[0]!.activity.activity).toBe('Convene PDRA');
    expect(searchBoard(board, 'PR-CDRRMC')[0]!.activities).toHaveLength(1);
    expect(searchBoard(board, 'secretariat')[0]!.activities[0]!.activity.activity).toBe('Convene regular CDRRMC meeting');
    expect(searchBoard(board, 'WITHIN MANDATE')[0]!.activities[0]!.activity.activity).toBe('Maintain common operating picture');
    expect(searchBoard(board, 'prescribed')[0]!.activities[0]!.activity.activity).toBe('Convene PDRA');
  });
  it('returns everything for a blank query and nothing for a miss', () => {
    expect(searchBoard(board, '  ')).toHaveLength(2);
    expect(searchBoard(board, 'zzzz')).toHaveLength(0);
  });
});
