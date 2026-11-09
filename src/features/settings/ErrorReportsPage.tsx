// Error reports (1.11.0): the crash and error reports the app sends to client_errors (migration 20261105001500).
// Administrators only, online only (reports are not kept on devices). The Settings menu has linked here since
// 1.8.0, but the screen was missing. Delete reports older than 90 days (DEPLOY §11).
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/time';
import { Button, Notice, PageHeader } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { tip } from '@/components/Tooltip';

interface Report { id: string; received_at: string; app_version: string; route: string | null; kind: string; message: string; stack: string | null; user_agent: string | null }
const KIND: Record<string, string> = { render: 'Screen crashed', error: 'Script error', unhandled_rejection: 'Unhandled failure', chunk_load: 'Update not loaded' };

export function ErrorReportsPage() {
  const { has } = useAuth();
  const online = useOnline();
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.from('client_errors').select('id, received_at, app_version, route, kind, message, stack, user_agent')
      .order('received_at', { ascending: false }).limit(200);
    if (e) setError(e.message); else setRows((data ?? []) as Report[]);
  }, []);
  useEffect(() => { if (online && has('admin')) void load(); }, [online, has, load]);

  if (!has('admin')) return <div className="page"><PageHeader title="Error reports" back="/settings" /><Notice tone="warn">Only a system administrator can read error reports.</Notice></div>;
  return (
    <div className="page">
      <PageHeader title="Error reports" back="/settings" subtitle="The newest 200 reports. Each holds the app version, the screen, the error and the browser; email addresses and long numbers are removed before sending."
        actions={<Button tip="Load the reports again (needs a connection)" variant="secondary" icon={RefreshCw} disabled={!online} onClick={() => void load()}>Refresh</Button>} />
      {!online && <Notice tone="info" title="Needs a connection">Reports are read from the server and are not kept on this device.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      {online && rows === null && !error && <div className="space-y-2" aria-label="Loading"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>}
      {rows && rows.length === 0 && <Notice tone="ok" title="No reports">Nothing has been reported.</Notice>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-sheet border border-line bg-surface">
          <Table>
            <TableCaption className="pb-3">Delete reports older than 90 days (DEPLOY §11).</TableCaption>
            <TableHeader>
              <TableRow><TableHead>Received</TableHead><TableHead>Kind</TableHead><TableHead>Screen</TableHead><TableHead>Version</TableHead><TableHead>Error</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-data">{fmtDateTime(r.received_at)}</TableCell>
                  <TableCell><Badge variant={r.kind === 'render' ? 'destructive' : 'secondary'}>{KIND[r.kind] ?? r.kind}</Badge></TableCell>
                  <TableCell className="font-data">{r.route ?? '—'}</TableCell>
                  <TableCell className="font-data">{r.app_version}</TableCell>
                  <TableCell className="min-w-[18rem]">
                    <Collapsible>
                      <p>{r.message}</p>
                      {(r.stack || r.user_agent) && <>
                        <CollapsibleTrigger {...tip('Show the technical details: stack trace and browser')} className="mt-1 min-h-tap text-sm font-semibold text-action underline">Details</CollapsibleTrigger>
                        <CollapsibleContent><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-control bg-sunken p-2 text-xs">{r.stack}{r.user_agent && `\n\n${r.user_agent}`}</pre></CollapsibleContent>
                      </>}
                    </Collapsible>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
