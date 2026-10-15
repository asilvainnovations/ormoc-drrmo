import { NavLink, Link, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { BookOpen, ClipboardCheck, House, ListChecks, RadioTower, Settings, CloudOff, RefreshCw, AlertTriangle, Check, MonitorSmartphone } from 'lucide-react';
import { LEVEL_INFO } from '@/domain/eoc';
import { useActiveDeclaration, useEocStatus, useNow, usePending } from '@/lib/hooks';
import { useSyncState } from '@/lib/sync';
import { duration, fmtTime, relative } from '@/lib/time';
import { hoursBetween } from '@/domain/aa';
import { env } from '@/lib/env';
import { UpdatePrompt } from './UpdatePrompt';

const NAV = [
  { to: '/', label: 'Today', icon: House, end: true },
  { to: '/assess', label: 'Assess', icon: ClipboardCheck },
  { to: '/protocols', label: 'Protocols', icon: ListChecks },
  { to: '/eoc', label: 'EOC', icon: RadioTower },
  { to: '/library', label: 'Library', icon: BookOpen },
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
  if (env.demo) { syncText = 'Demo: data stays on this device'; syncShort = 'Demo'; SyncIcon = MonitorSmartphone; }
  else if (sync.status === 'offline') { syncText = pending.outbox ? `Offline, ${pending.outbox} waiting` : 'Offline'; syncShort = pending.outbox ? `Offline, ${pending.outbox}` : 'Offline'; SyncIcon = CloudOff; }
  else if (sync.status === 'syncing') { syncText = 'Syncing'; syncShort = 'Syncing'; SyncIcon = RefreshCw; }
  else if (pending.failed || pending.conflicts) { syncText = `${pending.failed + pending.conflicts} need attention`; syncShort = `${pending.failed + pending.conflicts} to check`; SyncIcon = AlertTriangle; }
  else if (pending.outbox) { syncText = `${pending.outbox} waiting`; syncShort = `${pending.outbox} waiting`; SyncIcon = RefreshCw; }
  else { syncText = sync.lastSyncAt ? `Synced ${relative(sync.lastSyncAt, now.getTime())}` : 'Not synced yet'; syncShort = sync.lastSyncAt ? 'Synced' : 'Not synced'; }
  const detail = level === 'white' ? 'Normal operations' : `${info.meaning} since ${fmtTime(activation?.started_at)}`;

  return (
    <div className={clsx('sticky top-0 z-30 pt-[env(safe-area-inset-top)]', tone)}>
      <div className="mx-auto flex max-w-page items-center gap-3 px-4 py-2 lg:px-8">
        <Link to="/eoc" className="min-w-0 flex-1 rounded-control">
          <p className="text-sm leading-5 sm:text-base">
            <span className="font-bold">EOC {info.name} level</span><span className="hidden sm:inline">, {detail.charAt(0).toLowerCase() + detail.slice(1)}</span>
          </p>
          <p className="text-xs leading-5 sm:hidden">{detail}</p>
          {decl && (
            <p className="text-xs font-semibold leading-5 sm:text-sm">
              {decl.status === 'declared' ? 'State of Imminent Disaster in force' : decl.status === 'requested' ? 'Declaration requested from RDRRMC VIII' : 'RDRRMC recommends a declaration'}
              {decl.status !== 'requested' && hoursBetween(now, decl.expected_impact_at) > 0 && `, impact in ${duration(hoursBetween(now, decl.expected_impact_at))}`}
            </p>
          )}
        </Link>
        <Link to="/settings/sync" aria-label={`Sync: ${syncText}`} className="inline-flex min-h-tap shrink-0 items-center gap-1.5 self-start rounded-control px-2 text-xs font-semibold sm:self-center sm:text-sm">
          <SyncIcon className={clsx('h-4 w-4', sync.status === 'syncing' && 'animate-spin')} aria-hidden />
          <span className="sm:hidden">{syncShort}</span><span className="hidden sm:inline">{syncText}</span>
        </Link>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <div className="min-h-dvh lg:pl-56">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      {/* Desktop rail */}
      <nav aria-label="Main" className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 py-5">
          <p className="text-lg font-bold leading-6">Ormoc DRRM Operations</p>
          <p className="text-sm text-muted">CDRRMO and EOC</p>
        </div>
        <ul className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => clsx('flex min-h-tap items-center gap-3 rounded-control px-3 font-semibold',
                isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-sunken')}>
                <Icon className="h-5 w-5" aria-hidden />{label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="px-3 pb-4">
          <NavLink to="/settings" className={({ isActive }) => clsx('flex min-h-tap items-center gap-3 rounded-control px-3 font-semibold',
            isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-sunken')}>
            <Settings className="h-5 w-5" aria-hidden />Settings
          </NavLink>
        </div>
      </nav>

      <StatusBand />
      <UpdatePrompt />
      <main id="main" tabIndex={-1} className="outline-none"><Outlet /></main>

      {/* Phone tab bar: thumb reach */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-safe-b lg:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => clsx('flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-xs font-semibold',
                isActive ? 'text-ink' : 'text-muted')}>
                {({ isActive }) => (<>
                  <span className={clsx('flex h-7 w-12 items-center justify-center rounded-full', isActive && 'bg-sunken')}><Icon className="h-5 w-5" aria-hidden /></span>
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
