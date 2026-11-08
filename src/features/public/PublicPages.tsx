// Public pages (1.10.0): the indexable face of MODE. Everything here is readable without an account and
// without loading the workspace (no IndexedDB, no sync). Content is data (typed arrays) so it can be reviewed
// and tested; policy text describes what the deployed code does (checked 8 Nov 2026) and says what the City
// still has to confirm. Contact details and policy status come from src/lib/site.ts.
import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, LifeBuoy, Mail, ShieldCheck } from 'lucide-react';
import { tip } from '@/components/Tooltip';
import { useAuth } from '@/lib/auth';
import { POLICY, policyApproved, setPageMeta, SITE } from '@/lib/site';
import { InstallPrompt } from '@/components/InstallPrompt';

// ------------------------------------------------------------------ content
type PolicySlug = 'privacy' | 'terms' | 'accessibility' | 'cookies';
interface Policy { slug: PolicySlug; title: string; description: string }
interface Faq { question: string; answer: string }
interface Feature { title: string; body: string }

export const POLICIES: Policy[] = [
  { slug: 'privacy', title: 'Privacy Policy', description: 'What MODE holds, why, who controls it, how it is protected and how to exercise your rights.' },
  { slug: 'terms', title: 'Terms of Use', description: 'Permitted use, official information and decisions, accounts and service limits.' },
  { slug: 'accessibility', title: 'Accessibility Statement', description: 'Inclusive design, assistive technology and how to report a barrier.' },
  { slug: 'cookies', title: 'Cookies and Device Storage', description: 'What MODE keeps on your device, why, and how to clear it.' },
];

export const FAQS: Faq[] = [
  { question: 'What is MODE?', answer: `MODE (${SITE.tagline}) is the City's platform for developing, running and improving the CDRRMO Manual of Operations and the EOC Manual: the institutional assessment, the manual text and its versions, the step-by-step workflows and protocols with their forms, and EOC operations records.` },
  { question: 'Does MODE issue official warnings or declarations?', answer: 'No. Hazard bulletins come from PAGASA, PHIVOLCS and other mandated agencies. States of Calamity and of Imminent Disaster are declared by the authorities the law names. MODE records and supports these processes; it does not replace them.' },
  { question: 'Does MODE replace incident command?', answer: 'No. The EOC supports the Incident Commander; MODE supports the EOC with logs, reports and coordination records. Field command stays with the designated Incident Commander.' },
  { question: 'Does MODE work offline?', answer: 'Yes, for most work. Records you can read are kept on the device, and new entries wait on the device and send when there is a connection. Actions that carry authority (changing the EOC level, approvals, declaration steps) need a connection so that two people cannot act on old information.' },
  { question: 'Who can see the records?', answer: 'Only approved accounts with a role assigned by the City administrator, and only what that role allows. The rules are enforced by the database itself, not only by the screens. A new account sees nothing until it is approved.' },
  { question: 'Are names of affected people stored?', answer: 'No. MODE has no fields for the names of evacuees, patients or informants. Barangay reports are counts. Staff accounts hold name, position, office and email.' },
  { question: 'How do I get an account?', answer: 'Create an account on the sign-in page, then ask the CDRRMO administrator to approve it and assign your role.' },
  { question: 'How do I report a problem?', answer: `Email ${SITE.supportEmail} with the page, the time, your device and browser, and what you did. Do not send passwords, one-time codes or personal data of affected people.` },
  { question: 'How do I install MODE?', answer: 'Use "Install app" where your browser offers it. On iPhone or iPad, open MODE in Safari, tap Share, then Add to Home Screen. Installation is optional.' },
];

const FEATURES: Feature[] = [
  { title: 'Institutional assessment', body: '140 indicators with evidence-gated scores, maturity readouts and an action plan.' },
  { title: 'Manual of Operations', body: 'Every chapter, SOP and form, with version history and approval by the CDRRMO Head.' },
  { title: 'Workflows and protocols', body: 'Each SOP runs step by step; every step is closed on its form, with who and when.' },
  { title: 'EOC operations', body: 'Alert level, logbook, SitReps, resource requests, contingency plans and response clusters.' },
  { title: 'Anticipatory action', body: 'PDRA, State of Imminent Disaster steps and fund rules under RA 12287 and its IRR.' },
  { title: 'Risk intelligence', body: 'A Geo-COP map on the City\'s own basemap, with validated layers and reference points.' },
];

// ------------------------------------------------------------------ frame
const linkCls = 'inline-flex min-h-tap items-center underline-offset-4 hover:underline';

