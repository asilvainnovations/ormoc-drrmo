import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, ExternalLink, FileText, FolderLock, Pencil, Plus, Search, X } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { save, evidenceFileUrl } from '@/lib/store';
import { fmtDate } from '@/lib/time';
import { Badge, Button, EmptyState, Input, KeyValue, List, ListRow, Loading, Meter, Notice, PageHeader, Section, Select, Tabs, TextLink } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { RefText } from '@/components/RefText';
import { INSTRUMENTS, parseCitations } from '@/data/references';
import type { Indicator, VaultCategory } from '@/types';
import { CATEGORY, KIND_LABEL, STATUS, VAULT_TABS } from './labels';
import { canUseVault } from './access';
import { DocumentForm, type Prefill } from './DocumentForm';

/** The vault is for assessors, validators, administrators and CDRRMO staff (RLS enforces it too). */
export function VaultGate({ children }: { children: ReactNode }) {
  const { has } = useAuth();
  if (canUseVault(has)) return <>{children}</>;
  return (
    <div className="page">
      <PageHeader title="Document Vault" />
      <Notice tone="info" title="Not available for your role">The Document Vault is open to assessors, validators, administrators and CDRRMO staff. Ask the system administrator if you need access.</Notice>
    </div>
  );
}

const isDR = (i: Indicator) => /\bDR\b/.test(i.methods ?? '');

// ------------------------------------------------------------------ documents
export function VaultPage() {
  const [params, setParams] = useSearchParams();
  const ref = params.get('ref');
  const ind = params.get('ind');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'' | VaultCategory>('');
  const [showOld, setShowOld] = useState(false);
  const [adding, setAdding] = useState<Prefill | null>(params.get('add') ? { indicatorIds: ind ? [ind] : [], refKey: ref ?? undefined } : null);
  const nav = useNavigate();
  const docs = useLiveQuery(() => db.vault_documents.toArray(), [], undefined);
  if (!docs) return <Loading />;

  const term = q.trim().toLowerCase();
  const shown = docs
    .filter((d) => showOld || d.status !== 'superseded')
    .filter((d) => !cat || d.category === cat)
    .filter((d) => !ref || d.ref_key === ref)
    .filter((d) => !ind || d.indicator_ids.includes(ind))
    .filter((d) => !term || [d.title, d.doc_number, d.issuer, d.summary, d.ref_key, d.indicator_ids.join(' ')].some((x) => x?.toLowerCase().includes(term)))
    .sort((a, b) => (b.doc_date ?? '').localeCompare(a.doc_date ?? '') || a.title.localeCompare(b.title));
  const clear = (k: string) => { params.delete(k); setParams(params, { replace: true }); };

  return (
    <div className="page">
      <PageHeader title="Document Vault" subtitle="Laws, guidelines, City issuances, plans and records, in one place for Document Review and the manuals."
        actions={<Button icon={Plus} onClick={() => setAdding({ indicatorIds: ind ? [ind] : [], refKey: ref ?? undefined })} tip="Add a document: upload a file, link the official copy, or record where the paper original is kept">Add document</Button>} />
      <Tabs items={VAULT_TABS} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="relative block">
          <span className="sr-only">Search the vault</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, number, issuer or indicator" className="pl-9"
            {...tip('Search by title, number, issuing office, description or indicator ID')} />
        </label>
        <Select value={cat} onChange={(e) => setCat(e.target.value as '' | VaultCategory)} aria-label="Type of document" {...tip('Show only one type of document')}>
          <option value="">All types</option>
          {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {(ref || ind) && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          Showing documents for
          {ref && <FilterChip label={ref} onClear={() => clear('ref')} />}
          {ind && <FilterChip label={`indicator ${ind}`} onClear={() => clear('ind')} />}
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState title={docs.length ? 'No documents match' : 'The vault is empty'}
          body={docs.length ? 'Try another search or clear the filters.' : 'Add the documents the assessment team reviews: ordinances, executive orders, plans, budgets, minutes and reports. Each can be linked to the indicators it evidences.'}
          action={<Button icon={Plus} onClick={() => setAdding({ indicatorIds: ind ? [ind] : [], refKey: ref ?? undefined })} tip="Add the first document">Add document</Button>} />
      ) : (
        <List>
          {shown.map((d) => (
            <ListRow key={d.id} to={`/vault/d/${d.id}`} tip="Open the document: details, file or link, and the indicators it supports"
              leading={<FileText className="h-5 w-5 text-sky" aria-hidden />}
              title={d.title}
              meta={[CATEGORY[d.category], d.doc_number, d.doc_date && fmtDate(d.doc_date), d.indicator_ids.length ? `${d.indicator_ids.length} indicator${d.indicator_ids.length > 1 ? 's' : ''}` : null].filter(Boolean).join(', ')}
              trailing={d.status !== 'current' ? <Badge tone={d.status === 'superseded' ? 'neutral' : 'warn'}>{STATUS[d.status]}</Badge> : d.storage_path ? <Badge tone="info">File</Badge> : d.url ? <Badge>Link</Badge> : undefined} />
          ))}
        </List>
      )}
      {docs.some((d) => d.status === 'superseded') && (
        <Button variant="quiet" className="mt-3" onClick={() => setShowOld((s) => !s)} tip="Superseded documents are kept for the record">{showOld ? 'Hide superseded documents' : 'Show superseded documents'}</Button>
      )}
      <DocumentForm open={!!adding} onClose={() => setAdding(null)} prefill={adding ?? undefined} onSaved={(id) => nav(`/vault/d/${id}`)} />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-soft py-0.5 pl-3 pr-1 font-data font-semibold">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear filter ${label}`} {...tip('Clear this filter')} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface"><X className="h-4 w-4" aria-hidden /></button>
    </span>
  );
}

