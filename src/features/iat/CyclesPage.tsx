import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/lib/auth';
import { Badge, Button, EmptyState, Field, Input, List, ListRow, PageHeader, Section, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { cycleResults } from '@/domain/scoring';
import type { Cycle } from '@/types';
import { CYCLE_STATUS } from './labels';

export function CyclesPage() {
  const { has } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`Institutional assessment ${new Date().getFullYear()}`);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const canCreate = has('assessor', 'validator', 'cdrrmo_head');

  const rows = useLiveQuery(async () => {
    const [cycles, domains, indicators] = await Promise.all([
      db.assessment_cycles.orderBy('cycle_year').reverse().toArray(), db.iat_domains.toArray(), db.iat_indicators.toArray()]);
    return Promise.all(cycles.map(async (c) => ({ c, res: cycleResults(indicators, domains, await db.responses.where('cycle_id').equals(c.id).toArray()) })));
  }, []);

  const create = async () => {
    setBusy(true);
    const c: Cycle & { _new: true } = { _new: true, id: uuid(), name: name.trim(), cycle_year: new Date().getFullYear(), iat_version: '1.1',
      status: 'draft', period_from: null, period_to: null, notes: notes.trim() || null, version: 1 };
    await save('assessment_cycles', c, `Create assessment cycle ${c.name}`);
    setBusy(false); setOpen(false);
    toast('Assessment cycle created');
    nav(`/assess/${c.id}`);
  };

  return (
    <div className="page">
      <PageHeader title="Institutional assessment" subtitle="IAT v1.1: 125 core indicators (Parts A and B) and 15 interface indicators (Part C)."
        actions={canCreate && <Button tip="Start a new assessment cycle, for example the annual reassessment" icon={Plus} onClick={() => setOpen(true)}>New cycle</Button>} />
      <Section title="Assessment cycles">
        {rows && rows.length === 0 ? (
          <EmptyState title="No assessment cycle yet"
            body="Start a cycle for the baseline assessment. Each indicator is scored 0 to 4 against evidence, then validated with CDRRMO management."
            action={canCreate && <Button tip="Start the first assessment, the baseline for the Manual of Operations" icon={Plus} onClick={() => setOpen(true)}>Start the baseline</Button>} />
        ) : (
          <List>
            {rows?.map(({ c, res }) => (
              <ListRow tip="Open this cycle: progress, results and domains" key={c.id} to={`/assess/${c.id}`} title={c.name}
                meta={`${res.answered} of ${res.total} indicators answered${res.imi.maturityIndex !== null ? `, maturity ${res.imi.maturityIndex.toFixed(2)} (${res.imi.band})` : ''}`}
                trailing={<Badge tone={c.status === 'final' ? 'ok' : c.status === 'validation' ? 'info' : 'neutral'}>{CYCLE_STATUS[c.status]}</Badge>} />
            ))}
          </List>
        )}
      </Section>
      <Sheet open={open} onClose={() => setOpen(false)} title="New assessment cycle"
        footer={<><Button tip="Close without creating" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button tip="Create the cycle with all 140 indicators" busy={busy} disabled={!name.trim()} onClick={create}>Create cycle</Button></>}>
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Notes" optional hint="Scope, team or anything the validators should know.">{(id, d) => <Textarea id={id} aria-describedby={d} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </Sheet>
    </div>
  );
}