function Frame({ title, description, path, children }: { title: string; description: string; path: string; children: ReactNode }) {
  const { status } = useAuth();
  useEffect(() => { setPageMeta({ title, description, path, index: true }); }, [title, description, path]);
  const signedIn = status === 'active';
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <a href="#public-main" {...tip('Skip the menu and go to the page content')}
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" {...tip('MODE home')} className="font-display text-lg font-extrabold text-action">
            {SITE.name} <span className="text-sm font-medium text-muted">Ormoc City DRRMO and EOC</span>
          </Link>
          <nav aria-label="Public" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
            <Link to="/about" className={linkCls} {...tip('What MODE is and how it works')}>About</Link>
            <Link to="/faq" className={linkCls} {...tip('Answers to common questions')}>FAQ</Link>
            <Link to="/support" className={linkCls} {...tip('Help, privacy requests and contacts')}>Support</Link>
            <Link to={signedIn ? '/today' : '/login'} {...tip(signedIn ? 'Open your workspace' : 'Sign in with your MODE account')}
              className="inline-flex min-h-tap items-center rounded-control bg-action px-4 text-on-action">{signedIn ? 'Open workspace' : 'Sign in'}</Link>
          </nav>
        </div>
      </header>
      <main id="public-main" tabIndex={-1} className="mx-auto max-w-page px-4 py-10 outline-none">{children}</main>
      <div className="px-4"><InstallPrompt /></div>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-page gap-6 px-4 pb-24 pt-8 md:grid-cols-3 lg:pb-8">
          <div>
            <p className="font-semibold">{SITE.fullName}</p>
            <p className="mt-2 text-sm text-muted">{SITE.controller}. {SITE.address}.</p>
          </div>
          <nav aria-label="Explore">
            <h2 className="font-bold">Explore</h2>
            <ul className="mt-1 text-sm">
              <li><Link to="/about" className={linkCls} {...tip('What MODE is and how it works')}>About MODE</Link></li>
              <li><Link to="/faq" className={linkCls} {...tip('Answers to common questions')}>Frequently asked questions</Link></li>
              <li><Link to="/support" className={linkCls} {...tip('Help, privacy requests and contacts')}>Support</Link></li>
            </ul>
          </nav>
          <nav aria-label="Policies">
            <h2 className="font-bold">Policies</h2>
            <ul className="mt-1 text-sm">
              {POLICIES.map((p) => <li key={p.slug}><Link to={`/policies/${p.slug}`} className={linkCls} {...tip(p.description)}>{p.title}</Link></li>)}
            </ul>
            <p className="mt-3 text-xs text-muted">{policyApproved() ? `In effect from ${POLICY.effective}.` : 'Policies are drafts awaiting City approval.'} Last reviewed {POLICY.lastReviewed}.</p>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-bold uppercase tracking-widest text-action">{children}</p>;
}

function Limitation() {
  return (
    <section aria-labelledby="limit" className="rounded-sheet border border-warn bg-warn-soft p-5">
      <h2 id="limit" className="font-bold">What MODE does not do</h2>
      <p className="mt-2">MODE is a decision-support and records platform. It does not issue hazard warnings, declare a State of Calamity or a State of Imminent Disaster, command field operations or replace the City's approved plans and authorities. In an emergency, call the City emergency hotline and follow official advisories.</p>
    </section>
  );
}

// ------------------------------------------------------------------ pages
export function PublicHome() {
  return (
    <Frame path="/" title="Home" description="MODE is the Ormoc City DRRMO and EOC Manual of Operations platform: institutional assessment, the Manual, step-by-step workflows with forms, and EOC operations, mobile-first and offline-capable.">
      <section className="grid items-center gap-8 rounded-sheet bg-action px-6 py-12 text-on-action md:grid-cols-[1.2fr_.8fr] md:px-12">
        <div>
          <p className="font-semibold uppercase tracking-widest opacity-80">Ormoc City · Disaster Risk Reduction and Management</p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight md:text-5xl">One place to run the City's DRRM and EOC procedures.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed opacity-90">MODE holds the Manual of Operations, turns each procedure into steps people can follow on a phone, and keeps the evidence that they were followed.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/login" {...tip('Sign in with your MODE account')} className="inline-flex min-h-tap items-center gap-2 rounded-control bg-surface px-5 font-bold text-ink">Sign in <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link to="/about" {...tip('Read what MODE is and how it works')} className="inline-flex min-h-tap items-center rounded-control border border-on-action px-5 font-semibold">About MODE</Link>
          </div>
        </div>
        <div className="rounded-sheet border border-on-action/30 p-6">
          <ShieldCheck className="h-10 w-10" aria-hidden />
          <h2 className="mt-4 text-2xl font-bold">Works on a phone, works offline.</h2>
          <p className="mt-3 opacity-90">Entries wait on the device and send when there is signal. Approvals and level changes need a connection, so nobody acts on old information.</p>
        </div>
      </section>
      <section aria-labelledby="supports" className="py-12">
        <h2 id="supports" className="text-3xl font-bold">What MODE supports</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => <li key={f.title} className="rounded-sheet border border-line bg-surface p-5"><h3 className="text-lg font-bold">{f.title}</h3><p className="mt-2 text-muted">{f.body}</p></li>)}
        </ul>
      </section>
      <Limitation />
    </Frame>
  );
}

