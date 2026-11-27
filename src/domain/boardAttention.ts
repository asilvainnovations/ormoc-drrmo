// "Needs attention now" for the EOC Board (1.25.0): the few things a duty officer should look at first, computed from the
// same figures the Board shows. Decision support only; nothing here triggers an action.

export interface AttentionInput {
  activeEvent: boolean;
  silentPriority: string[];            // barangay names, highest DDRiVE priority first, that have not reported
  lifeSafetyAwaiting: number;          // life-safety requests still at "requested"
  campsOverCapacity: number;
  /** 1.33.0: children unaccompanied or separated, persons apart from their carer, families not together (ECHO). */
  familyUnity?: { children: number; carers: number; families: number };
  evacCountsMissing: number;           // barangays evacuating or affected without counts
  nextSitrep: { time: string; minutes: number } | null;
}
/** 1.34.0 (B = MAP): who is expected to act and what response closes the item, so the board prompts an action. */
export interface AttentionItem { id: string; tone: 'bad' | 'warn' | 'info'; text: string; to: string; who?: string; response?: string }
const ACT: Record<string, { who: string; response: string }> = {
  ls: { who: 'EOC Manager, with Logistics', response: 'Approve, partly approve or refuse, with the reason, then track delivery.' },
  silent: { who: 'EOC operations staff', response: 'Reach the BDRRMC; log the report, or "no contact" with the time tried.' },
  camps: { who: 'CCCM lead (CSWDO), with the camp manager', response: 'Open an overflow site or transfer families together; log the decision.' },
  family: { who: 'CSWDO protection desk', response: 'Reunite, or record the care arrangement; keep the family or carer together.' },
  counts: { who: 'Barangay focal person, through EOC staff', response: 'Enter families and persons, or mark them as not reported.' },
  sitrep: { who: 'Planning Section', response: 'Submit the SitRep to DILG VIII by the cut-off.' },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function attentionItems(i: AttentionInput): AttentionItem[] {
  const out: AttentionItem[] = [];
  if (i.lifeSafetyAwaiting > 0) out.push({ id: 'ls', tone: 'bad', text: `${plural(i.lifeSafetyAwaiting, 'life-safety request')} waiting for a decision`, to: '/eoc/requests' });
  if (i.activeEvent && i.silentPriority.length > 0) {
    const shown = i.silentPriority.slice(0, 3).join(', ');
    out.push({ id: 'silent', tone: 'warn', text: `${plural(i.silentPriority.length, 'high-risk barangay', 'high-risk barangays')} not yet reporting: ${shown}${i.silentPriority.length > 3 ? '…' : ''}`, to: '/eoc/barangays' });
  }
  if (i.campsOverCapacity > 0) out.push({ id: 'camps', tone: 'bad', text: `${plural(i.campsOverCapacity, 'evacuation centre')} over capacity`, to: '/tools/echo/camps' });
  const fu = i.familyUnity;
  if (fu && fu.children + fu.carers + fu.families > 0) {
    const parts = [fu.children && plural(fu.children, 'child', 'children') + ' unaccompanied or separated', fu.carers && plural(fu.carers, 'person') + ' apart from their carer',
      fu.families && plural(fu.families, 'family', 'families') + ' not housed together'].filter(Boolean);
    out.push({ id: 'family', tone: 'bad', text: `Families together: ${parts.join(', ')}`, to: '/tools/echo/dashboard' });
  }
  if (i.evacCountsMissing > 0) out.push({ id: 'counts', tone: 'warn', text: `${plural(i.evacCountsMissing, 'barangay')} reporting without evacuee counts`, to: '/eoc/barangays' });
  if (i.activeEvent && i.nextSitrep && i.nextSitrep.minutes <= 120) out.push({ id: 'sitrep', tone: 'info', text: `SitRep to the Province due ${i.nextSitrep.time}`, to: '/eoc/sitreps' });
  return out.map((a) => ({ ...a, ...ACT[a.id] }));
}

/** The next SitRep submission time (HH:MM, Manila) after `now`, from the level's am/pm cut-offs. */
export function nextSubmission(cutoff: { submission_am: string; submission_pm: string } | undefined, now = new Date()): { time: string; minutes: number } | null {
  if (!cutoff) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24; const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const nowMin = h * 60 + m;
  const mins = [cutoff.submission_am, cutoff.submission_pm].map((t) => { const [hh, mm] = t.split(':').map(Number); return (hh ?? 0) * 60 + (mm ?? 0); });
  const next = mins.find((x) => x >= nowMin);
  const target = next ?? (mins[0]! + 24 * 60);
  const hh = Math.floor((target % (24 * 60)) / 60); const mm = target % 60;
  return { time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, minutes: target - nowMin };
}
