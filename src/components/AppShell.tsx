import { NavLink, Link, Outlet } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';
import clsx from 'clsx';
import { BookOpen, ClipboardCheck, FolderLock, House, ListChecks, RadioTower, Settings, CloudOff, RefreshCw, AlertTriangle, Check, Wrench, Scale, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { LEVEL_INFO } from '@/domain/eoc';
import { useActiveDeclaration, useEocStatus, useNow, usePending } from '@/lib/hooks';
import { useSyncState } from '@/lib/sync';
import { duration, fmtTime, relative } from '@/lib/time';
import { hoursBetween } from '@/domain/aa';
import { useAuth } from '@/lib/auth';
// 1.17 (ADR-031): nav labels translate to Ormocanon (Bisaya) or Filipino; tooltips stay English so help text stays exact.
import { useT, type StringKey } from '@/lib/i18n';
import { canUseVault } from '@/features/vault/access';
import { tip } from './Tooltip';
import { CommandPalette } from './CommandPalette';
import { ThemeToggle } from './ThemeToggle';
import { BrandLockup, Seal } from './Brand';
import { NotificationBell } from '@/features/notifications/NotificationBell';

type NavItem = {
  to: string; k: StringKey; label: string; icon: LucideIcon; end?: boolean; tip: string;
  rail?: boolean; vault?: boolean;
  sub?: { to: string; k: StringKey; label: string; icon: LucideIcon; tip: string }[];
};
const NAV: NavItem[] = [
  { to: '/today', k: 'nav.today', label: 'Today', icon: House, end: true, tip: 'Your day: alerts, quick actions, running protocols and latest log' },
  // Validation follows Today in the primary desktop navigation; it remains rail-only on phones to protect thumb navigation.
  { to: '/governance', k: 'nav.governance', label: 'Validation', icon: Scale, tip: 'Review register, outstanding decisions and the validation workshop', rail: true },
  { to: '/assess', k: 'nav.assess', label: 'Assess', icon: ClipboardCheck, tip: 'Institutional Assessment Tool: score indicators with evidence and plan improvements' },
  // 1.29.0 (ADR-046): "Protocols" becomes "DRRM" — workflows, protocols and forms by thematic area.
  { to: '/drrm', k: 'nav.protocols', label: 'DRRM', icon: ListChecks, tip: 'DRRM workflows, protocols and forms by thematic area, to run live or as drills' },
  { to: '/eoc', k: 'nav.eoc', label: 'EOC', icon: RadioTower, tip: 'Emergency Operations Center: level, logbook, SitReps, requests and anticipatory action' },
  { to: '/library', k: 'nav.library', label: 'Library', icon: BookOpen, tip: 'The Manual of Operations and EOC Manual, with traceability to the indicators' },
  { to: '/vault', k: 'nav.vault', label: 'Vault', icon: FolderLock, tip: 'Document Vault: laws, guidelines and documents for Document Review', vault: true },
  // Desktop rail only; on phones the Today screen links to Tools (the tab bar holds six).
  { to: '/tools', k: 'nav.tools', label: 'Tools', icon: Wrench, tip: 'ICS exercises, continuity planning, Gawad KALASAG readiness, HazardHunterPH, GeoAnalyticsPH, Zoom Earth and DDRiVE-M', rail: true },
];

/** 1.29.0 (ADR-046): the desktop rail folds to icons to give the page more width. The choice stays on this device;
 *  Ctrl+B (Cmd+B on a Mac) toggles it. Storage can be unavailable, so reads and writes are guarded. */
const RAIL_KEY = 'mode.rail.collapsed';
function useRailCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => { try { return window.localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; } });
  const toggle = useCallback(() => setCollapsed((c) => {
    try { window.localStorage.setItem(RAIL_KEY, c ? '0' : '1'); } catch { /* session only */ }
    return !c;
  }), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
  return [collapsed, toggle];
}

/** The signature element: activation level, any declaration in force, and data freshness. */
export function StatusBand() {
  const { level, activation } = useEocStatus();
  const decl = useActiveDeclaration();
  const sync = useSyncState();
  const { userId } = useAuth();
  const pending = usePending(userId);
  const now = useNow();
  const info = LEVEL_INFO[level];
  const tone = level === 'white' ? 'bg-lvl-white text-lvl-white-ink' : level === 'blue' ? 'bg-lvl-blue text-on-level' : 'bg-lvl-red text-on-level';

  // Full text on wider screens; a short form on phones so nothing is truncated.
  let syncText: string; let syncShort: string; let SyncIcon = Check;
  if (sync.status === 'offline') { syncText = pending.outbox ? `Offline, ${pending.outbox} waiting` : 'Offline'; syncShort = pending.outbox ? `Offline, ${pending.outbox}` : 'Offline'; SyncIcon = CloudOff; }
  // Online, but the server could not take some items yet; they retry on their own (1.7).
  else if (sync.status === 'retrying' && pending.outbox) { syncText = `Server problem, ${pending.outbox} waiting`; syncShort = `Retrying ${pending.outbox}`; SyncIcon = AlertTriangle; }
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
        <CommandPalette className="shrink-0 self-start text-ink sm:self-center lg:w-56" compact={false} />
        <NotificationBell className="self-start sm:self-center" />
        <Link to="/settings/sync" aria-label={`Sync: ${syncText}`} {...tip('Sync status. Open to see what is waiting to send or needs your attention')} className="inline-flex min-h-tap shrink-0 items-center gap-1.5 self-start rounded-control px-2 font-data text-sm font-semibold sm:self-center">
          <SyncIcon className={clsx('h-4 w-4', sync.status === 'syncing' && 'animate-spin')} aria-hidden />
          <span className="sm:hidden">{syncShort}</span><span className="hidden sm:inline">{syncText}</span>
        </Link>
      </div>
    </div>
  );
}

