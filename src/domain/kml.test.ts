import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { bboxOf, firstPoint, kmlToGeoJson, kmzToKml, parseCoordinates, readGeoJson } from './kml';

// The EOC placemark the City shared on 6 Nov 2026 (Google Earth export, trimmed of styles).
const EOC_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document><name>EOC.kml</name>
  <Placemark id="0A9E71EA9142E2E2B044">
    <name>EOC</name>
    <LookAt><longitude>124.6042871572453</longitude><latitude>11.01389600057808</latitude><heading>-88.857</heading><tilt>60.005</tilt><range>1093.013</range></LookAt>
    <Point><coordinates>124.6042871572453,11.01389600057808,7.471268260529933</coordinates></Point>
  </Placemark>
</Document></kml>`;

describe('KML to GeoJSON', () => {
  it('reads the EOC placemark', () => {
    const r = kmlToGeoJson(EOC_KML);
    expect(r.featureCount).toBe(1);
    expect(r.warnings).toEqual([]);
    const f = r.geojson.features[0]!;
    expect(f.id).toBe('0A9E71EA9142E2E2B044');
    expect(f.properties.name).toBe('EOC');
    expect(f.geometry).toEqual({ type: 'Point', coordinates: [124.6042871572453, 11.01389600057808, 7.471268260529933] });
    expect(firstPoint(r)).toEqual({ name: 'EOC', lat: 11.01389600057808, lng: 124.6042871572453, altitude: 7.471268260529933 });
  });

  it('reads lines, areas, multi-geometry and extended data, and drops description markup', () => {
    const r = kmlToGeoJson(`<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder>
      <Placemark><name>Route</name><description><![CDATA[<b>Evacuation</b> route <script>x()</script>]]></description>
        <LineString><coordinates>124.60,11.01 124.61,11.02</coordinates></LineString></Placemark>
      <Placemark><name>Zone</name><ExtendedData><Data name="hazard"><value>flood</value></Data></ExtendedData>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>124.6,11 124.7,11 124.7,11.1 124.6,11</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
      <Placemark><MultiGeometry><Point><coordinates>124.5,11.0</coordinates></Point><Point><coordinates>124.8,11.2</coordinates></Point></MultiGeometry></Placemark>
      <Placemark><name>Empty</name></Placemark>
    </Folder></Document></kml>`);
    expect(r.featureCount).toBe(3);
    expect(r.geojson.features[0]!.properties.description).toBe('Evacuation route x()');
    expect(r.geojson.features[1]!.properties.hazard).toBe('flood');
    expect(r.geojson.features[2]!.geometry.type).toBe('GeometryCollection');
    expect(r.warnings).toEqual(['1 placemark had no point, line or area and was left out.']);
    expect(r.bbox).toEqual([124.5, 11, 124.8, 11.2]);
  });

  it('refuses a file that is not KML', () => {
    expect(() => kmlToGeoJson('<svg></svg>')).toThrow(/not KML/);
    expect(() => kmlToGeoJson('not xml at all <')).toThrow();
  });

  it('refuses a coordinate out of range', () => {
    expect(() => parseCoordinates('200,11')).toThrow(/longitude,latitude/);
  });

  it('opens a KMZ', () => {
    const kmz = zipSync({ 'doc.kml': strToU8(EOC_KML), 'files/icon.png': new Uint8Array([1, 2]) });
    expect(kmlToGeoJson(kmzToKml(kmz)).featureCount).toBe(1);
  });
});

describe('GeoJSON', () => {
  it('keeps features with a geometry and flattens properties', () => {
    const r = readGeoJson(JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [124.6, 11.0] }, properties: { n: 3, tags: ['a'] } },
      { type: 'Feature', geometry: null, properties: {} },
    ] }));
    expect(r.featureCount).toBe(1);
    expect(r.geojson.features[0]!.properties).toEqual({ n: '3', tags: '["a"]' });
    expect(r.warnings).toEqual(['1 features had no geometry and were left out.']);
  });
  it('refuses projected coordinates', () => {
    expect(() => readGeoJson(JSON.stringify({ type: 'Feature', geometry: { type: 'Point', coordinates: [712000, 1218000] }, properties: {} })))
      .toThrow(/EPSG:4326/);
  });
  it('has no box when empty', () => expect(bboxOf({ type: 'FeatureCollection', features: [] })).toBeNull());
});
