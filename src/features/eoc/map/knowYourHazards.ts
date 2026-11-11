// "Know your hazards" (after the Project NOAH feature of that name, rebuilt for MODE; no NOAH code or text is used).
// For a chosen point: the class of each hazard sheet, the nearest EOC reference points, what to do, and a go-bag list.
// The advice is general safety practice written for this page. It is a DRAFT for CDRRMO review (Chapter 4 warning
// SOPs and the City's IEC materials govern) and sets no threshold: the City's advisories and the official warning
// products decide when to act.
import { distance, type LngLat } from './geodesy';
import type { HazardMap } from './hazardMaps';

export const ADVICE_STATUS = 'Draft for CDRRMO review. Follow the City advisories and the official PAGASA and PHIVOLCS warnings.';

export const ADVICE: Record<string, string[]> = {
  flood: [
    'Know your evacuation centre and the safest route to it before the rains.',
    'When the City or your barangay calls for evacuation, go early; do not wait for water to rise.',
    'Do not walk, swim or drive through moving floodwater.',
    'Switch off electricity and close the LPG tank before you leave, if it is safe to do so.',
  ],
  rain_landslide: [
    'Watch for cracks on slopes and walls, tilting trees or posts, and muddy water in streams.',
    'During continuous heavy rain, stay away from steep slopes and the foot of slopes.',
    'Leave at once if your barangay warns of a landslide, or if you hear rumbling upslope.',
  ],
  storm_surge: [
    'If you live near the shore, know whether your area is in the storm surge zone and where to go.',
    'Leave the coast when the City or your barangay orders pre-emptive evacuation; surge can arrive before the strongest winds.',
    'Move boats and fishing gear early, then move inland or to higher, sturdy buildings.',
  ],
  liquefaction: [
    'Ground may sink or crack in a strong earthquake here: after shaking stops, move away from sand boils and ground cracks.',
    'Check the building for tilting or settling before you go back in; ask the City Engineering Office to inspect it.',
  ],
  eq_landslide: [
    'After strong shaking, stay away from steep slopes and cuts: they may fail during aftershocks.',
    'Report fresh cracks or slides on slopes and roads to the barangay or the CDRRMO.',
  ],
  ground_rupture: [
    'This point is near a mapped active fault. Building over the trace is not recommended (PHIVOLCS: keep at least 5 m on each side of the trace or deformation zone).',
    'After an earthquake, keep away from fresh ground cracks and damaged roads, bridges and pipes.',
  ],
  shaking: [
    'During shaking: Duck, Cover and Hold. Stay away from glass, shelves and things that can fall.',
    'After shaking: go out calmly to an open area, away from buildings, posts and wires; expect aftershocks.',
  ],
  tsunami: [
    'If you feel a strong or long earthquake near the coast, do not wait for an official warning: go inland or to high ground at once.',
    'If the sea suddenly pulls back or you hear a roar from the sea, move to high ground.',
    'Stay away from the shore until the authorities say it is safe; more waves may follow.',
  ],
};

export const GO_BAG = ['Drinking water', 'Ready-to-eat food', 'Flashlight and spare batteries', 'First-aid kit and your regular medicines',
  'Copies of IDs and important papers in a waterproof bag', 'Whistle', 'Some cash', 'Phone, charger and power bank', 'Clothes, blanket and hygiene kit'];

/** Classes that mean the point is not shown in a hazard zone on that sheet. */
export const isNoHazard = (v: string) => /^(No class shown|Not mapped here|Not readable|Could not)/.test(v);

/** Advice to show: only for sheets that show a class at the point. */
export function adviceFor(found: { map: HazardMap; value: string }[]) {
  return found.filter((f) => !isNoHazard(f.value) && ADVICE[f.map.code]).map((f) => ({ map: f.map, value: f.value, steps: ADVICE[f.map.code]! }));
}

export interface PlacePoint { id: string; name: string; kind: string; lat: number; lng: number; status: string }
/** The nearest places to a point, closest first. */
export function nearest(p: LngLat, places: PlacePoint[], n = 5) {
  return places.map((x) => ({ ...x, km: distance(p, [x.lng, x.lat]) / 1000 })).sort((a, b) => a.km - b.km).slice(0, n);
}
