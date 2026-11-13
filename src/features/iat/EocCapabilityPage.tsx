// Assess → EOC capability checklist (1.20.0, ADR-035): the OCD/NDRRMC TWG EOC Capability Assessment Checklist
// (Dec 2017), 154 items for the primary and the alternate EOC, each mapped to IAT Part B, rolled up to B1–B7.
// Answers pre-filled from the IAT v1-7 crosswalk are labelled as such and never read as evidence: saving an answer
// (a change or a plain confirmation on site) makes it "observed" on the server, and only the CDRRMO Head validates
// an observed answer, online. Captured offline like the IAT; nothing here changes an IAT score.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/db';
import { save, updateOnline } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/time';
import { Badge, Button, ChoiceGroup, Field, List, ListRow, Loading, Notice, PageHeader, Section, Select, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { CAP_DOMAIN_LABEL, CAP_SITE_LABEL, CAP_STATUSES, CAP_STATUS_LABEL, CAP_STATUS_TONE, itemDomains, rollUp, siteTotals } from '@/domain/eocCapability';
import type { EocCapItem, EocCapResponse, EocCapSite, EocCapStatus } from '@/types';
import { isEditable } from './data';

type Filter = 'all' | 'prefilled' | 'observed' | EocCapStatus;

export function EocCapabilityPage() {
  const { cycleId } = useParams();
  const { has } = useAuth();
  const [site, setSite] = useState<EocCapSite>('primary');
  const [filter, setFilter] = useState<Filter>('all');
  const [domain, setDomain] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    if (!cycleId) return null;
    const cycle = await db.assessment_cycles.get(cycleId);
    const items = (await db.eoc_cap_items.toArray()).sort((a, b) => a.sort - b.sort);
    const responses = await db.eoc_cap_responses.where('cycle_id').equals(cycleId).toArray();
    return { cycle, items, responses };
  }, [cycleId]);

  const bySite = useMemo(() => new Map((data?.responses ?? []).filter((r) => r.site === site).map((r) => [r.item_id, r])), [data, site]);
  if (!data) return <Loading />;
  if (!data.cycle) return <Notice tone="warn" title="Assessment cycle not found">Open the cycle again from Assess.</Notice>;
  const { cycle, items, responses } = data;

  const rows = rollUp(items, responses, site);
  const totals = siteTotals(items, responses, site);
  const shown = items.filter((it) => {
    const r = bySite.get(it.id);
    const status = r?.status ?? 'not_assessed';
    if (domain !== 'all' && !itemDomains(it).includes(domain)) return false;
    if (filter === 'all') return true;
    if (filter === 'prefilled') return r?.provenance === 'prefilled_iat' && status !== 'not_assessed';
    if (filter === 'observed') return r?.provenance === 'observed' && status !== 'not_assessed';
    return status === filter;
  });
  const sections = Array.from(new Set(shown.map((i) => `${i.section_group}|${i.section}`)));
  const open = items.find((i) => i.id === openId) ?? null;

  return (
    <>
      <PageHeader back={`/assess/${cycle.id}`} title="EOC capability checklist"
        subtitle={`${cycle.name} · OCD/NDRRMC TWG EOC Capability Assessment Checklist (Dec 2017), mapped to IAT Part B`} />

      <Notice tone="info" title="Pre-filled answers are not observations">
        {totals.prefilled > 0
          ? <>{totals.prefilled} of {totals.items} answers for the {CAP_SITE_LABEL[site].toLowerCase()} are pre-filled from the IAT v1-7 scores (the lowest score of the mapped indicators). Confirm or change each one on site: saving makes it observed, and only observed answers can be validated. </>
          : <>Answers here are recorded by the assessment team; the CDRRMO Head validates them. </>}
        The checklist is a readiness tool: it does not change any IAT score.
      </Notice>

      <div className="mb-4 max-w-xl">
        <ChoiceGroup legend="Site" value={site} onChange={setSite} columns={2}
          options={(['primary', 'alternate'] as EocCapSite[]).map((s) => ({ value: s, label: CAP_SITE_LABEL[s],
            tip: s === 'alternate' ? 'The alternate EOC (IAT B2.7). Not assessed until one is designated.' : 'The primary EOC at the CDRRM Office' }))} />
      </div>

      <Section title={`Readiness by IAT Part B domain — ${CAP_SITE_LABEL[site]}`}>
        <p className="mb-2 text-sm text-muted">
          Observed {totals.observed} · pre-filled {totals.prefilled} · validated {totals.validated} · not assessed {totals.byStatus.not_assessed} of {totals.items} items.
          An item mapped to two domains counts in each.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse font-data text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 pr-2">Domain</th><th className="px-2 text-right">Items</th>
                {(['met', 'partially_met', 'largely_unmet', 'not_met', 'not_applicable', 'not_assessed'] as EocCapStatus[]).map((s) =>
                  <th key={s} className="px-2 text-right">{CAP_STATUS_LABEL[s]}</th>)}
                <th className="px-2 text-right">Observed</th><th className="px-2 text-right">Pre-filled</th><th className="pl-2 text-right">Validated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.domain} className="border-b border-line/60">
                  <td className="py-2 pr-2">{CAP_DOMAIN_LABEL[r.domain] ?? r.domain}</td><td className="px-2 text-right">{r.items}</td>
                  <td className="px-2 text-right">{r.met}</td><td className="px-2 text-right">{r.partially_met}</td>
                  <td className="px-2 text-right">{r.largely_unmet}</td><td className="px-2 text-right">{r.not_met}</td>
                  <td className="px-2 text-right">{r.not_applicable}</td><td className="px-2 text-right">{r.not_assessed}</td>
                  <td className="px-2 text-right">{r.observed}</td><td className="px-2 text-right">{r.prefilled}</td><td className="pl-2 text-right">{r.validated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Checklist items">
        <div className="mb-3 grid max-w-2xl gap-3 sm:grid-cols-2">
          <Field label="Show" tip="Filter the items by answer or by how the answer was made">
            {(id) => <Select id={id} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All items</option>
              <option value="prefilled">Pre-filled from the IAT (to confirm)</option>
              <option value="observed">Observed</option>
              {CAP_STATUSES.map((s) => <option key={s} value={s}>{CAP_STATUS_LABEL[s]}</option>)}
            </Select>}
          </Field>
          <Field label="IAT Part B domain" tip="Show only the items that map to one Part B domain">
            {(id) => <Select id={id} value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="all">All domains</option>
              {Object.keys(CAP_DOMAIN_LABEL).map((d) => <option key={d} value={d}>{CAP_DOMAIN_LABEL[d]}</option>)}
            </Select>}
          </Field>
        </div>
        {sections.length === 0 && <p className="text-muted">No items match.</p>}
        {sections.map((key) => {
          const [group, section] = key.split('|');
          return (
            <div key={key} className="mb-4">
              <h3 className="font-heading text-sm font-bold">{section} <span className="font-normal text-muted">· {group}</span></h3>
              <List>
                {shown.filter((i) => i.section === section && i.section_group === group).map((it) => {
                  const r = bySite.get(it.id);
                  const status = r?.status ?? 'not_assessed';
                  return (
                    <ListRow key={it.id} onClick={() => setOpenId(it.id)} tip="Open this item to record or confirm the answer"
                      title={`${it.item_no}. ${it.item}`}
                      meta={<>{it.iat_indicators.length ? `IAT ${it.iat_indicators.join(', ')}` : 'No IAT counterpart: assess locally'}
                        {r?.provenance === 'prefilled_iat' && status !== 'not_assessed' && ' · pre-filled from IAT, to confirm'}
                        {r?.state === 'validated' && ' · validated'}</>}
                      trailing={<Badge tone={CAP_STATUS_TONE[status]}>{CAP_STATUS_LABEL[status]}</Badge>} />
                  );
                })}
              </List>
            </div>
          );
        })}
      </Section>

      {open && <ItemSheet item={open} response={bySite.get(open.id) ?? null} cycleId={cycle.id} site={site}
        editable={isEditable(cycle.status) && has('assessor', 'validator', 'cdrrmo_head', 'admin')}
        canValidate={has('cdrrmo_head')} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ItemSheet({ item, response, cycleId, site, editable, canValidate, onClose }: {
  item: EocCapItem; response: EocCapResponse | null; cycleId: string; site: EocCapSite; editable: boolean; canValidate: boolean; onClose: () => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<EocCapStatus>(response?.status ?? 'not_assessed');
  const [evidence, setEvidence] = useState(response?.evidence_observed ?? '');
  const [gap, setGap] = useState(response?.gap_remarks ?? '');
  const [action, setAction] = useState(response?.recommended_action ?? '');
  const [vaultId, setVaultId] = useState(response?.vault_document_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setStatus(response?.status ?? 'not_assessed'); setEvidence(response?.evidence_observed ?? ''); setGap(response?.gap_remarks ?? '');
    setAction(response?.recommended_action ?? ''); setVaultId(response?.vault_document_id ?? ''); setError(null);
  }, [response?.id, response?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const docs = useLiveQuery(async () => {
    const all = (await db.vault_documents.toArray()).filter((d) => d.status === 'current');
    const mine = new Set(item.iat_indicators);
    return all.sort((a, b) => Number(b.indicator_ids.some((i) => mine.has(i))) - Number(a.indicator_ids.some((i) => mine.has(i))) || a.title.localeCompare(b.title));
  }, [item.id]);

  const validated = response?.state === 'validated';
  const prefilled = response?.provenance === 'prefilled_iat';
  const canEdit = editable && !validated;
  const verb = prefilled ? 'Confirm' : 'Save';

  const submit = async () => {
    if (status === 'not_applicable' && !gap.trim()) { setError('Give the reason it does not apply in Gap / Remarks.'); return; }
    setBusy(true); setError(null);
    try {
      const base = response ?? { _new: true as const, id: uuid(), cycle_id: cycleId, item_id: item.id, site, version: 1 };
      await save('eoc_cap_responses', { ...base, status, provenance: 'observed', evidence_observed: evidence.trim() || null,
        gap_remarks: gap.trim() || null, recommended_action: action.trim() || null, vault_document_id: vaultId || null },
      `EOC checklist ${item.section} ${item.item_no}`);
      toast(prefilled ? 'Confirmed on site' : 'Saved', 'ok');
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const setState = async (state: 'validated' | 'draft') => {
    if (!response) return;
    setBusy(true); setError(null);
    try {
      await updateOnline('eoc_cap_responses', response, { state }, state === 'validated' ? 'Validate a checklist answer' : 'Reopen a checklist answer');
      toast(state === 'validated' ? 'Validated' : 'Reopened', 'ok');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Sheet open onClose={onClose} title={`${item.section} · item ${item.item_no}`}
      footer={<>
        <Button variant="secondary" onClick={onClose} tip="Close without saving">Close</Button>
        {canValidate && response && !validated && <Button variant="secondary" icon={ShieldCheck} disabled={busy || prefilled}
          tip={prefilled ? 'Confirm this pre-filled answer on site first; only observed answers can be validated' : 'Validate this answer (CDRRMO Head; needs a connection)'}
          onClick={() => setState('validated')}>Validate</Button>}
        {canValidate && validated && <Button variant="secondary" icon={RotateCcw} disabled={busy}
          tip="Reopen this answer so the team can change it (CDRRMO Head; needs a connection)" onClick={() => setState('draft')}>Reopen</Button>}
        {canEdit && <Button disabled={busy} onClick={submit}
          tip={prefilled ? 'Confirm the answer as observed on site (with any changes). Works offline' : 'Save this answer. Works offline and sends when you reconnect'}>{verb}</Button>}
      </>}>
      <p className="mb-2 font-semibold">{item.item}</p>
      <p className="mb-3 text-sm text-muted">
        {CAP_SITE_LABEL[site]} · {item.iat_indicators.length ? `IAT Part B ${item.iat_indicators.join(', ')}` : 'No IAT Part B counterpart: assess on its own merits'}
      </p>
      {prefilled && <Notice tone="warn" title="Pre-filled from IAT v1-7, not observed">
        The status and text below were copied from the IAT crosswalk. Check them on site, change what differs, and confirm.
      </Notice>}
      {validated && <Notice tone="ok" title="Validated">Validated{response?.validated_at ? ` ${fmtDateTime(response.validated_at)}` : ''}. Ask the CDRRMO Head to reopen it to make changes.</Notice>}
      {response?.assessed_at && !prefilled && <p className="mb-3 text-sm text-muted">Last recorded {fmtDateTime(response.assessed_at)}.</p>}
      {error && <Notice tone="bad" title="Not saved">{error}</Notice>}
      <div className="space-y-4">
        <ChoiceGroup legend="Status" value={status} onChange={(v) => canEdit && setStatus(v)} columns={2}
          options={CAP_STATUSES.map((s) => ({ value: s, label: CAP_STATUS_LABEL[s], disabled: !canEdit, disabledReason: 'Read only', tip: `Mark this item ${CAP_STATUS_LABEL[s].toLowerCase()}` }))} />
        <Field label="Evidence observed" optional tip="What was seen, tested or read, with the date (positions and offices only, never personal names)">
          {(id) => <Textarea id={id} rows={4} value={evidence} disabled={!canEdit} onChange={(e) => setEvidence(e.target.value)} />}
        </Field>
        <Field label="Gap / Remarks" optional={status !== 'not_applicable'} tip="What is missing, or why the item does not apply">
          {(id) => <Textarea id={id} rows={3} value={gap} disabled={!canEdit} onChange={(e) => setGap(e.target.value)} />}
        </Field>
        <Field label="Recommended action" optional tip="The next step to close the gap">
          {(id) => <Textarea id={id} rows={3} value={action} disabled={!canEdit} onChange={(e) => setAction(e.target.value)} />}
        </Field>
        <Field label="Evidence in the Document Vault" optional tip="Link the Vault document that shows this item (documents for the mapped indicators are listed first)">
          {(id) => <Select id={id} value={vaultId} disabled={!canEdit} onChange={(e) => setVaultId(e.target.value)}>
            <option value="">No document linked</option>
            {(docs ?? []).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </Select>}
        </Field>
        <p className="text-sm text-muted">Record positions and offices only. Never enter names of staff, evacuees, patients or informants.</p>
      </div>
    </Sheet>
  );
}
