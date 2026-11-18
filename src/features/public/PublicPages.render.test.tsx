// Public pages (ADR-045): header destinations, contacts, authority-boundary wording and FAQ structure.
// The copy itself follows docs/implementation/public-website-pwa/01-public-web-copy.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let status = 'signed_out';
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ ready: true, status }) }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));

const { AboutPage, FAQPage, FAQS, PublicHome, SupportPage } = await import('./PublicPages');
const { SITE } = await import('@/lib/site');
const { USER_GUIDE_URL } = await import('@/lib/userGuide');

const at = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);
afterEach(() => { cleanup(); status = 'signed_out'; });

describe('public header and footer', () => {
  it('sends the City seal to the City website in a new tab, and the CDRRMO seal and wordmark to MODE home', () => {
    at(<PublicHome />);
    const header = screen.getAllByRole('banner')[0]!;
    const city = within(header).getByRole('link', { name: /City Government of Ormoc website/ });
    expect(city.getAttribute('href')).toBe(SITE.cityWebsite);
    expect(city.getAttribute('target')).toBe('_blank');
    expect(city.getAttribute('rel')).toContain('noopener');
    expect(city.getAttribute('rel')).toContain('noreferrer');
    expect(within(header).getByRole('link', { name: /Ormoc City CDRRMO, MODE home/ }).getAttribute('href')).toBe('/');
    expect(within(header).getByRole('link', { name: 'MODE Ormoc City DRRMO and EOC' }).getAttribute('href')).toBe('/');
  });
  it('shows the User Guide action in the header and the footer, opening the built guide in a new tab', () => {
    at(<PublicHome />);
    const links = screen.getAllByRole('link', { name: /MODE User Guide/ });
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const l of links) { expect(l.getAttribute('href')).toBe(USER_GUIDE_URL); expect(l.getAttribute('target')).toBe('_blank'); }
    expect(screen.getAllByRole('link', { name: /User Guide/ }).length).toBeGreaterThanOrEqual(2);
  });
  it('shows Sign in when signed out and Open workspace when signed in', () => {
    at(<PublicHome />);
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]!.getAttribute('href')).toBe('/login');
    cleanup(); status = 'active';
    at(<PublicHome />);
    expect(screen.getByRole('link', { name: 'Open workspace' }).getAttribute('href')).toBe('/today');
  });
  it('has a skip link, a main landmark and a footer', () => {
    at(<AboutPage />);
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#public-main');
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });
});

describe('contacts come from site settings', () => {
  it('Support lists technical support and privacy requests at their own addresses, and no personal address', () => {
    const { container } = at(<SupportPage />);
    const mails = [...container.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href'));
    expect(mails).toContain(`mailto:${SITE.supportEmail}`);
    expect(mails).toContain(`mailto:${SITE.dpoEmail}`);
    expect(SITE.supportEmail).toBe('mode-support@asilvainnovations.com');
    expect(SITE.dpoEmail).toBe('cdrrmo.ormoccity@gmail.com');
    expect(container.textContent).not.toMatch(/alvin\.silva/i);
    const privacy = screen.getByRole('heading', { name: 'Privacy requests' }).closest('li')!;
    expect(privacy.querySelector(`a[href="mailto:${SITE.dpoEmail}`.concat('"]'))).toBeTruthy();
    const tech = screen.getByRole('heading', { name: 'Technical support' }).closest('li')!;
    expect(tech.querySelector(`a[href="mailto:${SITE.supportEmail}`.concat('"]'))).toBeTruthy();
  });
  it('says Support is not an emergency channel', () => {
    at(<SupportPage />);
    expect(screen.getByText('Not an emergency channel')).toBeTruthy();
    expect(screen.getByText(/not an emergency reporting or dispatch service/)).toBeTruthy();
  });
  it('does not show an NPC registration unless the City sets one', () => {
    const { container } = at(<SupportPage />);
    expect(SITE.npcRegistration).toBeNull();
    expect(container.textContent).not.toMatch(/NPC registration/i);
  });
});

describe('authority boundary and claims', () => {
  it('Home keeps the limitation statement and links the review call to Support, not to the workspace', () => {
    at(<PublicHome />);
    expect(screen.getByText(/does not issue official hazard warnings or evacuation orders/)).toBeTruthy();
    const cta = screen.getByRole('link', { name: /Learn about the Manual review and validation process/ });
    expect(cta.getAttribute('href')).toBe('/support');
  });
  it('Home shows what MODE stands for and links the policies and Support from the trust section', () => {
    at(<PublicHome />);
    expect(screen.getByText(/MODE: Manual of Operations for the DRRMO and EOC/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Built to support institutional governance' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Privacy Policy' })[0]!.getAttribute('href')).toBe('/policies/privacy');
    expect(screen.getAllByRole('link', { name: 'Support and contacts' })[0]!.getAttribute('href')).toBe('/support');
  });
  it('About separates the Manual from the platform and the EOC from incident command', () => {
    at(<AboutPage />);
    expect(screen.getByRole('heading', { name: /supports the Manual; it is not the Manual/ })).toBeTruthy();
    expect(screen.getByText(/does not create or transfer statutory authority/)).toBeTruthy();
    expect(screen.getByText(/retain their established incident command/)).toBeTruthy();
  });
  it('public copy makes no endorsement, warning-service or live-score claims', () => {
    const texts: string[] = [];
    for (const el of [<PublicHome key="h" />, <AboutPage key="a" />, <SupportPage key="s" />]) { const { container } = at(el); texts.push(container.textContent ?? ''); cleanup(); }
    const all = texts.join(' ') + FAQS.map((f) => f.answer).join(' ');
    expect(all).not.toMatch(/endorse/i);
    expect(all).not.toMatch(/Mayor/i);
    expect(all).not.toMatch(/\bIMI\b|Institutional Maturity Index/);
  });
});

describe('FAQ', () => {
  it('groups the questions under headings and each group has an accordion', () => {
    at(<FAQPage />);
    const groups = [...new Set(FAQS.map((f) => f.group))];
    expect(groups).toEqual(['About MODE', 'Authority and emergency operations', 'Accounts and access', 'Offline use, synchronisation and installation',
      'Assessment, evidence and validation', 'Risk information', 'Privacy and support']);
    for (const g of groups) expect(screen.getByRole('heading', { level: 2, name: g })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Does MODE replace the approved Manuals\?/ }).length).toBe(1);
  });
  it('keeps the offline answer honest: authority actions need a connection', () => {
    const offline = FAQS.find((f) => f.question === 'Can every action be completed offline?')!;
    expect(offline.answer).toMatch(/require a live connection/);
    const report = FAQS.find((f) => f.question === 'How do I report a technical problem?')!;
    expect(report.answer).toContain(SITE.supportEmail);
  });
});
