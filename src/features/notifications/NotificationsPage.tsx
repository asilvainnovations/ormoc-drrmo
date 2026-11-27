import { BehavioralDesignGuide } from '@/components/BehavioralDesignGuide';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CheckCheck, RotateCcw } from 'lucide-react';
import { Button, PageHeader, Section } from '@/components/ui';
import GlassCard from '@/components/ui/GlassCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Badge as KitBadge } from '@/components/ui/badge';
import { useToast } from '@/components/Toast';
import { tip } from '@/components/Tooltip';
import { relative } from '@/lib/time';
import { isUnread, NOTICE_KINDS, type NoticeKind } from '@/domain/notifications';
import { setNoticePrefs, useNotifications } from './useNotifications';
import { TONE_ICON } from './NotificationBell';

type FormValues = Record<NoticeKind, boolean>;
const VARIANT = { bad: 'destructive', warn: 'warning', info: 'info' } as const;

/** Settings → Notifications (1.29.0, ADR-046): the full list, and which kinds of notice appear on this device. */
export function NotificationsPage() {
  const { all, notices, unread, prefs, markAllRead, markOneRead } = useNotifications();
  const toast = useToast();
  const nav = useNavigate();
  const values = Object.fromEntries(NOTICE_KINDS.map(({ kind }) => [kind, !prefs.muted[kind]])) as FormValues;
  const form = useForm<FormValues>({ defaultValues: values });
  useEffect(() => { form.reset(values); }, [JSON.stringify(values)]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (v: FormValues) => {
    const muted = Object.fromEntries(NOTICE_KINDS.map(({ kind }) => [kind, !v[kind]])) as Partial<Record<NoticeKind, boolean>>;
    setNoticePrefs({ ...prefs, muted });
    toast('Notification choices saved on this device');
  };
  const hidden = all.length - notices.length;

  return (
    <div className="page">
      <BehavioralDesignGuide area="Notifications and follow-through" motivation="Timely cues help the responsible office respond to changed conditions, deadlines, evidence requests and operational exceptions." ability="Open the linked record, read the requested action and use the destination workflow to respond. Read marks and device preferences are not completion evidence." prompt="Act when the notice points to an overdue action, sync failure, open request or active protocol. Record the response in the source workflow, not merely by dismissing the notice." actionHref="/settings/notifications" actionLabel="Review notices" boundary="Notifications are prompts, not decisions or proof of action. The source record remains authoritative for status, owner, evidence and closure." />
      <PageHeader title="Notifications" back="/settings"
        subtitle="Built from the records on this device: EOC level, declarations, sync problems, open requests, running protocols and overdue actions. Choices and read marks stay on this device." />

      <Section title={`Current Notices (${notices.length})`}
        action={unread.length > 0 && <Button tip="Mark every notice as read. A notice comes back when its situation changes" variant="secondary" icon={CheckCheck} onClick={markAllRead}>Mark all read</Button>}>
        {notices.length === 0 ? (
          <Alert variant="success">
            <CheckCheck className="h-4 w-4" aria-hidden />
            <AlertTitle>Nothing needs your attention</AlertTitle>
            <AlertDescription>{hidden > 0 ? `${hidden} notice${hidden === 1 ? ' is' : 's are'} turned off below.` : 'New notices appear here and on the bell in the status band.'}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {notices.map((n) => {
              const Icon = TONE_ICON[n.tone];
              const fresh = isUnread(n, prefs);
              return (
                <Alert key={n.id} variant={VARIANT[n.tone]}>
                  <Icon className="h-4 w-4" aria-hidden />
                  <AlertTitle className="flex flex-wrap items-center gap-2">
                    {n.title}
                    {fresh && <KitBadge variant="secondary" size="sm">Unread</KitBadge>}
                  </AlertTitle>
                  <AlertDescription>
                    <p>{n.body}{n.at && <span className="font-data text-muted"> · {relative(n.at)}</span>}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button tip={`Open the page for: ${n.title}`} onClick={() => { markOneRead(n); nav(n.to); }}>Open</Button>
                      {fresh && <Button tip="Mark this notice as read" variant="quiet" onClick={() => markOneRead(n)}>Mark read</Button>}
                    </div>
                  </AlertDescription>
                </Alert>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="What to Notify">
        <GlassCard hover={false} className="p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(save)} className="space-y-1">
              {NOTICE_KINDS.map(({ kind, label, about }) => (
                <FormField key={kind} control={form.control} name={kind} render={({ field }) => (
                  <FormItem className="flex min-h-tap items-center justify-between gap-4 rounded-control px-2 py-2 hover:bg-sky-soft/40">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-semibold text-ink">{label}</FormLabel>
                      <FormDescription className="text-sm text-muted">{about}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={`Notify: ${label}`} {...tip(`Turn ${label} notices on or off on this device`)} />
                    </FormControl>
                  </FormItem>
                )} />
              ))}
              <div className="flex flex-wrap gap-2 pt-3">
                <Button tip="Save these choices on this device" type="submit" disabled={!form.formState.isDirty}>Save choices</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button tip="Show every current notice as unread again" variant="quiet" icon={RotateCcw} type="button">Reset read marks</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset read marks?</AlertDialogTitle>
                      <AlertDialogDescription>Every current notice shows as unread again on this device. Your on/off choices stay as they are.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel {...tip('Keep the read marks')}>Cancel</AlertDialogCancel>
                      <AlertDialogAction {...tip('Clear the read marks on this device')} onClick={() => { setNoticePrefs({ ...prefs, read: {} }); toast('Read marks reset'); }}>Reset</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </Form>
        </GlassCard>
      </Section>
    </div>
  );
}
