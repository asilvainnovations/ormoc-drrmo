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
      <Meter value={used} max={limit || 1} label={label} tone={over ? 'bad' : used / (limit || 1) > 0.85 ? 'warn' : 'action'} />
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
      <PageHeader title="Anticipatory Action Funds" back="/eoc/aa"
        subtitle={`No more than ${params.aa_share_of_ldrrmf_70 * 100}% of the 70% LDRRMF (IRR Rule V Sec. 1(b)). For hydrometeorological and geological hazards, interventions beyond a lead time of three (3) days may use at most ${params.tranche_beyond_max * 100}% of the allocation, and up to ${params.tranche_within_max * 100}% within a maximum lead time of three (3) days (IRR Rule V Sec. 2).`}
        actions={has('cdrrmo_head') && <Button tip="Set this year’s LDRRMF total and the anticipatory action allocation" onClick={() => setEdit({ year: String(new Date().getFullYear()), total: '', alloc: '', ref: '', version: 1, isNew: true })}>Set allocation</Button>} />
      <Notice tone="info">Pending national guidance: the DBM–COA guidelines on funding, budgeting and use of AA funds (IRR Rule V Sec. 4) and the NDRRMC operational guidelines on triggers, thresholds and drought timelines (IRR Rule II Sec. 2, Rule V Sec. 2). The 30%/70% graduation does not apply to other lawful sources: Special Trust Fund balances, donations, ODA, other LGUs or agency budgets.</Notice>
      {data?.years.length === 0 ? <EmptyState title="No allocation set" body="Record the year's LDRRMF and the amount set aside for anticipatory action in the LDRRMFIP." /> : data?.years.map((y) => {
        const st = fundStatus(y, data.disb, params);
        return (
          <Section key={y.fiscal_year} title={`Fiscal year ${y.fiscal_year}`}
            action={has('cdrrmo_head') && <Button tip="Change this year’s figures" variant="quiet" onClick={() => setEdit({ year: String(y.fiscal_year), total: String(y.ldrrmf_total), alloc: String(y.aa_allocation), ref: y.appropriation_ref ?? '', version: y.version, isNew: false })}>Edit</Button>}>
            <p className="mb-3 text-sm text-muted">LDRRMF ₱{fmtPeso(Number(y.ldrrmf_total))}. AA allocation ₱{fmtPeso(Number(y.aa_allocation))} (cap ₱{fmtPeso(st.cap)}).{y.appropriation_ref ? ` ${y.appropriation_ref}.` : ''}</p>
            <div className="max-w-xl space-y-4">
              <Tranche label="Beyond a lead time of three (3) days" used={st.beyondUsed} limit={st.beyondLimit} />
              <Tranche label="Within a lead time of three (3) days" used={st.withinUsed} limit={st.withinLimit} />
              {st.ungraduatedUsed > 0 && <p className="text-sm">LDRRMF used for hazards outside the graduation (for example drought): ₱{fmtPeso(st.ungraduatedUsed)}</p>}
              <p className="text-sm">LDRRMF AA used in all: ₱{fmtPeso(st.beyondUsed + st.withinUsed + st.ungraduatedUsed)} of ₱{fmtPeso(Number(y.aa_allocation))}</p>
              <p className="text-sm">Other sources used: ₱{fmtPeso(st.otherUsed)}</p>
            </div>
          </Section>
        );
      })}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title="AA allocation"
        footer={<><Button tip="Close without saving" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button tip="Save the allocation. It cannot exceed 10% of the 70% LDRRMF" disabled={over || !edit?.total || !edit?.alloc} onClick={persist}>Save allocation</Button></>}>
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
