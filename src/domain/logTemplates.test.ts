import { describe, expect, it } from 'vitest';
import { LOG_TEMPLATES, missingFields, renderLog, templateById } from './logTemplates';

describe('logbook templates', () => {
  it('writes a warning in a fixed shape', () => {
    const t = templateById('warning')!;
    expect(renderLog(t, { source: 'PAGASA', hazard: 'Tropical cyclone', product: '5', area: 'Leyte', until: '18:00' }))
      .toBe('Warning received: Tropical cyclone from PAGASA · No. 5 · Area: Leyte · Valid until 18:00.');
  });
  it('leaves out blank optional fields', () => {
    expect(renderLog(templateById('warning')!, { source: 'MGB', hazard: 'Landslide' })).toBe('Warning received: Landslide from MGB.');
    expect(renderLog(templateById('barangay')!, { barangay: 'Lao', condition: 'Isolated' })).toBe('Barangay Lao: isolated.');
  });
  it('lists the required fields still empty', () => {
    expect(missingFields(templateById('request')!, { item: 'boats' }).map((f) => f.key)).toEqual(['qty', 'for', 'priority']);
    expect(missingFields(templateById('situation')!, { trend: 'Stable' })).toEqual([]);
  });
  it('has no template that asks for the name of an affected person', () => {
    expect(LOG_TEMPLATES.flatMap((t) => t.fields).some((f) => /\b(victim|patient|evacuee name|casualty name)\b/i.test(f.label))).toBe(false);
  });
});
