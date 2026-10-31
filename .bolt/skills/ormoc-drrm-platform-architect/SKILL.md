---
name: ormoc-drrm-platform-architect
description: "Use this skill for any architecture, design, back-end or front-end work on the Ormoc DRRM Operations Platform: the mobile-first, offline-capable PWA that supports the CDRRMO Manual of Operations (MOO) and the EOC Manual, built for the City Government of Ormoc by Alvin M. Silva (Cognitio Plus / ASilva Innovations). The platform supports the manuals. It is not the manual. The approved MOO and EOC Manual remain the legal documents. The platform holds their current text, version history, protocols, and the evidence that they are used.Architect, design and build the Ormoc CDRRMO/EOC Manual of Operations platform and toolkit (repo asilvainnovations/ormoc-drrmo) — SQL/RLS back end, offline PWA front end, rules from RA 12287, Memo 131 and DILG VIII."
---

## 0. Sources of truth, in order  
  
1. \*\*Source code in the repo\*\* (\`github.com/asilvainnovations/ormoc-drrmo\`, branch \`main\`). Clone fresh every session: \`GIT\_LFS\_SKIP\_SMUDGE=1 git clone --depth 1 https://github.com/asilvainnovations/ormoc-drrmo\`. Read \`package.json\` for the current version and \`git log -1\` for the commit. The repo moves fast, so never trust a version number from memory or from a summary.  
2. \*\*Verified reference files\*\* in \`reference/\`: the IAT workbook (\`Ormoc\_CDRRMO-EOC\_Institutional\_Assessment\_Tool\_v1-\*.xlsx\`), the Traceability and 140-Indicator Data Dictionary v1.1, the MOO chapter drafts (\`.docx\` and \`reference/moo/\*.md\`), and the legal PDFs.  
3. \*\*Repo docs\*\*: \`docs/system-design.md\`, \`docs/design-system.md\`, \`docs/adr/\*.md\`, \`DEPLOY.md\`, \`README.md\`.  
4. \*\*Project write-ups\*\* (\`claude/platform\_audit\_\*.md\`, \`claude/v1.2\_review\_and\_signup.md\`, \`claude/DRRM\_Platform\_summary.md\`, \`claude/IAT\_\*.md\`). Treat these as secondary. Check every claim in them against the code before acting on it.  
  
If prose disagrees with code, the code wins, and the prose gets corrected in the same change. Legal PDFs (IRR of RA 12287, NDRRMC Memo 131 s. 2018) are image scans read by OCR. Mark legal readings as medium confidence until someone checks them against certified copies.  
  
## 1. Regulatory and domain anchors  
  
Encode every rule from these, and cite the source in code comments, the ADR, and the \`RefText\` catalogue (\`src/data/references.ts\`):  
  
| Source | What it drives in the platform |  
|---|---|  
| RA 10121 + IRR | CDRRMO mandate, LDRRMF 70/30 split, CDRRMC, roles |  
| RA 12287 (Imminent Disaster Act) + IRR (14 Sep 2026) | PDRA → State of Imminent Disaster declaration, the 72 h lead-time rule, the RDRRMC 24 h reply, the Mayor's EO, AA funding (≤10% of the 70% LDRRMF), tranches (≤30% beyond 72 h, ≤70% within), lifting, 45-day OCD report, 29 IRR Rule IV checklist actions |  
| NDRRMC Memo 131 s. 2018 | EOC establishment, White/Blue/Red alert levels, activation and deactivation, EOC functions |  
| DILG VIII Harmonized Disaster Response Reporting Template + SOP | SitRep fields and report types (pre, during, post, terminal); LGU-to-Province cut-offs (6 AM/6 PM at White; 9 AM/7 PM at Blue and Red); confirmed vs for-validation dead and missing; displaced persons; sex- and age-disaggregated data; State of Calamity fields; PDF and Excel export |  
| NDRRMC–OCD PSCP Guidebook + CSC MC 2 s. 2021 | PSCP workbench (ISO 22301 terms MTPD, RTO, RPO) |  
| EOC Capability Assessment Checklist | EOC readiness items (72 h three-deep roster, generator, alternate EOC, comms redundancy, exercises, AARs) |  
| Ormoc City DRRM 10-Year Plan 2023–2032 | Local hazards, gaps, priorities (institutionalising EOC operations, ICS/EOC training, roster, RDNA/PDNA teams) |  
| IAT v1.1 (140 indicators: Part A 82, Part B 43, Part C 15) | Evidence-gated scoring, maturity bands, IMI, Interface Index, gap priority, action plan |  
| Traceability v1.1 (MR-01 to MR-18) | Every feature and manual section maps to at least one master requirement |  
| RA 10173 (Data Privacy Act) | No names of affected persons, evacuees or informants; aggregate barangay counts only; audit log retention questions go to the DPO |  
  
Fixed local facts:  
- \*\*Ormoc has 85 barangays\*\* (PSA PSGC, 4Q 2022). The 28 numbered Poblacion barangays merged into South, East and West, and Barangay 29 became North. Any list showing 110 is out of date.  
- \*\*Time zone\*\*: all legal clocks use server time, displayed as \`Asia/Manila\`.  
- \*\*Short-lead hazards\*\* (Anilao–Malbasag flash floods, landslides) usually fall under the 72 h declaration floor. Route them to city-level early action, not to a declaration.  
  
When a legal reading is contested, do not hard-code a guess. Store the parameter in \`aa\_rules\` (or a similar rules table), warn instead of blocking where the law allows discretion, and write an ADR naming whose reading it is (City Legal Office, OCD VIII).  
  
## 2. Architecture invariants (do not break)  
  
Stack (ADR-001): Vite 5, React 18, TypeScript strict, Tailwind 3, React Router 6, Dexie 4 (IndexedDB), zod, marked + DOMPurify, vite-plugin-pwa. Supabase: Postgres 15+ with RLS, Auth, Storage, Realtime. Exact versions are pinned. Node 22. \*\*No custom application server and no edge functions.\*\* Business rules live in SQL.  
  
\`\`\`  
React screens ─ src/domain (TS mirror of SQL rules)  
   │ reads                      │ writes  
   ▼                            ▼  
IndexedDB (Dexie) ◄─ store.save() ─► outbox ──push FIFO──► PostgREST  
   ▲ pull by (cursor, pk) keyset, 5-min overlap            │  
   └──────────── Realtime nudges for EOC tables ◄──────────┘  
Postgres: RLS + app.\* SECURITY DEFINER helpers (fixed search\_path)  
          triggers: app.touch\_row (version, stamps), app.audit, guard\_\* locks  
          RPCs: start\_protocol, set\_eoc\_level, load\_aa\_checklist, my\_roles …  
          views: v\_response\_results, v\_domain\_results, v\_cycle\_results, v\_traceability …  
Storage: private buckets \`evidence\` and \`vault\`, signed URLs (5 min)  
\`\`\`  
  
Rules:  
1. \*\*Rules live in SQL; TypeScript mirrors them\*\* (ADR-005). Any rule in \`src/domain/\*.ts\` must say which migration it mirrors and must have a parity or unit test. Scoring parity is \`src/domain/scoring.parity.test.ts\`.  
2. \*\*Local-first\*\* (ADR-003). Screens read only from Dexie, never wait on the network. Writes go through \`save()\` / \`saveMany()\` in \`src/lib/store.ts\`, which writes the row and the outbox entry in one transaction.  
3. \*\*Optimistic concurrency.\*\* Every editable table has \`id uuid, version int, created\_at, updated\_at\` maintained by \`app.touch\_row()\`. A stale write raises SQLSTATE \`PT409\` (HTTP 409). Never use \`40001\`, because PostgREST retries it forever. New rows are sent as inserts and edits as updates (a v1.2 fix): never upsert through the BEFORE INSERT trigger.  
4. \*\*Server-stamped columns are never sent.\*\* Who/when columns, sequence numbers, deadlines and snapshots are listed in \`omit\` for each table in \`src/lib/tables.ts\`. The server sets \`created\_by\`, \`prepared\_by\`, \`validated\_by\` and \`done\_by\`.  
5. \*\*Authority actions need a connection\*\* (ADR-006). EOC level changes, approvals, declaration steps, disbursements and role grants use \`callOnline()\` and fail with \`NeedsConnectionError\`. They are never queued.  
6. \*\*Errors are classified.\*\* Transient errors (5xx, 429, timeouts, expired tokens) stop the queue and retry later. Only a clean refusal becomes a \`failed\` item carrying the server's message. A local row is removed only when the server says it does not exist.  
7. \*\*Accounts and devices\*\* (ADR-009). Open sign-up, but an account with no role reads nothing (\`app.is\_active\_user()\` = active profile plus at least one role). Outbox items carry \`userId\` and are sent only under that account. Sign-out clears the device, offline included, and must never erase another account's unsent items.  
8. \*\*Ten roles\*\* (ADR-004): \`cdrrmo\_head\`, \`eoc\_manager\`, \`eoc\_staff\`, \`duty\_officer\`, \`assessor\`, \`validator\`, \`lead\_office\_focal\`, \`author\`, \`viewer\`, \`admin\`. Enforce them in RLS and triggers, never only in the UI. Only \`cdrrmo\_head\` approves or retires manual versions and protocols.  
9. \*\*Immutability.\*\* Approved versions, validated responses, approved SitReps, closed protocol runs, requested declarations (and the PDRA behind them), lifted declarations (report fields only), and disbursements are locked. Logbook is insert and select only, with corrections as new rows. Vault documents are superseded, never deleted. Locked tables get \`revoke delete\` and split policies, not \`FOR ALL\`.  
10. \*\*OAuth clients are read-only\*\* (ADR-010, migration \`20261031001000\`).  
11. \*\*Privacy by schema.\*\* No columns for names of evacuees, patients or informants. Every free-text screen reminds users of this.  
12. \*\*Tools keep data in the browser\*\* (ADR-011). The ICS simulator, PSCP workbench and Gawad KALASAG self-check save per account in local storage and export JSON or print. Hazard services (HazardHunterPH, GeoAnalyticsPH, Zoom Earth, DDRiVE-M) are links with \`rel="noopener noreferrer"\`, never iframes. Never loosen the CSP. Narrow it to the City's Supabase project, not \`\*.supabase.co\`.  
13. \*\*Hosting\*\* (ADR-002): a City-owned Supabase project in \`ap-southeast-1\`, Netlify or Vercel under a City-owned team, portable to plain Postgres. The consultant's developer access is time-boxed.  
  
## 3. Repo map  
  
\`\`\`  
src/components/   ui.tsx primitives, AppShell, Sheet, Toast, Tooltip, RefText, Brand, UpdatePrompt  
src/domain/       scoring.ts, aa.ts, eoc.ts, protocol.ts, barangays.ts (+ tests)  
src/features/     home, iat (/assess), library, protocols, eoc (+ eoc/aa), vault, tools (ics, pscp, gk), settings, auth  
                  each feature: routes.tsx (lazy-loaded in App.tsx), \*Page.tsx, actions.ts, labels.ts  
src/lib/          db.ts (Dexie schema), store.ts (save/queue/callOnline/uploads), sync.ts (push/pull),  
                  tables.ts (sync config), auth.tsx, bootstrap.ts (REFERENCE\_VERSION), time.ts, ids.ts (uuid, uuidv5), hooks.ts  
src/data/         reference.json (generated), references.ts (citation catalogue)  
src/styles/       tokens.css  
supabase/migrations/  YYYYMMDDHHMMSS\_name.sql, applied in order, idempotent where possible  
supabase/seed/parts/  generated reference parts (small enough for the SQL editor)  
supabase/seed/operational/  one-time working records (IAT baseline, Vault register)  
supabase/tests/   00\_supabase\_stub.sql, 10\_rules\_and\_security.sql (tests.expect\_ok / expect\_error / expect\_rows / expect\_eq)  
tests/integration/  supabase-js → PostgREST 12 → Postgres  
e2e/              Playwright: journeys, accounts, offline, a11y (axe), tooltips, vault  
scripts/          generate\_seed.py, generate\_operational\_seed.py, split\_manual\_docx.py, brand\_assets.py, \*\_test.sh  
reference/        workbooks, legal PDFs, reference/moo/\*.md manual sources  
docs/             system-design.md, design-system.md, adr/  
\`\`\`  
  
## 4. Workflow for any change  
  
### 4.1 Frame it  
1. Name the \*\*master requirement(s)\*\* (MR-01 to MR-18) and the \*\*IAT indicators\*\* the change serves, plus the legal provision if there is one.  
2. Decide what is \*\*offline-capable capture\*\* and what is an \*\*authority action\*\* (§2 rule 5).  
3. If the change sets a new direction (a new module, a legal reading, a storage choice, a CSP change), draft an \*\*ADR\*\* in \`docs/adr/NNN-title.md\` (Context, Decision, Consequences, Status and date) and add it to \`docs/adr/README.md\`. Supersede old ADRs with a new one. Never edit an accepted decision.  
  
### 4.2 Back end (SQL first)  
1. Write a new migration, \`supabase/migrations/&lt;timestamp&gt;\_&lt;name&gt;.sql\`. Never edit an applied migration. Use \`create … if not exists\`, \`drop … if exists\` then \`create\`, and \`create or replace\` so a re-run is safe.  
2. Tables: \`id uuid primary key\`, \`version int\`, \`created\_at\`, \`updated\_at\`; call \`select app.track('public.&lt;table&gt;');\` for touch and audit. Use enums or check constraints for statuses.  
3. RLS: \`enable row level security\`; one policy per command (\`select\`, \`insert\`, \`update\`), using \`app.has\_role\` / \`app.has\_any\_role\` / \`app.is\_active\_user()\`. Grant the minimum. Use no \`delete\` on legal or financial records.  
4. Guards: \`app.guard\_&lt;thing&gt;()\` \`security definer set search\_path = public, pg\_temp\`, \`before update\` (all columns, not just \`of status\`) with \`errcode '42501'\` for authority and a clear plain-English message. The message is shown to users verbatim. Pattern: \`app.guard\_moo\_document\`.  
5. Server stamps: who/when columns set from \`auth.uid()\` and \`now()\` in triggers. Legal clocks accept a device time only within a bounded window (for example, no more than 24 h back and 5 min ahead).  
6. Rule parameters go in a rules table (\`aa\_rules\`), editable by admin on the CDRRMO Head's instruction, audited.  
7. Views compute results. Round at the same point as the workbook (band before rounding) and keep TS and SQL identical.  
8. Tests: add checks to \`supabase/tests/10\_rules\_and\_security.sql\` that log in as each relevant role, covering allowed, refused (with the expected SQLSTATE), and the lock after approval. If the stub lacks a Supabase default grant, add it, so the tests match a real project. Run \`npm run test:db\`.  
  
### 4.3 Sync layer  
1. Add the table to \`TABLES\` in \`src/lib/tables.ts\` (pk, cursor, write mode, omit list), parents before children.  
2. Add the Dexie store and indexes in \`src/lib/db.ts\` with a \*\*schema version bump\*\*.  
3. Add TS types in \`src/types.ts\`.  
4. If the table holds files, use \`queueUpload()\` and check \`uploadProblem()\` against the bucket's types and size. \*\*Keep the blob until the upload succeeds.\*\* A refused upload goes to a held list with Retry and Export, never deleted.  
5. Add an integration test in \`tests/integration/\` for anything touching conflict, RLS refusal or paging (\`npm run test:it\`).  
  
### 4.4 Front end  
1. Screens go in \`src/features/&lt;module&gt;/\`, registered in \`routes.tsx\` and lazy-loaded in \`App.tsx\`. Reads use \`useLiveQuery\` on Dexie. Writes use \`save()\` or \`callOnline()\` from \`actions.ts\`.  
2. Use only primitives from \`src/components/ui.tsx\` and tokens from \`tokens.css\` / \`tailwind.config.ts\`: no new hex values, arbitrary sizes or local copies of a primitive.  
3. \*\*Every\*\* button, link, tab, field and checkbox has a \`tip\` (\`e2e/tooltips.spec.ts\` fails otherwise). A tip is one sentence on what it does, plus who may do it or "needs a connection" when that is not obvious.  
4. Enum values never appear raw. Map them in the feature's \`labels.ts\`.  
5. Citations go through \`RefText\`. Add new instruments to \`src/data/references.ts\`, ending with "The official text governs."  
6. Design rules (\`docs/design-system.md\`):  
   - State before content: the status band shows the EOC level, any declaration in force, and sync state.  
   - \`lvl-white\`, \`lvl-blue\` and \`lvl-red\` appear only in the band, the EOC board and level controls.  
   - Orange marks active or focused elements. Status uses \`ok\`, \`warn\` (ochre), \`bad\` and \`info\`, always with text.  
   - One primary button per view, labelled with the verb that happens. The toast echoes that verb.  
   - Fonts: Montserrat for display, Poppins for body, Roboto Condensed for data.  
   - Tap targets are at least 44 px. Phones get a bottom tab bar, and \`lg\` and up get a side rail.  
   - Disabled controls and refusals say why, using the server's words.  
   - Times read "15 Oct 2026, 14:05" (Manila time).  
   - Use CDRRMO vocabulary: logbook, SitRep, PDRA, EO, barangay, LDRRMF.  
   - Dark mode, \`prefers-reduced-motion\`, and WCAG 2.1 AA (axe).  
7. Print and export: print stylesheets for SitReps, the AAR, the PSCP and declarations. Build DILG VIII template exports (PDF and Excel) client-side, with no new server.  
8. Add a crash boundary with a plain-language recovery screen instead of a white page.  
  
### 4.5 Reference data and manuals  
- Workbook changed → \`npm run seed:generate\` → \`npm run test:db\` and \`npm test\` (parity) → bump \`REFERENCE\_VERSION\` in \`src/lib/bootstrap.ts\`.  
- New manual chapter → \`python3 scripts/split\_manual\_docx.py &lt;chapter.docx&gt; --slug chN --prefix MOO\_ChN\` → sources land in \`reference/moo/\` and figures in \`public/library/chN/\` → re-seed.  
- Seeds must never reset \`status\` on approved versions or protocols, and never bump \`template\_rev\` when steps are unchanged.  
- Operational seeds (baseline, Vault) run once and must be idempotent.  
  
### 4.6 Verify  
Run \`npm run check\` (typecheck, unit, build), \`npm run test:db\`, \`npm run test:it\` and \`npm run test:e2e\` when the tools are available (PostgREST 12, local Postgres 16, Playwright, which is preinstalled). Report the counts. If a suite can't run here, say so. Never claim it passed.  
  
### 4.7 Document and release  
1. Update \`docs/system-design.md\` (modules table, data model, MR traceability, open items) and \`README.md\` where behaviour changed.  
2. Add a \*\*"To x.y"\*\* entry under DEPLOY.md §3 "Updating an existing database": the migrations to run once, the seed parts to re-run (and old parts to delete), and any operational files.  
3. Bump \`version\` in \`package.json\` (minor for features, patch for fixes).  
4. \*\*Hand-over format (Alvin's standing rule):\*\*  
   - Deliver a \*\*zip containing only the files new or changed since the previous zip delivered\*\*, with repo-relative paths. Files left out are presumed unchanged.  
   - \*\*No patch files.\*\*  
   - List files to delete separately, in the reply and in a \`DELETE.txt\` inside the zip.  
   - Give the apply steps in order: upload, migrations, seed parts, operational files.  
   - Uploads through the GitHub web UI drop dot-folders (\`.github/\`) and executable bits. Recommend pushing with git, and keep test scripts invoked through \`bash\`.  
  
## 5. Open backlog (verify each against the code before working on it)  
  
Status checked against v1.5.0 (\`fb1c81f\`, 31 Oct 2026). Re-check every item: some may be fixed since.  
  
\*\*Go-live blockers\*\*  
- \[ \] Refused upload deletes the only copy of an evidence file. \`push()\` in \`src/lib/sync.ts\` deletes \`db.files\` after \`pushUpload\` returns \`'done'\`, even on refusal. Still open in v1.5.  
- \[ \] Approved resource requests are editable. \`guard\_resource\_request\` fires only \`before update of status\` (\`20261015000400\_eoc.sql:215\`). Still open in v1.5. Lock every non-fulfilment column once a request is approved.  
- \[ \] The \`author\` role can approve or rewrite protocols and the IRR checklist; \`start\_protocol\` runs draft templates. Mirror \`guard\_moo\_document\`.  
- \[ \] The PDRA behind a requested declaration can be rewritten. Freeze it once a declaration references it.  
- \[ \] Declarations, disbursements and PDRAs can be hard-deleted on a real Supabase project. \`revoke delete\`, split the \`FOR ALL\` policies, add the default grants to the test stub, and check with \`\\dp\` on the live project.  
- \[ \] A shared phone can wipe another account's unsent entries at sign-out. Check whether \`unsent()\` counts all accounts, and tag failed and conflict items with the account.  
- \[ \] SitRep totals and the EOC board include old events. Scope them to the current activation.  
- \[ \] The barangay form copies the previous barangay's figures, and a blank count is saved as 0. Blank must stay null.  
- \[ \] Error boundary, error reporting, uptime check. A restore runbook that covers Storage buckets. A record of which migrations production has.  
- \[ \] CI under \`.github/workflows/\` (DEPLOY claims it exists).  
  
\*\*Sync robustness\*\*  
- \[ \] Retry with backoff and a limit, write \`lastError\`, and let later items pass one stuck item.  
- \[ \] A server window on device timestamps (barangay reports, logbook).  
- \[ \] Tombstones so server deletions reach devices.  
  
\*\*Legal fidelity (settle with the City Legal Office and OCD VIII, then write an ADR)\*\*  
- \[ \] 72 h floor: store both lead-time figures (from forecast issuance and time left), and warn with a recorded override instead of a hard block.  
- \[ \] Lifting: let the user enter the hazard-occurrence time with evidence. The 45-day OCD deadline counts from that time.  
- \[ \] The RDRRMC-initiated route (IRR Rule III Sec. 2), and a CDRRMC endorsement step before a City request (SOP GOV-05 Step 5). An adoption reference field, with regional and provincial options.  
- \[ \] Exempt slow-onset hazards (drought) from the 30%/70% tranche rule pending operational guidelines.  
- \[ \] DILG VIII SitRep alignment and exports (see §1).  
- \[ \] Pending national guidance: NDRRMC AA triggers, DBM–COA AA fund rules, the AA M&amp;E framework. Update \`aa\_rules\` and the checklist when they are issued.  
  
\*\*Minor and consistency\*\*  
- Band maturity before rounding, as the workbook does. A domain is "Compliant" only at 100% mandatory compliance.  
- Audit-flag approvals made by \`admin\`. Give developer access an expiry and an email check.  
- Restrict evidence read access for \`viewer\` if the DPO agrees.  
- Upgrade \`dompurify\` and \`react-router-dom\`. Lazy-load \`reference.json\`.  
- Cebuano or Waray UI: the City decides.  
  
\*\*Later modules (from the MRs and the EOC Capability Checklist)\*\*  
- Responder roster and fatigue: a 72 h three-deep roster for each ICS/EOC position (MR-09).  
- Resource inventory screen on the existing \`resources\` table (MR-08).  
- Risk-map layer, linked or static, CSP-safe (MR-03).  
- A \`training\_runs\` table so ICS drills and AARs become server-side evidence for B7.2 and B7.3 (MR-04, MR-11).  
- An EOC capability self-assessment based on the checklist, mapped to IAT Part B.  
- Tappable citations inside manual text ("Basis" lines).  
  
## 6. Engagement context  
  
- The fourteen-week co-creation with the City Government of Ormoc produces the CDRRMO MOO and the EOC Manual. The platform is the toolkit that assesses (IAT), drafts and traces (Library), runs (Protocols), and operates (EOC and AA).  
- The validation workshop is \*\*1–4 Dec 2026\*\*. Before it:  
  - re-score the 27 baseline items that rest only on FGD evidence (§5.2 cap at 2);  
  - recalculate the workbook;  
  - fix the Ch.1 §1.1 figures;  
  - issue Methodology v1.1.  
- Protocols and manual sections stay \*\*drafts\*\* until the CDRRMO and the owning office validate them and the CDRRMO Head approves them in the Library. Never mark seeded content as approved.  
- Training and workshops use a separate training Supabase project, never production.  
- The City owns the code and data. Keep everything maintainable by a local IT contractor: plain SQL, common TypeScript, documented runbooks.  
  
## 7. Output checklist (before handing over)  
  
- \[ \] Change traced to its MR, indicators and legal provision  
- \[ \] Rule in SQL, with RLS and guard; TS mirror with a test  
- \[ \] \`tables.ts\`, the Dexie version, types and omit lists updated  
- \[ \] Authority actions online-only; capture offline-capable  
- \[ \] Tooltips, labels, \`RefText\`, design tokens, a11y, dark mode  
- \[ \] SQL, unit, integration and e2e tests added, run, and counts reported, or "not run here" stated  
- \[ \] ADR (if a decision), system-design, README, DEPLOY "To x.y", version bump  
- \[ \] Zip of files changed since the last zip only, a delete list, and ordered apply steps  
- \[ \] Legal readings flagged with confidence and who must confirm them