// The Plan's own risk profile beside the DDRiVE matrix: what each hazard could cost, and how flood risk narrows to the
// barangays that need investment first. Figures live in src/data/ldrrmpRisk.ts with their page references.
import { FLOOD_CRITICAL, LDRRMP_SOURCE, POTENTIAL_DAMAGES_BN } from '@/data/ldrrmpRisk';
import { BarRow, Metric } from '@/features/governance/kit';
import { useFloodRows } from '@/features/tools/flood/useFloodRows';
import { classCounts } from '@/domain/floodScreen';

const n = (v: number) => v.toLocaleString('en-PH');

export function LdrrmpRiskProfile() {
  const max = Math.max(...POTENTIAL_DAMAGES_BN.map((h) => h.billion));
  const f = FLOOD_CRITICAL;
  const data = useFloodRows();
  const rows = data?.rows ?? [];
  const counts = classCounts(rows);
  const by = (c: string) => counts.find((x) => x.cls === c)?.barangays ?? 0;
  const classed = ['Very high', 'High', 'Moderate', 'Low'].reduce((a, c) => a + by(c), 0);
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <div>
        <h3 className="text-base font-extrabold text-ink">What each hazard could cost</h3>
        <p className="mb-2 text-xs text-muted">Total potential damages to exposed assets, in billions of pesos.</p>
        {POTENTIAL_DAMAGES_BN.map((h, i) => (
          <BarRow key={h.hazard} label={h.hazard} value={h.billion} max={max} tone={i < 3 ? 'red' : 'grey'} display={`₱${h.billion}B`} labelWidth="10rem" valueWidth="3.5rem" />
        ))}
        <p className="mt-2 text-xs text-muted">Flood, rain-induced landslides and liquefaction are secondary hazards: each needs a tropical cyclone, heavy rain or an earthquake to trigger it.</p>
      </div>
      <div>
        <h3 className="text-base font-extrabold text-ink">Where flood risk concentrates</h3>
        <p className="mb-2 text-xs text-muted">Today's {rows.length || 85} barangays, by DDRiVE flood class.</p>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="With a flood class" value={classed} hint={`of ${rows.length || 85} barangays`} />
          <Metric label="Very high" value={by('Very high')} tone="bad" hint="barangays" />
          <Metric label="High" value={by('High')} tone="bad" hint="barangays" />
          <Metric label="Moderate or low" value={by('Moderate') + by('Low')} hint="barangays" />
        </div>
        <p className="mt-2 text-xs text-muted">A blank is "not assessed", never "low". Counts come from the current 85-barangay list, so they do not add up to the Plan's figures below.</p>
        <h4 className="mt-4 text-sm font-bold text-ink">As printed in the Plan (earlier 110-barangay scheme)</h4>
        <p className="mb-1 text-xs text-muted">Kept for reference. They count barangays under the old scheme and cannot be converted to the 85 barangays one for one.</p>
        <ul className="list-disc pl-5 text-xs text-muted">
          <li>{f.exposed} barangays exposed to flood; {f.highOrVeryHigh} with high or very high exposure.</li>
          <li>{f.critical} critical ({n(f.criticalPopulation)} people), of which {f.over1bn} with over ₱1B damage ({n(f.over1bnPopulation)} people).</li>
          <li>Critical means high or very high exposure with at least 50% of the barangay population in the exposed area.</li>
        </ul>
      </div>
      <p className="text-xs text-muted lg:col-span-2">Source: {LDRRMP_SOURCE}. The official text governs.</p>
    </div>
  );
}
