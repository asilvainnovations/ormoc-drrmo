// Add or edit a vault document. Works offline: the record is saved on the device and the
// file is queued; both reach the server in order (record first, then the file).
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { save, queueUpload, uploadProblem, fileType } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { INSTRUMENTS } from '@/data/references';
import type { VaultCategory, VaultDocument } from '@/types';
import { CATEGORY, CATEGORY_TIP } from './labels';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.pptx,.txt';

export interface Prefill { indicatorIds?: string[]; refKey?: string }

export function DocumentForm({ open, onClose, editing, prefill, onSaved }: {
  open: boolean; onClose: () => void; editing?: VaultDocument | null; prefill?: Prefill; onSaved?: (id: string) => void;
}) {
  const toast = useToast();
  const known = useLiveQuery(async () => new Set((await db.iat_indicators.toArray()).map((i) => i.id)), [], new Set<string>());
  const [f, setF] = useState({ title: '', category: 'record' as VaultCategory, ref_key: '', doc_number: '', issuer: '', doc_date: '', summary: '', indicators: '', url: '', location: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setF(editing ? {
      title: editing.title, category: editing.category, ref_key: editing.ref_key ?? '', doc_number: editing.doc_number ?? '', issuer: editing.issuer ?? '',
      doc_date: editing.doc_date ?? '', summary: editing.summary ?? '', indicators: editing.indicator_ids.join(', '), url: editing.url ?? '', location: editing.location ?? '',
    } : { title: '', category: prefill?.refKey ? categoryFor(prefill.refKey) : 'record', ref_key: prefill?.refKey ?? '', doc_number: '', issuer: '', doc_date: '', summary: '',
      indicators: (prefill?.indicatorIds ?? []).join(', '), url: '', location: '' });
  }, [open, editing, prefill]);

  const ids = f.indicators.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  const unknown = ids.filter((x) => !known.has(x));
  const urlBad = f.url.trim() !== '' && !/^https:\/\//i.test(f.url.trim());
  const fileBad = file && !editing?.storage_path ? uploadProblem(file, 'vault') : null;
  const problem = !f.title.trim() ? 'Give the document a title.' : unknown.length ? `Unknown indicator: ${unknown.join(', ')}` : urlBad ? 'Links must start with https://' : fileBad;

  const submit = async () => {
    if (problem) return;
    setBusy(true);
    try {
      const id = editing?.id ?? uuid();
      const path = file && !editing?.storage_path ? `${id}/${file.name.replace(/[^\w.-]+/g, '_')}` : editing?.storage_path ?? null;
      const row: VaultDocument & { _new?: true } = {
        ...(editing ?? { _new: true as const, id, status: 'current' as const, superseded_by: null, uploaded_by: null, version: 1 }),
        title: f.title.trim(), category: f.category, ref_key: f.ref_key || null, doc_number: f.doc_number.trim() || null, issuer: f.issuer.trim() || null,
        doc_date: f.doc_date || null, summary: f.summary.trim() || null, indicator_ids: Array.from(new Set(ids)).sort(), url: f.url.trim() || null,
        location: f.location.trim() || null, storage_path: path,
        file_name: file && !editing?.storage_path ? file.name : editing?.file_name ?? null,
        mime_type: file && !editing?.storage_path ? fileType(file) || null : editing?.mime_type ?? null,
        size_bytes: file && !editing?.storage_path ? file.size : editing?.size_bytes ?? null,
      };
      // Record first: the server only accepts a file into the folder of an existing record.
      await save('vault_documents', row, `Vault: ${row.title.slice(0, 40)}`);
      if (file && path && !editing?.storage_path) await queueUpload(file, path, id, 'vault');
      toast(editing ? 'Document updated' : 'Document added to the vault');
      onSaved?.(id); onClose();
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit document' : 'Add a document'}
      footer={<>
        <Button variant="secondary" onClick={onClose} tip="Close without saving">Cancel</Button>
        <Button busy={busy} disabled={!!problem} onClick={submit} tip={problem ?? 'Save to the vault. Works offline; the file uploads when you reconnect'}>{editing ? 'Save changes' : 'Add to vault'}</Button>
      </>}>
      <Field label="Title" hint="As it appears on the document, for example: Executive Order No. 12, s. 2026, creating the City EOC.">
        {(id, d) => <Input id={id} aria-describedby={d} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} {...tip('The document’s title as written on it')} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" hint={CATEGORY_TIP[f.category]}>
          {(id, d) => <Select id={id} aria-describedby={d} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as VaultCategory })} {...tip('What kind of document this is')}>
            {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}
        </Field>
        <Field label="Law or guideline it is or implements" optional>
          {(id) => <Select id={id} value={f.ref_key} onChange={(e) => setF({ ...f, ref_key: e.target.value })} {...tip('Link the document to a law, rule or guideline so it appears under that reference')}>
            <option value="">None</option>
            {INSTRUMENTS.filter((x) => x.kind !== 'agency' && x.kind !== 'practice').map((x) => <option key={x.key} value={x.key}>{x.key}</option>)}</Select>}
        </Field>
        <Field label="Number" optional>{(id) => <Input id={id} value={f.doc_number} onChange={(e) => setF({ ...f, doc_number: e.target.value })} placeholder="EO No. 12, s. 2026" {...tip('Ordinance, EO, resolution or circular number')} />}</Field>
        <Field label="Issued by" optional>{(id) => <Input id={id} value={f.issuer} onChange={(e) => setF({ ...f, issuer: e.target.value })} placeholder="Office of the City Mayor" {...tip('The office or agency that issued it')} />}</Field>
        <Field label="Date" optional>{(id) => <Input id={id} type="date" value={f.doc_date} onChange={(e) => setF({ ...f, doc_date: e.target.value })} {...tip('Date issued, approved or signed')} />}</Field>
        <Field label="Indicators it can evidence" optional hint="IDs separated by commas, for example A4.1, A4.6." error={unknown.length ? `Unknown: ${unknown.join(', ')}` : null}>
          {(id, d) => <Input id={id} aria-describedby={d} value={f.indicators} onChange={(e) => setF({ ...f, indicators: e.target.value })} {...tip('Assessment indicators this document supports. It then shows on those indicators and in Document Review')} />}
        </Field>
      </div>
      <Field label="Short description" optional hint="What it contains and why it matters. No names of affected persons.">
        {(id, d) => <Textarea id={id} aria-describedby={d} rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} {...tip('A line or two so others know what is inside without opening it')} />}
      </Field>
      {!editing?.storage_path ? (
        <Field label="File" optional hint="PDF, image, Word, Excel or PowerPoint, up to 25 MB." error={fileBad}>
          {(id, d) => <input id={id} aria-describedby={d} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            {...tip('Attach a scan or the file itself. It is stored privately and opened through short-lived links')}
            className="block w-full text-sm file:mr-3 file:min-h-tap file:rounded-control file:border-0 file:bg-sky-soft file:px-4 file:font-semibold file:text-ink" />}
        </Field>
      ) : <p className="text-sm text-muted">Attached file: {editing.file_name}. To replace it, add the new file as a new document and mark this one superseded.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Link" optional error={urlBad ? 'Links must start with https://' : null}>
          {(id, d) => <Input id={id} aria-describedby={d} type="url" inputMode="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" {...tip('A link to the official online copy, for example on the Official Gazette or an agency site')} />}
        </Field>
        <Field label="Where the original is kept" optional>
          {(id) => <Input id={id} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="CDRRMO records room, shelf 2" {...tip('For paper originals: the office, room or folder')} />}
        </Field>
      </div>
    </Sheet>
  );
}

function categoryFor(key: string): VaultCategory {
  const k = INSTRUMENTS.find((x) => x.key === key)?.kind;
  return k === 'law' ? 'law' : k === 'irr' ? 'irr' : k === 'framework' ? 'framework' : k === 'issuance' ? 'issuance' : 'other';
}
