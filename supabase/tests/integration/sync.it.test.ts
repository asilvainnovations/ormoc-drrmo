// The app's own sync engine, through the real supabase-js client and PostgREST,
// against the real migrations and RLS. One signed-in role per scenario.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/env', () => ({ env: { demo: false, supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: process.env.ANON_KEY, appVersion: 'it' } }));
vi.mock('@/lib/supabase', () => ({ supabase: null }));

import { db } from '@/lib/db';
import { save } from '@/lib/store';
import { push, pull, setSyncClient } from '@/lib/sync';
import { uuid } from '@/lib/ids';
import { startProtocol } from '@/features/protocols/actions';
import { loadChecklist } from '@/features/eoc/aa/actions';
import { addLog } from '@/features/eoc/actions';

const sql = (q: string) => execFileSync('psql', ['-At', '-d', process.env.IT_DB!, '-c', q]).toString().trim();
/** Run SQL as a signed-in City user (the triggers check roles through auth.uid()). */
const sqlAs = (sub: string, q: string) => sql(`set request.jwt.claim.sub = '${sub}'; ${q}`).split('\n').filter((l) => l !== 'SET').join('\n');
let client: SupabaseClient;

async function signIn(email: string) {
  client = createClient('http://127.0.0.1:54321', process.env.ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, storageKey: `it-${email}` } });
  const { error } = await client.auth.signInWithPassword({ email, password: 'integration-only' });
  if (error) throw error;
  setSyncClient(client);
}

beforeEach(async () => { await db.delete(); await db.open(); });
afterEach(async () => { await client?.auth.signOut(); });

describe('assessment through PostgREST', () => {
  it('creates a cycle, enforces the evidence gate, and accepts a supported score', async () => {
    await signIn('assessor@it.local');
    const cycleId = uuid(), respId = uuid();
    await save('assessment_cycles', { _new: true, id: cycleId, name: 'IT cycle', cycle_year: 2026, iat_version: '1.1', status: 'draft', period_from: null, period_to: null, notes: null, version: 1 }, 'cycle');
    await save('responses', { _new: true, id: respId, cycle_id: cycleId, indicator_id: 'A1.1', score: null, is_na: false, na_justification: null, gap_remarks: null, recommended_action: null, status: 'draft', version: 1 }, 'open');
    await save('evidence', { _new: true, id: uuid(), response_id: respId, kind: 'interview', strength: 'verbal', title: 'KII Head', doc_date: null, source: 'CDRRMO Head', storage_path: null, note: null, version: 1 }, 'ev');
    expect(await push()).toBe(true);
    expect(sql(`select created_by from public.assessment_cycles where id = '${cycleId}'`)).toBe('00000000-0000-0000-0000-0000000000b1');

    // Over-scoring is refused by the server; the explanation reaches the Sync screen.
    let r = (await db.responses.get(respId))!;
    await save('responses', { ...r, score: 3 }, 'score 3');
    await push();
    const failed = await db.failed.toArray();
    expect(failed.at(-1)?.error).toMatch(/above what the evidence supports/);
    expect((await db.responses.get(respId))?.score).toBeNull();

    r = (await db.responses.get(respId))!;
    await save('responses', { ...r, score: 2 }, 'score 2');
    await push();
    expect(sql(`select score || '/' || version from public.responses where id = '${respId}'`)).toBe('2/2');
  });

  it('records a conflict when someone else saved first', async () => {
    await signIn('assessor@it.local');
    const cycleId = uuid();
    await save('assessment_cycles', { _new: true, id: cycleId, name: 'Conflict', cycle_year: 2026, iat_version: '1.1', status: 'draft', period_from: null, period_to: null, notes: null, version: 1 }, 'cycle');
    await push();
    sql(`update public.assessment_cycles set name = 'Changed elsewhere', version = version where id = '${cycleId}'`);
    const local = (await db.assessment_cycles.get(cycleId))!;
    await save('assessment_cycles', { ...local, name: 'My name' }, 'rename');
    await push();
    expect(await db.conflicts.count()).toBe(1);
    expect((await db.assessment_cycles.get(cycleId))?.name).toBe('Changed elsewhere');
  });

  it('refuses writes a role may not make', async () => {
    await signIn('viewer@it.local');
    await save('assessment_cycles', { _new: true, id: uuid(), name: 'Not allowed', cycle_year: 2026, iat_version: '1.1', status: 'draft', period_from: null, period_to: null, notes: null, version: 1 }, 'viewer cycle');
    await push();
    expect((await db.failed.toArray()).at(-1)?.error).toMatch(/row-level security/);
  });
});

