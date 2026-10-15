import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from './db';
import { currentLevel } from '@/domain/eoc';
import { DEFAULT_AA_PARAMS, type AaParams } from '@/domain/aa';
import type { Declaration } from '@/types';

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}

export function useOnline(): boolean {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export const useEocStatus = () => useLiveQuery(async () => currentLevel(await db.eoc_activations.toArray()), [], { level: 'white' as const, activation: null });

export const useActiveDeclaration = () =>
  useLiveQuery<Declaration | undefined>(() => db.declarations.where('status').anyOf('requested', 'recommended', 'declared').first(), []);

export const usePending = () => useLiveQuery(async () => ({
  outbox: await db.outbox.count(), failed: await db.failed.count(), conflicts: await db.conflicts.count(),
}), [], { outbox: 0, failed: 0, conflicts: 0 });

export function useAaParams(): AaParams {
  return useLiveQuery(async () => {
    const rows = await db.aa_rules.toArray();
    const p = { ...DEFAULT_AA_PARAMS };
    for (const r of rows) if (r.key in p) (p as Record<string, number>)[r.key] = Number(r.value);
    return p;
  }, [], DEFAULT_AA_PARAMS);
}

export const useReference = () => useLiveQuery(async () => ({
  domains: await db.iat_domains.orderBy('sort').toArray(),
  indicators: await db.iat_indicators.orderBy('sort').toArray(),
  hazards: await db.hazards.orderBy('sort').toArray(),
  offices: await db.offices.toArray(),
}), []);

export const useProfiles = () => useLiveQuery(async () => new Map((await db.profiles.toArray()).map((p) => [p.id, p])), [], new Map());
