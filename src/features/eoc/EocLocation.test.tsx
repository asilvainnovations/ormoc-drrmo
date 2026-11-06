import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { EocLocation } from './EocLocation';
import { primaryEoc } from '@/data/eoc-site';

describe('EOC location card', () => {
  afterEach(cleanup);

  it('shows the coordinates and links out safely, never in a frame', () => {
    const { container, getByText } = render(<EocLocation />);
    const site = primaryEoc()!;
    expect(getByText('11.013896° N, 124.604287° E')).toBeTruthy();
    expect(getByText('11°00′50.0″ N, 124°36′15.4″ E')).toBeTruthy();

    const links = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')];
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const a of links) {
      expect(a.getAttribute('data-tip'), a.textContent ?? '').toBeTruthy();
      const href = a.getAttribute('href')!;
      if (/^https?:/.test(href)) {
        expect(new URL(href).protocol).toBe('https:');
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toContain('noopener');
        expect(a.getAttribute('rel')).toContain('noreferrer');
      }
    }
    const kml = links.find((a) => a.getAttribute('href') === site.kml)!;
    expect(kml.hasAttribute('download')).toBe(true);
    expect(kml.getAttribute('target')).toBeNull();
    expect(links.some((a) => a.getAttribute('href')!.startsWith('geo:'))).toBe(true);
    for (const b of container.querySelectorAll('button')) expect(b.getAttribute('data-tip')).toBeTruthy();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('says plainly that the position and the alternate EOC still need the CDRRMO', () => {
    const { getByText } = render(<EocLocation />);
    expect(getByText('To be confirmed')).toBeTruthy();
    expect(getByText('Not yet recorded')).toBeTruthy();
  });
});
