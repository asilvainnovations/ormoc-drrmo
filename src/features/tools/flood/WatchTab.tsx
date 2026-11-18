// Watch list: barangays at or above a flood class the person picks, ordered by the basis they pick.
// Rainfall figures are typed in from the PAGASA bulletin and travel with the list as context; they never rank or trigger.
import { useMemo, useState } from 'react';
import { ClipboardCopy } from 'lucide-react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { Chips } from '@/features/eoc/kit';
import { CLASS_STYLE } from '@/features/eoc/map/themes';
import { useToast } from '@/components/Toast';
import { WATCH_BASIS, watchList, watchText, type FloodClass, type FloodRow, type WatchBasis } from '@/domain/floodScreen';

const MIN: { value: FloodClass; label: string }[] = [{ value: 'Very high', label: 'Very high' }, { value: 'High', label: 'High and above' }, { value: 'Moderate', label: 'Moderate and above' }];
const num = (v: number | null) => (v == null ? '—' : v.toLocaleString('en-PH'));

export function WatchTab({ rows, onPick }: { rows: FloodRow[]; onPick: (psgc: string) => void }) {
  const toast = useToast();
  const [min, setMin] = useState<FloodClass>('High');
  const [basis, setBasis] = useState<WatchBasis>('exposed');
  const [note, setNote] = useState({ rain24: '', rain72: '', product: '', at: '' });
  const list = useMemo(() => watchList(rows, min, basis), [rows, min, basis]);
  const set = (k: keyof typeof note) => (e: React.ChangeEvent<HTMLInputElement>) => setNote((n) => ({ ...n, [k]: e.target.value }));
  async function copy() {
    try { await navigator.clipboard.writeText(watchText(list, note)); toast('Watch list copied'); } catch { toast('Copy was blocked. Select the table and copy it.'); }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-control border border-line bg-surface p-4">
          <p className="text-sm font-bold">Show barangays that are</p>
          <Chips value={min} onChange={setMin} options={MIN} label="Lowest flood class to show" />
          <p className="text-sm font-bold">Order by</p>
          <Chips value={basis} onChange={setBasis} options={WATCH_BASIS.map((b) => ({ value: b.value, label: b.label }))} label="Order by" />
        </div>
        <div className="space-y-2 rounded-control border border-line bg-surface p-4">
          <p className="text-sm font-bold">PAGASA reading to print with the list <span className="font-normal text-muted">(optional)</span></p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="24-hour rainfall, mm" optional>{(id) => <Input id={id} inputMode="decimal" value={note.rain24} onChange={set('rain24')} />}</Field>
            <Field label="72-hour rainfall, mm" optional>{(id) => <Input id={id} inputMode="decimal" value={note.rain72} onChange={set('rain72')} />}</Field>
            <Field label="Bulletin or product" optional>{(id) => <Input id={id} value={note.product} onChange={set('product')} placeholder="e.g. PAGASA regional forecast" />}</Field>
            <Field label="As of" optional>{(id) => <Input id={id} value={note.at} onChange={set('at')} placeholder="e.g. 18 Nov, 2 PM" />}</Field>
          </div>
        </div>
      </div>
      <Notice tone="info" title="How to read this">The ranking uses the DDRiVE flood class and exposure only. It does not change with rainfall, and it is not a warning or an evacuation trigger. Decide from PAGASA bulletins and the approved EOC procedures.</Notice>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{list.length} barangay{list.length === 1 ? '' : 's'}</p>
        <Button variant="secondary" icon={ClipboardCopy} tip="Copy the list as plain text for a message or the logbook" onClick={() => void copy()} disabled={!list.length}>Copy list</Button>
      </div>
      <div className="overflow-x-auto rounded-control border border-line">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-sunken text-left"><tr><th className="p-3">#</th><th className="p-3">Barangay</th><th className="p-3">Class</th><th className="p-3 text-right">People exposed</th><th className="p-3 text-right">Share</th><th className="p-3 text-right">Priority</th></tr></thead>
          <tbody>{list.map((r, i) => (
            <tr key={r.psgc} className="border-t border-line hover:bg-sky-soft">
              <td className="p-3 tabular-nums text-muted">{i + 1}</td>
              <td className="p-3 font-semibold"><button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onPick(r.psgc)}>{r.name}</button></td>
              <td className="p-3"><span className="rounded-full px-2.5 py-0.5 text-xs font-extrabold text-black" style={{ background: CLASS_STYLE[r.cls]?.color }}>{r.cls}</span></td>
              <td className="p-3 text-right tabular-nums">{num(r.exposedPop)}</td>
              <td className="p-3 text-right tabular-nums">{r.exposurePct == null ? '—' : `${r.exposurePct.toFixed(1)}%`}</td>
              <td className="p-3 text-right tabular-nums">{r.priority ?? '—'}</td>
            </tr>))}
            {!list.length && <tr><td colSpan={6} className="p-6 text-center text-muted">No barangay at this class yet. DDRiVE flood classes may still be loading.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
