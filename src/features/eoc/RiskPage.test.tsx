// MODE Ormoc City — Emergency Operations Center (EOC)
// Copyright 2026 Alvin M. Silva
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// RiskPage.test.tsx — tests for the EOC risk page's matrix chart.
// Extend this file with page-level tests (register table, filters, add-risk dialog) as the page grows.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RiskMatrixChart, { buildMatrix, levelForScore, scoreFor } from '../RiskMatrixChart';
import type { RiskMatrixItem } from '../RiskMatrixChart';

const risk = (likelihood: number, impact: number): RiskMatrixItem => ({ likelihood, impact });

describe('RiskMatrixChart', () => {
  it('renders a 5×5 grid of 25 cells', () => {
    render(<RiskMatrixChart items={[]} />);
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(25);
  });

  it('scores cells as likelihood × impact, top-left 25 and bottom-right 1', () => {
    render(<RiskMatrixChart items={[]} />);
    expect(screen.getByTestId('cell-5-5')).toHaveTextContent('25');
    expect(screen.getByTestId('cell-1-1')).toHaveTextContent('1');
    expect(screen.getByTestId('cell-3-4')).toHaveTextContent('12');
    expect(screen.getByTestId('cell-4-2')).toHaveTextContent('8');
  });

  it('labels each cell with its likelihood, impact, score and count for screen readers', () => {
    render(<RiskMatrixChart items={[]} />);
    expect(screen.getByRole('cell', { name: /likelihood 5, impact 5: score 25, 0 items/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /likelihood 1, impact 1: score 1, 0 items/i })).toBeInTheDocument();
  });

  it('shows a count badge only on cells that contain items', () => {
    render(<RiskMatrixChart items={[risk(4, 3), risk(4, 3), risk(2, 5)]} />);
    expect(screen.getByTestId('count-4-3')).toHaveTextContent('2');
    expect(screen.getByTestId('count-2-5')).toHaveTextContent('1');
    expect(screen.queryByTestId('count-1-1')).toBeNull();
    // The aria-label keeps the count even without the badge.
    expect(screen.getByRole('cell', { name: /likelihood 4, impact 3: score 12, 2 items/i })).toBeInTheDocument();
  });

  it('hides count badges when showCounts is false but keeps counts in aria-labels', () => {
    render(<RiskMatrixChart items={[risk(4, 3)]} showCounts={false} />);
    expect(screen.queryByTestId('count-4-3')).toBeNull();
    expect(screen.getByRole('cell', { name: /score 12, 1 item/i })).toBeInTheDocument();
  });

  it('renders the axis captions', () => {
    render(<RiskMatrixChart items={[]} />);
    expect(screen.getByText('Likelihood (5 → 1)')).toBeInTheDocument();
    expect(screen.getByText('Impact (1 → 5)')).toBeInTheDocument();
  });
});

describe('matrix scoring helpers', () => {
  it('scoreFor multiplies likelihood and impact', () => {
    expect(scoreFor(5, 5)).toBe(25);
    expect(scoreFor(3, 2)).toBe(6);
    expect(scoreFor(1, 1)).toBe(1);
  });

  it('clamps out-of-range likelihoods and impacts into 1–5', () => {
    expect(scoreFor(9, 0)).toBe(5);   // clamped to 5 × 1
    expect(scoreFor(-3, 3)).toBe(3);  // clamped to 1 × 3
    expect(scoreFor(NaN, 4)).toBe(4); // NaN treated as 1
  });

  it('levelForScore follows the organisation’s risk criteria', () => {
    expect(levelForScore(25)).toBe('Critical');
    expect(levelForScore(20)).toBe('Critical');
    expect(levelForScore(12)).toBe('High');
    expect(levelForScore(6)).toBe('Medium');
    expect(levelForScore(1)).toBe('Low');
  });

  it('buildMatrix counts items per cell with clamping', () => {
    const m = buildMatrix([risk(6, 3), risk(3, 3), risk(3, 3)]); // 6 clamps to 5
    expect(m[0][2]).toMatchObject({ likelihood: 5, impact: 3, score: 15, count: 1 });
    expect(m[2][2]).toMatchObject({ likelihood: 3, impact: 3, score: 9, count: 2 });
    expect(m[1][2].count).toBe(0); // likelihood 4 × impact 3
  });
});
