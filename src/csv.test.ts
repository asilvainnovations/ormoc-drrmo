import { describe, expect, it } from 'vitest';
import { parseBarangayCsv } from './SettingsPages';

describe('barangay CSV import', () => {
  it('parses rows and reports bad lines', () => {
    const { rows, errors } = parseBarangayCsv('psgc,name,classification,population,lat,lng\n0803738001,Sample Barangay,coastal;urban,1200,11.0,124.6\n12,Bad\n0803738002,,riverine');
    expect(rows).toEqual([{ psgc: '0803738001', name: 'Sample Barangay', classification: ['coastal', 'urban'], population: 1200, lat: 11, lng: 124.6 }]);
    expect(errors).toHaveLength(2);
  });
});
