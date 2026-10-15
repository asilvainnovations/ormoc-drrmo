import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Renders manual text. Markdown is sanitized: authored content never runs script. */
export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(source, { async: false, gfm: true, breaks: false }) as string), [source]);
  return <div className="prose-doc" dangerouslySetInnerHTML={{ __html: html }} />;
}
