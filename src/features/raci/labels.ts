// RACI duty vocabulary and colours (ADR-033). The tokens are reserved for this board
// (src/styles/tokens.css); Tailwind classes are static strings so the purge keeps them.
import type { RaciDuty } from '@/types';

export const DUTY_ORDER: RaciDuty[] = ['R', 'A', 'C', 'I'];

export const DUTIES: Record<RaciDuty, { label: string; definition: string; chip: string }> = {
  R: {
    label: 'Responsible',
    definition: 'Performs the work and produces the required output.',
    chip: 'bg-raci-r text-raci-on-strong',
  },
  A: {
    label: 'Accountable',
    definition: 'Owns the result and approves the output or decision. Normally only one A per activity.',
    chip: 'bg-raci-a text-raci-on-strong',
  },
  C: {
    label: 'Consulted',
    definition: 'Provides technical advice or is consulted before action.',
    chip: 'bg-raci-c text-raci-on-strong',
  },
  I: {
    label: 'Informed',
    definition: 'Receives relevant information on the decision or outcome.',
    chip: 'bg-raci-i text-raci-i-ink border border-line',
  },
};

/** Shown on the board; Annex 1-F's own caveat. The official text governs. */
export const RACI_CAVEAT =
  'The RACI matrix assigns work; it does not create legal authority. Where law assigns a decision to a specific official or body, that statutory authority prevails (MOO Annex 1-F). The official text governs.';
