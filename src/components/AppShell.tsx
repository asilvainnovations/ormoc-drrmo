import { NavLink, Link, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { BookOpen, ClipboardCheck, FolderLock, House, ListChecks, RadioTower, Settings, CloudOff, RefreshCw, AlertTriangle, Check, Wrench } from 'lucide-react';
import { LEVEL_INFO } from '@/domain/eoc';
import { useActiveDeclaration, useEocStatus, useNow, usePending } from '@/lib/hooks';
import { useSyncState } from '@/lib/sync';
import { duration, fmtTime, relative } from '@/lib/time';
import { hoursBetween } from '@/domain/aa';
import { useAuth } from '@/lib/auth';
import { canUseVault } from '@/features/vault/access';
import { tip } from './Tooltip';
import { BrandLockup } from './Brand';

const NAV = [
  { to: '/', label: 'Today', icon: House, end: true, tip: 'Your day: alerts, quick actions, running protocols and latest log' },
  { to: '/assess', label: 'Assess', icon: ClipboardCheck, tip: 'Institutional Assessment Tool: score indicators with evidence and plan improvements' },
  { to: '/protocols', label: 'Protocols', icon: ListChecks, tip: 'Step-by-step CDRRMO procedures you can run live or as drills' },
  { to: '/eoc', label: 'EOC', icon: RadioTower, tip: 'Emergency Operations Center: level, logbook, SitReps, requests and anticipatory action' },
  { to: '/library', label: 'Library', icon: BookOpen, tip: 'The Manual of Operations and EOC Manual, with traceability to the indicators' },
  { to: '/vault', label: 'Vault', icon: FolderLock, tip: 'Document Vault: laws, guidelines and documents for Document Review', vault: true },
  // Desktop rail only; on phones the Today screen links to Tools (the tab bar holds six).
  { to: '/tools', label: 'Tools', icon: Wrench, tip: 'ICS exercises, continuity planning, Gawad KALASAG readiness, HazardHunterPH, GeoAnalyticsPH, Zoom Earth and DDRiVE-M', rail: true },
];

/** The signature element: activation level, any declaration in force, and data freshness. */
export function StatusBand() {
  const { level, activation } = useEocStatus();
  const decl = useActiveDeclaration();
  const sync = useSyncState();
  const pending = usePending();
  const now = useNow();
  const info = LEVEL_INFO[level];
  const tone = level === 'white' ? 'bg-lvl-white text-lvl-white-ink' : level === 'blue' ? 'bg-lvl-blue text-on-level' : 'bg-lvl-red text-on-level';

  // Full text on wider screens; a short form on phones so nothing is truncated.
  let syncText: string; let syncShort: string; let SyncIcon = Check;
  if (sync.status === 'offline') { syncText = pending.outbox ? `Offline, ${pending.outbox} waiting` : 'Offline'; syncShort = pending.outbox ? `Offline, ${pending.outbox}` : 'Offline'; SyncIcon = CloudOff; }
  else if (sync.status === 'syncing') { syncText = 'Syncing'; syncShort = 'Syncing'; SyncIcon = RefreshCw; }
  else if (pending.failed || pending.conflicts) { syncText = `${pending.failed + pending.conflicts} need attention`; syncShort = `${pending.failed + pending.conflicts} to check`; SyncIcon = AlertTriangle; }
  else if (pending.outbox) { syncText = `${pending.outbox} waiting`; syncShort = `${pending.outbox} waiting`; SyncIcon = RefreshCw; }
  else { syncText = sync.lastSyncAt ? `Synced ${relative(sync.lastSyncAt, now.getTime())}` : 'Not synced yet'; syncShort = sync.lastSyncAt ? 'Synced' : 'Not synced'; }
  const detail = level === 'white' ? 'Normal operations' : `${info.meaning} since ${fmtTime(activation?.started_at)}`;

  return (
    <div className={clsx('sticky top-0 z-30 pt-[env(safe-area-inset-top)] print:hidden', tone)}>
      <div className="mx-auto flex max-w-page items-center gap-3 px-4 py-2 lg:px-8">
        <Link to="/eoc" {...tip('Open the EOC board. The band shows the current alert level and any declaration in force')} className="min-w-0 flex-1 rounded-control">
          <p className="text-sm leading-5 sm:text-base">
            <span className="font-data text-[1.0625rem] font-bold uppercase tracking-wide">EOC {info.name} level</span><span className="hidden sm:inline">, {detail.charAt(0).toLowerCase() + detail.slice(1)}</span>
          </p>
          <p className="text-xs leading-5 sm:hidden">{detail}</p>
          {decl && (
            <p className="text-xs font-semibold leading-5 sm:text-sm">
              {decl.status === 'declared' ? 'State of Imminent Disaster in force' : decl.status === 'requested' ? 'Declaration requested from RDRRMC VIII' : 'RDRRMC recommends a declaration'}
              {decl.status !== 'requested' && hoursBetween(now, decl.expected_impact_at) > 0 && `, impact in ${duration(hoursBetween(now, decl.expected_impact_at))}`}
            </p>
          )}
        </Link>
        <Link to="/settings/sync" aria-label={`Sync: ${syncText}`} {...tip('Sync status. Open to see what is waiting to send or needs your attention')} className="inline-flex min-h-tap shrink-0 items-center gap-1.5 self-start rounded-control px-2 font-data text-sm font-semibold sm:self-center">
          <SyncIcon className={clsx('h-4 w-4', sync.status === 'syncing' && 'animate-spin')} aria-hidden />
          <span className="sm:hidden">{syncShort}</span><span className="hidden sm:inline">{syncText}</span>
        </Link>
      </div>
    </div>
  );
}

export function AppShell() {
  const { has } = useAuth();
  const nav = NAV.filter((n) => !n.vault || canUseVault(has));
  const tabs = nav.filter((n) => !n.rail);
  return (
    <div className="min-h-dvh lg:pl-60 print:pl-0">
      <div className="app-backdrop" aria-hidden />
      <a href="#main" {...tip('Skip the menu and go to the page content')} className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      {/* Desktop rail */}
      <nav aria-label="Main" className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface lg:flex print:!hidden">
        <div className="border-b border-line px-4 pb-4 pt-5">
          <BrandLockup size={44} stacked />
        </div>
        <ul className="flex-1 space-y-1 px-3 pt-3">
          {nav.map(({ to, label, icon: Icon, end, tip: t }) => (
            <li key={to}>
              <NavLink to={to} end={end} {...tip(t)} className={({ isActive }) => clsx('flex min-h-tap items-center gap-3 rounded-control border-l-4 px-3 font-semibold',
                isActive ? 'border-accent bg-sky-soft text-ink' : 'border-transparent text-ink hover:bg-sky-soft/60')}>
                <Icon className="h-5 w-5" aria-hidden />{label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="px-3 pb-4">
          <NavLink to="/settings" {...tip('Sync, users and roles, barangay list, about and privacy, sign out')} className={({ isActive }) => clsx('flex min-h-tap items-center gap-3 rounded-control border-l-4 px-3 font-semibold',
            isActive ? 'border-accent bg-sky-soft text-ink' : 'border-transparent text-ink hover:bg-sky-soft/60')}>
            <Settings className="h-5 w-5" aria-hidden />Settings
          </NavLink>
        </div>
      </nav>

      <StatusBand />
      <main id="main" tabIndex={-1} className="outline-none"><Outlet /></main>

      {/* Phone tab bar: thumb reach */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-safe-b lg:hidden print:hidden">
        <ul className={clsx('grid', tabs.length === 6 ? 'grid-cols-6' : 'grid-cols-5')}>
          {tabs.map(({ to, label, icon: Icon, end, tip: t }) => (
            <li key={to}>
              <NavLink to={to} end={end} {...tip(t)} className={({ isActive }) => clsx('flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 font-data text-[0.8125rem] font-semibold',
                isActive ? 'text-ink' : 'text-muted')}>
                {({ isActive }) => (<>
                  <span className={clsx('flex h-7 w-11 items-center justify-center rounded-full', isActive && 'bg-sky-soft text-action ring-1 ring-accent')}><Icon className="h-5 w-5" aria-hidden /></span>
                  {label}
                </>)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