export function AboutPage() {
  return (
    <Frame path="/about" title="About MODE" description="About MODE: purpose, principles, institutional boundaries and who uses the Ormoc City DRRMO and EOC Manual of Operations platform.">
      <Eyebrow>About the platform</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold">About MODE</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted">{SITE.fullName}. It supports the development, use and continuous improvement of the CDRRMO Manual of Operations and the EOC Manual of the City of Ormoc.</p>
      <div className="prose-doc mt-8 max-w-3xl">
        <h2>The platform supports the Manual; it is not the Manual</h2>
        <p>The approved Manual of Operations and EOC Manual remain the City's controlling documents. MODE holds their current text and versions, runs their procedures step by step, and keeps the evidence that they were used.</p>
        <h2>How it is designed</h2>
        <ul>
          <li><strong>Relevance and resilience:</strong> procedures are anchored in the City's CDP, CLUP, DRRM Plan and hazard profiles.</li>
          <li><strong>Effectiveness and efficiency:</strong> milestones, modular drafting, and validation before any text is approved.</li>
          <li><strong>Sustainability and local ownership:</strong> CDRRMO, CPDO, CSWDO, the IT Division and BDRRMCs take part in assessment and validation. The City owns the code and the data.</li>
          <li><strong>Innovation and integration:</strong> recurring problems are traced to their underlying structures; GIS hazard analysis informs risk-based procedures.</li>
        </ul>
        <h2>Institutional boundaries</h2>
        <p>The CDRRMC gives policy direction and oversight. The CDRRMO is the permanent DRRM office. The EOC is activated for coordination. Incident command stays with the designated Incident Commander. MODE does not change these mandates.</p>
        <h2>Who uses it</h2>
        <p>Approved City personnel: CDRRMO and EOC staff, focal persons of partner offices, assessors, validators and the CDRRMO Head. Each account sees only what its role allows.</p>
      </div>
    </Frame>
  );
}

export function FAQPage() {
  return (
    <Frame path="/faq" title="Frequently Asked Questions" description="Answers about MODE: access, offline use, official warnings, privacy, installation and support.">
      <Eyebrow>Help centre</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold">Frequently asked questions</h1>
      <div className="mt-8 max-w-3xl space-y-3">
        {FAQS.map((f) => (
          <details key={f.question} className="rounded-sheet border border-line bg-surface p-4">
            <summary {...tip('Show or hide the answer')} className="min-h-tap cursor-pointer font-bold">{f.question}</summary>
            <p className="mt-3 leading-7 text-muted">{f.answer}</p>
          </details>
        ))}
      </div>
      <p className="mt-8">Still need help? <Link to="/support" {...tip('Help, privacy requests and contacts')} className="font-bold text-action underline">Contact support</Link>.</p>
    </Frame>
  );
}

