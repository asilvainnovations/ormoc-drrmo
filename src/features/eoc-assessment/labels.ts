// EOC capability assessment vocabulary and colours (ADR-035). Chips reuse the platform status
// tones (tokens.css): Met green, Partially met amber, Largely unmet orange (accent-soft/accent-ink),
// Not met red, No direct IAT indicator grey. Colour always comes with the word.
import type { EocAssessmentRunStatus, EocAssessmentSite, EocAssessmentStatus, Role } from '@/types';

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
  not_applicable: {
    label: 'Not applicable',
    definition: 'Recorded on site as not applying to this EOC; the reason is in Gap / remarks.',
    chip: 'bg-sunken text-ink',
  },
  not_assessed: {
    label: 'Not assessed',
    definition: 'No answer yet for this site.',
    chip: 'bg-sunken text-muted',
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
  'The baseline answers are PRE-FILLED from the IAT v1-7 crosswalk: each item took the weakest mapped B_EOC score (3 or 4 = Met, 2 = Partially met, 1 = Largely unmet, 0 = Not met; "No direct IAT indicator" where none maps). That is not an observation. Confirm or change each answer on site: saving makes it observed, only observed answers can be validated, and a run is validated only when none is still pre-filled. Nothing here changes an IAT score, and DDRiVE (EOC → Risk) stays the risk-intelligence source.';

export const SITE_LABEL: Record<EocAssessmentSite, string> = { primary: 'Primary EOC', alternate: 'Alternate EOC' };

/** Controlled vocabulary for tool links (SOP / Protocol / Workflow / Form records). */
export const TOOL_LINK_HINT = 'Link the SOP, Protocol, Workflow or Form record that closes the gap — e.g. code PR-EOC-ACTIVATE, title EOC Activation.';
