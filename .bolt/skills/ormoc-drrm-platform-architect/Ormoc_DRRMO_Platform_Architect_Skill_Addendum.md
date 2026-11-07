# Ormoc DRRM Platform Architect — MOO drafting addendum

**Applies to:** `.bolt/skills/ormoc-drrm-platform-architect/SKILL.md`  
**Repository reviewed:** `asilvainnovations/ormoc-drrmo` (`main`)  
**Repository version observed:** MODE 1.9.0  
**Date:** 8 November 2026  
**Status:** Proposed additive guidance; merge into the existing skill after repository write access is available.

This addendum supplements and does not replace the existing architect skill. Retain all current SQL/RLS, local-first, authority-action, integrity, privacy, testing and handover invariants.

## 1. Current MOO document architecture

The approved MOO is one integrated Manual for the CDRRMO and EOC, organised in five Parts and ten functional areas (ADR-012). Draft chapters are detailed operational expressions of that architecture. The chapter sequence currently established by Chapter 1 is:

1. Legal Mandate, DRRM Governance and Institutional Accountability.
2. CDRRMO Organizational Structure, Staffing and Human Resource Management.
3. Risk Intelligence, DRRM and Contingency Planning, and Institutional Preparedness.
4. Early Warning, Activation, Incident Management and Emergency Response.
5. DRRM Financing, Procurement and Resource Accountability.
6. EOC Operations, Information Management, Logistics and Coordination.
7. Monitoring, Evaluation, Knowledge Management and Continuous Improvement.
8. Recovery, Rehabilitation and Build Back Better.
9. Partnerships, Local Ownership and Institutional Sustainability.

Preserve the distinction between the eight contractual functional modules, the ten functional areas and the detailed chapter sequence. They describe different levels of architecture and must not be treated as competing structures.

## 2. Chapter 1–3 drafting conventions

New chapters must match the controlled working-draft style of Chapters 1 and 2 (Draft 1.2, 6 November 2026):

- Controlled cover page, document control, revision/approval record and page headers/footers.
- Assessment-informed rationale; purpose and intended results; scope, application and mandate boundaries; legal/policy framework; systems-thinking and TQM principles; institutional roles/process ownership; detailed procedures; RACI; performance and corrective action; implementation/validation register; relationship with other chapters; conclusion and references.
- Use precise, professional prose, clear tables, numbered procedural steps, explicit evidence/records, named process owners, decision points, escalation and validation controls.
- Keep working drafts clearly marked as drafts. A procedure appearing in the MOO is not proof of implementation, compliance, approval or testing.
- Do not infer scores, gap-priority bands, owners, targets, due dates or Action Plan statuses. Copy them only from the current controlled IAT workbook and retain source/version provenance.

## 3. Chapter 4 scope and division of responsibilities

Chapter 4 is **Early Warning, Activation, Incident Management and Emergency Response**. Chapter 1 maps its principal assessment references to A6, A7, A8 and B1.2–B1.5. Chapter 4 must establish the operational chain from authoritative warning receipt and verification through impact interpretation, authorised decision, accessible dissemination, protective action, EOC activation, ICS-supported coordination, response monitoring and transition.

Do not duplicate Chapter 6's detailed EOC facility, information management, communication systems, common operating picture, GIS, logistics and resource-management procedures. Chapter 4 establishes their incident-management context and cross-references the detailed Chapter 6 procedures. Chapter 5 owns financing, procurement, expenditure, property, LDRRMF and audit controls. Chapter 7 owns performance measurement, after-action learning and corrective-action monitoring. Chapter 8 owns recovery/rehabilitation processes.

## 4. Institutional and command invariants

- CDRRMC remains the statutory policy, coordination and oversight body.
- CDRRMO remains the permanent technical, administrative and operational DRRM office.
- EOC is an activated operational coordination mechanism, not a fourth CDRRMO division and not an alternate field-command structure.
- The Incident Commander/IMT retains incident-level command and tactical direction under the approved ICS arrangements. The EOC supports coordination, information, resources and executive decision support.
- Sector offices, technical agencies, utilities, barangays and response organisations retain their respective statutory, professional, regulatory, asset-owner and field-operational mandates.
- RACI clarifies work allocation; it does not transfer legal or statutory authority. Legal approval authority must be identified separately from operational process accountability.
- EOC activation does not itself declare a State of Calamity or State of Imminent Disaster. Keep RA 10121 and RA 12287 pathways distinct and reference Chapter 1 GOV-04/GOV-05.
- Evacuation and other protective actions must follow the authority assigned by law and valid City issuances. This MOO must not create an independent power to order evacuation.

## 5. Early warning and response controls

For each warning and operational decision, capture at least: originating agency/source; product identifier and original wording; issue, receipt and validity times; hazard and geographic coverage; observed/forecast status; uncertainty; relevant plan/scenario; affected people/assets/services; decision authority; recommendation; approval or refusal; message version; dissemination channel; acknowledgement/failure; implementing office; action status; and record references.

