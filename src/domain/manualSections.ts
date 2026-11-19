// Chapter sections and corrections (1.27.0). Pure functions; the server (apply_manual_correction) replaces the section's
// "before" text with its "after" text only when "before" appears exactly once in the working draft, and logs both.
import type { CorrectionAction } from '@/types';

export interface Section { index: number; title: string; level: number; text: string }

/** Split markdown into sections at headings (# to ####), ignoring lines inside ``` fences. Text before the first
 *  heading is its own section. Joining every section's text gives back the whole body exactly. */
export function splitSections(body: string): Section[] {
  const lines = body.split(/(?<=\n)/);
  const out: { title: string; level: number; lines: string[] }[] = [];
  let fence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) fence = !fence;
    const m = !fence ? line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/) : null;
    if (m) out.push({ title: m[2]!.trim(), level: m[1]!.length, lines: [line] });
    else if (out.length) out[out.length - 1]!.lines.push(line);
    else out.push({ title: 'Opening text', level: 0, lines: [line] });
  }
  return out.map((s, index) => ({ index, title: s.title, level: s.level, text: s.lines.join('') }));
}

/** The paragraphs of a section after its heading line: blocks separated by blank lines. */
export function paragraphs(section: Section): string[] {
  const body = section.level > 0 ? section.text.slice(section.text.indexOf('\n') + 1) : section.text;
  return body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export interface CorrectionInput {
  action: CorrectionAction;
  /** revise: the whole section as edited. */ revised?: string;
  /** add: the new text, placed after paragraph `afterParagraph` (-1 = right under the heading, null = at the end). */ added?: string; afterParagraph?: number | null;
  /** delete: the paragraphs to remove (indexes into paragraphs()). */ remove?: number[];
  /** figure: markdown image and where it goes; replaceParagraph replaces an existing figure paragraph. */ figure?: string; replaceParagraph?: number | null;
}

const ending = (t: string) => (t.endsWith('\n') ? t : `${t}\n`);

/** The section text after a correction. Throws a plain-English message when the input cannot be applied. The section's
 *  own trailing blank lines are kept, so the next heading stays separated. */
export function correctedSection(section: Section, c: CorrectionInput): string {
  const tail = section.text.match(/\s*$/)![0] || '\n';
  return applyCorrection(section, c).trimEnd() + tail;
}

function applyCorrection(section: Section, c: CorrectionInput): string {
  const paras = paragraphs(section);
  const head = section.level > 0 ? section.text.slice(0, section.text.indexOf('\n') + 1) : '';
  const rebuild = (ps: string[]) => ending(head + (ps.length ? (head ? '\n' : '') + ps.join('\n\n') + '\n' : ''));
  switch (c.action) {
    case 'revise': {
      const t = (c.revised ?? '').replace(/\r\n/g, '\n');
      if (!t.trim()) throw new Error('The revised section is empty. To remove text, use Delete.');
      return ending(t.trimEnd());
    }
    case 'add': {
      const t = (c.added ?? '').trim();
      if (!t) throw new Error('Type the text to add.');
      const at = c.afterParagraph == null ? paras.length : Math.min(Math.max(c.afterParagraph + 1, 0), paras.length);
      return rebuild([...paras.slice(0, at), t, ...paras.slice(at)]);
    }
    case 'delete': {
      const drop = new Set(c.remove ?? []);
      if (!drop.size) throw new Error('Tick the paragraphs to delete.');
      return rebuild(paras.filter((_, i) => !drop.has(i)));
    }
    case 'figure': {
      const f = (c.figure ?? '').trim();
      if (!f) throw new Error('Choose the figure and give it a caption.');
      if (c.replaceParagraph != null) {
        if (!isFigure(paras[c.replaceParagraph] ?? '')) throw new Error('Only a figure can be replaced with a figure.');
        return rebuild(paras.map((p, i) => (i === c.replaceParagraph ? f : p)));
      }
      return rebuild([...paras, f]);
    }
  }
}

/** A paragraph that is just a markdown image (a figure). */
export const isFigure = (p: string) => /^!\[[^\]]*\]\([^)]+\)$/.test(p.trim());

/** Markdown for an uploaded figure: the path is in the private manual-figures bucket (rendered by Markdown.tsx). */
export function figureMarkdown(caption: string, path: string): string {
  const c = caption.replace(/[[\]\n]/g, ' ').trim();
  return `![${c}](/manual-figures/${path})`;
}

/** Storage path for a new figure of a document. */
export function figurePath(documentId: string, fileId: string, fileName: string): string {
  const ext = (fileName.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
  return `${documentId}/${fileId}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

/** What changed, paragraph by paragraph: kept, removed and added (for the corrections log). */
export function paragraphDiff(before: string, after: string): { kind: 'same' | 'removed' | 'added'; text: string }[] {
  const a = before.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const b = after.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  // Longest common subsequence on paragraphs: sections are short, so the table stays small.
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i]![j] = a[i] === b[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out: { kind: 'same' | 'removed' | 'added'; text: string }[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i]! }); i++; j++; }
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) out.push({ kind: 'removed', text: a[i++]! });
    else out.push({ kind: 'added', text: b[j++]! });
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++]! });
  while (j < b.length) out.push({ kind: 'added', text: b[j++]! });
  return out;
}
