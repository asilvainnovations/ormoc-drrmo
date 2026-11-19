import { describe, expect, it } from 'vitest';
import { CATEGORY, THEMATIC, chapterArea, formAreas, templateIsWorkflow, thematicOf } from './labels';
import type { ProtocolCategory } from '@/types';

describe('DRRM thematic areas (1.14)', () => {
  it('places every category in exactly one of the four areas', () => {
    expect(THEMATIC.map((t) => t.key)).toEqual(['prevention', 'preparedness', 'response', 'recovery']);
    for (const c of Object.keys(CATEGORY) as ProtocolCategory[]) {
      expect(THEMATIC.filter((t) => t.categories.includes(c)).length, c).toBe(1);
    }
    expect(thematicOf('recovery')).toBe('recovery');
    expect(thematicOf('reporting')).toBe('response');
    expect(thematicOf('risk_information')).toBe('prevention');
  });
});

describe('1.29.0 placement against NDRRMP 2020–2030 and the Ormoc 10-Year Plan (ADR-046)', () => {
  it('uses Title Case area names', () => {
    for (const t of THEMATIC) expect(t.label, t.key).toMatch(/^(?:[A-Z][a-z]+|and)(?: (?:[A-Z][a-z]+|and))*$/);
    expect(THEMATIC.map((t) => t.label)).toEqual(['Disaster Prevention and Mitigation', 'Disaster Preparedness',
      'Disaster Response and Early Recovery', 'Disaster Rehabilitation and Recovery']);
  });
  it('places response operations and forecast-based early action under Response and Early Recovery', () => {
    for (const c of ['eoc', 'anticipatory_action', 'response_clusters', 'reporting'] as ProtocolCategory[]) expect(thematicOf(c), c).toBe('response');
    expect(thematicOf('warning')).toBe('prevention');
    expect(thematicOf('budget')).toBe('prevention');
    expect(thematicOf('learning')).toBe('preparedness');
    expect(thematicOf('partnerships')).toBe('preparedness');
  });
  it('places a form by the steps that use it, else by its chapter', () => {
    expect(formAreas(['eoc', 'eoc', 'warning']).primary).toBe('response');
    expect(formAreas(['eoc', 'eoc', 'warning']).also).toEqual(['prevention']);
    expect(formAreas([], 'Chapter 4')).toEqual({ primary: 'response', also: [] });
    expect(formAreas([], 'Chapter 7').primary).toBe('preparedness');
    expect(formAreas([], 'Area 6').primary).toBe('prevention');
    expect(chapterArea('Chapter 5')).toBe('recovery');
  });
  it('keeps the template kind over the category rule', () => {
    expect(templateIsWorkflow({ kind: 'protocol', category: 'learning' })).toBe(false);
    expect(templateIsWorkflow({ kind: 'workflow', category: 'recovery' })).toBe(true);
    expect(templateIsWorkflow({ category: 'partnerships' })).toBe(true);
  });
});
