import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FlowDiagram } from './ProtocolsPage';
import type { FormTemplate, ProtocolStep } from '@/types';

const step = (o: Partial<ProtocolStep>): ProtocolStep => ({
  id: o.seq ? `s${o.seq}` : 's', template_id: 't', seq: 1, version: 1,
  instruction: 'Do the thing', is_critical: false, requires_note: false, due_offset_minutes: null, ...o,
} as ProtocolStep);

const form = (code: string, title: string): FormTemplate => ({
  id: code, code, title, purpose: null, document_id: null, version: 1,
  schema: { fields: [{ key: 'a', label: 'A', type: 'text' }] }, status: 'approved', rev: 1,
});

const renderFlow = (steps: ProtocolStep[], forms = new Map<string, FormTemplate>()) =>
  render(<MemoryRouter><FlowDiagram steps={steps} forms={forms} /></MemoryRouter>);

describe('FlowDiagram (1.12)', () => {
  it('renders the summary line and one node per step in order', () => {
    renderFlow([step({ seq: 1 }), step({ seq: 2, instruction: 'Second' }), step({ seq: 3 })]);
    expect(screen.getByText(/3 steps · 0 critical · 0 recorded on a Manual form/)).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    const nodes = screen.getAllByText(/\b[123]\b/);
    expect(nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('marks critical steps and shows due targets and note requirements', () => {
    renderFlow([step({ seq: 1, is_critical: true, requires_note: true, due_offset_minutes: 30 })]);
    expect(screen.getByText('Critical')).toBeTruthy();
    expect(screen.getByText('Note required')).toBeTruthy();
    expect(screen.getByText('Target: +30 min')).toBeTruthy();
  });

  it('links a Manual-form step to the Forms page and shows the one-tap record otherwise', () => {
    const steps = [step({ seq: 1, form_code: 'FORM-3-01' }), step({ seq: 2, form_code: 'STEP-RECORD' })];
    renderFlow(steps, new Map([['FORM-3-01', form('FORM-3-01', 'Damage report')]]));
    const link = screen.getByRole('link', { name: /FORM-3-01 Damage report/ });
    expect(link.getAttribute('href')).toContain('/drrm/forms?open=FORM-3-01');
    expect(link.textContent).toContain('1 field');
    expect(screen.getByText(/One-tap step record — no separate form/)).toBeTruthy();
  });

  it('shows an empty state when the workflow has no steps', () => {
    renderFlow([]);
    expect(screen.getByText('No steps yet')).toBeTruthy();
  });
});