export function SupportPage() {
  const cards: { icon: typeof Mail; title: string; body: ReactNode }[] = [
    { icon: LifeBuoy, title: 'Technical support', body: <>Email <a href={`mailto:${SITE.supportEmail}`} {...tip('Write to platform support')} className="font-semibold underline">{SITE.supportEmail}</a> with the page, time, device and browser, and what you did. Say whether you were online.</> },
    { icon: Mail, title: 'Accounts and roles', body: 'New accounts are approved, and roles assigned, by the CDRRMO administrator. Ask your office head or the CDRRMO.' },
    { icon: ShieldCheck, title: 'Privacy requests', body: <>For access, correction or other requests about records the City holds, write to <a href={`mailto:${SITE.dpoEmail}`} {...tip('Write to the CDRRMO data protection contact')} className="font-semibold underline">{SITE.dpoEmail}</a>.</> },
    { icon: BookOpen, title: 'How-to guidance', body: 'The Manual of Operations, its SOPs and forms are in the Library after you sign in. Every button in MODE shows a tip when you hold or hover over it.' },
  ];
  return (
    <Frame path="/support" title="Support" description="Help with MODE accounts, technical problems, accessibility and privacy requests.">
      <Eyebrow>Help and assistance</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold">Support</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted">Never send passwords, one-time codes or personal information of affected people by email.</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-sheet border border-line bg-surface p-5"><Icon className="h-8 w-8 text-action" aria-hidden /><h2 className="mt-3 text-xl font-bold">{title}</h2><p className="mt-2 text-muted">{body}</p></li>
        ))}
      </ul>
      <section className="mt-8 rounded-sheet border border-warn bg-warn-soft p-5">
        <h2 className="font-bold">Not an emergency channel</h2>
        <p className="mt-2">This page and the support email are not monitored around the clock. In an emergency, call the City emergency hotline or your barangay, and follow official advisories.</p>
      </section>
    </Frame>
  );
}

// ------------------------------------------------------------------ policies
function PolicyBody({ slug }: { slug: PolicySlug }) {
  const S = SITE;
  switch (slug) {
    case 'privacy': return <>
      <p>This policy covers the MODE website, the web application and the installed app. It describes what the deployed system does; where something must still be confirmed by the City, it says so.</p>
      <h2>Who is responsible</h2>
      <p>Personal information controller: {S.controller}. Contact: <a href={`mailto:${S.dpoEmail}`} {...tip('Write to the data protection contact')}>{S.dpoEmail}</a>, {S.address}. {S.developer} develops and supports the platform for the City and processes data only on the City's instructions; the processing agreement is part of the City's contract.{S.npcRegistration ? ` NPC registration: ${S.npcRegistration}.` : ''}</p>
      <h2>What MODE holds</h2>
      <ul>
        <li><strong>Staff accounts:</strong> name, position, office, email, roles, sign-in records.</li>
        <li><strong>Institutional records:</strong> assessment answers and evidence, manual text and versions, workflow and protocol runs with their forms, EOC logbook, SitReps, resource requests, declarations, Document Vault files.</li>
        <li><strong>Barangay reports as counts only.</strong> There are no fields for the names of evacuees, patients or informants, and every free-text field reminds users of this.</li>
        <li><strong>Crash reports:</strong> app version, page, error text with email addresses and phone numbers removed, and browser type.</li>
        <li><strong>An audit log</strong> of every change: who, what and when.</li>
      </ul>
      <h2>Why, and on what basis</h2>
      <p>To carry out the City's DRRM functions under RA 10121 and RA 12287, to keep accountable records, and to secure and support the system. Processing follows RA 10173 (Data Privacy Act) and NPC issuances; any sensitive personal information needs a basis under Section 13 of that law.</p>
      <h2>Where it is kept and how it is protected</h2>
      <p>In the City's own Supabase project (database, sign-in and file storage), hosted in the Singapore region (ap-southeast-1) under ADR-002. Access rules are enforced by the database for every request (row-level security); evidence, Vault and map-layer files are private and open through links that expire after five minutes (only the City basemap, which is public map data, is open); authority actions need a live connection; records that carry legal or financial weight cannot be deleted. The City should confirm the live project's region, backups and support access in its records.</p>
      <h2>How long</h2>
      <p>Records are kept for as long as the City's records disposition schedule requires; the CDRRMO and the Data Protection Officer set the periods. The administrator deletes crash reports after 90 days.</p>
      <h2>Your rights</h2>
      <p>You may ask to be informed, to access and correct your information, to object, and to have information blocked or erased where the law allows, and you may complain to the National Privacy Commission. Write to <a href={`mailto:${S.dpoEmail}`} {...tip('Write to the data protection contact')}>{S.dpoEmail}</a>.</p>
      <h2>Breaches</h2>
      <p>Report a suspected breach at once to the CDRRMO and {S.supportEmail}. The City, as controller, decides on notification to the NPC and to affected persons within the periods the NPC sets.</p>
    </>;
    case 'terms': return <>
      <p>These terms apply to everyone who uses MODE. City contracts and data-processing agreements prevail where they say so.</p>
      <h2>Purpose and limits</h2>
      <p>MODE supports DRRM governance, assessment, planning, records and coordination. Information can be incomplete or delayed; check the source, time and validation status shown before acting on it.</p>
      <h2>Official warnings and decisions</h2>
      <p>MODE does not issue warnings, storm signals, advisories, evacuation orders or declarations. Those come from the agencies and officials the law names. Decisions on evacuation, declarations and spending remain with the persons and bodies authorized by law.</p>
      <h2>Accounts</h2>
      <p>Use only your own account and the role the City gave you. Do not share passwords. Report a lost device or suspected misuse at once.</p>
      <h2>Acceptable use</h2>
      <p>Do not try to reach records your role does not allow, weaken security, impersonate an official source, or enter false information. Do not enter names of affected people.</p>
      <h2>Availability</h2>
      <p>The service is provided as available. Keep the City's manual and radio procedures as alternatives; do not rely on MODE as the only emergency channel. Philippine law governs these terms.</p>
    </>;
    case 'accessibility': return <>
      <p>MODE aims to be usable by everyone who works in the City's DRRM system, on any phone or computer.</p>
      <h2>What we do</h2>
      <ul>
        <li>Headings, landmarks and labels for screen readers; every control explains itself in a tip.</li>
        <li>Keyboard operation with a visible focus; touch targets at least 44 pixels.</li>
        <li>Contrast checked automatically against WCAG 2.1 AA on the main screens; status is never shown by colour alone.</li>
        <li>Dark mode follows your device setting. The Accessibility button offers larger text, higher contrast, a plainer font and reduced motion, remembered on this device.</li>
        <li>Text alternatives for figures and maps; plain-language instructions and error messages.</li>
      </ul>
      <h2>Known limits</h2>
      <p>Maps and some manual figures carry information visually; their notes and tables carry the same content in text. No formal accessibility audit has been done yet.</p>
      <h2>Report a barrier</h2>
      <p>Write to <a href={`mailto:${S.supportEmail}`} {...tip('Report an accessibility barrier')}>{S.supportEmail}</a> with the page, your device and the task you were doing.</p>
    </>;
    case 'cookies': return <>
      <p>MODE sets no cookies and uses no advertising, analytics or tracking services. It keeps the following on your device:</p>
      <ul>
        <li><strong>Sign-in session</strong> (browser local storage, key beginning "sb-"): keeps you signed in.</li>
        <li><strong>Offline records</strong> (IndexedDB database "ormoc-drrm-ops"): the records your role can read, entries waiting to send, and files waiting to upload.</li>
        <li><strong>App files</strong> (service-worker cache): the app itself, its fonts and images, so it opens without a connection. Manual figures and map tiles are not cached.</li>
        <li><strong>Preferences and tool workspaces</strong> (local storage): accessibility settings, and your own ICS, PSCP and Gawad KALASAG workspaces.</li>
      </ul>
      <h2>Who else receives data</h2>
      <p>Only the City's Supabase project, which also serves the map basemap. Links to PAGASA, PHIVOLCS and other services open in a new tab and are not loaded inside MODE.</p>
      <h2>Your choices</h2>
      <p>Signing out removes your records from the device (entries other people have not yet sent are kept for them). You can clear all site data in your browser settings; unsent entries are then lost.</p>
    </>;
  }
}

