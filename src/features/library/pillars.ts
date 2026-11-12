import type { ThematicArea } from '@/features/protocols/labels';

/** 1.17 (ADR-031): each of the ten functional areas belongs to exactly one of the four DRRM pillars.
 * This is the Library's visual separator (block accent, chip, legend); the mapping is stated once
 * here and in the Introduction chapter. Areas follow the NDRRMP outcomes: governance, workforce and
 * the CDRRMC sit under Preparedness; digital continuity under Prevention (safeguarding assets
 * before disasters). */
export const PILLAR_OF_AREA: Record<number, ThematicArea> = {
  2: 'prevention', 9: 'prevention',
  1: 'preparedness', 3: 'preparedness',
  4: 'response', 5: 'response', 6: 'response', 7: 'response', 8: 'response',
  10: 'recovery',
};

export function pillarOfArea(areaNo: number | null | undefined): ThematicArea | null {
  return areaNo == null ? null : (PILLAR_OF_AREA[areaNo] ?? null);
}

/** Static class strings (Tailwind purges dynamic class names). The pillar colours are token-based and
 * never reuse the reserved EOC alert colours (lvl-white/blue/red) — pillars.test.ts guards that. */
export const PILLAR_CLASS: Record<ThematicArea, { band: string; chip: string; dot: string; edge: string }> = {
  prevention: { band: 'bg-pillar-prevention-soft', chip: 'bg-pillar-prevention text-on-strong', dot: 'bg-pillar-prevention', edge: 'border-l-pillar-prevention' },
  preparedness: { band: 'bg-pillar-preparedness-soft', chip: 'bg-pillar-preparedness text-on-strong', dot: 'bg-pillar-preparedness', edge: 'border-l-pillar-preparedness' },
  response: { band: 'bg-pillar-response-soft', chip: 'bg-pillar-response text-on-strong', dot: 'bg-pillar-response', edge: 'border-l-pillar-response' },
  recovery: { band: 'bg-pillar-recovery-soft', chip: 'bg-pillar-recovery text-on-strong', dot: 'bg-pillar-recovery', edge: 'border-l-pillar-recovery' },
};

export const PILLAR_KEYS: { key: ThematicArea; labelKey: 'pillar.prevention' | 'pillar.preparedness' | 'pillar.response' | 'pillar.recovery' }[] = [
  { key: 'prevention', labelKey: 'pillar.prevention' },
  { key: 'preparedness', labelKey: 'pillar.preparedness' },
  { key: 'response', labelKey: 'pillar.response' },
  { key: 'recovery', labelKey: 'pillar.recovery' },
];
