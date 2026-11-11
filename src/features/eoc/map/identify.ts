// Identify on a hazard sheet (ADR-028): the sheets are pictures, so the class at a point is read from the pixel
// colour and matched to the sheet's own legend. The answer is "about": it is only as good as the print and the fit.
import { cornersToPixel, type LngLat } from './geodesy';
import type { HazardMap } from './hazardMaps';

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** The legend class nearest to a pixel colour, or null when the pixel is transparent or matches no class. */
export function legendClass(rgba: [number, number, number, number], m: HazardMap): string | null {
  if (rgba[3] < 40) return null;
  // Classified sheets keep only legend colours. Published images are shaded over relief and their sea and
  // background colours sit close to some legend colours (a pale "Under 1 m" against a pale sea), so they need
  // a near-exact match; otherwise the caller says to check the sheet rather than guess.
  const tol = m.mode === 'classified' ? 60 : 28;
  let best: { label: string; d: number } | null = null;
  for (const l of m.legend) {
    const [r, g, b] = hex(l.color);
    const d = Math.hypot(rgba[0] - r, rgba[1] - g, rgba[2] - b);
    if (!best || d < best.d) best = { label: l.label, d };
  }
  return best && best.d <= tol ? best.label : null;
}

/** Pixel position of a map point on a sheet, or null when the point is outside the sheet. */
export function pixelOf(p: LngLat, m: HazardMap): [number, number] | null {
  const [x, y] = cornersToPixel(m.corners, m.size[0], m.size[1])(p);
  if (x < 0 || y < 0 || x >= m.size[0] || y >= m.size[1]) return null;
  return [Math.floor(x), Math.floor(y)];
}

/** Loaded sheet pixels, kept per page load so a click reads a colour without fetching again. */
const cache = new Map<string, Promise<ImageData | null>>();
export function sheetPixels(m: HazardMap): Promise<ImageData | null> {
  let p = cache.get(m.code);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = m.size[0]; c.height = m.size[1];
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(ctx.getImageData(0, 0, c.width, c.height));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = m.file;
    });
    cache.set(m.code, p);
  }
  return p;
}

/** Class of every listed sheet at a point: "Not mapped" outside a sheet, "No class shown" where it is blank. */
export async function identifyAt(p: LngLat, maps: HazardMap[]): Promise<{ map: HazardMap; value: string }[]> {
  return Promise.all(maps.map(async (m) => {
    const px = pixelOf(p, m);
    if (!px) return { map: m, value: 'Not mapped here' };
    const data = await sheetPixels(m);
    if (!data) return { map: m, value: 'Could not read the sheet' };
    const i = (px[1] * data.width + px[0]) * 4;
    const c = legendClass([data.data[i]!, data.data[i + 1]!, data.data[i + 2]!, data.data[i + 3]!], m);
    return { map: m, value: c ?? (m.mode === 'image' ? 'Not readable here: check the sheet' : 'No class shown') };
  }));
}
