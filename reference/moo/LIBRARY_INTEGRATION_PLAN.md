# Loading the Consolidated Manual into the Library: Integration Plan

Repo reviewed: asilvainnovations/ormoc-drrmo (main, package version 1.30.0). Nothing in the repo has been changed.

## 1. What the repo does today

- The folder you named is `reference/moo/` at the repo root (113 files). `public/reference/moo` does not exist.
- `reference/moo/` holds per-chapter Markdown sources, one file per version: Ch.0 v1.1, Ch.1 v1.2, Ch.2 v1.2, Ch.3 v1.1, Ch.4 v1.1, Ch.5 v1.0, Ch.6 v1.1, Ch.7 v1.0, Ch.8 v1.0, plus annex, SOP and form files (e.g. `MOO_Ch3v11_Annex_3-A.md`). There is no Chapter 9, no Chapter 10, no Executive Summary and no Annex A.
- Pipeline: `scripts/split_manual_docx.py` writes `reference/moo/*.md` and `public/library/<slug>/fig-NN.webp`. `scripts/generate_seed.py` (`LIBRARY_DRAFTS`, `CHAPTERS`) reads them and writes `supabase/seed/parts/NN_seed.sql` and `src/data/reference.json`.
- `src/features/library/` contains no manual text. `DocumentPage.tsx` reads `moo_documents` and `moo_versions` from the database (via Dexie) and renders `body_md` with `Markdown.tsx` (marked plus DOMPurify). Figures must be `/library/<slug>/fig-NN.webp`.
- Seed rules: a new version label creates a new `moo_versions` row; existing rows and approved text are never overwritten. Long bodies are loaded in about 88 KB pieces.

## 2. Gap between the repo and the Consolidated Manual

| Item | Repo | Consolidated Manual |
|---|---|---|
| Chapters 1–2 | v1.2 (IAT v1.5) | v1.3 |
| Chapters 3–4 | v1.1 | v1.2 |
| Chapters 5, 6, 7, 8 | v1.0, v1.1, v1.0, v1.0 | same versions, but revised text (barangay count, spelling, cross-references) |
| Chapters 9, 10 | absent | present (SOPs 9-01 to 9-09 and 10-01 to 10-07) |
| Executive Summary, Annex A | absent | present |
| Spelling | American in `CHAPTERS` titles ("Organizational") | British ("Organisational") |
| Barangay count | Ch.3 v1.1 comment: "working figure until reconciled" | 85 is official |
| Annexes, SOPs, forms | separate Library documents | embedded in each chapter |

## 3. Files to create or add (proposed, none created yet)

**Already prepared in this delivery (`repo-additions/`)**
1. `reference/moo/MOO_Consolidated_v1.0.md`: the full manual, 1.5 MB, 18 top-level sections.
2. `public/library/moo-consolidated/fig-01.webp … fig-104.webp`: 6.8 MB, 1400 px, WebP quality 80. The cover is excluded because `public/moo-cover.webp` already exists. `vite.config.ts` already excludes `library/**` from precache.

**To create**
3. `scripts/split_consolidated_md.py`: split the master file at each top-level heading into `MOO_Ch0_Introduction_v1.2.md` (Executive Summary, front matter, Introduction), `MOO_Ch1_v1.3.md` … `MOO_Ch10_v1.0.md` and `MOO_AnnexA_v1.0.md`. Reason: `DocumentPage`, "Correct this chapter", approval and the Corrections Log all work per document. A single 1.5 MB document cannot be corrected or approved chapter by chapter.
4. `scripts/generate_seed.py` edits:
   - add `LIBRARY_DRAFTS` entries (new version labels such as `v1.3 consolidated draft (IAT v1.7)`);
   - add `CHAPTERS` entries for `MOO Ch.9` and `MOO Ch.10` and the Annex A document;
   - update the Chapter 2 title to British spelling;
   - add `_CH9_INDS` and `_CH10_INDS`;
   - drop the "working figure" wording for 85 barangays.
5. `scripts/sop_registry.py`: add `CH9_PROCEDURES` and `CH10_PROCEDURES` (16 SOPs) only if they should run as protocols or workflows in the app. This is optional.
6. `src/features/library/pillars.ts` and `PILLAR_OF_AREA`: confirm the primary functional area for Chapters 9 and 10 (proposed 3 and 10).
7. `src/features/library/LibraryPage.test.ts`, `LibraryPage.render.test.tsx` and `src/data/references.test.ts`: update expected counts. No new React component is needed.

**Seed and migration**
8. Migration: none required. Verified: the `moo_documents` columns, the `kind` check and the version guard already support this. Chapters 9 and 10 insert as new rows.
9. Seed parts: run `generate_seed.py`. Its output renumbers parts 01–37 and would collide with the hand-named `37_raci`, `38*`, `39` and `40` parts. Recommended: add a separate generator `scripts/consolidated_manual_seed.py` (the `ddrive_seed.py` pattern) that writes `supabase/seed/parts/41a_consolidated_manual.sql` … about 18–20 pieces, loaded after part 40. They sort after every existing part, so the CI loader and `load_reference_data.sh` pick them up with no change.
10. `supabase/seed/operational/04_vault_register.sql`: add a Vault entry for the consolidated edition.
11. Housekeeping: `DEPLOY.md` (new 1.31.0 section and part count), `FILE_MANIFEST.txt`, `PATCHES.md`, `package.json` version, and an ADR in `docs/adr/` (next number after the latest).

## 4. Risks to settle first

1. **Bundle growth.** `src/data/reference.json` (2.6 MB) already bundles all 139 version bodies (about 1.9 MB). Adding 1.5 MB more grows the offline bundle by roughly 60%. Recommended: bundle only the newest version of each document.
2. **Duplicated annexes.** Existing Annex, SOP and form documents (1-A…, 2-A…, 3-A…) overlap with text now embedded in the chapters. Either keep them as child documents and strip the embedded copies from the chapter bodies, or retire them as `superseded` (the repo already has this mechanism).
3. **Version order.** The Library treats the newest `created_at` as the working version, so the seed order must put the consolidated versions last.
4. **Draft visibility.** Chapters are still `draft`. Readers without author or correction roles see "No approved text yet" until the CDRRMO Head approves each chapter.
5. **Indicator links.** The IAT "Feeds Manual Chapter" column still uses old numbering (`CHAPTER_RENUMBER`). Chapters 9 and 10 need explicit indicator lists. I derived them from the chapter text: Ch.9 cites 21 indicators and Ch.10 cites 27. These need your confirmation.
6. **Rendering test (done).** With the app's own `marked` and `DOMPurify` the file renders 390 tables and 104 images in about 0.3 s plus 1.4 s sanitising, with no stray pipe-table text.
