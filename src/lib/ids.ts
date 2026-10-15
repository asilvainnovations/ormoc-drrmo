// Client-generated ids so records can be created offline and replayed safely.
export const uuid = (): string => crypto.randomUUID();

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const parse = (u: string) => {
  const h = u.replace(/-/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** RFC 4122 UUIDv5 — matches PostgreSQL extensions.uuid_generate_v5(namespace, name). */
export async function uuidv5(name: string, namespace: string): Promise<string> {
  const ns = parse(namespace);
  const nm = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns); buf.set(nm, ns.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', buf)).slice(0, 16);
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const h = hex(digest);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
