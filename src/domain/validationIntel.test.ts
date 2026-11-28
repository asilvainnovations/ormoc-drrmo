import { describe, expect, it } from 'vitest';
import type { ManualReviewItem } from '@/types';
import { chapterOf, chapterSummary, impactOf, intelCsv, intelRows, levelSummary } from './validationIntel';

const item = (p: Partial<ManualReviewItem>) => ({ id: p.source_tracker_id, version: 1, title: 'x', description: null, chapter_ref: 'Ch. 1', section_ref: null,
  source_register: null, source_used: null, required_action: null, priority: 'standard', priority_raw: null, review_status: 'open', validation_status: 'not_started',
  lead_office: 'CDRRMO', lead_position: null, workshop_slot: null, closure_test: null, disposition: null, closed_at: null, closed_by: null, notes: null, ...p }) as ManualReviewItem;

// Two rows as the Validation Task Locator holds them, with the scores in Validation_Radial_Dataset.csv.
const vr001 = item({ source_tracker_id: 'VR-001', title: 'CDRRMO legal status', priority: 'critical_urgent', chapter_version: 'Ch. 1 v1.3', lead_office: 'City Legal Office / SP',
  section_ref: '§4.5 Local DRRM Issuances; §6.2 CDRRMO; Table 1.7–1.9; Annex 1-I', sop_ref: 'GOV-03 Institutional Policy and Ordinance Development',
  issue_type: 'Existing provision — legal/institutional evidence requires validation' });
const vr002 = item({ source_tracker_id: 'VR-002', title: 'CDRRMC composition', priority: 'important', chapter_version: 'Ch. 1 v1.3',
  section_ref: '§6.1 City DRRM Council; Table 1.12; SOP 8-06 Partner seats on the CDRRMC', sop_ref: 'GOV-01; SOP 8-06',
  issue_type: 'Existing provision — membership and accreditation evidence requires validation' });

describe('Validation Intelligence: Systems Impact', () => {
  it('scores as the radial dataset does', () => {
    expect(impactOf(vr001)).toMatchObject({ score: 76, level: 'High', refs: 5, authority: 15, cross: 0 });
    expect(impactOf(vr002)).toMatchObject({ score: 65, level: 'Medium', cross: 20, authority: 0 });
  });
  it('uses the corrected chapter from the locator', () => {
    expect(chapterOf({ chapter_ref: 'Ch. 5', chapter_version: 'Ch. 6 v1.1' })).toBe(6);
    expect(chapterOf({ chapter_ref: 'Ch. 5', chapter_version: null })).toBe(5);
  });
  it('shares add up to 100% and summarise by level and chapter', () => {
    const rows = intelRows([vr001, vr002], new Map([[1, 'Legal Mandate']]));
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(100, 1);
    expect(levelSummary(rows).find((l) => l.level === 'High')).toMatchObject({ items: 1 });
    expect(chapterSummary(rows)[0]).toMatchObject({ label: 'Ch. 1 — Legal Mandate', items: 2 });
    expect(rows.find((r) => r.item.source_tracker_id === 'VR-001')?.stakeholders).toEqual(['City Legal Office', 'SP']);
  });
  it('writes the CSV with the requested columns', () => {
    const csv = intelCsv(intelRows([vr001, vr002]));
    expect(csv.split('\n')[0]).toContain('Sections & subsections requiring focused review,SOPs/Protocols/Forms,Validating Stakeholder,Level of Priority,Systems Impact');
    expect(csv).toContain('VR-001,CDRRMO legal status,Ch. 1,');
  });
});