describe('operations through PostgREST', () => {
  it('starts a protocol offline-style and the server creates identical step ids', async () => {
    await signIn('duty@it.local');
    await pull(['protocol_templates', 'protocol_steps'], true);
    const t = (await db.protocol_templates.where('code').equals('PR-DUTY-HANDOVER').first())!;
    const runId = await startProtocol(t, '00000000-0000-0000-0000-0000000000b3');
    const local = await db.protocol_run_steps.where('run_id').equals(runId).sortBy('seq');
    expect(await push()).toBe(true);
    expect(sql(`select string_agg(id::text, ',' order by seq) from public.protocol_run_steps where run_id = '${runId}'`)).toBe(local.map((s) => s.id).join(','));
    // Closing a step sends only status and note, so the locked snapshot is never touched.
    await save('protocol_run_steps', { ...local[0]!, status: 'done', note: 'Logbook read' }, 'step 1');
    expect(await push()).toBe(true);
    expect(await db.failed.count()).toBe(0);
    expect(sql(`select status || '|' || done_by from public.protocol_run_steps where id = '${local[0]!.id}'`)).toBe('done|00000000-0000-0000-0000-0000000000b3');
  });

  it('appends logbook entries and ignores a replayed insert', async () => {
    await signIn('duty@it.local');
    await addLog('Radio net check complete', 'general', null);
    const item = (await db.outbox.toArray())[0]!;
    expect(await push()).toBe(true);
    await db.outbox.add({ ...item, seq: undefined });           // replay the same insert
    expect(await push()).toBe(true);
    expect(await db.failed.toArray()).toEqual([]);
    expect(sql(`select count(*) || '|' || max(author::text) from public.logbook_entries where entry = 'Radio net check complete'`)).toBe('1|00000000-0000-0000-0000-0000000000b3');
  });

  it('loads the AA checklist with the same ids on device and server', async () => {
    await signIn('eocmgr@it.local');
    await pull(['aa_action_templates', 'hazards'], true);
    const pdra = uuid(), decl = uuid();
    sql(`insert into public.pdra_sessions (id, hazard_code, forecast_source, forecast_issued_at, expected_impact_at, impact_class, decision, decision_basis)
         values ('${pdra}', 'tropical_cyclone', 'PAGASA SWB', now(), now() + interval '100 hours', 'severe', 'request_declaration', 'IT')`);
    sqlAs('00000000-0000-0000-0000-0000000000b4', `insert into public.declarations (id, pdra_id, hazard_code, expected_impact_at, origin, status, eo_number) values ('${decl}', '${pdra}', 'tropical_cyclone', now() + interval '100 hours', 'adopted_provincial', 'draft', null)`);
    sqlAs('00000000-0000-0000-0000-0000000000b4', `update public.declarations set status = 'declared', eo_number = 'EO-IT-1', version = version where id = '${decl}'`);
    await pull(['declarations'], true);
    await loadChecklist({ declarationId: decl }, 'tropical_cyclone');
    const local = (await db.aa_actions.where('declaration_id').equals(decl).toArray()).map((a) => a.id).sort();
    expect(await push()).toBe(true);
    const server = sql(`select string_agg(id::text, ',' order by id) from public.aa_actions where declaration_id = '${decl}'`).split(',');
    expect(server).toEqual(local);
  });

  it('pulls what a viewer may read', async () => {
    await signIn('viewer@it.local');
    await pull(undefined, true);
    expect(await db.iat_indicators.count()).toBe(140);
    expect(await db.master_requirements.count()).toBe(18);
    expect(await db.protocol_templates.count()).toBe(9);
    expect(await db.moo_versions.where('status').equals('draft').count()).toBe(0);   // drafts are hidden from viewers
  });
});
