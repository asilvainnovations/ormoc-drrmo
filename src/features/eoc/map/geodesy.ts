// Geodesy for the Geo-COP tools (ADR-028): measuring, the coordinate readout and the image-overlay lookup.
// Plain formulas, no library: WGS 84 throughout.

const R = 6371008.8; // mean Earth radius (m), IUGG
const rad = (d: number) => (d * Math.PI) / 180;

export type LngLat = [number, number];

/** Great-circle distance in metres (haversine). */
export function distance(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Length of a path in metres. */
export const pathLength = (pts: LngLat[]) => pts.slice(1).reduce((s, p, i) => s + distance(pts[i]!, p), 0);

/** Area of a simple polygon on the sphere in square metres (no closing point needed). */
export function polygonArea(pts: LngLat[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % pts.length]!;
    s += rad(p2[0] - p1[0]) * (2 + Math.sin(rad(p1[1])) + Math.sin(rad(p2[1])));
  }
  return Math.abs((s * R * R) / 2);
}

export const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
export const fmtArea = (m2: number) => (m2 >= 1e6 ? `${(m2 / 1e6).toFixed(2)} km²` : `${(m2 / 1e4).toFixed(2)} ha`);

/** WGS 84 / UTM zone 51N (EPSG:32651), the grid on the City's planning maps. */
export function toUtm51(lng: number, lat: number): { e: number; n: number } {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const phi = rad(lat);
  const lam = rad(lng - 123);
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ep2 * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * lam;
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi)
    - ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
  const e = k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
  const n = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24
    + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));
  return { e, n };
}

/** Projective transform from the four corners of an image overlay (TL, TR, BR, BL) to pixel space. */
export function cornersToPixel(corners: LngLat[], width: number, height: number): (p: LngLat) => [number, number] {
  const dst: [number, number][] = [[0, 0], [width, 0], [width, height], [0, height]];
  // Solve the 8 homography unknowns (h33 = 1) with Gaussian elimination.
  const A: number[][] = [];
  const b: number[] = [];
  corners.forEach(([x, y], i) => {
    const [u, v] = dst[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  });
  const h = solve(A, b);
  return ([x, y]) => {
    const w = h[6]! * x + h[7]! * y + 1;
    return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w];
  };
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    [M[c], M[p]] = [M[p]!, M[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const row = M[r]!;
      const piv = M[c]!;
      const k = row[c]! / piv[c]!;
      for (let j = c; j <= n; j++) row[j] = row[j]! - k * piv[j]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}
