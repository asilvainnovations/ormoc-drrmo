import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { useAaParams } from '@/lib/hooks';
import { aaCap, fmtPeso, fundStatus } from '@/domain/aa';
import { Button, EmptyState, Field, Input, Meter, Notice, PageHeader, Section } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { AaFundYear } from '@/types';

function Tranche({ label, used, limit }: { label: string; used: number; limit: number }) {
  const over = used > limit;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-sm"><span className="font-semibold">{label}</span><span>₱{fmtPeso(used)} of ₱{fmtPeso(limit)}</span></div>
      <Meter value={used} max={limit || 1} label={label} tone={over ? 'bad' : used / (limit || 1) > 0.85 ? 'warn' : 'ink'} />
    </div>
  );
}

export function FundsPage() {
  const { has } = useAuth();
  const params = useAaParams();
  const toast = useToast();
  const data = useLiveQuery(async () => ({ years: await db.aa_fund_years.orderBy('fiscal_year').reverse().toArray(), disb: await db.aa_disbursements.toArray() }), []);
  const [edit, setEdit] = useState<{ year: string; total: string; alloc: string; ref: string; version: number; isNew: boolean } | null>(null);
  const cap = edit ? aaCap(Number(edit.total) || 0, params) : 0;
  const over = edit ? Number(edit.alloc) > cap : false;

  const persist = async () => {
    if (!edit || over) return;
    const row: AaFundYear & { _new?: true } = { fiscal_year: Number(edit.year), ldrrmf_total: Number(edit.total), aa_allocation: Number(edit.alloc), appropriation_ref: edit.ref.trim() || null,
      version: edit.version, ...(edit.isNew ? { _new: true as const } : {}) };
    await save('aa_fund_years', row, `AA allocation ${edit.year}`);
    setEdit(null); toast('Allocation saved');
  };

  return (
    <div className="page">
      <PageHeader title="Anticipatory action funds" back="/eoc/aa"
        subtitle={`Up to ${params.aa_share_of_ldrrmf_70 * 100}% of the 70% LDRRMF. Interventions more than 3 days before impact may use up to ${params.tranche_beyond_max * 100}% of the allocation; within 3 days, up to ${params.tranche_within_max * 100}% (IRR Rule V).`}
        actions={has('cdrrmo_head') && <Button onClick={() => setEdit({ year: String(new Date().getFullYear()), total: '', alloc: '', ref: '', version: 1, isNew: true })}>Set allocation</Button>} />
      <Notice tone="info">The DBM–COA guidelines on funding, budgeting and utilization of AA measures are pending (IRR Rule V Sec. 4). Other lawful sources (Special Trust Fund, donations, ODA) are not limited by the 30%/70% graduation.</Notice>
      {data?.years.length === 0 ? <EmptyState title="No allocation set" body="Record the year's LDRRMF and the amount set aside for anticipatory action in the LDRRMFIP." /> : data?.years.map((y) => {
        const st = fundStatus(y, data.disb, params);
        return (
          <Section key={y.fiscal_year} title={`Fiscal year ${y.fiscal_year}`}
            action={has('cdrrmo_head') && <Button variant="quiet" onClick={() => setEdit({ year: String(y.fiscal_year), total: String(y.ldrrmf_total), alloc: String(y.aa_allocation), ref: y.appropriation_ref ?? '', version: y.version, isNew: false })}>Edit</Button>}>
            <p className="mb-3 text-sm text-muted">LDRRMF ₱{fmtPeso(Number(y.ldrrmf_total))}. AA allocation ₱{fmtPeso(Number(y.aa_allocation))} (cap ₱{fmtPeso(st.cap)}).{y.appropriation_ref ? ` ${y.appropriation_ref}.` : ''}</p>
            <div className="max-w-xl space-y-4">
              <Tranche label="Beyond 3 days before impact" used={st.beyondUsed} limit={st.beyondLimit} />
              <Tranche label="Within 3 days of impact" used={st.withinUsed} limit={st.withinLimit} />
              <p className="text-sm">Other sources used: ₱{fmtPeso(st.otherUsed)}</p>
            </div>
          </Section>
        );
      })}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="AA allocation"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={over || !edit?.total || !edit?.alloc} onClick={persist}>Save allocation</Button></>}>
        {edit && <>
          <Field label="Fiscal year">{(id) => <Input id={id} inputMode="numeric" disabled={!edit.isNew} value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value })} />}</Field>
          <Field label="Total LDRRMF for the year (₱)" hint="At least 5% of estimated revenue from regular sources (RA 10121 Sec. 21).">{(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={edit.total} onChange={(e) => setEdit({ ...edit, total: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
          <Field label="Set aside for anticipatory action (₱)" hint={`Cap: ₱${fmtPeso(cap)}`} error={over ? `Above the cap of ₱${fmtPeso(cap)}.` : null}>{(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={edit.alloc} onChange={(e) => setEdit({ ...edit, alloc: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
          <Field label="Appropriation reference" optional hint="LDRRMFIP or appropriation ordinance.">{(id, d) => <Input id={id} aria-describedby={d} value={edit.ref} onChange={(e) => setEdit({ ...edit, ref: e.target.value })} />}</Field>
        </>}
      </Sheet>
    </div>
  );
}
