// Resource inventory (1.21.0, ADR-039): the read-first screen over the resources table — what the
// EOC has, where it is and whether it is serviceable (IAT B6.3, B2.5, B6.6). The table's columns
// are shown as they are; the Chapter 6 fields stay deferred (ADR-032). Editing quantity, location
// and serviceability is an online action for the operations team, as the table's RLS already allows.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { updateOnline } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { canOperate } from '@/domain/eoc';
import { Badge, Button, Checkbox, EmptyState, Field, Input, List, ListRow, Notice, PageHeader, Select, Tabs } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { Resource, ResourceCategory } from '@/types';
import { EOC_TABS, RESOURCE_CATEGORY } from './labels';

export function ResourcesPage() {
  const { roles } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<'all' | ResourceCategory>('all');
  const [barangay, setBarangay] = useState('');
  const [open, setOpen] = useState<Resource | null>(null);
  const data = useLiveQuery(async () => ({
    rows: (await db.resources.toArray()).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    offices: new Map((await db.offices.toArray()).map((o) => [o.id, o.name])),
    barangays: (await db.barangays.toArray()).map((b) => b.name).sort((a, b) => a.localeCompare(b)),
  }), []);

  const list = useMemo(() => {
    const word = q.trim().toLowerCase();
    return (data?.rows ?? [])
      .filter((r) => category === 'all' || r.category === category)
      .filter((r) => !barangay || (r.location_text ?? '').toLowerCase().includes(barangay.toLowerCase()))
      .filter((r) => !word || r.name.toLowerCase().includes(word) || (r.location_text ?? '').toLowerCase().includes(word));
  }, [data, q, category, barangay]);

  if (!data) return null;
  const unserviceable = list.filter((r) => !r.is_serviceable).length;

  return (
    <div className="page">
      <PageHeader title="Resource inventory" subtitle="Equipment, vehicles and stocks the EOC can draw on (B6.3, B2.5, B6.6). The Chapter 6 fields are still deferred — this shows what the record holds today (ADR-032)." />
      <Tabs items={EOC_TABS} />
      {unserviceable > 0 && <Notice tone="warn" title={`${unserviceable} item${unserviceable === 1 ? '' : 's'} not serviceable`}>Check them against the generator and vehicle test logs before the next activation.</Notice>}
      {data.rows.length === 0 ? (
        <EmptyState title="No resources recorded" body="Resource records arrive with the operational data. The operations team records equipment, vehicles and stocks here." />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Field label="Find a resource">{(id) => <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
            <Field label="Kind">{(id) => <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as 'all' | ResourceCategory)}>
              <option value="all">All kinds</option>
              {(Object.keys(RESOURCE_CATEGORY) as ResourceCategory[]).map((c) => <option key={c} value={c}>{RESOURCE_CATEGORY[c]}</option>)}
            </Select>}</Field>
            <Field label="Barangay or place">{(id) => <Select id={id} value={barangay} onChange={(e) => setBarangay(e.target.value)}>
              <option value="">Everywhere</option>
              {data.barangays.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>}</Field>
          </div>
          <List>
            {list.map((r) => (
              <ListRow key={r.id} tip="Open this resource" onClick={() => setOpen(r)} title={r.name}
                meta={`${RESOURCE_CATEGORY[r.category]} · ${r.quantity} ${r.unit}${r.location_text ? ` · ${r.location_text}` : ''}${r.owner_office_id ? ` · ${data.offices.get(r.owner_office_id) ?? ''}` : ''}`}
                trailing={<Badge tone={r.is_serviceable ? 'ok' : 'bad'}>{r.is_serviceable ? 'Serviceable' : 'Not serviceable'}</Badge>} />
            ))}
            {list.length === 0 && <p className="px-3 py-4 text-sm text-muted">Nothing matches this filter.</p>}
          </List>
        </>
      )}
      <ResourceSheet resource={open} offices={data.offices} canEdit={canOperate(roles)} onClose={() => setOpen(null)}
        onSaved={() => { setOpen(null); toast('Resource updated.'); }} onError={(m) => toast(m, 'bad')} />
    </div>
  );
}

function ResourceSheet({ resource, offices, canEdit, onClose, onSaved, onError }: {
  resource: Resource | null; offices: Map<string, string>; canEdit: boolean;
  onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('unit');
  const [location, setLocation] = useState('');
  const [serviceable, setServiceable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  if (resource && loaded !== resource.id) {
    setLoaded(resource.id);
    setQuantity(resource.quantity); setUnit(resource.unit); setLocation(resource.location_text ?? ''); setServiceable(resource.is_serviceable);
  }
  if (!resource) return null;
  const dirty = quantity !== resource.quantity || unit !== resource.unit || location !== (resource.location_text ?? '') || serviceable !== resource.is_serviceable;

  const save = async () => {
    setBusy(true);
    try {
      await updateOnline<Resource>('resources', resource, {
        quantity: Math.max(0, quantity), unit: unit.trim() || 'unit', location_text: location.trim() || null, is_serviceable: serviceable,
      }, 'Update the resource');
      onSaved();
    } catch (e) { onError(e instanceof Error ? e.message : 'Not saved.'); } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!resource} onClose={onClose} title={resource.name}
      footer={canEdit ? <>
        <Button variant="secondary" onClick={onClose} tip="Close without saving">Cancel</Button>
        <Button variant="primary" busy={busy} disabled={!dirty} onClick={save} tip="Save the quantity, location and serviceability (operations team; needs a connection)">Save</Button>
      </> : undefined}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="info">{RESOURCE_CATEGORY[resource.category]}</Badge>
        <Badge tone={resource.is_serviceable ? 'ok' : 'bad'}>{resource.is_serviceable ? 'Serviceable' : 'Not serviceable'}</Badge>
      </div>
      {resource.owner_office_id && <p className="mb-3 text-sm"><span className="text-muted">Owner: </span>{offices.get(resource.owner_office_id) ?? '—'}</p>}
      {canEdit ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">{(id) => <Input id={id} type="number" min={0} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))} />}</Field>
            <Field label="Unit">{(id) => <Input id={id} value={unit} onChange={(e) => setUnit(e.target.value)} />}</Field>
          </div>
          <Field label="Location" optional hint="Where it is kept — a place, barangay or facility name.">{(id) => <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field>
          <Checkbox checked={serviceable} onChange={() => setServiceable(!serviceable)} tip="Untick when the item is under repair or failed its test">Serviceable and ready to deploy</Checkbox>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p><span className="text-muted">Quantity: </span>{resource.quantity} {resource.unit}</p>
          <p><span className="text-muted">Location: </span>{resource.location_text ?? '—'}</p>
          <p className="text-muted">The operations team keeps this record.</p>
        </div>
      )}
    </Sheet>
  );
}
