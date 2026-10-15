import type { ProtocolRunStep } from '@/types';

export function stepProblem(s: Pick<ProtocolRunStep, 'requires_note'>, status: ProtocolRunStep['status'], note: string): string | null {
  if (status === 'pending') return null;
  if (status === 'skipped' && !note.trim()) return 'Say why the step was skipped.';
  if (s.requires_note && !note.trim()) return 'This step needs a note: record what was done or found.';
  return null;
}

export function completionProblem(steps: ProtocolRunStep[]): string | null {
  const open = steps.filter((s) => s.status === 'pending' || (s.is_critical && s.status !== 'done'));
  if (open.length === 0) return null;
  return `${open.length} step${open.length === 1 ? '' : 's'} still open. Critical steps must be done before completing.`;
}

export type DueState = 'none' | 'upcoming' | 'due_soon' | 'overdue';
export function dueState(step: Pick<ProtocolRunStep, 'due_at' | 'status'>, now = new Date()): DueState {
  if (!step.due_at || step.status !== 'pending') return 'none';
  const ms = new Date(step.due_at).getTime() - now.getTime();
  if (ms < 0) return 'overdue';
  if (ms < 10 * 60_000) return 'due_soon';
  return 'upcoming';
}
