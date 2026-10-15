import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { canOperate } from '@/domain/eoc';
import { fmtDateTime } from '@/lib/time';
import { useProfiles } from '@/lib/hooks';
import { Badge, Button, Field, List, ListRow, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { LogCategory, LogEntry } from '@/types';
import { addLog } from './actions';
import { EOC_TABS, LOG_CATEGORY } from './labels';

export function LogbookPage() {
  const { roles, userId } = useAuth();
  const people = useProfiles();
  const toast = useToast();
  const [filter, setFilter] = useState<LogCategory | ''>('');
  const [open, setOpen] = useState(false);
  const [correcting, setCorrecting] = useState<LogEntry | null>(null);
  const [text, setText] = useState('');
  const [cat, setCat] = useState<LogCategory>('general');
  const rows = useLiveQuery(async () => {
    const all = await db.logbook_entries.orderBy('occurred_at').reverse().limit(500).toArray();
    return filter ? all.filter((r) => r.category === filter) : all;
  }, [filter], []);
  const corrected = new Set(rows.filter((r) => r.corrects_id).map((r) => r.corrects_id));

  const submit = async () => {
    await addLog(text, correcting ? 'correction' : cat, userId, correcting?.id ?? null);
    setText(''); setOpen(false); setCorrecting(null); toast(correcting ? 'Correction logged' : 'Logged');
  };

  return (
    <div className="page">
      <PageHeader title="Logbook" subtitle="Entries cannot be edited or deleted. Record a correction instead."
        actions={canOperate(roles) && <Button onClick={() => setOpen(true)}>New entry</Button>} />
      <Tabs items={EOC_TABS} />
      <div className="mb-4 max-w-xs">
        <Field label="Show">{(id) => (
          <Select id={id} value={filter} onChange={(e) => setFilter(e.target.value as LogCategory | '')}>
            <option value="">All entries</option>{Object.entries(LOG_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>)}</Field>
      </div>
      <List>
        {rows.map((r) => (
          <ListRow key={r.id} onClick={canOperate(roles) && r.category !== 'level_change' ? () => { setCorrecting(r); setOpen(true); } : undefined}
            title={<span className={corrected.has(r.id) ? 'text-muted line-through' : ''}>{r.entry}</span>}
            meta={`${fmtDateTime(r.occurred_at)}${r.author && people.get(r.author) ? `, ${people.get(r.author)!.full_name}` : ''}`}
            trailing={<Badge tone={r.category === 'correction' ? 'warn' : r.category === 'level_change' ? 'info' : 'neutral'}>{LOG_CATEGORY[r.category]}</Badge>} />
        ))}
      </List>
      <Sheet open={open} onClose={() => { setOpen(false); setCorrecting(null); }} title={correcting ? 'Correct an entry' : 'New logbook entry'}
        footer={<><Button variant="secondary" onClick={() => { setOpen(false); setCorrecting(null); }}>Cancel</Button><Button disabled={!text.trim()} onClick={submit}>{correcting ? 'Log correction' : 'Log entry'}</Button></>}>
        {correcting && <p className="rounded-control bg-sunken p-3 text-sm">Correcting: {correcting.entry}</p>}
        {!correcting && <Field label="Category">{(id) => (
          <Select id={id} value={cat} onChange={(e) => setCat(e.target.value as LogCategory)}>
            {(['general', 'decision', 'warning', 'request', 'resource', 'report'] as LogCategory[]).map((k) => <option key={k} value={k}>{LOG_CATEGORY[k]}</option>)}
          </Select>)}</Field>}
        <Field label={correcting ? 'Corrected entry' : 'Entry'} hint="Time is recorded automatically. No names of affected persons.">{(id, d) => <Textarea id={id} aria-describedby={d} rows={4} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
      </Sheet>
    </div>
  );
}
