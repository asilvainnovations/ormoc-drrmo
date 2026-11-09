// Public pages (1.10.0): the indexable face of MODE. Everything here is readable without an account and
// without loading the workspace (no IndexedDB, no sync). Content is data (typed arrays) so it can be reviewed
// and tested; policy text describes what the deployed code does (checked 8 Nov 2026) and says what the City
// still has to confirm. Contact details and policy status come from src/lib/site.ts.
import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, ClipboardCheck, FileText, LifeBuoy, ListChecks, Mail, Map as MapIcon, Menu, RadioTower, RefreshCcw, ShieldCheck, Siren, WifiOff } from 'lucide-react';
import { Seals } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { tip } from '@/components/Tooltip';
import { useAuth } from '@/lib/auth';
import { POLICY, policyApproved, setPageMeta, SITE } from '@/lib/site';
import { InstallPrompt } from '@/components/InstallPrompt';

// ------------------------------------------------------------------ content
type PolicySlug = 'privacy' | 'terms' | 'accessibility' | 'cookies';
interface Policy { slug: PolicySlug; title: string; description: string }
interface Faq { question: string; answer: string }
interface Feature { title: string; body: string; icon: typeof Mail }

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

/** How the Manual and the platform work together (home page, "How it works"). */
const CYCLE = [
  { icon: ClipboardCheck, title: 'Assess', body: 'Score the 140 indicators with evidence. Gaps become actions.' },
  { icon: FileText, title: 'Write', body: 'Each gap is answered by a chapter, an SOP and its forms, validated with the offices.' },
  { icon: ListChecks, title: 'Run', body: 'Staff follow the SOP step by step on a phone; every step closes on its form.' },
  { icon: RefreshCcw, title: 'Improve', body: 'Runs, drills and after-action reviews feed the next revision and the next assessment.' },
];

const FEATURES: Feature[] = [
  { icon: ClipboardCheck, title: 'Institutional assessment', body: '140 indicators with evidence-gated scores, maturity readouts and an action plan.' },
  { icon: BookOpen, title: 'Manual of Operations', body: 'Every chapter, SOP and form, with version history and approval by the CDRRMO Head.' },
  { icon: ListChecks, title: 'Workflows and protocols', body: 'Each SOP runs step by step; every step is closed on its form, with who and when.' },
  { icon: RadioTower, title: 'EOC operations', body: 'Alert level, logbook, SitReps, resource requests, contingency plans and response clusters.' },
  { icon: Siren, title: 'Anticipatory action', body: 'PDRA, State of Imminent Disaster steps and fund rules under RA 12287 and its IRR.' },
  { icon: MapIcon, title: 'Risk intelligence', body: 'A Geo-COP map on the City\'s own basemap, with validated layers and reference points.' },
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
          <Link to="/" {...tip('MODE home')} className="flex items-center gap-3 font-display text-lg font-extrabold text-action">
            <Seals size={36} />
            <span>{SITE.name} <span className="hidden text-sm font-medium text-muted sm:inline">Ormoc City DRRMO and EOC</span></span>
          </Link>
          <nav aria-label="Public" className="flex items-center gap-x-4 text-sm font-semibold">
            <Link to="/about" className={`${linkCls} hidden md:inline-flex`} {...tip('What MODE is and how it works')}>About</Link>
            <Link to="/faq" className={`${linkCls} hidden md:inline-flex`} {...tip('Answers to common questions')}>FAQ</Link>
            <Link to="/support" className={`${linkCls} hidden md:inline-flex`} {...tip('Help, privacy requests and contacts')}>Support</Link>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger {...tip('Open the menu: about, questions, support and policies')} aria-label="Menu"
                className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-control hover:bg-sky-soft/60 md:hidden"><Menu className="h-5 w-5" aria-hidden /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild><Link to="/about" {...tip('What MODE is and how it works')} className="min-h-tap">About MODE</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/faq" {...tip('Answers to common questions')} className="min-h-tap">Questions</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/support" {...tip('Help, privacy requests and contacts')} className="min-h-tap">Support</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                {POLICIES.map((p) => <DropdownMenuItem key={p.slug} asChild><Link to={`/policies/${p.slug}`} {...tip(p.description)} className="min-h-tap">{p.title}</Link></DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to={signedIn ? '/today' : '/login'} {...tip(signedIn ? 'Open your workspace' : 'Sign in with your MODE account')}
              className="inline-flex min-h-tap items-center rounded-control bg-action px-4 text-on-action shadow-raised hover:opacity-90">{signedIn ? 'Open workspace' : 'Sign in'}</Link>
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
            <p className="mt-3 text-xs text-muted">In effect from {POLICY.effective}. Last reviewed {POLICY.lastReviewed}.</p>
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
    <Alert variant="warning" aria-labelledby="limit" className="rounded-sheet p-5">
      <ShieldCheck className="h-5 w-5" aria-hidden />
      <AlertTitle id="limit" className="font-bold">What MODE does not do</AlertTitle>
      <AlertDescription className="mt-2">MODE is a decision-support and records platform. It does not issue hazard warnings, declare a State of Calamity or a State of Imminent Disaster, command field operations or replace the City's approved plans and authorities. In an emergency, call the City emergency hotline and follow official advisories.</AlertDescription>
    </Alert>
  );
}

