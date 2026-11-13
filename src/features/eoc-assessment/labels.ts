// EOC capability assessment vocabulary and colours (ADR-035). Chips reuse the platform status
// tones (tokens.css): Met green, Partially met amber, Largely unmet orange (accent-soft/accent-ink),
// Not met red, No direct IAT indicator grey. Colour always comes with the word.
import type { EocAssessmentRunStatus, EocAssessmentStatus, Role } from '@/types';

export const STATUS: Record<EocAssessmentStatus, { label: string; definition: string; chip: string }> = {
  met: {
    label: 'Met',
    definition: 'The weakest mapped IAT indicator scores 3 or 4.',
    chip: 'bg-ok-soft text-ok',
  },
  partially_met: {
    label: 'Partially met',
    definition: 'The weakest mapped IAT indicator scores 2.',
    chip: 'bg-warn-soft text-warn',
  },
  largely_unmet: {
    label: 'Largely unmet',
    definition: 'The weakest mapped IAT indicator scores 1.',
    chip: 'bg-accent-soft text-accent-ink',
  },
  not_met: {
    label: 'Not met',
    definition: 'The weakest mapped IAT indicator scores 0.',
    chip: 'bg-bad-soft text-bad',
  },
  no_direct_indicator: {
    label: 'No direct IAT indicator',
    definition: 'This checklist item maps to no B_EOC indicator, so no score derives a status.',
    chip: 'bg-sunken text-muted',
  },
};

export const RUN_STATUS: Record<EocAssessmentRunStatus, { label: string; chip: string; definition: string }> = {
  draft: { label: 'Draft', chip: 'bg-warn-soft text-warn', definition: 'Open for the assessment team to edit. The CDRRMO Head validates it.' },
  validated: { label: 'Validated', chip: 'bg-ok-soft text-ok', definition: 'Validated by the CDRRMO Head. Locked for the record; open a new run to reassess.' },
};

/** Roles that record and edit checklist responses (RLS in migration 20261114003000 enforces this). */
export const WRITE_ROLES: Role[] = ['assessor', 'validator', 'eoc_manager', 'eoc_staff', 'cdrrmo_head', 'admin'];
/** Roles that validate a run (RLS guard app.guard_eoc_assessment enforces this, ADR-006). */
export const VALIDATE_ROLES: Role[] = ['cdrrmo_head', 'admin'];

/** The derivation rule, shown once at the top of the board. */
export const DERIVATION_NOTE =
  'Each item takes its status from the weakest mapped IAT B_EOC indicator score: 3 or 4 = Met, 2 = Partially met, 1 = Largely unmet, 0 = Not met. Items with no mapped indicator show "No direct IAT indicator". The module never re-scores risk — DDRiVE (EOC → Risk) stays the risk-intelligence source.';

/** Controlled vocabulary for tool links (SOP / Protocol / Workflow / Form records). */
export const TOOL_LINK_HINT = 'Link the SOP, Protocol, Workflow or Form record that closes the gap — e.g. code PR-EOC-ACTIVATE, title EOC Activation.';
