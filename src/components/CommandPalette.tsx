// Search MODE from anywhere (1.11.0): Ctrl+K or ⌘K, or the Search button. Finds screens, manual sections (by
// code, title or old chapter code), workflows and protocols (by code, title or controlling SOP) and forms. Reads
// only the device's copy (IndexedDB), so it works offline. Built on cmdk through components/ui/command.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, ClipboardCheck, FileText, FolderLock, House, ListChecks, RadioTower, Search, Settings, Siren, Workflow, Wrench } from 'lucide-react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/auth';
import { canUseVault } from '@/features/vault/access';
import { templateIsWorkflow } from '@/features/protocols/labels';
import { tip } from '@/components/Tooltip';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command';

const SCREENS = [
  { to: '/today', label: 'Today', icon: House, keys: 'home dashboard' },
  { to: '/assess', label: 'Institutional assessment', icon: ClipboardCheck, keys: 'IAT indicators scores evidence maturity' },
  { to: '/drrm', label: 'DRRM workflows', icon: Workflow, keys: 'SOP workflow process owner' },
  { to: '/drrm/protocols', label: 'DRRM protocols', icon: ListChecks, keys: 'checklist run drill' },
  { to: '/drrm/forms', label: 'Forms', icon: FileText, keys: 'records registers' },
  { to: '/eoc', label: 'EOC board', icon: RadioTower, keys: 'alert level white blue red activation' },
  { to: '/eoc/log', label: 'EOC logbook', icon: RadioTower, keys: 'log entry significant events' },
  { to: '/eoc/sitreps', label: 'SitReps', icon: RadioTower, keys: 'situation report DILG' },
  { to: '/eoc/aa', label: 'Anticipatory action', icon: Siren, keys: 'PDRA state of imminent disaster RA 12287' },
  { to: '/eoc/map', label: 'Geo-COP map', icon: RadioTower, keys: 'GIS map layers' },
  { to: '/eoc/hazard-maps', label: 'Hazard maps', icon: RadioTower, keys: 'flood landslide storm surge tsunami liquefaction fault shaking QGIS measure layers' },
  { to: '/eoc/risk', label: 'Risk intelligence', icon: RadioTower, keys: 'DDRiVE hazard barangay vulnerability exposure risk' },
  { to: '/library', label: 'Library', icon: BookOpen, keys: 'manual chapters annexes' },
  { to: '/library/trace', label: 'Traceability', icon: BookOpen, keys: 'indicators master requirements' },
  { to: '/vault', label: 'Document Vault', icon: FolderLock, keys: 'laws issuances documents', vault: true },
  { to: '/tools', label: 'Tools and hazard maps', icon: Wrench, keys: 'ICS PSCP Gawad KALASAG HazardHunterPH' },
  { to: '/settings', label: 'Settings', icon: Settings, keys: 'sync users roles barangays sign out appearance' },
];

export function CommandPalette({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { has } = useAuth();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const data = useLiveQuery(async () => (open ? {
    docs: await db.moo_documents.orderBy('sort').toArray(),
    templates: (await db.protocol_templates.toArray()).filter((t) => t.status !== 'retired'),
    forms: (await db.form_templates.toArray()).filter((f) => f.status !== 'retired'),
  } : null), [open]);
  const screens = useMemo(() => SCREENS.filter((s) => !s.vault || canUseVault(has)), [has]);
  const go = (to: string) => { setOpen(false); nav(to); };
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} {...tip('Search screens, manual sections, procedures and forms (Ctrl+K)')}
        className={cn('inline-flex min-h-tap items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-muted hover:bg-sky-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus', className)}>
        <Search className="h-4 w-4" aria-hidden />
        {compact ? <span className="sr-only">Search</span> : <><span className="sr-only sm:not-sr-only sm:flex-1 sm:text-left">Search</span><kbd className="hidden rounded border border-line px-1.5 font-data text-xs lg:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd></>}
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a screen, SOP 4-06, Form 3-01, EOC Ch.2…" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>Nothing matches. Try a shorter word or a code.</CommandEmpty>
          <CommandGroup heading="Screens">
            {screens.map((s) => (
              <CommandItem key={s.to} value={`${s.label} ${s.keys}`} onSelect={() => go(s.to)}>
                <s.icon className="mr-2 text-action" aria-hidden />{s.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {data && <>
            <CommandSeparator />
            <CommandGroup heading="Workflows and protocols">
              {data.templates.map((t) => (
                <CommandItem key={t.id} value={`${t.code} ${t.title} ${t.sop_ref ?? ''} ${t.process_owner ?? ''}`}
                  onSelect={() => go(`${templateIsWorkflow(t) ? '/drrm' : '/drrm/protocols'}?open=${encodeURIComponent(t.code)}`)}>
                  {templateIsWorkflow(t) ? <Workflow className="mr-2 text-action" aria-hidden /> : <ListChecks className="mr-2 text-action" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{t.title}<span className="block truncate text-xs text-muted">{t.sop_ref ?? t.code}</span></span>
                  {t.status === 'draft' && <Badge variant="warning" size="sm">Draft</Badge>}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Manual sections">
              {data.docs.map((d) => (
                <CommandItem key={d.id} value={`${d.code} ${d.title} ${(d.aliases ?? []).join(' ')}`} onSelect={() => go(`/library/doc/${d.id}`)}>
                  <BookOpen className="mr-2 text-action" aria-hidden />
                  <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{d.code}</span> {d.title}</span>
                  <CommandShortcut>{d.manual}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Forms">
              {data.forms.map((f) => (
                <CommandItem key={f.id} value={`${f.code} ${f.title}`} onSelect={() => go(`/drrm/forms?open=${encodeURIComponent(f.code)}`)}>
                  <FileText className="mr-2 text-action" aria-hidden />
                  <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{f.code}</span> {f.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>}
        </CommandList>
      </CommandDialog>
    </>
  );
}
