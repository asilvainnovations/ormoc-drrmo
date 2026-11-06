// EOC location card for the Board (ADR-015). Reads a fixed record that ships with the app, so it
// shows offline. Maps open outside the app; nothing is framed and the CSP is unchanged.
import { Copy, Download, MapPin, Navigation, Smartphone } from 'lucide-react';
import { Badge, Button, ButtonAnchor, KeyValue, Notice, Section } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { alternateEoc, primaryEoc, type EocSite } from '@/data/eoc-site';
import { fmtDms, fmtLatLng, geoUri, googleDirectionsUrl, googleMapsUrl, osmUrl, plainLatLng } from '@/lib/geo';

export function EocLocation() {
  const site = primaryEoc();
  const alt = alternateEoc();
  const toast = useToast();
  if (!site) return null;

  const copy = async (s: EocSite) => {
    const text = `${s.name}: ${plainLatLng(s.lat, s.lng)}`;
    try { await navigator.clipboard.writeText(text); toast('Coordinates copied'); }
    catch { toast(`Could not copy. The coordinates are ${plainLatLng(s.lat, s.lng)}`, 'info'); }
  };

  return (
    <Section title="EOC location" className="lg:col-span-2">
      <KeyValue items={[
        ['Site', <span className="inline-flex flex-wrap items-center gap-2">{site.name}
          <Badge tone={site.confirmed ? 'ok' : 'warn'}>{site.confirmed ? 'Confirmed' : 'To be confirmed'}</Badge></span>],
        ['Coordinates (WGS 84)', <span className="font-data">{fmtLatLng(site.lat, site.lng)}</span>],
        ['Degrees, minutes, seconds', <span className="font-data">{fmtDms(site.lat, site.lng)}</span>],
        ['Elevation', site.elevationM == null ? null : <span>About {Math.round(site.elevationM)} m above sea level <span className="font-normal text-muted">(map terrain, not surveyed)</span></span>],
        ['Alternate EOC', alt ? <span className="font-data">{alt.name}, {fmtLatLng(alt.lat, alt.lng)}</span>
          : <span className="inline-flex flex-wrap items-center gap-2">Not yet recorded <Badge tone="warn">Checklist item</Badge></span>],
        ['Source', <span className="font-normal">{site.source}</span>],
      ]} />

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonAnchor href={googleMapsUrl(site.lat, site.lng)} icon={MapPin}
          tip="Open the EOC location in Google Maps in a new tab (needs a connection)">Google Maps</ButtonAnchor>
        <ButtonAnchor href={googleDirectionsUrl(site.lat, site.lng)} icon={Navigation}
          tip="Get directions to the EOC in Google Maps in a new tab (needs a connection)">Directions</ButtonAnchor>
        <ButtonAnchor href={geoUri(site.lat, site.lng, site.name)} icon={Smartphone} newTab={false} className="lg:hidden"
          tip="Open the EOC location in this phone's map app. Works offline if the map app has offline maps">Phone map app</ButtonAnchor>
        <ButtonAnchor href={osmUrl(site.lat, site.lng)}
          tip="Open the EOC location in OpenStreetMap in a new tab (needs a connection)">OpenStreetMap</ButtonAnchor>
        <ButtonAnchor href={site.kml} download="Ormoc_City_EOC.kml" icon={Download}
          tip="Download the EOC placemark as a KML file for Google Earth or a GIS. Works offline">KML for Google Earth</ButtonAnchor>
        <Button variant="secondary" icon={Copy} onClick={() => void copy(site)}
          tip="Copy the EOC coordinates to paste into a radio log, SMS or report">Copy coordinates</Button>
      </div>

      {!site.confirmed && (
        <div className="mt-4">
          <Notice tone="info" title="Position not yet confirmed">
            Taken from a map placemark, not a survey. The CDRRMO confirms it before it is cited in the Manual of Operations or shared with OCD VIII.
          </Notice>
        </div>
      )}
    </Section>
  );
}
