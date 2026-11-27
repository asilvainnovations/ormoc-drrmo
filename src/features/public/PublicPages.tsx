// Public pages (1.10.0, refined 18 Nov 2026 under ADR-045): the indexable face of MODE. Everything here is
// readable without an account and without loading the workspace (no IndexedDB, no sync). Content is data
// (typed arrays) so it can be reviewed and tested; policy text describes what the deployed code does
// (checked 8 Nov 2026) and says what the City still has to confirm. Contact details and policy status come
// from src/lib/site.ts. The copy follows docs/implementation/public-website-pwa/01-public-web-copy.md.
import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Activity, ArrowRight, BookOpen, ClipboardCheck, FileText, LifeBuoy, ListChecks, Mail, Map as MapIcon, Menu, RadioTower, RefreshCcw, ShieldCheck, Siren, Users, WifiOff } from 'lucide-react';
import { Seal } from '@/components/Brand';
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
import { PRODUCT } from '@/lib/product';
import { POLICY, policyApproved, setPageMeta, SITE } from '@/lib/site';
import { USER_GUIDE_LABEL, USER_GUIDE_TIP, USER_GUIDE_URL } from '@/lib/userGuide';
import { SYSTEMS_DIAGNOSIS_LABEL, SYSTEMS_DIAGNOSIS_TIP, SYSTEMS_DIAGNOSIS_URL } from '@/lib/systemsDiagnosis';
import { InstallPrompt } from '@/components/InstallPrompt';

// ------------------------------------------------------------------ content
type PolicySlug = 'privacy' | 'terms' | 'accessibility' | 'cookies';
interface Policy { slug: PolicySlug; title: string; description: string }
interface Faq { group: string; question: string; answer: string }
interface Feature { title: string; body: string; icon: typeof Mail }

export const POLICIES: Policy[] = [
  { slug: 'privacy', title: 'Privacy Policy', description: 'What MODE holds, why, who controls it, how it is protected and how to exercise your rights.' },
  { slug: 'terms', title: 'Terms of Use', description: 'Permitted use, official information and decisions, accounts and service limits.' },
  { slug: 'accessibility', title: 'Accessibility Statement', description: 'Inclusive design, assistive technology and how to report a barrier.' },
  { slug: 'cookies', title: 'Cookies and Device Storage', description: 'What MODE keeps on your device, why, and how to clear it.' },
];