// ------------------------------------------------------------------ pages
export function PublicHome() {
  return (
    <Frame path="/" title="Home" description="MODE is the Ormoc City DRRMO and EOC Manual of Operations platform: institutional assessment, the Manual, step-by-step workflows with forms, and EOC operations, mobile-first and offline-capable.">
      <section className="relative overflow-hidden rounded-sheet bg-banner text-on-level shadow-sheet">
        <picture aria-hidden>
          <source srcSet="/brand/app-banner-1600.webp" type="image/webp" />
          <img src="/brand/app-banner-1600.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-banner via-banner/85 to-banner/40" aria-hidden />
        <div className="relative grid items-center gap-8 px-6 py-12 md:grid-cols-[1.25fr_.75fr] md:px-12 md:py-16">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-on-level/40 text-on-level">RA 10121</Badge>
              <Badge variant="outline" className="border-on-level/40 text-on-level">RA 12287</Badge>
              <Badge variant="outline" className="border-on-level/40 text-on-level">NDRRMC Memo 131 s. 2018</Badge>
            </div>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight md:text-5xl">One place to run the City's DRRM and EOC procedures.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed opacity-90">MODE holds the Manual of Operations, turns each procedure into steps people can follow on a phone, and keeps the evidence that they were followed.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login" {...tip('Sign in with your MODE account')} className="inline-flex min-h-tap items-center gap-2 rounded-control bg-accent-bright px-5 font-bold text-banner shadow-raised hover:opacity-90">Sign in <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <Link to="/about" {...tip('Read what MODE is and how it works')} className="inline-flex min-h-tap items-center rounded-control border border-on-level/60 px-5 font-semibold hover:bg-on-level/10">About MODE</Link>
            </div>
          </div>
          <div className="grid gap-3">
            {[{ icon: WifiOff, t: 'Works offline', b: 'Entries wait on the device and send when there is signal.' },
              { icon: ShieldCheck, t: 'Authority stays online', b: 'Approvals and level changes need a connection, so nobody acts on old information.' },
              { icon: ListChecks, t: 'Every step has a record', b: 'Each step closes on its form, with who and when.' }].map(({ icon: Icon, t, b }) => (
              <div key={t} className="flex gap-3 rounded-sheet border border-on-level/25 bg-on-level/10 p-4 backdrop-blur">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-accent-bright" aria-hidden />
                <div><p className="font-bold">{t}</p><p className="text-sm opacity-90">{b}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="pt-12">
        <h2 id="how" className="text-3xl font-bold">How it works</h2>
        <p className="mt-2 max-w-prose text-muted">The Manual is improved in a cycle. The platform keeps each turn of the cycle on record.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CYCLE.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative rounded-sheet border border-line bg-surface p-5 shadow-raised">
              <span className="font-data text-sm font-bold text-accent-ink">Step {i + 1}</span>
              <Icon className="mt-2 h-7 w-7 text-action" aria-hidden />
              <h3 className="mt-2 text-lg font-bold">{title}</h3>
              <p className="mt-1 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="supports" className="py-12">
        <h2 id="supports" className="text-3xl font-bold">What MODE supports</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Card className="h-full rounded-sheet transition hover:-translate-y-0.5 hover:border-sky hover:shadow-sheet motion-reduce:hover:translate-y-0">
                <CardHeader className="pb-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-soft text-action"><Icon className="h-5 w-5" aria-hidden /></span>
                  <CardTitle className="pt-2 text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent><CardDescription className="text-base text-muted">{body}</CardDescription></CardContent>
              </Card>
            </li>
          ))}
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
      <Accordion type="multiple" className="mt-8 max-w-3xl rounded-sheet border border-line bg-surface px-4">
        {FAQS.map((f, i) => (
          <AccordionItem key={f.question} value={`q${i}`} className="border-line">
            <AccordionTrigger {...tip('Show or hide the answer')} className="min-h-tap text-left font-bold">{f.question}</AccordionTrigger>
            <AccordionContent className="leading-7 text-muted">{f.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
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
          <li key={title}><Card className="h-full rounded-sheet"><CardHeader className="pb-2"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-soft text-action"><Icon className="h-5 w-5" aria-hidden /></span><CardTitle className="pt-2 text-xl">{title}</CardTitle></CardHeader><CardContent className="text-muted">{body}</CardContent></Card></li>
        ))}
      </ul>
      <Alert variant="warning" className="mt-8 rounded-sheet p-5">
        <Siren className="h-5 w-5" aria-hidden />
        <AlertTitle className="font-bold">Not an emergency channel</AlertTitle>
        <AlertDescription className="mt-2">This page and the support email are not monitored around the clock. In an emergency, call the City emergency hotline or your barangay, and follow official advisories.</AlertDescription>
      </Alert>
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
      <p>In the City's own Supabase project (database, sign-in and file storage), hosted in Supabase's Northeast Asia region in Tokyo, Japan (ap-northeast-1). This is a transfer of personal data outside the Philippines, made under the City's arrangement with the provider. Access rules are enforced by the database for every request (row-level security); evidence, Vault and map-layer files are private and open through links that expire after five minutes (only the City basemap, which is public map data, is open); authority actions need a live connection; records that carry legal or financial weight cannot be deleted.</p>
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
      <p>This policy explains the cookies and similar technologies MODE uses: what each item is, why it is needed, how long it stays and how you can control it. "Similar technologies" means storage in your browser that works like a cookie: local storage, session storage, the IndexedDB database and the service-worker cache.</p>
      <h2>Summary</h2>
      <ul>
        <li><strong>No advertising, analytics or tracking.</strong> MODE does not use cookies or any other technology to profile you, measure visits or show advertisements, and it shares nothing with advertising or analytics companies.</li>
        <li><strong>Only what MODE needs to work.</strong> Every item below is first-party (set by MODE itself) and is either strictly necessary for the service you asked for, or remembers a preference you chose.</li>
        <li><strong>Browser storage instead of cookies.</strong> MODE keeps these items in browser storage rather than in cookies, so they are not sent to the server with every request. If MODE ever needs a cookie, it will be listed in the table below before it is used.</li>
      </ul>
      <h2>What MODE stores on your device</h2>
      <table>
        <thead><tr><th>Item</th><th>Category</th><th>Purpose</th><th>Kept until</th></tr></thead>
        <tbody>
          <tr><td>Sign-in session (local storage, key beginning <code>sb-</code>)</td><td>Strictly necessary</td><td>Keeps you signed in and lets the server check your role.</td><td>You sign out, or the session expires</td></tr>
          <tr><td>Offline records (IndexedDB database <code>ormoc-drrm-ops</code>)</td><td>Strictly necessary</td><td>The records your role can read, entries waiting to send and files waiting to upload, so MODE works without a connection.</td><td>You sign out (unsent entries of other accounts on a shared device are kept for them)</td></tr>
          <tr><td>App files (service-worker cache)</td><td>Strictly necessary</td><td>The app, its fonts and images, so it opens offline. Manual figures and map tiles are not cached.</td><td>Replaced at each update</td></tr>
          <tr><td>Update marker (session storage, <code>drrm:reloaded-after-update</code>)</td><td>Strictly necessary</td><td>Prevents an update from reloading the page twice.</td><td>The browser tab is closed</td></tr>
          <tr><td>Appearance (local storage, <code>theme</code>)</td><td>Preference</td><td>Light, dark or the device setting, as you chose.</td><td>You change it or clear site data</td></tr>
          <tr><td>Accessibility settings (local storage, <code>mode-accessibility-preferences</code>)</td><td>Preference</td><td>Text size, contrast, font and motion, as you chose.</td><td>You reset them or clear site data</td></tr>
          <tr><td>Install reminder (local storage, <code>mode-install-dismissed-at</code>)</td><td>Preference</td><td>Hides the "Install MODE" reminder after you dismiss it.</td><td>30 days</td></tr>
          <tr><td>Tool workspaces (local storage, keys beginning <code>ormoc-tools:</code>)</td><td>Functional</td><td>Your own ICS exercise, continuity-plan and Gawad KALASAG work, kept per account on this device.</td><td>You delete them or sign out</td></tr>
        </tbody>
      </table>
      <h2>Legal basis</h2>
      <p>Strictly necessary items are needed to provide the service you requested and to protect City records; they cannot be switched off without stopping MODE from working. Preference items store choices you make and are only written when you make them. Processing follows RA 10173 (Data Privacy Act of 2012), its IRR and NPC issuances.</p>
      <h2>Who else receives data</h2>
      <p>Only the City's Supabase project, which also serves the map basemap. Links to PAGASA, PHIVOLCS and other services open in a new tab and are not loaded inside MODE; those sites have their own cookie policies.</p>
      <h2>How to control or remove these items</h2>
      <ul>
        <li><strong>Sign out</strong> (Settings) to remove your records and session from the device.</li>
        <li><strong>Change a preference</strong> with the Appearance or Accessibility buttons, or reset it there.</li>
        <li><strong>Clear site data</strong> in your browser settings to remove everything at once. Entries that have not yet been sent are lost, so sync first.</li>
      </ul>
      <h2>Changes</h2>
      <p>This policy is updated whenever MODE adds, changes or removes an item, and the "Last reviewed" date above changes with it.</p>
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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/" {...tip('MODE home')}>Home</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/policies/privacy" {...tip('All policies')}>Policies</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{p.title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className="mt-4 text-4xl font-extrabold">{p.title}</h1>
      <p className="mt-3 text-sm text-muted">In effect from {POLICY.effective}. Approved by {POLICY.owner}. Last reviewed against the deployed system: {POLICY.lastReviewed}.</p>
      {approved && (
        <Alert className="mt-6 rounded-sheet">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <AlertTitle className="font-bold">Approved by the City Legal Office and the City Data Protection Officer.</AlertTitle>
          <AlertDescription>Approval snapshot of 10 November 2026; the City may re-issue the effective date or approving officer by configuration.</AlertDescription>
        </Alert>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Other policies" className="order-last lg:order-first">
          <p className="mb-2 font-data text-xs font-bold uppercase tracking-widest text-muted">Policies</p>
          <ul className="space-y-1">
            {POLICIES.map((x) => (
              <li key={x.slug}><Link to={`/policies/${x.slug}`} {...tip(x.description)} aria-current={x.slug === p.slug ? 'page' : undefined}
                className={`flex min-h-tap items-center rounded-control border-l-4 px-3 text-sm font-semibold ${x.slug === p.slug ? 'border-accent bg-sky-soft' : 'border-transparent hover:bg-sky-soft/60'}`}>{x.title}</Link></li>
            ))}
          </ul>
          <Separator className="my-4" />
          <p className="text-xs text-muted">Questions: <a href={`mailto:${SITE.dpoEmail}`} {...tip('Write to the data protection contact')} className="underline">{SITE.dpoEmail}</a></p>
        </nav>
        <article className="prose-doc max-w-3xl rounded-sheet border border-line bg-surface p-6 shadow-raised md:p-8"><PolicyBody slug={p.slug} /></article>
      </div>
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
