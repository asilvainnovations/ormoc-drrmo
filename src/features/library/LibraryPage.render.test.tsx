import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { bootstrapReference } from '@/lib/bootstrap';
import { LibraryPage } from './LibraryPage';

describe('LibraryPage organization (1.14)', () => {
  it('lists the written chapters first, each opening to its SOPs, forms and annexes', async () => {
    await bootstrapReference();
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);
    expect(await screen.findByText('Manual of Operations: chapters')).toBeTruthy();
    // Chapters in order, each with its functional area named
    const ch1 = await screen.findByText(/^Chapter 1 · /);
    expect(screen.getByText(/^Chapter 4 · /)).toBeTruthy();
    expect(screen.getAllByText(/Functional area 1 · /).length).toBeGreaterThan(0);
    // Closed at first; opening Chapter 2 shows its SOP group
    expect(screen.queryByText(/SOP HR-01/)).toBeNull();
    fireEvent.click(screen.getByText(/^Chapter 2 · /));
    expect(await screen.findByText(/SOP HR-01/)).toBeTruthy();
    expect(screen.getAllByText(/^SOPs \(\d+\)$/).length).toBeGreaterThan(0);
    // Areas without a chapter, superseded sections and the EOC Manual follow
    expect(screen.getByText('Functional areas without a written chapter yet')).toBeTruthy();
    expect(screen.getByText(/^Superseded sections \(\d+\)$/)).toBeTruthy();
    expect(screen.getByText(/EOC Manual \(\d+ sections\)/)).toBeTruthy();
    // One colour key for the status badges
    expect(screen.getByText('Status colours')).toBeTruthy();
    expect(screen.getAllByText('For validation').length).toBeGreaterThan(0);
    expect(ch1).toBeTruthy();
  });

  it('opens the matching chapter while searching', async () => {
    cleanup();
    await bootstrapReference();
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'GOV-05' } });
    expect(await screen.findByText(/SOP GOV-05/)).toBeTruthy();
    expect(screen.queryByText(/^Chapter 2 · /)).toBeNull();
  });
});
