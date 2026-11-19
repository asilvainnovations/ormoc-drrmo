import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Bell, CheckCheck, Info, OctagonAlert, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { tip } from '@/components/Tooltip';
import { relative } from '@/lib/time';
import { isUnread, type Notice, type NoticeTone } from '@/domain/notifications';
import { useNotifications } from './useNotifications';

export const TONE_ICON: Record<NoticeTone, typeof Info> = { bad: OctagonAlert, warn: AlertTriangle, info: Info };
export const TONE_TEXT: Record<NoticeTone, string> = { bad: 'text-bad', warn: 'text-warn', info: 'text-info' };

/** 1.29.0 (ADR-046): the bell in the status band. A count shows only unread notices; opening one marks it read. */
export function NotificationBell({ className }: { className?: string }) {
  const { notices, unread, prefs, markAllRead, markOneRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const go = (n: Notice) => { markOneRead(n); setOpen(false); nav(n.to); };
  const label = unread.length ? `Notifications: ${unread.length} unread` : 'Notifications: none unread';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} {...tip('Notifications: EOC level, declarations, sync problems, open requests, running protocols and overdue actions')}
          className={clsx('relative inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-control', className)}>
          <Bell className="h-5 w-5" aria-hidden />
          {unread.length > 0 && (
            <span aria-hidden className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 font-data text-[0.6875rem] font-bold leading-none text-on-strong ring-2 ring-surface">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1rem))] border-line bg-surface p-0 text-ink">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {unread.length > 0 && (
            <button type="button" onClick={markAllRead} {...tip('Mark every notice as read. A notice comes back when its situation changes')}
              className="inline-flex min-h-tap items-center gap-1 rounded-control px-2 text-sm font-semibold text-action hover:bg-sky-soft">
              <CheckCheck className="h-4 w-4" aria-hidden />Mark all read
            </button>
          )}
        </div>
        <Separator />
        {notices.length === 0
          ? <p className="px-4 py-6 text-sm text-muted">Nothing needs your attention.</p>
          : (
            <ScrollArea className="max-h-80">
              <ul>
                {notices.map((n) => {
                  const Icon = TONE_ICON[n.tone];
                  const fresh = isUnread(n, prefs);
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => go(n)} {...tip(`Open: ${n.title}`)}
                        className={clsx('flex w-full gap-3 px-4 py-3 text-left hover:bg-sky-soft/60', fresh && 'bg-sky-soft/40')}>
                        <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', TONE_TEXT[n.tone])} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className={clsx('block leading-5', fresh ? 'font-semibold' : 'font-normal')}>{n.title}{fresh && <span className="sr-only"> (unread)</span>}</span>
                          <span className="block text-sm text-muted">{n.body}</span>
                          {n.at && <span className="block font-data text-xs text-muted">{relative(n.at)}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        <Separator />
        <Link to="/settings/notifications" onClick={() => setOpen(false)} {...tip('Choose which notices appear, and see them all')}
          className="flex min-h-tap items-center gap-2 px-4 text-sm font-semibold text-action hover:bg-sky-soft/60">
          <Settings2 className="h-4 w-4" aria-hidden />Notification settings
        </Link>
      </PopoverContent>
    </Popover>
  );
}
