import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

const FIG = 'src="/manual-figures/';

/** A figure added through a chapter correction (1.27.0): from this device if kept, otherwise from the private
 *  manual-figures bucket (downloaded, never hot-linked: the CSP allows images only from the app, data: and blob:). */
async function figureBlob(path: string): Promise<Blob | null> {
  const key = `mf:${path}`;
  const kept = await db.files.get(key);
  if (kept) return kept.blob;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  const { data, error } = await supabase.storage.from('manual-figures').download(path);
  if (error || !data) return null;
  await db.files.put({ id: key, blob: data, name: path.split('/').pop() ?? path, type: data.type, createdAt: new Date().toISOString() });
  return data;
}

/** Renders manual text. Markdown is sanitized: authored content never runs script. */
export function Markdown({ source }: { source: string }) {
  const box = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    const clean = DOMPurify.sanitize(marked.parse(source, { async: false, gfm: true, breaks: false }) as string);
    // Uploaded figures: keep their path in data-mf and load them below (after sanitizing, so nothing new can run).
    return clean.split(FIG).join('data-mf="');
  }, [source]);
  useEffect(() => {
    const urls: string[] = [];
    let live = true;
    for (const img of Array.from(box.current?.querySelectorAll<HTMLImageElement>('img[data-mf]') ?? [])) {
      const path = img.dataset.mf!;
      void figureBlob(path).then((b) => {
        if (!live) return;
        if (!b) { img.replaceWith(Object.assign(document.createElement('span'), { className: 'text-sm text-muted', textContent: `[${img.alt || 'Figure'}: opens when online]` })); return; }
        const u = URL.createObjectURL(b); urls.push(u); img.src = u;
      });
    }
    return () => { live = false; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [html]);
  return <div ref={box} className="prose-doc" dangerouslySetInnerHTML={{ __html: html }} />;
}
