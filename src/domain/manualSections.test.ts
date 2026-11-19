import { describe, expect, it } from 'vitest';
import { correctedSection, figureMarkdown, figurePath, isFigure, paragraphDiff, paragraphs, splitSections } from './manualSections';

const BODY = `Intro line.

# 4. Early warning

Para one.

Para two.

![Figure 4-1: Warning flow](/library/ch4/fig-01.webp)

## 4.1 Sources

\`\`\`
# not a heading inside a fence
\`\`\`

Source text.
`;

describe('chapter sections', () => {
  it('splits at headings, skips fenced code, and joins back to the exact body', () => {
    const s = splitSections(BODY);
    expect(s.map((x) => x.title)).toEqual(['Opening text', '4. Early warning', '4.1 Sources']);
    expect(s.map((x) => x.text).join('')).toBe(BODY);
  });
  it('lists paragraphs after the heading and recognises figures', () => {
    const p = paragraphs(splitSections(BODY)[1]!);
    expect(p).toEqual(['Para one.', 'Para two.', '![Figure 4-1: Warning flow](/library/ch4/fig-01.webp)']);
    expect(isFigure(p[2]!)).toBe(true);
    expect(isFigure(p[0]!)).toBe(false);
  });
});

describe('corrections', () => {
  const sec = splitSections(BODY)[1]!;
  it('adds text after a chosen paragraph, under the heading, or at the end', () => {
    expect(paragraphs({ ...sec, text: correctedSection(sec, { action: 'add', added: 'New.', afterParagraph: 0 }) })).toEqual(['Para one.', 'New.', 'Para two.', expect.stringMatching(/^!\[/)]);
    expect(paragraphs({ ...sec, text: correctedSection(sec, { action: 'add', added: 'Top.', afterParagraph: -1 }) })[0]).toBe('Top.');
    expect(correctedSection(sec, { action: 'add', added: 'End.' })).toMatch(/End\.\n\n$/);
  });
  it('deletes ticked paragraphs and keeps the heading', () => {
    const t = correctedSection(sec, { action: 'delete', remove: [1] });
    expect(t.startsWith('# 4. Early warning\n')).toBe(true);
    expect(t).not.toContain('Para two.');
  });
  it('revises the whole section text', () => {
    expect(correctedSection(sec, { action: 'revise', revised: '# 4. Early warning\n\nRewritten.' })).toBe('# 4. Early warning\n\nRewritten.\n\n');
  });
  it('adds a figure or replaces an existing figure, but never replaces text with a figure', () => {
    const fig = figureMarkdown('Figure 4-2: New flow', figurePath('d0c', 'f1', 'Flow.JPEG'));
    expect(fig).toBe('![Figure 4-2: New flow](/manual-figures/d0c/f1.jpg)');
    expect(correctedSection(sec, { action: 'figure', figure: fig, replaceParagraph: 2 })).toContain('/manual-figures/d0c/f1.jpg');
    expect(correctedSection(sec, { action: 'figure', figure: fig, replaceParagraph: 2 })).not.toContain('fig-01.webp');
    expect(() => correctedSection(sec, { action: 'figure', figure: fig, replaceParagraph: 0 })).toThrow(/Only a figure/);
  });
  it('keeps the blank line before the next heading', () => {
    const body = '# A\n\nOne.\n\n# B\n\nTwo.\n';
    const [a] = splitSections(body);
    const fixed = correctedSection(a!, { action: 'add', added: 'More.' });
    expect(body.replace(a!.text, fixed)).toBe('# A\n\nOne.\n\nMore.\n\n# B\n\nTwo.\n');
  });
  it('refuses empty corrections in plain words', () => {
    expect(() => correctedSection(sec, { action: 'add', added: ' ' })).toThrow(/Type the text/);
    expect(() => correctedSection(sec, { action: 'delete', remove: [] })).toThrow(/Tick/);
    expect(() => correctedSection(sec, { action: 'revise', revised: '' })).toThrow(/empty/);
  });
  it('shows a paragraph diff for the log', () => {
    expect(paragraphDiff('A\n\nB\n\nC', 'A\n\nB2\n\nC')).toEqual([
      { kind: 'same', text: 'A' }, { kind: 'removed', text: 'B' }, { kind: 'added', text: 'B2' }, { kind: 'same', text: 'C' }]);
  });
});