export const FAQS: Faq[] = [
  { group: 'About MODE', question: 'What is MODE?', answer: 'MODE is the digital operations and institutional knowledge platform supporting Ormoc City\'s CDRRMO and EOC Manuals. It brings together Manual content, procedures, institutional assessment, risk information and operational records for authorised users.' },
  { group: 'About MODE', question: 'Does MODE replace the approved Manuals?', answer: 'No. The approved CDRRMO Manual of Operations and EOC Manual remain the authoritative documents. MODE is their digital operational companion. A change in the platform does not, by itself, amend or approve the official Manuals.' },
  { group: 'About MODE', question: 'Does MODE make Ormoc City resilient?', answer: 'No platform can achieve resilience on its own. MODE is intended to support institutional capabilities, access to procedures, coordination, evidence and learning. Resilience depends on the City\'s wider governance, investments, services, partnerships and community action.' },

  { group: 'Authority and emergency operations', question: 'Does MODE issue official hazard warnings or advisories?', answer: 'No. Follow official information and advisories from PAGASA, PHIVOLCS, MGB and other agencies with the relevant mandate. MODE may help authorised users organise and access risk information, but it is not an official warning service.' },
  { group: 'Authority and emergency operations', question: 'Does MODE issue evacuation orders or declare a State of Calamity or State of Imminent Disaster?', answer: 'No. These decisions and declarations remain with the authorities designated by law. MODE may support documentation and coordination of the applicable process; it does not make the decision or confer authority.' },
  { group: 'Authority and emergency operations', question: 'Does MODE replace the Incident Commander or the Incident Management Team?', answer: 'No. The EOC supports coordination under the City\'s arrangements. Field command and incident management remain with the designated Incident Commander and IMT under the applicable ICS structure.' },
  { group: 'Authority and emergency operations', question: 'Can an EOC activation be treated as a declaration of a State of Calamity?', answer: 'No. EOC activation and a declaration under disaster-related law are distinct processes. Follow the applicable law, approved City procedures and authorised decision-makers.' },

  { group: 'Accounts and access', question: 'Who can use MODE, and how do I get an account?', answer: 'Create an account on the sign-in page, then ask the CDRRMO administrator to approve it and assign a role appropriate to your responsibilities. A new account sees nothing until it is approved.' },
  { group: 'Accounts and access', question: 'Why can I not see a record or module?', answer: 'Access depends on the permissions assigned to your account and the status of the relevant record. The rules are enforced by the database, not only by the screens. Contact the CDRRMO administrator if you believe your access is incorrect.' },
  { group: 'Accounts and access', question: 'Can I share my account?', answer: 'No. Use your own account, protect your sign-in credentials and report suspected account compromise or a lost device through the support channel.' },

  { group: 'Offline use, synchronisation and installation', question: 'Can MODE work offline?', answer: 'Some information and functions are available offline, depending on what has been made available on the device and the function being used. New entries remain on the device until connectivity returns. Check the displayed sync status and do not assume that an unsynchronised entry has reached the City\'s central system.' },
  { group: 'Offline use, synchronisation and installation', question: 'Can every action be completed offline?', answer: 'No. Actions that carry authority or need current information (changing the EOC level, approvals, declaration steps) require a live connection, so that two people cannot act on old information. Follow the on-screen status and the City\'s approved fallback procedures.' },
  { group: 'Offline use, synchronisation and installation', question: 'What should I do if a record is waiting to sync or shows a conflict?', answer: 'Keep the device available, avoid repeatedly submitting the same action, review the sync status and follow the instructions shown in the application. If the issue remains, contact support and give the page, approximate time, device and browser. Do not email passwords or sensitive information about affected persons.' },
  { group: 'Offline use, synchronisation and installation', question: 'How do I install MODE?', answer: 'Use "Install app" where your browser offers it. On iPhone or iPad, open MODE in Safari, tap Share, then Add to Home Screen. Installation is optional.' },

  { group: 'Assessment, evidence and validation', question: 'What does an institutional assessment score mean?', answer: 'A score represents the assessment result for a defined indicator and assessment cycle. It must be interpreted with its scoring criteria, evidence, validation status and applicable denominator. A score is not, by itself, proof of legal compliance or operational readiness.' },
  { group: 'Assessment, evidence and validation', question: 'Does uploading evidence mean that an indicator is validated?', answer: 'No. Evidence submission and evidence validation are distinct. Follow the assigned review and validation process and check the status shown for the record.' },
  { group: 'Assessment, evidence and validation', question: 'Can stakeholders edit or approve the Manual directly?', answer: 'Only users with the relevant permissions may contribute to the workflow. Review comments, technical recommendations and validation inputs do not automatically constitute formal approval. Approval remains with the official or body authorised under the City\'s process.' },

  { group: 'Risk information', question: 'Are the maps and risk profiles forecasts?', answer: 'No. They are decision-support materials based on identified sources and available data. Check the source, date, geographic coverage, limitations and validation status before using them. They do not replace official warnings or technical assessments.' },

  { group: 'Privacy and support', question: 'Are names of affected people stored?', answer: 'No. MODE has no fields for the names of evacuees, patients or informants. Barangay reports are counts. Staff accounts hold name, position, office and email.' },
  { group: 'Privacy and support', question: 'What should I avoid entering into MODE?', answer: 'Follow the City\'s data-protection and records-management instructions. Do not enter unnecessary personal or sensitive information about affected people into free-text fields or send it through ordinary email.' },
  { group: 'Privacy and support', question: 'How do I report a technical problem?', answer: `Email ${SITE.supportEmail} with the affected page or module, the approximate time, your device and browser, and a short description. Never send passwords, one-time codes or unnecessary personal data.` },
  { group: 'Privacy and support', question: 'Is the Support page an emergency channel?', answer: 'No. The website and the support email are not a substitute for the City\'s emergency hotline, EOC communications or official emergency reporting channels. In an emergency, use the established City and barangay procedures and follow official advisories.' },
];