export function AppShell() {
  const tNav = useT();
  const { has } = useAuth();
  const nav = NAV.filter((n) => !n.vault || canUseVault(has));
  const tabs = nav.filter((n) => !n.rail);
  const [collapsed, toggleRail] = useRailCollapsed();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <div className={clsx('min-h-dvh print:pl-0 lg:transition-[padding] lg:duration-200 motion-reduce:transition-none', collapsed ? 'lg:pl-16' : 'lg:pl-60')} data-rail={collapsed ? 'collapsed' : 'expanded'}>
      <div className="app-backdrop" aria-hidden />
      <a href="#main" {...tip('Skip the menu and go to the page content')} className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      {/* Desktop rail; folds to icons (1.29.0) */}
      <nav aria-label="Main" className={clsx('fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface lg:flex print:!hidden lg:transition-[width] lg:duration-200 motion-reduce:transition-none',
        collapsed ? 'w-16' : 'w-60')}>
        <div className={clsx('border-b border-line', collapsed ? 'flex flex-col items-center gap-2 px-2 pb-3 pt-4' : 'relative px-4 pb-4 pt-5')}>
          {collapsed ? <Seal kind="cdrrmo" size={36} /> : <BrandLockup size={44} stacked product />}
          <button type="button" onClick={toggleRail} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand the side panel' : 'Collapse the side panel'}
            {...tip(collapsed ? 'Expand the side panel to show the labels (Ctrl+B)' : 'Collapse the side panel to icons and widen the page (Ctrl+B)')}
            className={clsx('inline-flex min-h-tap min-w-tap items-center justify-center rounded-control text-muted hover:bg-sky-soft/60 hover:text-ink', !collapsed && 'absolute right-2 top-2')}>
            <ToggleIcon className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <ul className={clsx('flex-1 space-y-1 overflow-y-auto pt-3', collapsed ? 'px-2' : 'px-3')}>
          {nav.map(({ to, k, icon: Icon, end, tip: t, sub }) => (
            <li key={to}>
              <NavLink to={to} end={end} {...tip(collapsed ? `${tNav(k)}: ${t}` : t)} aria-label={collapsed ? tNav(k) : undefined}
                className={({ isActive }) => clsx('flex min-h-tap items-center gap-3 rounded-control border-l-4 font-semibold',
                  collapsed ? 'justify-center px-0' : 'px-3',
                  isActive ? 'border-accent bg-sky-soft text-ink' : 'border-transparent text-ink hover:bg-sky-soft/60')}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden />{!collapsed && tNav(k)}
              </NavLink>
              {sub && (
                <ul className="mt-1 space-y-1">
                  {sub.map((c) => (
                    <li key={c.to}>
                      <NavLink to={c.to} {...tip(collapsed ? `${tNav(c.k)}: ${c.tip}` : c.tip)} aria-label={collapsed ? tNav(c.k) : undefined}
                        className={({ isActive }) => clsx('flex min-h-tap items-center gap-3 rounded-control border-l-4 text-sm font-semibold',
                          collapsed ? 'justify-center px-0' : 'pl-9 pr-3',
                          isActive ? 'border-accent bg-sky-soft text-ink' : 'border-transparent text-muted hover:bg-sky-soft/60 hover:text-ink')}>
                        <c.icon className="h-4 w-4 shrink-0" aria-hidden />{!collapsed && tNav(c.k)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <div className={clsx('space-y-1 pb-4', collapsed ? 'px-2' : 'px-3')}>
          <ThemeToggle withLabel={!collapsed} className={clsx('w-full', collapsed ? 'justify-center px-0' : 'justify-start px-3')} />
          <NavLink to="/settings" {...tip('Sync, notifications, users and roles, barangay list, about and privacy, sign out')} aria-label={collapsed ? 'Settings' : undefined}
            className={({ isActive }) => clsx('flex min-h-tap items-center gap-3 rounded-control border-l-4 font-semibold',
              collapsed ? 'justify-center px-0' : 'px-3',
              isActive ? 'border-accent bg-sky-soft text-ink' : 'border-transparent text-ink hover:bg-sky-soft/60')}>
            <Settings className="h-5 w-5 shrink-0" aria-hidden />{!collapsed && 'Settings'}
          </NavLink>
        </div>
      </nav>

      <StatusBand />
      <main id="main" tabIndex={-1} className="outline-none"><ScreenErrorBoundary><Outlet /></ScreenErrorBoundary></main>

      {/* Phone tab bar: thumb reach */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-safe-b lg:hidden print:hidden">
        <ul className={clsx('grid', tabs.length === 6 ? 'grid-cols-6' : 'grid-cols-5')}>
          {tabs.map(({ to, k, icon: Icon, end, tip: t }) => (
            <li key={to}>
              <NavLink to={to} end={end} {...tip(t)} className={({ isActive }) => clsx('flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 font-data text-[0.8125rem] font-semibold',
                isActive ? 'text-ink' : 'text-muted')}>
                {({ isActive }) => (<>
                  <span className={clsx('flex h-7 w-11 items-center justify-center rounded-full', isActive && 'bg-sky-soft text-action ring-1 ring-accent')}><Icon className="h-5 w-5" aria-hidden /></span>
                  {tNav(k)}
                </>)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
