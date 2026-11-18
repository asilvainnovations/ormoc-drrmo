// The Plan's own risk profile beside the DDRiVE matrix: what each hazard could cost, and how flood risk narrows to the
// barangays that need investment first. Figures live in src/data/ldrrmpRisk.ts with their page references.
import { LDRRMP_SOURCE, POTENTIAL_DAMAGES_BN } from '@/data/ldrrmpRisk';
import { BarRow, Metric } from '@/features/governance/kit';
import { useFloodRows } from '@/features/tools/flood/useFloodRows';
import { classCounts } from '@/domain/floodScreen';


export function LdrrmpRiskProfile() {
  const max = Math.max(...POTENTIAL_DAMAGES_BN.map((h) => h.billion));
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
        <p className="mt-2 text-xs text-muted">A blank is "not assessed", never "low". Barangays are added as their flood assessments are loaded.</p>
      </div>
      <p className="text-xs text-muted lg:col-span-2">Source: {LDRRMP_SOURCE}. The official text governs.</p>
    </div>
  );
}
