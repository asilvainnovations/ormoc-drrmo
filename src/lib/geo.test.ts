import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EOC_SITES } from '@/data/eoc-site';
import { fmtDms, fmtLatLng, geoUri, googleDirectionsUrl, googleMapsUrl, inOrmoc, kmlPoints, osmUrl, plainLatLng, toDms } from './geo';

describe('coordinate formats', () => {
  it('formats decimal degrees with hemispheres', () => {
    expect(fmtLatLng(11.01389600057808, 124.6042871572453)).toBe('11.013896° N, 124.604287° E');
    expect(fmtLatLng(-1.5, -70.25, 2)).toBe('1.50° S, 70.25° W');
    expect(plainLatLng(11.01389600057808, 124.6042871572453)).toBe('11.013896, 124.604287');
  });

  it('converts to degrees, minutes and seconds without showing 60 seconds', () => {
    expect(toDms(11.01389600057808, 'lat')).toBe('11°00′50.0″ N');
    expect(toDms(124.6042871572453, 'lng')).toBe('124°36′15.4″ E');
    expect(toDms(10.999999, 'lat')).toBe('11°00′00.0″ N');
    expect(fmtDms(11.01389600057808, 124.6042871572453)).toBe('11°00′50.0″ N, 124°36′15.4″ E');
  });

  it('builds HTTPS map links and a geo: link', () => {
    for (const u of [googleMapsUrl(11, 124.6), googleDirectionsUrl(11, 124.6), osmUrl(11, 124.6)]) {
      expect(new URL(u).protocol).toBe('https:');
    }
    expect(googleMapsUrl(11.01389600057808, 124.6042871572453)).toContain('query=11.013896,124.604287');
    expect(geoUri(11.01389600057808, 124.6042871572453, 'Ormoc City EOC')).toBe('geo:11.013896,124.604287?q=11.013896,124.604287(Ormoc%20City%20EOC)');
  });
});

describe('KML placemarks', () => {
  it('reads the point, name and id', () => {
    const pts = kmlPoints('<kml><Placemark id="x1"><name>EOC</name><Point><coordinates>124.6,11.01,7.4</coordinates></Point></Placemark>'
      + '<Placemark><name>Line</name><LineString><coordinates>1,2 3,4</coordinates></LineString></Placemark></kml>');
    expect(pts).toEqual([{ id: 'x1', name: 'EOC', lat: 11.01, lng: 124.6, alt: 7.4 }]);
  });
});

describe('EOC site record', () => {
  it('has exactly one primary EOC, inside Ormoc', () => {
    expect(EOC_SITES.filter((s) => s.role === 'primary')).toHaveLength(1);
    for (const s of EOC_SITES) expect(inOrmoc(s.lat, s.lng)).toBe(true);
  });

  it('matches the KML file the app serves', () => {
    for (const s of EOC_SITES) {
      const kml = readFileSync(resolve(__dirname, '../../public', s.kml.replace(/^\//, '')), 'utf8');
      const [p] = kmlPoints(kml);
      if (!p) throw new Error(`${s.kml} has no point`);
      expect(p.lat).toBeCloseTo(s.lat, 9);
      expect(p.lng).toBeCloseTo(s.lng, 9);
      if (s.elevationM != null) expect(p.alt).toBeCloseTo(s.elevationM, 6);
    }
  });
});
