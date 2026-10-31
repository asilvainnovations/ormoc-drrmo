# ADR-011: Readiness tools in the app; hazard services linked, not embedded (v1.5)

Status: Accepted, 31 Oct 2026.

## Context
The repository's `public/` folder held four stand-alone pages: an ICS simulator, a Gawad KALASAG page, a Gawad KALASAG simulator and a script. None was linked from the app. The app's own Content-Security-Policy blocked their inline scripts, `gk.js` did not parse, and they loaded fonts, scripts and images from other sites. The Gawad KALASAG simulator also used criteria weights with no published source. The City also asked for access to HazardHunterPH, GeoAnalyticsPH, Zoom Earth and DDRiVE-M, and for a Public Service Continuity Plan tool.

## Decision
- **Rebuild the tools as app screens under `/tools`**, in the app's design system, with no external scripts:
  - **ICS exercise simulator:** the Ormoc scenario set (six scenarios, ten positions, position drills, learning module, quiz) moves to `src/features/tools/ics/ics-data.json`. Scoring is a tested module (`engine.ts`).
  - **Gawad KALASAG Seal readiness:** follows the published Seal for LDRRMCOs, with six criteria weighted 25/35/15/5/10/10, indicators rated 0 to 3, and the bands 2.50–3.00 Beyond Compliant and 1.50–2.49 Fully Compliant. The indicator wording is the platform's, mapped to IAT indicators, and the screen says so. It is a preparation aid; the OCD toolkit is scored for the real submission.
  - **PSCP workbench:** follows CSC MC No. 2, s. 2021 and the NDRRMC–OCD PSCP Guidebook, using ISO 22301 terms (MTPD, RTO, RPO). It checks the draft for consistency and writes a printable plan in Markdown.
- **Working data stays in the browser.** Exercise records, Seal ratings and PSCP drafts are drafts and training records, saved per account in local storage, exported as JSON, printed, or copied into the Library. Signing out clears them. No new tables or migrations were needed.
- **Hazard services are links, not frames.** HazardHunterPH, GeoAnalyticsPH, Zoom Earth (centered on Ormoc) and DDRiVE-M open in a new tab with `rel="noopener noreferrer"`. They run their own maps and terms, and framing them would mean loosening the CSP. Nothing from the platform is sent to them.
- **The old pages are removed** from `public/`.

## Consequences
- Exercise results are not shared between devices. If the City wants them as server-side evidence for B7.2 and B7.3, add a `training_runs` table later. The run record format is already fixed (`RunRecord`).
- Tools is in the desktop rail. On phones it opens from the Today screen, because the tab bar holds six items.
- Manual figures (`public/library/`) are not precached. The manual text works offline; the figures load when there is a connection.