Do not invent rainfall, wind, flood, tsunami, landslide or other technical warning thresholds. A local warning-action matrix must cite current official source products and the valid City-approved hazard-specific contingency plan. Preserve the technical agency's meaning. Escalate discrepancies to the source/competent technical office and record uncertainty rather than drawing unverified conclusions.

Communications must be accessible, actionable, multi-channel where practicable and include acknowledgement/failure follow-up. An issued or transmitted message alone is not evidence that intended communities received and understood it.

EOC White/Blue/Red are the repository's operational level names (White normal; Blue partial activation; Red full activation). They do not supply hazard thresholds. Triggers, activation authority, staffing, scenario modules and deactivation must be validated through the approved EOC EO and contingency plans. The existing Chapter 1 proposed levels and staffing arrangements are proposals until adopted.

## 6. Platform implementation implications

Use current repo code, not stale diagrams, as the implementation source of truth. Existing architecture observed in MODE 1.9.0 includes:

- React/Vite PWA; Dexie/IndexedDB local-first reads; transactional save/outbox writes; Supabase Postgres/RLS/Auth/Storage/Realtime.
- SQL is the source of truth for business rules; TypeScript domain code mirrors SQL and requires tests.
- EOC activation level change is an online-only authority action (`callOnline`/RPC). Never queue authority actions for later execution.
- EOC event/report windows must exclude stale prior incidents from current-event boards and SitRep totals.
- Barangay count fields use `null` for not reported; never silently convert blank to zero.
- Logbook is append-only; corrections are additional entries that reference the original.
- Approved or closed records remain protected by database integrity guards and RLS, not UI-only logic.
- General-purpose operational records must not collect names of evacuees, patients or informants. Use aggregate counts and refer restricted lists to authorised custodians.
- Every new feature requires indicator and MR traceability; tests; appropriate SQL migration; Dexie schema/sync registration if new data; RLS and guard controls; design-system components; accessible labels/tooltips; updated documentation and ordered handover.

## 7. IAT and source-control discipline

The current source workbooks in `reference/` are:

- `Ormoc_CDRRMO-EOC_Institutional_Assessment_Tool_v1-5.xlsx`
- `Ormoc_CDRRMO_EOC_Master_Requirements_Traceability_and_140_Indicator_Data_Dictionary_v1.1.xlsx`

The generator `scripts/generate_seed.py` reads IAT sheets `A_CDRRMO`, `B_EOC`, `C_Interface`, `Crosswalk`, and master workbook sheets `Master_Requirements`, `Domain_Traceability`, `Indicator_Data_Dictionary`. When workbook rows are not directly extractable, do not substitute older v1.1/v1.3 values or reconstruct scores from prose. Mark exact rows for controlled workbook verification.

**Barangay denominator safeguard:** older architecture text includes a fixed “85 barangays” statement. Chapter 3 records an unresolved 85-versus-110 discrepancy in project materials and requires CPDO, City Secretary and DILG City LGOO reconciliation. Do not hardcode or repeat the denominator as settled until the authoritative current master list and geographic coverage have been confirmed. The current platform reference data may need reconciliation to that approved master list.

## 8. Source and approval controls for legal/technical guidance

Treat scanned or OCR-derived legal text and older EOC issuances as provisional until checked against an official controlled copy. In particular, confirm the exact title and operative requirements of NDRRMC Memorandum No. 131, s. 2018 with OCD Region VIII; confirm the current DILG VIII/OCD VIII reporting template and actual provincial reporting cut-offs; validate the EOC EO, ICS EO, alert-level authorities, response-cluster configuration, evacuation authority and hazard-specific triggers with the City Legal Office, competent source agencies and relevant office heads.

A legal or technical validation register must state the unresolved question, source required, responsible reviewer and closure evidence. Do not describe an unapproved proposal as a City policy or operational fact.

## 9. Chapter 4 traceability and minimum SOP quality

At minimum, map Chapter 4 processes to the actual IAT A6/A7/A8/B1.2–B1.5 indicator rows and MR-01–MR-18 links from the workbooks. Do not assume every Part C indicator is owned by CDRRMO; identify its primary office owner and CDRRMO coordination role.

Every SOP step must state: sequence; accountable actor; action; decision/criteria; inputs; outputs/records; time/frequency; validation/control; escalation. Proposed SOP coverage may include source monitoring/verification; warning-to-action decisions and dissemination; PDRA/heightened preparedness coordination; EOC activation/scaling; EOC–ICS coordination; evacuation coordination; response/service coordination; situation reporting; deactivation/transition. Cross-reference Chapter 5–8 procedures where those chapters own detailed controls.

## 10. Repository status and update protocol

This is an additive update for the existing skill. Preserve all existing sections unless deliberately reconciled against current code and documents. The skill file is not considered updated on `main` until a GitHub commit is verified. If connected GitHub permission is read-only, supply the amended skill/addendum as a repo-relative handover file and state that it has not been committed or merged.
