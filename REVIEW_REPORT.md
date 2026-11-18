# MODE 1.23.0 Consolidated Handover — Review and Reconciliation Report

**Review date:** 18 November 2026  
**Scope:** Three supplied ZIP handovers only; no live repository or Supabase environment was changed.

## Executive result

The three packages are complementary, but their original apply instructions are not safe to follow as one sequence without reconciliation. The consolidated package selects the integrated client implementation from the build-fix package, retains the database migration and seed from Slice 1, and applies the CI reference-loader correction. It removes redundant delta files from the handover and replaces the three conflicting apply guides with one ordered procedure.

## Reconciled package choices

| Area | Selected source | Treatment |
|---|---|---|
| App route, types, Dexie schema, sync registry, nav/i18n | Build-fix governance ZIP | Canonical integrated client files |
| Four governance screens and labels | Build-fix governance ZIP | Selected over the parallel Slice 1 versions; includes UI icon imports consistent with the build-fix integration |
| Database migration | Slice 1 ZIP | Retained, with role-policy correction described below |
| Governance seed | Slice 1 ZIP | Retained |
| Reference loader | CI-fix ZIP | Replaces broken verification references for EOC assessment/capability catalogue |
| ADR-043 and milestone plan | Prior MODE 1.23 milestone package | Included as planning documents; ADR status remains Proposed |

## Inconsistencies fixed

### 1. Duplicate client integration paths

The Slice 1 package supplies separate `types.governance.ts`, `db.governance.delta.ts` and `tables.governance.delta.ts` files and asks for manual merging. The build-fix package already incorporates the governance types, Dexie stores, sync table entries, protected route and navigation into the full application files.

**Resolution:** The consolidated ZIP uses the integrated full files and excludes the delta files. Applying both approaches would duplicate type declarations and database/table wiring.

### 2. RLS UPDATE policy did not match its own stated role rule

The original migration comment says assessors and designated authoring/validation roles may draft-update review records, but the original UPDATE policies used `app.is_active_user()`. That allowed every active user through the RLS policy, subject only to trigger checks for formal closure/decision transitions.

**Resolution:** The consolidated migration narrows UPDATE access for both `manual_review_items` and `outstanding_decisions` to `admin`, `cdrrmo_head`, `assessor`, `validator`, and `author`. The existing trigger guards remain responsible for formal closure, reopening and decision authority. This correction must be tested against the actual `app_role` enum and all role identities before production.

### 3. CI reference-data verification pointed to a non-existent SQL file

The original loader verified EOC assessment items against `38_eoc_assessment.sql`, while the repository seed names the catalogue `38a_eoc_assessment.sql`; the EOC capability catalogue is separately seeded by `38_eoc_capability.sql`.

**Resolution:** The corrected loader verifies `eoc_assessment_items` from part 38a and `eoc_cap_items` from part 38. No database migration or seed change is made by this script replacement.

### 4. Apply instructions overlapped

The original Slice 1 instructions ask for manual integration of delta files, while the build-fix instructions ask to replace the integrated full files. The CI package separately replaces the reference loader.

**Resolution:** One `APPLY_STEPS.txt` defines the canonical files, preflight checks, order of application, test requirements and release gates. The full reference loader automatically processes all seed parts, including part 40; the instructions explicitly prevent separately running part 40 after the full loader.

## Source counts checked inside the supplied seed

| Register | Expected rows | Seed rows parsed |
|---|---:|---:|
| Review Register | 69 | 69 |
| Outstanding Decisions | 18 | 18 |
| Workshop Sessions | 12 | 12 |
| Stakeholder Matrix | 29 | 29 |

These are source reconciliation counts, not application constants. The import batch record is keyed and the inserts use stable source identifiers with `ON CONFLICT DO NOTHING`.

## Important limitations and release blockers

1. **No live repository verification:** The packages were reviewed against each other, not applied to a fresh clone. Confirm the exact base commit, package version, existing migrations, Dexie version and file diffs before applying.
2. **ADR-043 is Proposed:** It is not represented as accepted policy. Obtain the required institutional decision before production use.
3. **Automated tests are absent from the supplied handovers:** SQL role-matrix tests, governance unit tests and e2e tests are explicitly deferred in Slice 1 notes. They remain release blockers.
4. **Migration compatibility is unverified against the live database:** Confirm `app_role`, `app.track`, `app.touch_row`, profile references, prior migration state and policies in the actual target environment.
5. **Seed provenance:** The seed identifies the source workbook as `Ormoc_CDRRMO_EOC_Review_Validation_Tracker_V-2.xlsx` dated 12 November 2026. Verify this is the controlled workbook version intended for the workshop before importing.
6. **No 85-barangay finalization:** OD-08 remains an outstanding decision. The handover does not settle the 85 and pre-merger masterlist question.
7. **No production operation performed:** No branch, PR, commit, database migration, seed, release tag or deployment was created by this review.

## Suggested next action

Apply this package on a dedicated branch from the confirmed 1.22.0 base, resolve any repository-specific conflicts, then run typecheck/build and add the missing role, unit and e2e tests before database deployment.