/** How the Manual and the platform work together (home page, "How the platform supports improvement"). */
const CYCLE = [
  { icon: ClipboardCheck, title: 'Assess', body: 'Document institutional capacities, gaps and supporting evidence.' },
  { icon: ShieldCheck, title: 'Review and validate', body: 'Engage the responsible offices and technical stakeholders to examine findings and proposed procedures.' },
  { icon: ListChecks, title: 'Operationalise', body: 'Make approved guidance and workflows accessible to authorised personnel.' },
  { icon: RefreshCcw, title: 'Learn and improve', body: 'Use implementation records, exercises and after-action learning to inform future revisions.' },
];

const FEATURES: Feature[] = [
  { icon: BookOpen, title: 'The Manual of Operations', body: 'A structured digital companion to the City\'s CDRRMO and EOC Manuals, with access to controlled content, procedures and related guidance. The approved manuals remain the authoritative documents.' },
  { icon: ClipboardCheck, title: 'Institutional assessment and improvement', body: 'A structured way to assess institutional capacities, record supporting evidence, identify gaps and organise follow-up actions. Scores and maturity results must be read with their cycle, evidence and validation status.' },
  { icon: ListChecks, title: 'Operational workflows and protocols', body: 'Step-based guidance and supporting forms designed to help authorised personnel carry out defined procedures consistently. Actual authority remains with the officials and offices designated by law and City issuances.' },
  { icon: RadioTower, title: 'EOC coordination and records', body: 'Digital support for operational logs, situation reporting, resource coordination and related EOC records, subject to user roles and approved operating procedures.' },
  { icon: MapIcon, title: 'Risk information and decision support', body: 'Access to mapped and documented risk information, with source, date and validation context. These materials inform analysis; they are not forecasts or official warnings.' },
  { icon: WifiOff, title: 'Field-oriented and offline-capable access', body: 'A mobile-first experience designed to support access in connectivity-constrained settings. Users must check sync status and follow established fallback procedures when information cannot be synchronised.' },
];

// ------------------------------------------------------------------ frame
const linkCls = 'inline-flex min-h-tap items-center underline-offset-4 hover:underline';
const sealLinkCls = 'inline-flex min-h-tap min-w-tap items-center justify-center rounded-full';

function UserGuideLink({ compact = false }: { compact?: boolean }) {
  return (
    <a href={USER_GUIDE_URL} target="_blank" rel="noopener noreferrer" aria-label={`${USER_GUIDE_LABEL} (opens in a new tab)`} {...tip(USER_GUIDE_TIP)}
      className={compact ? linkCls : 'inline-flex min-h-tap items-center gap-1.5 rounded-control border border-line px-3 hover:bg-sky-soft/60'}>
      {!compact && <BookOpen className="h-4 w-4" aria-hidden />}
      <span className={compact ? '' : 'hidden sm:inline'}>User Guide</span>
    </a>
  );
}

