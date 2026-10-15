// EOC rules. Mirrors supabase/migrations/20261015000400_eoc.sql.
import type { Activation, EocLevel, RequestStatus, Role } from '@/types';

export const LEVEL_INFO: Record<EocLevel, { name: string; meaning: string }> = {
  white: { name: 'White', meaning: 'Normal operations' },
  blue: { name: 'Blue', meaning: 'Alert: partial activation' },
  red: { name: 'Red', meaning: 'Full activation' },
};

export const REQUEST_NEXT: Record<RequestStatus, RequestStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['mobilized', 'rejected'],
  mobilized: ['delivered'],
  delivered: ['demobilized'],
  demobilized: [],
  rejected: [],
};
export const REQUEST_VERB: Record<RequestStatus, string> = {
  requested: 'Request', approved: 'Approve', mobilized: 'Mark mobilized', delivered: 'Mark delivered',
  demobilized: 'Demobilize', rejected: 'Reject',
};

export const canChangeLevel = (roles: Role[]) => roles.some((r) => r === 'eoc_manager' || r === 'cdrrmo_head' || r === 'admin');
export const canDecideRequest = canChangeLevel;
export const canOperate = (roles: Role[]) =>
  roles.some((r) => ['duty_officer', 'eoc_staff', 'eoc_manager', 'cdrrmo_head', 'admin'].includes(r));

export function currentLevel(activations: Activation[]): { level: EocLevel; activation: Activation | null } {
  const open = activations.find((a) => !a.ended_at) ?? null;
  return { level: open?.level ?? 'white', activation: open };
}

export function levelChangeProblem(current: EocLevel, next: EocLevel, reason: string): string | null {
  if (current === next) return `The EOC is already at ${LEVEL_INFO[next].name} level.`;
  if (!reason.trim()) return 'Give the reason for the level change.';
  return null;
}
