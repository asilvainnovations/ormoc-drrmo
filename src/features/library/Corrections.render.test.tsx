import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { db } from '@/lib/db';
import { CorrectionSheet, CorrectionsLog } from './Corrections';
import type { ManualCorrection, MooDocument, MooVersion } from '@/types';

const doc = { id: 'd0000000-0000-0000-0000-000000000001', manual: 'MOO', kind: 'chapter', code: 'MOO Ch.9', title: 'Test', status: 'draft', version: 1 } as unknown as MooDocument;
const base = { id: 'v1', document_id: doc.id, label: 'v1.0', status: 'approved', change_note: null, version: 1,
  body_md: '# 9. Test\n\nIntro.\n\n## 9.1 Duties\n\nFirst duty.\n\nSecond duty.\n' } as MooVersion;

describe('chapter corrections (1.27.0)', () => {
  it('offers every section and asks for a reason before saving', async () => {
    render(<CorrectionSheet open onClose={() => undefined} doc={doc} base={base} />);
    expect(screen.getByRole('option', { name: '— 9.1 Duties', hidden: true })).toBeTruthy();
    fireEvent.click(screen.getByText('Delete text'));
    expect(screen.getByText('Second duty.')).toBeTruthy();
    fireEvent.click(screen.getByText('Save correction'));
    expect(await screen.findByText(/Give a reason for the correction/)).toBeTruthy();
  });

  it('shows the log with who, when, why and the change', async () => {
    await db.profiles.put({ id: 'u1', full_name: 'Val Idator', position: null, office_id: null, is_active: true });
    await db.manual_corrections.put({ id: 'c1', version: 1, document_id: doc.id, version_id: 'v2', section_title: '9.1 Duties', action: 'revise',
      before_md: '## 9.1 Duties\n\nFirst duty.', after_md: '## 9.1 Duties\n\nFirst duty, revised.', reason: 'Workshop session 2 agreed wording',
      figure_path: null, review_item_id: null, corrected_by: 'u1', created_at: '2026-11-19T12:00:00Z' } as ManualCorrection);
    render(<CorrectionsLog documentId={doc.id} />);
    expect(await screen.findByText(/Val Idator/)).toBeTruthy();
    expect(screen.getByText('Workshop session 2 agreed wording')).toBeTruthy();
    expect(screen.getByText('First duty, revised.')).toBeTruthy();
  });
});
