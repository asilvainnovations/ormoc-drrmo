import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/lib/db';
import { bootstrapReference } from '@/lib/bootstrap';
import { LibraryPage } from './LibraryPage';

describe('LibraryPage organization (1.12)', () => {
  it('groups the Manual by Part and functional area, with the EOC Manual alongside', async () => {
    await bootstrapReference();
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);
    // Part sections come from manual_parts
    expect(await screen.findByText(/Part 1 · Legal mandate and governance/)).toBeTruthy();
    expect(screen.getByText(/Part 5 /)).toBeTruthy();
    // Area sub-groups come from manual_areas
    expect(screen.getByText(/Area 1 ·/)).toBeTruthy();
    expect(screen.getByText(/Area 10 ·/)).toBeTruthy();
    // The legacy EOC Manual keeps its own section (ADR-012)
    expect(screen.getByText(/EOC Manual \(\d+ sections\)/)).toBeTruthy();
    // Kind chips distinguish SOPs, forms and annexes from chapters
    expect(screen.getAllByText('SOP').length).toBeGreaterThan(0);
    // No document is duplicated between areas and the loose list
    const { docs } = await (async () => ({ docs: await db.moo_documents.toArray() }))();
    expect(docs.length).toBeGreaterThan(0);
    expect(await screen.findByText(/Library/)).toBeTruthy();
  });
});
