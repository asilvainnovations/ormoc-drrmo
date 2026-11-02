# ADR-012: One Manual of Operations: five Parts, ten functional areas (v1.6)

Status: Accepted, 2 Nov 2026.

## Context
Up to v1.5 the Library showed two manuals, the CDRRMO Manual of Operations (MOO Ch.1 to Ch.9) and the EOC Manual (EOC Ch.1 to Ch.9), as 18 generated shells plus a job-description annex. The contract, the project instructions and the Inception Report (Oct 2026, sec. 3.3 to 3.4 and Annex A) call for **one** Manual of Operations for the CDRRMO and the EOC. The report binds ten functional areas into five Parts, from mandate to recovery:

| Part | Functional areas |
|---|---|
| 1 Legal mandate and governance | 1 Governance, organization and institutional arrangements |
| 2 SOPs by alert level (the core, and the largest Part) | 3 Preparedness · 4 EOC activation · 7 Logistics · 8 Responder safety |
| 3 Information management and public communication | 2 Risk intelligence · 5 Early warning · 6 Situational awareness and GIS |
| 4 Continuity and infrastructure safeguards | 9 Digital continuity and systems resilience |
| 5 Recovery and continuous improvement | 10 Recovery, learning and performance |

The Traceability Dictionary v1.1 gives every indicator a "Primary Functional Area". IAT routing ("Source MOO Chapter"), protocols and links in drafted text still name the old codes.

## Decision
- **Tables `manual_parts` and `manual_areas`** hold the structure (migration `20261102001200_single_manual.sql`). Active users read them; the administrator maintains them. OAuth apps cannot write them (ADR-010).
- **Every Library document belongs to an area** (`area_no`), may serve others (`also_areas`), and keeps the codes it had or absorbed in `aliases`. Search and links resolve aliases, so "EOC Ch.2" opens Area 4.
- **Ten area outlines** (`kind = 'area'`, code "Area N") are the home of every gap whose primary area is N. Their indicator links come from the dictionary, not from the old chapter text.
- **The 18 shells:** MOO Ch.1, Ch.2 and Ch.3 keep their ids and become the drafted Chapters 1, 2 and 3. The other fifteen are **superseded** (shown as "Merged"), point at their area through `parent_id`, and lose their indicator links. The JD annex merges into Chapter 2, and the v0.9 package-control annex 1-0 into Chapter 1 v1.0. Superseding happens only while a shell is unapproved.

| Old code | New home | Old code | New home |
|---|---|---|---|
| MOO Ch.4 | Area 4 | EOC Ch.1 | Area 1 |
| MOO Ch.5 | Area 1 | EOC Ch.2, Ch.5 | Area 4 |
| MOO Ch.6 | Area 3 | EOC Ch.3 | Area 9 |
| MOO Ch.7, Ch.8 | Area 10 | EOC Ch.4 | Area 5 |
| MOO Ch.9 | Area 1 | EOC Ch.6 | Area 6 |
| | | EOC Ch.7 | Area 7 |
| | | EOC Ch.8 | Area 3 |
| | | EOC Ch.9 | Area 10 |
- **Chapters are numbered as drafted**, not by area: Chapter 1 sits in Area 1, Chapter 2 in Area 1 (also 3 and 8), Chapter 3 in Area 2 (also 3). Annexes, SOPs and forms point at their chapter through `parent_id`. Codes drop the "MOO" prefix ("Annex 2-K"); the old code stays as an alias.
- **Protocols** that pointed at a merged shell now point at its area outline.
- **The `manual` column stays** (always 'MOO' for new rows) so older app versions keep working until they update.
- **Drafts are readable by every active user**, with a notice that the text is not yet approved. Only the CDRRMO Head approves (unchanged).

## Consequences
- The Library opens on Parts and areas. The assessment screens, the action plan and the CSV export name the functional area; the old "Source MOO Chapter" text is kept in the CSV for comparison with the workbook.
- **Coverage gap:** no indicator names Area 8 (Responder Safety, Welfare and Inclusive Emergency Operations) as its primary area. Its outline is empty until the dictionary is revised (for example A2.7 and B4.6, now in Area 1 and Area 4). This is a finding for the workbook owners, not a platform defect.
- The Inception Report's table in sec. 3.3 has its "Principal Scope" column shifted down one row. The platform uses Annex A, which is consistent.
- Superseded shells and their old text remain for audit. Admins may delete them later; nothing depends on them except history.