// ------------------------------------------------------------------ one document
export function VaultDocumentPage() {
  const { id } = useParams();
  const { userId, has } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const data = useLiveQuery(async () => {
    const d = id ? await db.vault_documents.get(id) : undefined;
    if (!d) return { d: null };
    const inds = await db.iat_indicators.where('id').anyOf(d.indicator_ids).toArray();
    const cycle = (await db.assessment_cycles.orderBy('cycle_year').reverse().toArray()).find((c) => c.status !== 'archived');
    const who = d.uploaded_by ? await db.profiles.get(d.uploaded_by) : undefined;
    return { d, inds, cycle, who };
  }, [id]);
  if (!data) return <Loading />;
  const { d } = data;
  if (!d) return <div className="page"><PageHeader title="Document not found" back="/vault" subtitle="It may not have synced to this device yet." /></div>;
  const canEdit = d.uploaded_by === userId || has('cdrrmo_head') || !d.uploaded_by;
  const open = async () => {
    const tab = window.open('', '_blank');
    try { const url = await evidenceFileUrl(d.id, d.storage_path!, 'vault'); if (tab) tab.location.href = url; else window.location.assign(url); }
    catch (e) { tab?.close(); toast((e as Error).message, 'bad'); }
  };
  const supersede = () => save('vault_documents', { ...d, status: d.status === 'superseded' ? 'current' : 'superseded' }, `Vault: ${d.title.slice(0, 40)}`)
    .then(() => toast(d.status === 'superseded' ? 'Marked current' : 'Marked superseded'));

  return (
    <div className="page">
      <PageHeader title={d.title} back="/vault"
        subtitle={<>{CATEGORY[d.category]}{d.status !== 'current' && <Badge className="ml-2" tone={d.status === 'draft' ? 'warn' : 'neutral'}>{STATUS[d.status]}</Badge>}</>}
        actions={<>
          {d.storage_path && <Button icon={Download} onClick={open} tip="Open the attached file in a new tab (a private link valid for five minutes)">Open file</Button>}
          {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" {...tip('Open the official online copy in a new tab')}
            className="inline-flex min-h-tap items-center gap-2 rounded-control border border-line bg-surface px-4 font-semibold hover:border-sky hover:bg-sky-soft"><ExternalLink className="h-5 w-5" aria-hidden />Open link</a>}
          {canEdit && <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)} tip="Change the details or the linked indicators">Edit</Button>}
        </>} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <div>
          {d.summary && <p className="mb-6 max-w-prose text-lg leading-7">{d.summary}</p>}
          <KeyValue items={[
            ['Number', d.doc_number], ['Issued by', d.issuer], ['Date', d.doc_date ? fmtDate(d.doc_date) : null],
            ['Law or guideline', d.ref_key ? <RefText key="r" text={d.ref_key} /> : null], ['Original kept at', d.location],
            ['File', d.file_name ? `${d.file_name}${d.size_bytes ? ` (${Math.max(1, Math.round(d.size_bytes / 1024))} KB)` : ''}` : null],
            ['Added by', data.who?.full_name ?? null],
          ].filter(([, v]) => v !== null && v !== undefined && v !== '') as [string, ReactNode][]} />
          {!d.storage_path && !d.url && !d.location && <Notice tone="warn" title="No copy yet">Attach the file, add a link to the official copy, or say where the paper original is kept, so reviewers can find it.</Notice>}
          {canEdit && (
            <Button variant="quiet" className="mt-6" onClick={supersede}
              tip={d.status === 'superseded' ? 'Mark this document as the current version again' : 'Mark as replaced by a newer document. It stays in the vault for the record'}>
              {d.status === 'superseded' ? 'Mark as current' : 'Mark as superseded'}</Button>
          )}
        </div>
        <aside>
          <Section title="Evidence for">
            {data.inds!.length === 0 ? <p className="text-muted">Not linked to any indicator yet. Edit the document to link it.</p> : (
              <List>{data.inds!.map((i) => (
                <ListRow key={i.id} to={data.cycle ? `/assess/${data.cycle.id}/i/${encodeURIComponent(i.id)}` : `/vault?ind=${encodeURIComponent(i.id)}`}
                  tip={data.cycle ? 'Open this indicator in the current assessment' : 'Show all vault documents for this indicator'}
                  title={i.id} meta={i.statement.length > 110 ? `${i.statement.slice(0, 110)}…` : i.statement} />
              ))}</List>
            )}
          </Section>
        </aside>
      </div>
      <DocumentForm open={editing} onClose={() => setEditing(false)} editing={d} />
    </div>
  );
}

