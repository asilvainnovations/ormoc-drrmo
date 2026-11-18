// The Plan's own risk profile beside the DDRiVE matrix: what each hazard could cost, and how flood risk narrows to the
// barangays that need investment first. Figures live in src/data/ldrrmpRisk.ts with their page references.
import { FLOOD_CRITICAL, LDRRMP_SOURCE, POTENTIAL_DAMAGES_BN } from '@/data/ldrrmpRisk';
import { BarRow, Metric } from '@/features/governance/kit';

const n = (v: number) => v.toLocaleString('en-PH');

export function LdrrmpRiskProfile() {
  const max = Math.max(...POTENTIAL_DAMAGES_BN.map((h) => h.billion));
  const f = FLOOD_CRITICAL;
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
        <p className="mb-2 text-xs text-muted">From all barangays touched by flood to the ones to fund first.</p>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Exposed to flood" value={f.exposed} hint="barangays" />
          <Metric label="High or very high" value={f.highOrVeryHigh} hint="barangays" />
          <Metric label="Critical flood risk" value={f.critical} tone="bad" hint={`${n(f.criticalPopulation)} people`} />
          <Metric label="Over ₱1B damage" value={f.over1bn} tone="bad" hint={`${n(f.over1bnPopulation)} people (87% of the critical group)`} />
        </div>
        <p className="mt-2 text-xs text-muted">Critical means high or very high exposure with at least 50% of the barangay population in the exposed area. The Plan counts barangays under the earlier 110-barangay scheme.</p>
      </div>
      <p className="text-xs text-muted lg:col-span-2">Source: {LDRRMP_SOURCE}. The official text governs.</p>
    </div>
  );
}
