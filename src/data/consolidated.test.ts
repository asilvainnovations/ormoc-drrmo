// 1.31.0: Consolidated Draft 1.0 and the runnable Chapter 9 and 10 templates (scripts/generate_seed.py).
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ref from './reference.json';

type Doc = { id: string; code: string; chapter_no: number | null; kind: string };
type Ver = { document_id: string; label: string; body_md: string };
type Tpl = { id: string; code: string; category: string; document_id: string; status: string };
type Step = { template_id: string; form_code: string };
const docs = ref.moo_documents as Doc[];
const versions = ref.moo_versions as Ver[];
const tpls = ref.protocol_templates as Tpl[];
const steps = ref.protocol_steps as Step[];
const forms = new Set((ref.form_templates as { code: string }[]).map((f) => f.code));

describe('Consolidated Draft 1.0 in the offline bundle', () => {
  it('keeps one (the newest) version per document, so the bundle stays under the 4 MB precache limit', () => {
    const per = new Map<string, number>();
    for (const v of versions) per.set(v.document_id, (per.get(v.document_id) ?? 0) + 1);
    expect([...per.values()].every((n) => n === 1)).toBe(true);
    expect(statSync(join(__dirname, 'reference.json')).size).toBeLessThan(4 * 1024 * 1024);
  });
  it('has all ten chapters, each with the consolidated text as its offline version', () => {
    for (let n = 1; n <= 10; n++) {
      const d = docs.find((x) => x.code === `Chapter ${n}`);
      expect(d, `Chapter ${n}`).toBeTruthy();
      const v = versions.find((x) => x.document_id === d!.id)!;
      expect(v.label).toBe('Consolidated Draft 1.0');
      expect(v.body_md.startsWith(`# Chapter ${n}. `)).toBe(true);
    }
    expect(docs.some((d) => d.code === 'Annex A')).toBe(true);
  });
});

describe('Chapter 9 and 10 templates', () => {
  const ch = (n: number) => docs.find((d) => d.code === `Chapter ${n}`)!.id;
  const of = (n: number) => tpls.filter((t) => t.document_id === ch(n));
  it('has one template per SOP: nine in Chapter 9, seven in Chapter 10, all draft', () => {
    expect(of(9).map((t) => t.code).sort()).toEqual(Array.from({ length: 9 }, (_, i) => `WF-SOP9-0${i + 1}`));
    expect(of(10)).toHaveLength(7);
    expect(of(10).map((t) => t.code)).toContain('PR-LEADERSHIP-TRANSITION');
    expect([...of(9), ...of(10)].every((t) => t.status === 'draft')).toBe(true);
  });
  it('gives every step a built form', () => {
    const ids = new Set([...of(9), ...of(10)].map((t) => t.id));
    const s = steps.filter((x) => ids.has(x.template_id));
    expect(s.length).toBeGreaterThan(70);
    expect(s.every((x) => forms.has(x.form_code))).toBe(true);
    for (const c of ['CAP-F01', 'CAP-F06', 'CAP-F09', 'SUS-F01', 'SUS-F05']) expect(forms.has(c)).toBe(true);
  });
  it('uses the capacity, sustainability and continuity categories', () => {
    expect(new Set(of(9).map((t) => t.category))).toEqual(new Set(['capacity']));
    expect(new Set(of(10).map((t) => t.category))).toEqual(new Set(['sustainability', 'continuity']));
  });
});
