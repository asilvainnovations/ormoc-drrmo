// What the City has (1.25.0): the inventory as a picture first. Category cards with serviceable ratios, then the NDRRMC minimum
// equipment list checked against what is recorded, then the full list to search and edit. Adding an item is chips and a number.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { insertOnline, updateOnline } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { canOperate } from '@/domain/eoc';
import { categorySummary, DPMS_EQUIPMENT, standardCoverage, type StandardItem } from '@/domain/resourceStandard';
import { Badge, Button, Checkbox, EmptyState, Field, Input, Notice, PageHeader, Tabs } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { Resource, ResourceCategory } from '@/types';
import { Block, Chips, Stepper } from './kit';
import { EOC_TABS, RESOURCE_CATEGORY } from './labels';

const CATS = Object.keys(RESOURCE_CATEGORY) as ResourceCategory[];
const QUICK: { label: string; category: ResourceCategory; unit: string }[] = [
  { label: 'Rescue boat', category: 'vehicle', unit: 'units' }, { label: 'Ambulance', category: 'medical', unit: 'units' }, { label: 'Dump truck', category: 'heavy_equipment', unit: 'units' },
  { label: 'Backhoe', category: 'heavy_equipment', unit: 'units' }, { label: 'Generator set', category: 'power', unit: 'units' }, { label: 'Food packs', category: 'relief', unit: 'packs' },
  { label: 'Tents', category: 'relief', unit: 'units' }, { label: 'Radio (handheld)', category: 'communications', unit: 'units' }, { label: 'Chainsaw', category: 'rescue', unit: 'units' }, { label: 'Life vests', category: 'rescue', unit: 'pcs' },
];
type Draft = { id: string | null; name: string; category: ResourceCategory; unit: string; quantity: number; location: string; ownerOfficeId: string; serviceable: boolean; version: number };
const blank = (): Draft => ({ id: null, name: '', category: 'other', unit: 'units', quantity: 1, location: '', ownerOfficeId: '', serviceable: true, version: 1 });