// ------------------------------------------------------------------ Document Review checklist
export function VaultReviewPage() {
  const [filter, setFilter] = useState<'all' | 'missing'>('all');
  const data = useLiveQuery(async () => {
    const [inds, domains, docs] = await Promise.all([db.iat_indicators.orderBy('sort').toArray(), db.iat_domains.orderBy('sort').toArray(), db.vault_documents.toArray()]);
    const count = new Map<string, number>();
    for (const d of docs) if (d.status !== 'superseded') for (const x of d.indicator_ids) count.set(x, (count.get(x) ?? 0) + 1);
    return { inds: inds.filter(isDR), domains, count };
  }, []);
  if (!data) return <Loading />;
  const covered = data.inds.filter((i) => data.count.get(i.id)).length;
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Indicator', 'Domain', 'Type', 'Documents to request (means of verification)', 'Standard or reference', 'In the vault'],
      ...data.inds.map((i) => [i.id, i.domain, i.type === 'M' ? 'Mandatory' : 'Good practice', i.means_of_verification, i.reference, data.count.get(i.id) ?? 0])];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'document-review-request-list.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="page">
      <PageHeader title="Document Vault" subtitle="Document Review (DR): what to request for each indicator, and what is already in the vault."
        actions={<Button variant="secondary" icon={Download} onClick={exportCsv} tip="Download the request list as a spreadsheet, for the document request letter to offices">Download request list</Button>} />
      <Tabs items={VAULT_TABS} />
      <div className="mb-6 rounded-control border border-line bg-surface p-4">
        <p className="font-display text-lg font-bold">{covered} of {data.inds.length} Document Review indicators have at least one document</p>
        <div className="mt-2"><Meter value={covered} max={data.inds.length || 1} label="Document Review indicators with a document in the vault" /></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')} tip="Show every indicator assessed by Document Review">All</Button>
          <Button variant={filter === 'missing' ? 'primary' : 'secondary'} onClick={() => setFilter('missing')} tip="Show only indicators with no document in the vault yet">Still to collect ({data.inds.length - covered})</Button>
        </div>
      </div>
      {data.domains.map((dom) => {
        const rows = data.inds.filter((i) => i.domain === dom.code && (filter === 'all' || !data.count.get(i.id)));
        if (!rows.length) return null;
        return (
          <Section key={dom.code} title={`${dom.code} ${dom.name}`}>
            <List>{rows.map((i) => {
              const n = data.count.get(i.id) ?? 0;
              return (
                <ListRow key={i.id} to={n ? `/vault?ind=${encodeURIComponent(i.id)}` : `/vault?add=1&ind=${encodeURIComponent(i.id)}`}
                  tip={n ? 'See the documents in the vault for this indicator' : 'Add a document for this indicator'}
                  title={<><span className="mr-2 font-data text-muted">{i.id}</span>{i.means_of_verification}</>}
                  meta={i.statement.length > 120 ? `${i.statement.slice(0, 120)}…` : i.statement}
                  trailing={n ? <Badge tone="ok">{n} in vault</Badge> : <Badge tone="warn">None yet</Badge>} />
              );
            })}</List>
          </Section>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ reference catalogue
export function VaultReferencesPage() {
  const [q, setQ] = useState('');
  const data = useLiveQuery(async () => {
    const [inds, docs] = await Promise.all([db.iat_indicators.toArray(), db.vault_documents.toArray()]);
    const cited = new Map<string, Set<string>>();
    for (const i of inds) for (const c of parseCitations(i.reference)) if (c.key) (cited.get(c.key) ?? cited.set(c.key, new Set()).get(c.key)!).add(i.id);
    const held = new Map<string, number>();
    for (const d of docs) if (d.ref_key && d.status !== 'superseded') held.set(d.ref_key, (held.get(d.ref_key) ?? 0) + 1);
    return { cited, held };
  }, []);
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = INSTRUMENTS.filter((x) => !term || `${x.key} ${x.title} ${x.summary}`.toLowerCase().includes(term));
    return (Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => [k, list.filter((x) => x.kind === k)] as const).filter(([, xs]) => xs.length);
  }, [q]);
  if (!data) return <Loading />;
  return (
    <div className="page">
      <PageHeader title="Document Vault" subtitle="The laws, rules and guidelines cited by the assessment and the manuals. Plain-language notes for orientation; the official text governs." />
      <Tabs items={VAULT_TABS} />
      <label className="relative mb-6 block max-w-xl">
        <span className="sr-only">Search references</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, for example 10121, LDRRMF or privacy" className="pl-9" {...tip('Search by number, title or topic')} />
      </label>
      {groups.map(([kind, xs]) => (
        <Section key={kind} title={KIND_LABEL[kind]}>
          <ul className="divide-y divide-line">
            {xs.map((x) => {
              const n = data.cited.get(x.key)?.size ?? 0, h = data.held.get(x.key) ?? 0;
              return (
                <li key={x.key} className="py-4">
                  <p className="font-display font-bold">{x.title}</p>
                  <p className="mt-1 max-w-prose text-sm leading-6">{x.summary}</p>
                  {x.sections && (
                    <details className="mt-2 max-w-prose text-sm">
                      <summary {...tip('Show the sections the assessment cites')} className="min-h-tap cursor-pointer py-2 font-semibold underline decoration-dotted underline-offset-4">Sections cited</summary>
                      <ul className="space-y-1 pl-1">{Object.entries(x.sections).map(([s, t]) => <li key={s}><span className="font-data font-semibold">Sec. {s}.</span> {t}</li>)}</ul>
                    </details>
                  )}
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-data text-sm text-muted">
                    {n > 0 && <span>Cited by {n} indicator{n > 1 ? 's' : ''}</span>}
                    {x.kind !== 'agency' && x.kind !== 'practice' && (h > 0
                      ? <TextLink size="sm" to={`/vault?ref=${encodeURIComponent(x.key)}`} tip="Show the documents in the vault for this reference">{h} in the vault</TextLink>
                      : <TextLink size="sm" to={`/vault?add=1&ref=${encodeURIComponent(x.key)}`} tip="Add a copy of this document to the vault">Add a copy to the vault</TextLink>)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Section>
      ))}
    </div>
  );
}

/** For IndicatorPage: documents in the vault for one indicator. */
export function VaultForIndicator({ indicatorId }: { indicatorId: string }) {
  const { has } = useAuth();
  const docs = useLiveQuery(() => db.vault_documents.where('indicator_ids').equals(indicatorId).filter((d) => d.status !== 'superseded').toArray(), [indicatorId], []);
  if (!canUseVault(has)) return null;
  return (
    <Section title="In the Document Vault" className="mt-8"
      action={<Link to={`/vault?add=1&ind=${encodeURIComponent(indicatorId)}`} {...tip('Add a document to the vault and link it to this indicator')}
        className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold underline underline-offset-2"><FolderLock className="h-4 w-4" aria-hidden />Add to vault</Link>}>
      {docs.length === 0 ? <p className="text-muted">No vault documents are linked to this indicator yet.</p> : (
        <List>{docs.map((d) => <ListRow key={d.id} to={`/vault/d/${d.id}`} tip="Open this vault document" title={d.title}
          meta={[CATEGORY[d.category], d.doc_number, d.doc_date && fmtDate(d.doc_date)].filter(Boolean).join(', ')} />)}</List>
      )}
    </Section>
  );
}


