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

import React, { useMemo } from 'react';

/**
 * RiskMatrixChart — the organisation's 5×5 risk matrix (ISO 31000 likelihood × impact),
 * refactored out of the Diagnosis module's RiskRegister for reuse in the EOC.
 * Each cell shows the score (likelihood × impact) and, optionally, how many items sit in it.
 */

/** Anything the matrix can place on the grid: a register risk, a DDRiVE hazard event, etc. */
export interface RiskMatrixItem {
  /** Likelihood on the organisation's 1–5 scale. */
  likelihood: number;
  /** Impact on the organisation's 1–5 scale (severity class). */
  impact: number;
}

/** A precomputed matrix row/cell, as produced by the EOC data layer or buildMatrix(). */
export interface RiskMatrixRow {
  likelihood: number;
  impact: number;
  score: number;
  count: number;
}

export interface RiskMatrixChartProps {
  /** Items to plot; prefer this on new call sites. */
  items?: RiskMatrixItem[];
  /** @deprecated Alias for items, kept for existing call sites such as RiskPage. */
  risks?: RiskMatrixItem[];
  /** Precomputed cells with counts; when provided, the chart renders them as-is. */
  matrix?: RiskMatrixRow[];
  /** Show a count badge on cells that contain items. Default true. */
  showCounts?: boolean;
  title?: string;
  description?: string;
  ariaLabel?: string;
  className?: string;
}

const clamp15 = (n: number) => Math.min(5, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));

/** Score for a cell: likelihood × impact, both clamped to 1–5. */
export const scoreFor = (likelihood: number, impact: number) => clamp15(likelihood) * clamp15(impact);

/** Risk level for a score, following the organisation's risk criteria (Settings → Organisation). */
export const levelForScore = (score: number): 'Critical' | 'High' | 'Medium' | 'Low' =>
  score >= 20 ? 'Critical' : score >= 12 ? 'High' : score >= 6 ? 'Medium' : 'Low';

export const cellClass = (score: number) =>
  score >= 20 ? 'bg-red-600' : score >= 12 ? 'bg-orange-500' : score >= 6 ? 'bg-amber-400 text-slate-900' : 'bg-emerald-600';

export const levelClass = (level: string) =>
  level === 'Critical' ? 'bg-red-100 text-red-900' : level === 'High' ? 'bg-orange-100 text-orange-900' : level === 'Medium' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900';

/** Build the 5×5 grid rows, top row = likelihood 5 down to bottom row = likelihood 1. */
export const buildMatrix = (items: RiskMatrixItem[]): RiskMatrixRow[] =>
  Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => {
      const likelihood = 5 - i;
      const impact = j + 1;
      return {
        likelihood,
        impact,
        score: likelihood * impact,
        count: items.filter((r) => clamp15(r.likelihood) === likelihood && clamp15(r.impact) === impact).length,
      };
    })).flat();

export const RiskMatrixChart: React.FC<RiskMatrixChartProps> = ({
  items,
  risks,
  matrix,
  showCounts = true,
  title = 'Risk matrix (likelihood × impact)',
  description,
  ariaLabel = 'Risk matrix: likelihood 5 to 1 by impact 1 to 5',
  className,
}) => {
  const source = items ?? risks ?? [];
  const computed = useMemo(() => buildMatrix(source), [source]);
  // A precomputed matrix (e.g. aggregated in the EOC data layer) wins over deriving one from items.
  const cells = matrix && matrix.length ? matrix : computed;

  return (
    <div className={className}>
      <h3 className="font-montserrat font-bold text-lg mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-500 mb-3">{description}</p>}
      <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
        <span className="text-[10px] font-bold text-slate-500 [writing-mode:vertical-rl] rotate-180">Likelihood (5 → 1)</span>
        <div className="grid grid-cols-5 gap-1" role="table" aria-label={ariaLabel}>
          {cells.map((c) => (
            <div
              key={`${c.likelihood}-${c.impact}`}
              role="cell"
              data-testid={`cell-${c.likelihood}-${c.impact}`}
              className={`${cellClass(c.score)} aspect-square rounded-lg flex flex-col items-center justify-center text-white`}
              aria-label={`Likelihood ${c.likelihood}, impact ${c.impact}: score ${c.score}, ${c.count} item${c.count === 1 ? '' : 's'}`}
            >
              <span className="text-xs font-bold">{c.score}</span>
              {showCounts && c.count > 0 && (
                <span className="text-[10px] mt-0.5 px-1 rounded bg-black/30" data-testid={`count-${c.likelihood}-${c.impact}`}>{c.count}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="text-center text-[10px] font-bold text-slate-500 mt-2">Impact (1 → 5)</div>
    </div>
  );
};

export default RiskMatrixChart;
