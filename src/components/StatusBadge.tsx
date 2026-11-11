// 1.14: one colour code for the approval status of Manual text, workflows, protocols and forms (consistent-ui sweep).
// Draft = ochre (being written), For validation = blue (with the owning office or the CDRRMO Head), Approved = green.
// Superseded and retired are grey; returned is red. Colour always comes with the word (design-system.md section 3).
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export type ApprovalStatus = 'draft' | 'in_review' | 'approved' | 'superseded' | 'rejected' | 'retired';
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info';

export const APPROVAL: Record<ApprovalStatus, { label: string; tone: Tone; meaning: string }> = {
  draft: { label: 'Draft', tone: 'warn', meaning: 'Being written. Not yet for use.' },
  in_review: { label: 'For validation', tone: 'info', meaning: 'With the owning office or the CDRRMO Head for checking.' },
  approved: { label: 'Approved', tone: 'ok', meaning: 'Approved by the CDRRMO Head; the controlled version in force.' },
  rejected: { label: 'Returned', tone: 'bad', meaning: 'Sent back with comments for revision.' },
  superseded: { label: 'Superseded', tone: 'neutral', meaning: 'Replaced by a later version; kept for the record.' },
  retired: { label: 'Retired', tone: 'neutral', meaning: 'No longer in use; kept for the record.' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = APPROVAL[status as ApprovalStatus] ?? { label: status, tone: 'neutral' as Tone };
  return <Badge tone={s.tone} className={className}>{s.label}</Badge>;
}

/** The colour key, shown once at the top of a list that uses StatusBadge. A note, not an announcement. */
export function StatusLegend({ subject }: { subject: string }) {
  return (
    <Alert variant="info" role="note" className="mb-6">
      <Info className="h-4 w-4" aria-hidden />
      <AlertTitle>Status colours</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
          {(['draft', 'in_review', 'approved'] as const).map((k) => (
            <li key={k} className="flex items-center gap-2"><StatusBadge status={k} /><span className="text-sm">{APPROVAL[k].meaning}</span></li>
          ))}
        </ul>
        <p className="mt-2 text-sm">{subject} stays a draft until the owning office validates it and the CDRRMO Head approves it. A written procedure is not proof that it is in use.</p>
      </AlertDescription>
    </Alert>
  );
}
