// Public-site settings (1.10.0). Contact details and policy status come from the build environment, with
// the values supplied for the City on 8 Nov 2026 as defaults, so a change of address needs a redeploy, not a
// code change. Nothing here is secret: these values appear on public pages.
import { PRODUCT } from './product';

const env = import.meta.env as Record<string, string | undefined>;
const val = (k: string, fallback: string | null): string | null => {
  const v = env[k]?.trim();
  return v ? v : fallback;
};

export const SITE = {
  name: PRODUCT.short,
  fullName: PRODUCT.full,
  tagline: `${PRODUCT.expansion}, Ormoc City`,
  /** Canonical origin for SEO (https://…, no trailing slash). The City's domain since 8 Nov 2026. */
  url: (val('VITE_SITE_URL', 'https://www.mode-cddrmo-ormoc.online') ?? '').replace(/\/$/, ''),
  /** Platform support: the developer's mailbox, confirmed monitored on 8 Nov 2026. */
  supportEmail: val('VITE_SUPPORT_EMAIL', 'mode-support@asilvainnovations.com')!,
  /** Data protection contact for the City's records (CDRRMO). */
  dpoEmail: val('VITE_DPO_EMAIL', 'cdrrmo.ormoccity@gmail.com')!,
  address: val('VITE_BUSINESS_ADDRESS', 'New Ormoc City Hall, Anubing St., Brgy. Cogon, Ormoc City, Leyte')!,
  /** NPC registration reference, only if the City's registration applies to this system. */
  npcRegistration: val('VITE_NPC_REGISTRATION', null),
  /** Personal information controller for the City's records. */
  controller: 'City Government of Ormoc, through the City Disaster Risk Reduction and Management Office (CDRRMO)',
  developer: 'ASilva Innovations (Cognitio Plus)',
} as const;

/**
 * Policy status. "Last reviewed" is the date the text was last checked against the deployed system: a fixed
 * fact, deliberately not today's date.
 * Approved snapshot 10 Nov 2026: the City Legal Office and the Data Protection Officer approved the public
 * policies; the effective date and approving offices below are the dated snapshot of that approval. Env vars
 * can still override (VITE_POLICY_EFFECTIVE / VITE_POLICY_OWNER) if the City re-issues them.
 */
export const POLICY = {
  lastReviewed: '10 November 2026',
  effective: val('VITE_POLICY_EFFECTIVE', null) ?? '9 November 2026',
  owner: val('VITE_POLICY_OWNER', null) ?? 'City Legal Office and City Data Protection Officer',
} as const;
export const policyApproved = () => Boolean(POLICY.effective && POLICY.owner);

/** Set the page title, description, canonical URL and robots directive (public pages index; the workspace does not). */
export function setPageMeta({ title, description, path, index }: { title: string; description?: string; path?: string; index: boolean }) {
  if (typeof document === 'undefined') return;
  document.title = `${title} | ${SITE.name}, Ormoc City DRRMO & EOC`;
  const meta = (name: string) => {
    let m = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); document.head.appendChild(m); }
    return m;
  };
  if (description) meta('description').setAttribute('content', description);
  meta('robots').setAttribute('content', index ? 'index, follow' : 'noindex, nofollow');
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (index && path !== undefined) {
    if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
    link.setAttribute('href', `${SITE.url || window.location.origin}${path}`);
  } else link?.remove();
}

/** Public, indexable routes (also written to sitemap.xml at build time; keep in step with vite.config.ts). */
export const PUBLIC_PATHS = ['/', '/about', '/faq', '/support',
  '/policies/privacy', '/policies/terms', '/policies/accessibility', '/policies/cookies'] as const;
