// Domain maturity as a radar profile (1.11.0): the shape shows at a glance which functions lag. It complements
// the labelled bars (MaturityChart), which stay the accessible, exact view; values are also in the table below
// the chart for screen readers. Built on recharts through components/ui/chart (City colour tokens).
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { Domain } from '@/types';
import type { ResultRow } from '@/domain/scoring';

const config = {
  maturity: { label: 'Maturity (0 to 4)', color: 'rgb(var(--sky))' },
  target: { label: 'Compliant band starts (2.5)', color: 'rgb(var(--accent))' },
} satisfies ChartConfig;

export function MaturityRadar({ domains, results }: { domains: Domain[]; results: Record<string, ResultRow> }) {
  const rows = domains.map((d) => ({ code: d.code, name: d.name, maturity: results[d.code]?.maturityIndex ?? 0, target: 2.5, scored: results[d.code]?.maturityIndex !== null }));
  return (
    <figure>
      <ChartContainer config={config} className="mx-auto aspect-square max-h-[26rem]" role="img"
        aria-label={`Maturity profile by domain: ${rows.map((r) => `${r.code} ${r.scored ? r.maturity.toFixed(2) : 'not scored'}`).join(', ')}`}>
        <RadarChart data={rows} outerRadius="75%">
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="name" />} />
          <PolarGrid />
          <PolarAngleAxis dataKey="code" tick={{ fill: 'rgb(var(--ink))', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, 4]} tickCount={5} angle={90} tick={{ fill: 'rgb(var(--muted))', fontSize: 10 }} />
          <Radar dataKey="target" stroke="var(--color-target)" strokeDasharray="4 4" fill="none" isAnimationActive={false} />
          <Radar dataKey="maturity" stroke="var(--color-maturity)" fill="var(--color-maturity)" fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
        </RadarChart>
      </ChartContainer>
      <figcaption className="mt-2 text-center text-sm text-muted">Solid shape: domain maturity, 0 (centre) to 4 (edge). Dashed ring: 2.5, where the Compliant band begins. Unscored domains show at 0.</figcaption>
    </figure>
  );
}
