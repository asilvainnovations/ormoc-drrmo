import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ userId: 'u1', profile: { full_name: 'Duty Officer Test' }, has: () => true }) }));
vi.mock('@/lib/hooks', () => ({ useOnline: () => true }));

const { IcsPage } = await import('./ics/IcsPage');
const { ToolsHome, EXTERNAL_TOOLS } = await import('./ToolsHome');

describe('Tools hub', () => {
  it('links the four external services in new tabs, safely', () => {
    render(<MemoryRouter><ToolsHome /></MemoryRouter>);
    for (const t of EXTERNAL_TOOLS) {
      const a = screen.getByText(t.name).closest('a')!;
      expect(a.getAttribute('href')).toBe(t.url);
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
    expect(EXTERNAL_TOOLS.map((t) => new URL(t.url).host)).toEqual(['hazardhunter.georisk.gov.ph', 'geoanalytics.georisk.gov.ph', 'zoom.earth', 'asilvainnovations.github.io']);
  });
});

describe('ICS simulator', () => {
  it('runs a full individual drill through to the after-action review', () => {
    render(<MemoryRouter><IcsPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Individual drill'));
    fireEvent.click(screen.getByRole('button', { name: /Start exercise/ }));
    for (let op = 0; op < 4; op++) {
      const radios = within(screen.getByRole('group', { name: 'What do you do?' })).getAllByRole('radio');
      fireEvent.click(radios[0]!);
      fireEvent.click(screen.getByRole('button', { name: 'Decide' }));
      expect(screen.getByText(/^Basis:/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: op === 3 ? 'Close incident and review' : 'Next operational period' }));
    }
    expect(screen.getByRole('heading', { name: 'After-action review' })).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(5);   // header + four decisions
    expect(JSON.parse(localStorage.getItem('ormoc-tools:u1:ics-runs')!)).toHaveLength(1);
  });
});

describe('PSCP and Gawad KALASAG screens', () => {
  it('open the PSCP workbench, flag an RTO beyond the MTPD, and write the plan', async () => {
    const { PscpPage } = await import('./pscp/PscpPage');
    render(<MemoryRouter><PscpPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: 'Essential functions (BIA)' }));
    const rto = screen.getAllByLabelText('RTO (h)')[0]!;
    fireEvent.change(rto, { target: { value: '99' } });
    expect(screen.getByText('Longer than the MTPD')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Plan document' }));
    expect(screen.getByRole('heading', { name: /Public Service Continuity Plan: City Disaster/ })).toBeTruthy();
  });
  it('rate a Seal indicator and show the weighted mean', async () => {
    const { GkPage } = await import('./gk/GkPage');
    render(<MemoryRouter><GkPage /></MemoryRouter>);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Rating for S1' })).getByRole('radio', { name: '3 Beyond' }));
    expect(screen.getAllByText('3.00')).toHaveLength(2);   // overall and Structure
    expect(screen.getByText('Beyond Compliant')).toBeTruthy();
  });
});
