// Controlled vocabulary labels for Manual Governance (ADR-043). English UI strings.
import type {
  AuthorityStatus,
  DecisionStatus,
  GovernanceDisposition,
  GovernancePriority,
  ReviewStatus,
  ValidationStatusGov,
  WorkshopStatus,
} from '@/types';

export const PRIORITY: Record<GovernancePriority, { label: string; chip: string; tip: string }> = {
  critical_urgent: {
    label: 'Critical & urgent',
    chip: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
    tip: 'Legal authority, life-safety, pending national rules or explicit workshop decisions',
  },
  important: {
    label: 'Important',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
    tip: 'Institutional or operational issues that block validation if left open',
  },
  standard: {
    label: 'Standard review',
    chip: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
    tip: 'Routine review item; schedule within the workshop window',
  },
};

export const REVIEW_STATUS: Record<ReviewStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  pending_evidence: 'Pending evidence',
  pending_decision: 'Pending decision',
  closed: 'Closed',
  deferred: 'Deferred',
};

export const VALIDATION_STATUS: Record<ValidationStatusGov, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  validated: 'Validated',
  rejected: 'Rejected',
};

export const DECISION_STATUS: Record<DecisionStatus, string> = {
  for_decision: 'For decision',
  in_progress: 'In progress',
  decided: 'Decided',
  deferred: 'Deferred',
  withdrawn: 'Withdrawn',
};

export const WORKSHOP_STATUS: Record<WorkshopStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const AUTHORITY_STATUS: Record<AuthorityStatus, string> = {
  confirmed: 'Authority confirmed',
  to_be_confirmed: 'Authority to be confirmed',
};

export const DISPOSITION: Record<GovernanceDisposition, string> = {
  accepted: 'Accepted',
  revised: 'Revised',
  rejected: 'Rejected',
  deferred: 'Deferred',
  superseded: 'Superseded',
};

export const GOVERNANCE_CAVEAT =
  'Assignments and lead offices in this register are proposed for workshop planning. Legal authority and actual office designations must be verified. The official Manual text governs.';