function SystemsDiagnosisLink({ compact = false }: { compact?: boolean }) {
  return (
    <a href={SYSTEMS_DIAGNOSIS_URL} target="_blank" rel="noopener noreferrer" aria-label={`${SYSTEMS_DIAGNOSIS_LABEL} (opens in a new tab)`} {...tip(SYSTEMS_DIAGNOSIS_TIP)}
      className={compact ? linkCls : `${linkCls} hidden lg:inline-flex`}>
      {SYSTEMS_DIAGNOSIS_LABEL}
    </a>
  );
}

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
          <div className="flex items-center gap-2">
            <a href={SITE.cityWebsite} target="_blank" rel="noopener noreferrer" aria-label="City Government of Ormoc website (opens in a new tab)"
              {...tip('City Government of Ormoc website, opens in a new tab')} className={sealLinkCls}><Seal kind="city" size={36} /></a>
            <Link to="/" aria-label="Ormoc City CDRRMO, MODE home" {...tip('Ormoc City CDRRMO: MODE home')} className={sealLinkCls}><Seal kind="cdrrmo" size={36} /></Link>
            <Link to="/" {...tip('MODE home')} className="inline-flex min-h-tap items-center font-display text-lg font-extrabold text-action">
              <span>{SITE.name} <span className="hidden text-sm font-medium text-muted sm:inline">Ormoc City DRRMO and EOC</span></span>
            </Link>
          </div>
          <nav aria-label="Public" className="flex items-center gap-x-4 text-sm font-semibold">
            <Link to="/about" className={`${linkCls} hidden md:inline-flex`} {...tip('What MODE is and how it works')}>About</Link>
            <Link to="/faq" className={`${linkCls} hidden md:inline-flex`} {...tip('Answers to common questions')}>FAQ</Link>
            <Link to="/support" className={`${linkCls} hidden md:inline-flex`} {...tip('Help, privacy requests and contacts')}>Support</Link>
            <SystemsDiagnosisLink />
            <UserGuideLink />
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
            <p className="mt-2 text-sm text-muted">Technical support: <a href={`mailto:${SITE.supportEmail}`} {...tip('Write to platform support')} className="underline">{SITE.supportEmail}</a></p>
            <p className="mt-1 text-sm text-muted">CDRRMO and privacy requests: <a href={`mailto:${SITE.dpoEmail}`} {...tip('Write to the CDRRMO and its data protection officer')} className="underline">{SITE.dpoEmail}</a></p>
          </div>
          <nav aria-label="Explore">
            <h2 className="font-bold">Explore</h2>
            <ul className="mt-1 text-sm">
              <li><Link to="/about" className={linkCls} {...tip('What MODE is and how it works')}>About MODE</Link></li>
              <li><Link to="/faq" className={linkCls} {...tip('Answers to common questions')}>Frequently asked questions</Link></li>
              <li><Link to="/support" className={linkCls} {...tip('Help, privacy requests and contacts')}>Support</Link></li>
              <li><UserGuideLink compact /></li>
              <li><SystemsDiagnosisLink compact /></li>
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
      <AlertTitle id="limit" className="font-bold">Important: what MODE does not do</AlertTitle>
      <AlertDescription className="mt-2">MODE is a digital decision-support, workflow and records platform. It does not issue official hazard warnings or evacuation orders, declare a State of Calamity or State of Imminent Disaster, command field operations, or replace approved City plans and authoritative government issuances. In emergencies, follow official advisories and established City emergency procedures.</AlertDescription>
    </Alert>
  );
}

