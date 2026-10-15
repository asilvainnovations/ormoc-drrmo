// Domain maturity as labelled horizontal bars on a fixed 0–4 scale. One series,
// one colour; band and value are always written beside the bar (never colour alone).
import { Link } from 'react-router-dom';
import type { Domain } from '@/types';
import type { ResultRow } from '@/domain/scoring';

const pct = (v: number) => `${(v / 4) * 100}%`;
const THRESHOLDS = [0.5, 1.5, 2.5, 3.5];     // band edges: Initial, Developing, Compliant, Advanced

export function MaturityChart({ domains, results, hrefFor, caption }: {
  domains: Domain[]; results: Record<string, ResultRow>; hrefFor: (code: string) => string; caption: string;
}) {
  return (
    <figure>
      <figcaption className="mb-3 text-sm text-muted">{caption}</figcaption>
      <div className="mb-1 ml-[7.5rem] hidden justify-between text-xs text-muted sm:flex sm:ml-[16rem]" aria-hidden>
        {[0, 1, 2, 3, 4].map((t) => <span key={t}>{t}</span>)}
      </div>
      <ul className="space-y-1">
        {domains.map((d) => {
          const r = results[d.code]!;
          const v = r.maturityIndex;
          return (
            <li key={d.code}>
              <Link to={hrefFor(d.code)}
                title={v === null ? `${d.name}: not scored yet` : `${d.name}: ${v.toFixed(2)} ${r.band}, ${r.scored} of ${r.indicators} scored`}
                className="group grid min-h-tap grid-cols-[6.5rem_1fr] items-center gap-x-3 rounded-control px-1 py-1 hover:bg-sunken sm:grid-cols-[15rem_1fr]">
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{d.code}</span>
                  <span className="block truncate text-xs text-muted sm:text-sm">{d.name}</span>
                </span>
                <span className="relative block">
                  <span className="relative block h-3 rounded-full bg-sunken" aria-hidden>
                    {THRESHOLDS.map((t) => <span key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: pct(t) }} />)}
                    {v !== null && v > 0 && (
                      <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-ink" style={{ width: pct(v) }} />
                    )}
                  </span>
                  <span className="mt-1 flex justify-between gap-2 text-xs">
                    <span className="font-semibold">{v === null ? 'Not scored' : `${v.toFixed(2)} ${r.band}`}</span>
                    <span className="text-muted">
                      {r.scored}/{r.indicators} scored
                      {r.mandatoryCompliance !== null && `, ${Math.round(r.mandatoryCompliance * 100)}% mandatory met`}
                      {r.highGaps > 0 && `, ${r.highGaps} high`}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
