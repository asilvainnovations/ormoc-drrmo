import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '@/lib/db';
import { bootstrapReference } from '@/lib/bootstrap';
import { ValidationPage } from './ValidationPage';
import { ResultsBoard } from './ResultsBoard';
import type { Cycle, Response } from '@/types';

async function seed() {
  await bootstrapReference();
  await db.assessment_cycles.put({ id: 'cy1', name: 'Workshop test', cycle_year: 2026, iat_version: '1.7', status: 'validation', version: 1 } as Cycle);
  const base = { cycle_id: 'cy1', is_na: false, na_justification: null, gap_remarks: null, recommended_action: null, version: 1 };
  await db.responses.bulkPut([
    { ...base, id: 'r1', indicator_id: 'A1.1', score: 2, status: 'provisional', evidence_check: 'pending' },
    { ...base, id: 'r2', indicator_id: 'A1.2', score: 3, status: 'validated', validation_decision: 'confirmed', evidence_check: 'verified' },
    { ...base, id: 'r3', indicator_id: 'A1.3', score: 1, status: 'validated', validation_decision: 'revised', score_before_validation: 2, evidence_check: 'verified' },
  ] as Response[]);
}
const at = (path: string, el: JSX.Element, route: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={el} /></Routes></MemoryRouter>);

describe('validation workshop screens (1.15)', () => {
  it('lists what waits for validation and shows agreement', async () => {
    await seed();
    at('/assess/cy1/validate', <ValidationPage />, '/assess/:cycleId/validate');
    expect(await screen.findByText('Validation Workshop')).toBeTruthy();
    expect(await screen.findByText('A1.1')).toBeTruthy();          // waiting (default filter)
    expect(screen.queryByText('A1.2')).toBeNull();                 // validated, filtered out
    expect(screen.getByText('50%')).toBeTruthy();                  // 1 confirmed, 1 revised
  });
  it('shows the results board with validation progress', async () => {
    cleanup();
    await seed();
    at('/assess/cy1/validate/board', <ResultsBoard />, '/assess/:cycleId/validate/board');
    expect(await screen.findByText('Institutional Maturity Index (A+B)')).toBeTruthy();
    expect(screen.getByText(/2 of 125 core indicators validated/)).toBeTruthy();
  });
});