export function PolicyPage() {
  const { slug = '' } = useParams();
  const p = POLICIES.find((x) => x.slug === slug);
  if (!p) return <Navigate to="/policies/privacy" replace />;
  const approved = policyApproved();
  return (
    <Frame path={`/policies/${p.slug}`} title={p.title} description={`${p.title} for MODE, the Ormoc City DRRMO and EOC platform. ${p.description}`}>
      <Eyebrow>Policies</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold">{p.title}</h1>
      <p className="mt-3 text-sm text-muted">{approved ? `In effect from ${POLICY.effective}. Approved by ${POLICY.owner}.` : 'Draft for City approval.'} Last reviewed against the deployed system: {POLICY.lastReviewed}.</p>
      {!approved && (
        <div className="mt-6 rounded-sheet border border-warn bg-warn-soft p-4">
          <strong>Draft, not yet approved.</strong>
          <p className="mt-1">The City Legal Office and the Data Protection Officer review this text; the effective date and the approving officer are added on approval.</p>
        </div>
      )}
      <article className="prose-doc mt-8 max-w-3xl rounded-sheet border border-line bg-surface p-6 md:p-8"><PolicyBody slug={p.slug} /></article>
    </Frame>
  );
}

/** Unknown public paths and the old root bookmark of signed-in users. */
export function PublicNotFound() {
  const loc = useLocation();
  return (
    <Frame path={loc.pathname} title="Page not found" description="This page does not exist.">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3"><Link to="/" {...tip('Go to the MODE home page')} className="font-bold text-action underline">Go to the home page</Link></p>
    </Frame>
  );
}