// ------------------------------------------------------------------ pages
export function PublicHome() {
  return (
    <Frame path="/" title="Home" description="MODE is the digital operations and institutional knowledge platform supporting the Ormoc City CDRRMO and EOC: the Manual of Operations, procedures, institutional assessment, risk information and operational records.">
      <section className="relative overflow-hidden rounded-sheet bg-banner text-on-level shadow-sheet">
        <picture aria-hidden>
          <source srcSet="/brand/app-banner-1600.webp" type="image/webp" />
          <img src="/brand/app-banner-1600.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-banner via-banner/85 to-banner/40" aria-hidden />
        <div className="relative grid items-center gap-8 px-6 py-12 md:grid-cols-[1.25fr_.75fr] md:px-12 md:py-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-accent-bright">Ormoc City | Disaster risk reduction and emergency operations</p>
            <p className="mt-1 text-sm font-semibold opacity-90">{SITE.name}: {PRODUCT.expansion}</p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight md:text-5xl">Enabling the Institutional Foundations of a Resilient Ormoc</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed opacity-90">MODE is the digital operations and institutional knowledge platform supporting the Ormoc City Disaster Risk Reduction and Management Office (CDRRMO) and Emergency Operations Center (EOC).</p>
            <p className="mt-3 max-w-2xl leading-relaxed opacity-90">It brings together the Manual of Operations, operational procedures, institutional assessment, risk information and records of implementation, helping authorised personnel access guidance, coordinate work and learn from experience.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login" {...tip('Sign in with your MODE account')} className="inline-flex min-h-tap items-center gap-2 rounded-control bg-accent-bright px-5 font-bold text-banner shadow-raised hover:opacity-90">Sign in to MODE <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <a href="#supports" {...tip('Jump to what MODE brings together')} className="inline-flex min-h-tap items-center rounded-control border border-on-level/60 px-5 font-semibold hover:bg-on-level/10">Explore the platform</a>
              <a href={SYSTEMS_DIAGNOSIS_URL} target="_blank" rel="noopener noreferrer" aria-label={`${SYSTEMS_DIAGNOSIS_LABEL} (opens in a new tab)`} {...tip(SYSTEMS_DIAGNOSIS_TIP)} className="inline-flex min-h-tap items-center gap-2 rounded-control border border-on-level/60 px-5 font-semibold hover:bg-on-level/10"><Activity className="h-4 w-4" aria-hidden /> {SYSTEMS_DIAGNOSIS_LABEL}</a>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-on-level/40 text-on-level">RA 10121</Badge>
              <Badge variant="outline" className="border-on-level/40 text-on-level">RA 12287</Badge>
              <Badge variant="outline" className="border-on-level/40 text-on-level">NDRRMC Memo 131 s. 2018</Badge>
            </div>
          </div>
          <div className="grid gap-3">
            {[{ icon: WifiOff, t: 'Offline-capable', b: 'Entries wait on the device and send when there is signal. Check the sync status.' },
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

      {/* 1.32.1: the City Mayor's message in the Ormoc City DRRM Ten-Year Plan (2023-2032), p. 2, quoted word for word. */}
      <figure aria-labelledby="mayor-quote-by" className="mt-10 flex flex-col items-center gap-6 rounded-sheet border border-line bg-surface p-6 shadow-raised sm:flex-row sm:items-center md:p-8">
        <picture className="shrink-0">
          <source type="image/webp" srcSet="/brand/mayor-lucy-torres-gomez-192.webp 1x, /brand/mayor-lucy-torres-gomez-384.webp 2x" />
          <img src="/brand/mayor-lucy-torres-gomez-192.jpg" srcSet="/brand/mayor-lucy-torres-gomez-192.jpg 1x, /brand/mayor-lucy-torres-gomez-384.jpg 2x"
            width={144} height={144} loading="lazy" decoding="async" alt="Lucy Torres-Gomez, City Mayor of Ormoc"
            className="h-28 w-28 rounded-full object-cover ring-4 ring-accent ring-offset-2 ring-offset-surface md:h-36 md:w-36" />
        </picture>
        <div className="min-w-0 text-center sm:text-left">
          <blockquote className="font-display text-xl font-semibold leading-snug text-ink md:text-2xl">
            <p>
              <span aria-hidden className="mr-1 text-accent">&ldquo;</span>I foresee the development of more focused, targeted and advanced{' '}
              <abbr title="Programs, Projects and Activities" className="cursor-help no-underline decoration-dotted hover:underline">PPAs</abbr>{' '}
              to address the gaps of Ormoc City&rsquo;s disaster resilience.<span aria-hidden className="ml-0.5 text-accent">&rdquo;</span>
            </p>
          </blockquote>
          <figcaption id="mayor-quote-by" className="mt-4">
            <span className="block font-bold text-ink">Lucy Torres-Gomez</span>
            <span className="block text-sm text-muted">City Mayor of Ormoc</span>
            <span className="mt-1 block text-xs text-muted">Message from the Mayor, <cite className="not-italic">Ormoc City DRRM Ten-Year Plan (2023&ndash;2032)</cite>, p. 2. PPAs: programs, projects and activities. Quoted from the City&rsquo;s plan; it is not a statement about MODE.</span>
          </figcaption>
        </div>
      </figure>

      <section aria-labelledby="why" className="pt-12">
        <h2 id="why" className="text-3xl font-bold">Why MODE matters</h2>
        <p className="mt-3 max-w-3xl text-lg font-semibold">From institutional guidance to coordinated action. From operational learning to continuous improvement.</p>
        <p className="mt-3 max-w-3xl text-muted">Disaster risk reduction is not delivered by a platform alone. It depends on capable institutions, clear responsibilities, trusted information, practical procedures, coordinated partnerships and sustained learning.</p>
        <p className="mt-3 max-w-3xl text-muted">MODE is designed to support these foundations by making operational guidance easier to access and use, connecting institutional assessment with improvement actions, and helping preserve the records and learning that strengthen the City's DRRM and EOC systems.</p>
      </section>

      <section aria-labelledby="supports" className="pt-12">
        <h2 id="supports" className="text-3xl font-bold">What MODE brings together</h2>
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

      <section aria-labelledby="how" className="pt-12">
        <h2 id="how" className="text-3xl font-bold">How the platform supports improvement</h2>
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

      <section aria-labelledby="roles" className="pt-12">
        <h2 id="roles" className="text-3xl font-bold">Built around institutional roles</h2>
        <p className="mt-3 max-w-3xl text-muted">MODE supports the City's DRRM governance and operating arrangements. It does not reassign statutory mandates or replace the CDRRMC, CDRRMO, EOC, Incident Commander, Incident Management Team or other authorised offices and officials.</p>
      </section>

      <section aria-labelledby="participate" className="py-12">
        <Card className="rounded-sheet">
          <CardHeader>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-soft text-action"><Users className="h-5 w-5" aria-hidden /></span>
            <CardTitle id="participate" className="pt-2 text-2xl">Participate in Strengthening the Manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted">
            <p>A useful Manual must be technically sound, practical in the field, understood by the offices responsible for implementation and consistent with approved City policies and applicable law.</p>
            <p>CDRRMO, City departments, barangay representatives and partner stakeholders have an important role in reviewing and validating the procedures relevant to their mandates.</p>
            <Link to="/support" {...tip('How Manual review and validation questions are handled')} className="inline-flex min-h-tap items-center gap-2 font-bold text-action underline">Learn about the Manual review and validation process <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="trust" className="pb-12">
        <h2 id="trust" className="text-3xl font-bold">Built to support institutional governance</h2>
        <p className="mt-3 max-w-3xl text-muted">MODE is a digital support platform of the City Government of Ormoc's CDRRMO and EOC. Approved manuals, laws, ordinances and official issuances remain authoritative. The City is the personal information controller; access is by approved account and role.</p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold">
          <li><Link to="/policies/privacy" className={linkCls} {...tip('What MODE holds, why, and how to exercise your rights')}>Privacy Policy</Link></li>
          <li><Link to="/policies/terms" className={linkCls} {...tip('Permitted use, official information and decisions')}>Terms of Use</Link></li>
          <li><Link to="/policies/accessibility" className={linkCls} {...tip('Inclusive design and how to report a barrier')}>Accessibility Statement</Link></li>
          <li><Link to="/support" className={linkCls} {...tip('Help, privacy requests and contacts')}>Support and contacts</Link></li>
        </ul>
      </section>
      <Limitation />
    </Frame>
  );
}

export function AboutPage() {
  return (
    <Frame path="/about" title="About MODE" description="About MODE: purpose, relationship to the approved Manuals, institutional roles and boundaries, and who uses the Ormoc City CDRRMO and EOC platform.">
      <Eyebrow>About the platform</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold">A digital companion for Ormoc City's DRRM and EOC operations</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted">MODE supports the development, use and continuous improvement of the Ormoc City CDRRMO Manual of Operations and EOC Manual. It is intended to make institutional guidance more accessible, connect assessment with practical improvement, and support the documentation of operational processes and learning.</p>
      <div className="prose-doc mt-8 max-w-3xl">
        <h2>Why MODE was developed</h2>
        <p>Effective disaster risk reduction and emergency operations require more than plans and equipment. They rely on institutions that understand their roles, personnel who can find and apply procedures, information that can be assessed in context, and coordination arrangements that work across offices and communities.</p>
        <p>MODE provides a shared digital environment for parts of this institutional work. It helps organise the Manual and its supporting procedures, capture assessment and validation evidence, guide defined workflows, and maintain operational records for authorised users.</p>
        <h2>The platform supports the Manual; it is not the Manual</h2>
        <p>The City's duly approved CDRRMO Manual of Operations and EOC Manual remain the authoritative documents. MODE provides a digital means of accessing and supporting their use. A screen, workflow, score, map or database entry does not amend an approved Manual, City policy or legal mandate.</p>
        <p>Any proposed change to controlled Manual content must follow the City's established review, validation and approval arrangements. Digital publication must not be treated as approval unless the authorised process has been completed and recorded.</p>
        <h2>Contributing to a resilient Ormoc</h2>
        <p>The City's development and resilience aspirations provide the wider context for strengthening local DRRM institutions. The City's Comprehensive Development Plan expresses its development vision, while the City's Ten-Year Local DRRM Plan sets a direction for advancing disaster resilience. MODE is one enabling instrument within this broader institutional effort; it is not a substitute for the plans, investments, partnerships and public action needed to achieve those aspirations.</p>
        <h2>Institutional roles and boundaries</h2>
        <ul>
          <li><strong>CDRRMC:</strong> provides the policy direction, coordination and oversight assigned under applicable law and local issuances.</li>
          <li><strong>CDRRMO:</strong> serves as the City's permanent DRRM office and provides the technical and institutional functions assigned to it.</li>
          <li><strong>EOC:</strong> serves as an activated coordination mechanism under the City's approved arrangements.</li>
          <li><strong>Incident Commander and IMT:</strong> retain their established incident command and management functions under the applicable ICS arrangements.</li>
          <li><strong>MODE:</strong> provides digital access, workflow support, assessment, information management and records within approved user permissions. It does not create or transfer statutory authority.</li>
        </ul>
        <h2>Who uses MODE</h2>
        <p>Access is intended for authorised City personnel and designated stakeholders whose responsibilities require use of the platform. Accounts, roles and permissions are assigned through the City's approved administration process. Each account sees only what its role allows.</p>
        <h2>Design principles</h2>
        <ul>
          <li><strong>Institutional ownership:</strong> the platform supports City processes and stays aligned with approved City policies and operating arrangements. The City owns the code and the data.</li>
          <li><strong>Practical usability:</strong> guidance should be understandable and usable by personnel working across office, EOC and field settings.</li>
          <li><strong>Evidence and traceability:</strong> assessment, validation, operational records and Manual revisions retain source and status information.</li>
          <li><strong>Interoperability of roles:</strong> the platform supports coordination without blurring mandates or command relationships.</li>
          <li><strong>Continuous improvement:</strong> exercises, operational experience and after-action learning inform controlled improvements.</li>
          <li><strong>Responsible technology:</strong> offline use, privacy, access control, accessibility and data quality are treated as operational requirements.</li>
        </ul>
      </div>
    </Frame>
  );
}

export function FAQPage() {
  const groups = [...new Set(FAQS.map((f) => f.group))];
  return (
    <Frame path="/faq" title="Frequently Asked Questions" description="Answers about MODE: authority and emergency operations, accounts, offline use, assessment and validation, risk information, privacy and support.">
      <Eyebrow>Help centre</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold">Frequently asked questions</h1>
      {groups.map((g, gi) => (
        <section key={g} aria-labelledby={`faq-g${gi}`} className="mt-8 max-w-3xl">
          <h2 id={`faq-g${gi}`} className="text-2xl font-bold">{g}</h2>
          <Accordion type="multiple" className="mt-3 rounded-sheet border border-line bg-surface px-4">
            {FAQS.filter((f) => f.group === g).map((f, i) => (
              <AccordionItem key={f.question} value={`g${gi}q${i}`} className="border-line">
                <AccordionTrigger {...tip('Show or hide the answer')} className="min-h-tap text-left font-bold">{f.question}</AccordionTrigger>
                <AccordionContent className="leading-7 text-muted">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
      <p className="mt-8">Still need help? <Link to="/support" {...tip('Help, privacy requests and contacts')} className="font-bold text-action underline">Contact support</Link>.</p>
    </Frame>
  );
}

export function SupportPage() {
  const cards: { icon: typeof Mail; title: string; body: ReactNode }[] = [
    { icon: LifeBuoy, title: 'Technical support', body: <>Email <a href={`mailto:${SITE.supportEmail}`} {...tip('Write to platform support')} className="font-semibold underline">{SITE.supportEmail}</a> for help with the platform. Include the page or module, the approximate time, your device and browser, whether you were online, and what happened. Do not include passwords, one-time codes or unnecessary personal information.</> },
    { icon: Mail, title: 'Accounts and roles', body: 'New accounts are approved, and roles assigned, by the CDRRMO administrator. Contact your office head or the CDRRMO if you need access or believe your role is incorrect.' },
    { icon: FileText, title: 'Manual review and validation', body: 'For questions about Manual content, review comments or validation responsibilities, follow the CDRRMO-coordinated process and the instructions issued to participating offices and stakeholders. Participation in review does not, by itself, constitute formal approval.' },
    { icon: ShieldCheck, title: 'Privacy requests', body: <>For access, correction or other requests about records the City holds, write to the CDRRMO and its Data Protection Officer at <a href={`mailto:${SITE.dpoEmail}`} {...tip('Write to the CDRRMO data protection contact')} className="font-semibold underline">{SITE.dpoEmail}</a>.</> },
    { icon: Users, title: 'Accessibility feedback', body: <>If you meet a barrier using MODE with a keyboard, screen reader, magnification or other assistive technology, write to <a href={`mailto:${SITE.supportEmail}`} {...tip('Report an accessibility barrier')} className="font-semibold underline">{SITE.supportEmail}</a> and describe the page, device, browser and assistive technology involved.</> },
    { icon: BookOpen, title: 'How-to guidance', body: <>Read the <a href={USER_GUIDE_URL} target="_blank" rel="noopener noreferrer" {...tip(USER_GUIDE_TIP)} className="font-semibold underline">{USER_GUIDE_LABEL}</a> (opens in a new tab). The Manual of Operations, its SOPs and forms are in the Library after you sign in. Every button in MODE shows a tip when you hold or hover over it.</> },
  ];
  return (
    <Frame path="/support" title="Support" description="Help with MODE accounts, technical problems, Manual review, accessibility and privacy requests.">
      <Eyebrow>Help and assistance</Eyebrow>
      <h1 className="mt-2 text-4xl font-extrabold">MODE Support</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted">For help using MODE, account access, accessibility barriers or technical issues, use the channel below. Never send passwords, one-time codes or personal information of affected people by email.</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.map(({ icon: Icon, title, body }) => (
          <li key={title}><Card className="h-full rounded-sheet"><CardHeader className="pb-2"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-soft text-action"><Icon className="h-5 w-5" aria-hidden /></span><CardTitle className="pt-2 text-xl">{title}</CardTitle></CardHeader><CardContent className="text-muted">{body}</CardContent></Card></li>
        ))}
      </ul>
      <Alert variant="warning" className="mt-8 rounded-sheet p-5">
        <Siren className="h-5 w-5" aria-hidden />
        <AlertTitle className="font-bold">Not an emergency channel</AlertTitle>
        <AlertDescription className="mt-2">MODE Support is not an emergency reporting or dispatch service and is not monitored around the clock. In an emergency, contact the City's official emergency hotline, the appropriate barangay response channel or the EOC through established procedures, and follow official advisories.</AlertDescription>
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
          <AlertTitle className="font-bold">Compliant with the Data Privacy Act of 2012</AlertTitle>
          <AlertDescription>Regularly updated to maintain accuracy, relevance, and alignment with current operational requirements and approved practices.</AlertDescription>
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
