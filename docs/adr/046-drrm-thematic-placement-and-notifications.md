# ADR-046: DRRM Thematic Placement of Workflows, Protocols and Forms; Notifications; Collapsible Rail

**Status:** Proposed  
**Date:** 20 November 2026  
**Target milestone:** MODE 1.29.0  
**Decision owners:** CDRRMO Head (placement), lead consultant (Alvin M. Silva), technical maintainer

## Context

The DRRM module (the side panel's "Protocols") groups workflows and protocols under the four DRRM thematic areas, but:

- Forms were listed only by status (draft, approved, retired), with no thematic grouping.
- The 1.14 placement put EOC activation, evacuation, ICS interface, resource requests and anticipatory action under
  Preparedness, which left Response with only the SitRep cycle. The after-action review (SOP 7-04) sat under Recovery.
- Chapters 7 and 8 workflows shared the "Governance and the CDRRMC" group.
- Steps in Chapters 5–8 named 18 Manual forms (ME-F.., PTN-F.., REC-F01, REC-F03, LOG-F03) that had no template, so
  those steps fell back to the one-tap step record and the form never appeared on the Forms page.
- BUD-F01 and BUD-F02 (Chapter 6 FIN-F02, FIN-F03) still pointed to Chapter 2.

## Decision

1. **Placement follows the references.**
   - NDRRMP 2020–2030 Thematic Pillar 3 is *Disaster Response and Early Recovery*: Outcome 13 (response operations
     with ICS on site, information gathering and reporting, pre-developed response plans and protocols, partnerships for
     humanitarian logistics, relief), Outcome 14 (forecast-based early action) and Outcome 15 (SitReps, RDANA).
   - Ormoc City DRRM 10-Year Plan 2023–2032, Table 9: early warning system, LDRRMF utilisation and risk financing under
     Prevention and Mitigation; strengthening the LDRRMC and LDRRMO, the operations center, simulation exercises and
     capacity building under Preparedness; ICS, forecast-based early action and CCCM under Response and Early Recovery;
     PDNA and recovery programmes under Rehabilitation and Recovery.

   | Area | Groups |
   |---|---|
   | Disaster Prevention and Mitigation | Risk information; CDRA and planning; Geo-COP; LDRRMF budget cycle and risk financing; warning and public information |
   | Disaster Preparedness | Governance; CDRRMC secretariat; EOC workforce; daily operations; contingency planning; continuity and lifelines; **partnerships and mutual aid (Ch.8)**; **monitoring, evaluation and learning (Ch.7)** |
   | Disaster Response and Early Recovery | **Anticipatory action; EOC activation and response operations; contingency plan activation and clusters**; reporting |
   | Disaster Rehabilitation and Recovery | Recovery framework and PDNA (Ch.5) |

   Area and group names use Title Case. The DRRM thematic area of a category is set once, in
   `src/features/protocols/labels.ts`; the database stores only the category.

2. **Two new categories** (`learning`, `partnerships`) by migration `20261120003700`. Kind is stated per template
   where the code prefix misleads: PR-AAR is a protocol; WF-REC-FRAMEWORK is a workflow.

3. **Forms by thematic area.** A form sits under the area of the steps that record on it (most-used first) and shows
   "Also: …" for other areas; a form no step uses yet falls back to the area of its Manual chapter. STEP-RECORD is
   listed once, as shared by every area. The 19 missing Chapter 5–8 forms are built from each chapter's forms register
   and annexes, as drafts for CDRRMO Head approval.

4. **Notifications** are derived on the device from records already synced: EOC level, a declaration, sync problems,
   open life-safety and urgent requests, running protocols and overdue improvement actions (assessment roles). No new
   table. Read marks and on/off choices stay in local storage (guarded). A bell in the status band and
   Settings → Notifications show them.

5. **Side panel.** "Protocols" becomes "DRRM"; Validation sits below Assess; the desktop rail folds to icons (button or
   Ctrl/Cmd+B), the choice kept on the device, and the page takes the width the rail frees.

## Consequences

- The placement changes the 12 November 2026 grouping. It stays a proposal until the CDRRMO Head confirms it at the
  validation workshop (1–4 December 2026); approved templates keep their category until reopened.
- Notifications are not push messages and do not reach a closed app. A server-side notification feed is a later
  decision (needs a table, RLS and retention).
- The shadcn `sidebar.tsx` provider is not adopted: the existing rail keeps its tab-bar twin on phones and its tested
  tooltips; collapse is added to it instead.
