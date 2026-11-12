# ADR-032: Publish Chapters 5–8 and renumber the financing chapter

- Status: Accepted
- Date: 12 November 2026
- Deciders: Alvin M. Silva (platform architect), for City Government of Ormoc review

## Context

Four chapter drafts arrived on 12 November 2026: Recovery (file named v1.1, but its document
control states Draft 1.0 — the document control governs, and the filename discrepancy is flagged to
the drafting team), Financing v1.1 (already renumbered by its authors: SOPs 6-01 to 6-12, annexes
6-A to 6-D, revision record noting the move from working Chapter 5), M&E v1.0 and Stakeholder v1.0.

The platform had seeded the financing draft on 12 Nov (1.15-era) as `MOO Ch.5` v1.0 with SOPs
5-01–5-10. The Introduction's ten-chapter roadmap (Ch.0 §2.1) assigns Recovery to Chapter 5 and
Financing to Chapter 6. The IAT workbook's "Feeds Manual Chapter" column still uses the old numbers
(a full 140-row renumber sweep belongs to a workbook revision, not this release). The chapters also
cite Introduction sections that did not exist in Introduction v1.0 (§§5.1–5.3, §5.4, §7).

## Decision

1. **Renumber by deterministic id, not by delete-and-recreate.** `CHAPTER_RENUMBER` in
   `generate_seed.py` remaps the workbook chapter codes at build time (old Ch.5 financing → Ch.6;
   old Ch.6 capacity rows → Ch.3; old Ch.8 recovery → Ch.5; old Ch.9 partnerships → Ch.8). Doc rows
   keep their uuid5 ids and gain the new codes (`Chapter 5`–`Chapter 8`), so links, protocols and
   IAT routing survive. The old Chapter 5 financing v1.0 version id is reused for the Recovery v1.0
   text; financing re-seeds as Chapter 6 v1.1. The v1.0 financing text is recoverable from git at
   tag `v1.17.0`.
2. **Cleanup SQL ships with the release** (`supabase/cleanup/1.18.0_renumber.sql`), run before the
   seed parts, because the seed upserts by id and never deletes: it removes the `MOO Ch.9`
   partnerships outline doc (code now carries drafted Chapter 8) with its skeleton version, links,
   and the five renamed templates `WF-SOP5-03/06/08/09/10` with their steps.
3. **Template codes follow the chapters**: `WF-SOP5-xx` → `WF-SOP6-xx` (sop_ref 6-xx; protocol
   codes `PR-QRF-USE`, `PR-AA-FUNDS`, `PR-EMERGENCY-PROCURE` unchanged with refs 6-04/6-05/6-07).
   The chapter's request for code **aliases** is deferred: `protocol_templates` has no aliases
   column, and the platform is pre-go-live so no run data references the old codes. A registry
   migration can add alias support later.
4. **17 proposed templates** registered from the SOP control blocks (all draft, for CDRRMO
   validation): `WF-REC-FRAMEWORK`, `PR-PDNA` (Ch.5); `WF-SOP6-12` (Ch.6; 6-11 runs on
   `WF-BUDGET-CYCLE`); `WF-SOP7-01`, `PR-AAR`, `WF-SOP7-05`, `WF-SOP7-07`, `WF-SOP7-08`,
   `WF-SOP7-09` (Ch.7; 7-02/7-03 run on the Assess module, 7-06 on `PR-LIFT-REPORT`);
   `WF-SOP8-01/02/04/05/06/07/08`, `PR-MUTUAL-AID`, `PR-AUGMENT-REQUEST` (Ch.8).
5. **Introduction v1.1** (superseded by the addendum below): added §5 (the 2026 baseline — §5.4
   names the 32.9% Mandatory-compliance risk and the ad-hoc-fixes "shifting the burden" pattern)
   and §7 (systems thinking and TQM: one chain from plan to proof) so Chapters 6 and 7 cite real
   sections. The chapters' own text is untouched.

   **Addendum (12 Nov 2026, same release):** the drafting team's official
   `00_Introduction_v1.1.docx` replaces the interim hand-authored v1.1 (its version row id
   changes; the cleanup SQL deletes the interim row in case the first 1.18 zip was applied). The
   Introduction is **front matter, not a chapter**: doc code `Introduction` (was `Chapter 0`),
   `chapter_no` NULL, title "Introduction to the Manual"; the deterministic doc id
   (`uid('doc','MOO Ch.0')`) is unchanged, and its approval/validation machinery (Document
   Control table, Revision and Approval Record, draft banners) is stripped from the seeded text
   per the City. The Library sort treats it as first. Chapters 6 and 7 citations resolve to its
   §§5.3/5.4/7 unchanged.
6. **Area mapping**: Recovery → area 10; Financing → area 1 (also 7); M&E → area 10 (also 3);
   Stakeholder → area 1 (also 3, 7). The old MOO merges in `MERGED` (capacity, M&E, recovery,
   partnerships shells) are removed — the shells are superseded by the drafted chapters.
7. **Deferred schema work** (needs migrations, not a content release): Chapter 6's resources-table
   fields (holder type, commitment reference, reorder point, expiry), Chapter 7's event/loss
   tables, and template aliases.

## Consequences

- Library gains four drafted chapters and 18 annex docs; the check line becomes
  `140 | 18 | 935 | 71 | 54 | 329 | 29 | 10 | 140 | 59` (40 seed parts).
- Every 1.17 doc id survives; production needs the cleanup script once, before the seed. The
  Introduction keeps its id too — only its code (`Chapter 0` → `Introduction`) and `chapter_no`
  (0 → NULL) change, through the same upsert.
- `split_manual_docx.py` now accepts `# Annex 5-A.` headings (any case) — the 1.18 drafts use
  that style; older `# ANNEX` files keep working.
- The stale "Introduction sections 5.1–5.3 / 5.4 / 7" citations in Chapters 6 and 7 now resolve to
  real Introduction v1.1 sections. Ch.5's claim of a "Chapter 4 Draft 1.2" remains unverifiable in
  this corpus (repo holds Ch.4 v1.1); flagged to the drafting team.
