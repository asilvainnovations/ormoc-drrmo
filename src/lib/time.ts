// All times are shown in Philippine Standard Time, whatever the device clock zone.
const TZ = 'Asia/Manila';
const dtf = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const df = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric' });
const tf = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

export const fmtDateTime = (iso: string | null | undefined) => (iso ? dtf.format(new Date(iso)) : '—');
export const fmtDate = (iso: string | null | undefined) => (iso ? df.format(new Date(iso)) : '—');
export const fmtTime = (iso: string | null | undefined) => (iso ? tf.format(new Date(iso)) : '—');

export function relative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const a = Math.abs(s);
  const unit = a < 60 ? [s, 'second'] : a < 3600 ? [Math.round(s / 60), 'minute'] : a < 86400 ? [Math.round(s / 3600), 'hour'] : [Math.round(s / 86400), 'day'];
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(unit[0] as number, unit[1] as Intl.RelativeTimeFormatUnit);
}

/** "2 d 4 h" style duration for countdowns. */
export function duration(hours: number): string {
  const h = Math.abs(hours);
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`;
  return `${Math.floor(h / 24)} d ${Math.round(h % 24)} h`;
}

/** Value for <input type="datetime-local"> in Manila time. */
export function toLocalInput(iso: string | Date = new Date()): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).reduce<Record<string, string>>((m, p) => ((m[p.type] = p.value), m), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
/** Parse a datetime-local value entered in Manila time (UTC+8, no DST). */
export const fromLocalInput = (v: string) => new Date(`${v}:00+08:00`).toISOString();

const lf = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
const hf = new Intl.DateTimeFormat('en-PH', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' });
export const fmtLongDate = (d: Date = new Date()) => lf.format(d);
export const manilaHour = (d: Date = new Date()) => Number(hf.format(d));