export function ResourcesPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const canEdit = canOperate(roles);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<'all' | ResourceCategory>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useLiveQuery(async () => ({
    rows: (await db.resources.toArray()).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    places: (await db.barangays.orderBy('name').toArray()).map((b) => b.name),
    offices: (await db.offices.toArray()).sort((a,b) => a.name.localeCompare(b.name)),
  }), []);
  const rows = data?.rows ?? [];
  const summary = useMemo(() => categorySummary(rows), [rows]);
  const coverage = useMemo(() => standardCoverage(rows), [rows]);
  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return rows.filter((r) => category === 'all' || r.category === category).filter((r) => !w || r.name.toLowerCase().includes(w) || (r.location_text ?? '').toLowerCase().includes(w));
  }, [rows, q, category]);
  const gaps = coverage.filter((c) => c.units === 0).length;

  const addFromStandard = (s: StandardItem) => setDraft({ ...blank(), name: s.label.replace(/ \(.*\)$/, ''), category: s.category, unit: s.unit });
  const edit = (r: Resource) => setDraft({ id: r.id, name: r.name, category: r.category, unit: r.unit, quantity: r.quantity, location: r.location_text ?? '', ownerOfficeId: r.owner_office_id ?? '', serviceable: r.is_serviceable, version: r.version });

  const commit = async () => {
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    try {
      if (draft.id) {
        const row = rows.find((x) => x.id === draft.id)!;
        await updateOnline<Resource>('resources', row, { name: draft.name.trim(), category: draft.category, quantity: draft.quantity, unit: draft.unit.trim() || 'unit', location_text: draft.location.trim() || null, owner_office_id: draft.ownerOfficeId || null, is_serviceable: draft.serviceable }, 'Update the resource');
        toast('Resource updated');
      } else {
        const now = new Date().toISOString();
        const row: Resource = { id: uuid(), name: draft.name.trim(), category: draft.category, unit: draft.unit.trim() || 'unit', quantity: draft.quantity, owner_office_id: draft.ownerOfficeId || null,
          location_text: draft.location.trim() || null, is_serviceable: draft.serviceable, version: 1, created_at: now, updated_at: now } as Resource;
        await insertOnline('resources', row, 'Add a resource');
        toast(`Added: ${row.name}`);
      }
      setDraft(null);
    } catch (e) { toast(e instanceof Error ? e.message : 'Not saved.', 'bad'); } finally { setBusy(false); }
  };

  const maxLines = Math.max(1, ...summary.map((s) => s.lines));
  const totalUnits = rows.reduce((n,r) => n + r.quantity, 0);
  const serviceableUnits = rows.filter((r) => r.is_serviceable).reduce((n,r) => n + r.quantity, 0);
  const unassigned = rows.filter((r) => !r.owner_office_id).length;
  return (
    <div className="page">
      <PageHeader title="What the City Has" subtitle="Equipment, vehicles and stocks the EOC can draw on, where they are and whether they work."
        actions={canEdit && <Button tip="Add an item to the inventory (needs a connection)" icon={Plus} onClick={() => setDraft(blank())}>Add item</Button>} />
      <Tabs items={EOC_TABS} />
      {rows.length > 0 && <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-sheet border border-line bg-surface p-3"><p className="text-xs font-bold text-muted">Recorded inventory</p><p className="mt-1 font-data text-2xl font-extrabold">{totalUnits.toLocaleString("en-PH")}</p><p className="text-xs text-muted">{rows.length} item records</p></div>
        <div className="rounded-sheet border border-line bg-surface p-3"><p className="text-xs font-bold text-muted">Serviceable quantity</p><p className="mt-1 font-data text-2xl font-extrabold text-ok">{serviceableUnits.toLocaleString("en-PH")}</p><p className="text-xs text-muted">Recorded as serviceable</p></div>
        <div className="rounded-sheet border border-line bg-surface p-3"><p className="text-xs font-bold text-muted">Not serviceable</p><p className="mt-1 font-data text-2xl font-extrabold text-warn">{(totalUnits-serviceableUnits).toLocaleString("en-PH")}</p><p className="text-xs text-muted">Marked not serviceable</p></div>
        <div className="rounded-sheet border border-line bg-surface p-3"><p className="text-xs font-bold text-muted">No owner assigned</p><p className="mt-1 font-data text-2xl font-extrabold">{unassigned}</p><p className="text-xs text-muted">Records needing custodian assignment</p></div>
      </div>}
      {rows.length === 0 && <Notice tone="info" title="Nothing recorded yet">The inventory is empty. Add what the CDRRMO holds with the Add item form, or ask an administrator to import the property inventory. The checklist below shows what is still missing against the national minimum.</Notice>}

      {rows.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((s) => (
            <button key={s.category} type="button" onClick={() => setCategory(category === s.category ? 'all' : s.category)} aria-pressed={category === s.category}
              className={clsx('rounded-sheet border bg-surface p-4 text-left shadow-raised hover:border-sky', category === s.category ? 'border-ink ring-2 ring-ink' : 'border-line')}>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">{RESOURCE_CATEGORY[s.category]}</p>
              <p className="mt-1 font-display text-3xl font-extrabold">{s.units.toLocaleString('en-PH')}<span className="ml-1 text-sm font-bold text-muted">in {s.lines} line{s.lines === 1 ? '' : 's'}</span></p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"><div className={clsx('h-full rounded-full', s.notServiceable ? 'bg-warn' : 'bg-ok')} style={{ width: `${(100 * s.lines) / maxLines}%` }} /></div>
              <p className={clsx('mt-1 text-xs font-semibold', s.notServiceable ? 'text-warn' : 'text-ok')}>{s.notServiceable ? `${s.notServiceable} not serviceable` : 'All serviceable'}</p>
            </button>
          ))}
        </div>
      )}

      <Block title="National minimum equipment" className="mb-5"
        action={<span className="text-xs text-muted">NDRRMC Disaster Preparedness Minimum Standards, Vol. 2</span>}>
        <p className="mb-3 text-sm text-muted">{gaps === 0 ? 'Every item on the minimum list has at least one record.' : `${gaps} of ${DPMS_EQUIPMENT.length} items on the minimum list have no record yet.`} Matching is by item name.</p>
        <ul className="grid gap-2 md:grid-cols-2">
          {coverage.map((c) => (
            <li key={c.item.key} className={clsx('flex items-center justify-between gap-3 rounded-control border px-3 py-2', c.units ? 'border-ok/40 bg-ok-soft' : 'border-warn bg-warn-soft')}>
              <span className="min-w-0"><span className="block text-sm font-bold">{c.item.label}</span>
                <span className="text-xs text-muted">{c.units ? `${c.units} recorded, ${c.serviceable} serviceable` : 'Not recorded'}</span></span>
              {!c.units && canEdit && <Button tip={`Record ${c.item.label}`} variant="secondary" onClick={() => addFromStandard(c.item)}>Add</Button>}
              {c.units > 0 && <Badge tone={c.serviceable === c.units ? 'ok' : 'warn'}>{c.serviceable === c.units ? 'Ready' : 'Check'}</Badge>}
            </li>
          ))}
        </ul>
      </Block>

      {rows.length === 0 ? <EmptyState title="No resources recorded" body="Use Add item, or pick from the checklist above." /> : (
        <Block title={category === 'all' ? 'All items' : RESOURCE_CATEGORY[category]} action={category !== 'all' ? <button type="button" className="text-sm font-semibold text-info underline" onClick={() => setCategory('all')}>Show all</button> : undefined}>
          <Field label="Find an item or place">{(id) => <Input id={id} type="search" className="mb-3 max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => edit(r)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-sunken">
                  <span className="min-w-0"><span className="block font-bold">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{RESOURCE_CATEGORY[r.category]}{r.location_text ? ` · ${r.location_text}` : ''}{r.owner_office_id ? ` · ${data?.offices.find((o) => o.id === r.owner_office_id)?.name ?? 'Owner office'}` : ' · Owner not assigned'}</span></span>
                  <span className="flex shrink-0 items-center gap-3"><span className="font-data text-lg font-extrabold">{r.quantity} <span className="text-xs font-semibold text-muted">{r.unit}</span></span>
                    <Badge tone={r.is_serviceable ? 'ok' : 'bad'}>{r.is_serviceable ? 'Ready' : 'Not serviceable'}</Badge></span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="py-4 text-sm text-muted">Nothing matches.</li>}
          </ul>
        </Block>
      )}

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? draft.name : 'Add an item'}
        footer={canEdit ? <><Button tip="Close without saving" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button tip="Save (needs a connection)" busy={busy} disabled={!draft?.name.trim()} onClick={commit}>Save</Button></> : undefined}>
        {draft && (
          <div className="space-y-5">
            {!draft.id && (
              <div><p className="mb-2 text-sm font-bold">Pick a common item</p>
                <Chips label="Common items" value={QUICK.some((x) => x.label === draft.name) ? draft.name : null} onChange={(v) => { const x = QUICK.find((i) => i.label === v)!; setDraft({ ...draft, name: x.label, category: x.category, unit: x.unit }); }} options={QUICK.map((x) => ({ value: x.label, label: x.label }))} /></div>
            )}
            <Field label="Name">{(id) => <Input id={id} value={draft.name} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
            <div><p className="mb-2 text-sm font-bold">Kind</p><Chips label="Kind" value={draft.category} disabled={!canEdit} onChange={(v) => setDraft({ ...draft, category: v })} options={CATS.map((c) => ({ value: c, label: RESOURCE_CATEGORY[c] }))} /></div>
            <div><p className="mb-2 text-sm font-bold">How many ({draft.unit})</p><Stepper label="quantity" value={draft.quantity} onChange={(n) => setDraft({ ...draft, quantity: n })} jumps={[1, 5, 10, 50, 100]} />
              <Field label="Unit">{(id) => <Input id={id} className="mt-2 w-40" value={draft.unit} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />}</Field></div>
            <Field label="Responsible office" optional hint="Custodian / asset-owning office; this is not a deployment assignment.">{(id) => (
              <select id={id} className="min-h-tap w-full rounded-control border border-line bg-surface px-3" value={draft.ownerOfficeId} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, ownerOfficeId: e.target.value })}>
                <option value="">Owner not assigned</option>{data?.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>)}</Field>
            <Field label="Where it is kept" optional hint="A barangay, facility or storage site.">{(id) => (
              <>
                <Input id={id} list="resource-places" value={draft.location} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
                <datalist id="resource-places">{data?.places.map((p) => <option key={p} value={p} />)}</datalist>
              </>)}</Field>
            <Checkbox checked={draft.serviceable} onChange={() => canEdit && setDraft({ ...draft, serviceable: !draft.serviceable })} tip="Untick when under repair or failed its test">Serviceable and ready to deploy</Checkbox>
          </div>
        )}
      </Sheet>
    </div>
  );
}
