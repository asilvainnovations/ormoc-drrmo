# Security and accessibility assessments — commissioning record

Production-readiness audit (9 Nov 2026), P1 item 11: a penetration test and an independent WCAG 2.1 AA
accessibility audit must be completed **before go-live**. Go-live is planned after the 1–4 Dec 2026 validation
workshop; the assessments below are scheduled in the window **16–30 November 2026**, with re-tests before go-live.

Status legend: commissioned → report received → findings fixed → re-test passed.

## 1. Penetration test

| Field | Value |
|---|---|
| Scope | Production deployment `https://www.mode-cddrmo-ormoc.online` and the Supabase project `jmctsspadywjcbbqwweh` (PostgREST surface, Auth, Storage) |
| Type | External black-box + authenticated grey-box pass; OWASP ASVS L2 aligned |
| Window | 16–30 Nov 2026 (before the validation workshop) |
| Provider | **To be contracted — developer to engage a third-party tester; City informed** |
| Rules of engagement | Read-only on live data; no denial-of-service; test accounts only; coordination with the CDRRMO for any write test |
| Deliverable | Written report (CVSS-scored findings), re-test of all High/Critical |
| Status | **Scheduled — provider not yet named** |

## 2. Independent WCAG 2.1 AA accessibility audit

| Field | Value |
|---|---|
| Scope | Public pages (`/`, `/policies/*`, `/about`, FAQ), the sign-in flow and one full workspace journey (EOC board on a 360 px phone viewport) |
| Method | Expert audit (axe + manual screen-reader pass with NVDA/VoiceOver); POUR per criterion, report per WCAG-EM |
| Window | 16–30 Nov 2026 |
| Provider | **To be contracted — independent of the developer (independence is the point)** |
| Deliverable | Per-criterion report, defect list by severity, re-test after fixes |
| Status | **Scheduled — provider not yet named** |

## Interim evidence already in the repo (not a substitute for the audits)

- `e2e/a11y.spec.ts` — automated axe checks on the public pages and key workspace screens (runs in `npm run test:e2e`).
- `docs/public-pages-accessibility-pwa.md` — design-time accessibility decisions.
- `supabase/tests/10_rules_and_security.sql` — 260 in-database authorization and rule checks (`npm run test:db`).

## Go-live gate

Neither assessment may be marked "passed" until the written report and the re-test are on file. The CDRRMO Head
signs off this checklist at the go/no-go review after the workshop.
