# ADR-022: Chapter 4 runs in the platform; every template points to written text; owners follow the chapters (v1.11.0)

Status: Accepted, 8 Nov 2026. Extends ADR-019.

## Context
The 1.10 assessment found two kinds of mismatch.

**Owners differed between the chapter and the platform:**
- SOP HR-05 (duty roster and handover): MOO Ch.2 names "CDRRMO Head / division leads"; the platform named the duty officer.
- SOP HR-06 (EOC designation): MOO Ch.2 names "CDRRMO Head / EOC Manager"; the platform named the CDRRMO Head alone.

**Six templates cited text that did not exist:** PR-WARNING-DISSEM, PR-EOC-ACTIVATE, PR-PDRA, PR-FLASHFLOOD-EARLY, PR-SITREP-CYCLE and PR-LIFT-REPORT cited "EOC Manual Ch.2", "EOC Manual Ch.6" or "MOO Ch.7".

On 8 Nov 2026 the City supplied Chapter 4 Draft 1.0 (Early Warning, Activation, Incident Management and Emergency Response) and further sources:
- the DILG VIII memorandum of 26 Feb 2025 adopting RDRRMC VIII Res. No. 12-006 s. 2023 (reporting template, frequency, alert-status triggers);
- the NDRRMC–OCD Contingency Planning Guidebook (Feb 2020);
- DSWD–DILG–DOH–DepEd JMC No. 02 s. 2021 (CCCM and IDP protection);
- the Gawad KALASAG LDRRMO assessment toolkit CY 2026;
- the CDRRMO organisational structure chart.

## Decision
1. **Chapter 4 v1.1** (working draft) is the controlling text for SOPs 4-01 to 4-09. It is in the Library (`MOO_Ch4v1_*`, figures in `public/library/ch4v11/`).
2. **Every SOP 4-xx runs as a protocol.**
   - Four existing protocols now cite it: PR-WARNING-DISSEM (4-02), PR-PDRA (4-03), PR-EOC-ACTIVATE (4-04) and PR-SITREP-CYCLE (4-08). PR-FLASHFLOOD-EARLY cites 4-02 for short-lead hazards.
   - Five protocols are new: PR-WARNING-RECEIPT (4-01), PR-ICS-INTERFACE (4-05), PR-EVACUATION (4-06), PR-RESOURCE-REQUEST (4-07) and PR-EOC-DEACTIVATE (4-09).
   - Ten Chapter 4 forms are added.
3. **PR-LIFT-REPORT** cites SOP GOV-05 (MOO Ch.1, Annex 1-E), which already covers the lifting of a State of Imminent Disaster and the 45-day report.
4. **WF-GEO-COP** cites the proposed SOP 6-GIS-01. It is loaded as a Library draft under Area 6 until Chapter 6 adopts it.
5. **Owners follow the chapter text.**
   - HR-05: the owner is "CDRRMO Head / division leads"; the duty officer on shift performs the handover.
   - HR-06: the owner is "CDRRMO Head / EOC Manager"; the EOC Manager proposes and the Head approves.
6. **Three SQL checks keep this true:**
   - every SOP 4-01 to 4-09 has a protocol;
   - no template cites an unwritten chapter;
   - the HR-05 and HR-06 owners match Chapter 2.
7. **Barangay denominator.** Chapters 3 v1.1 and 4 v1.1 use 85 (PSA PSGC, 4Q 2022) as a working figure. It is not settled for City records until CPDO, the City Secretary and the DILG City LGOO reconcile the City master list. The platform's barangay list is imported from that list (Settings → Barangays). The constant 85 is used only as the expected count when the list is imported; it is a check, not a rule.

## Consequences
- 28 templates (13 protocols and 15 workflows), 197 steps and 50 forms load as drafts for the validation workshop.
- Process-owner wording uses the JMC 2014-1 division names used in the chapters. Chapter 4 Table 4.4 maps them to the four sections in the CDRRMO's 2026 structure chart.
- The regional alert-status triggers (RDRRMC VIII Res. 12-006 s. 2023) are summarised in Annex 4-C as a source, not as City triggers. City triggers still come from the approved EOC EO and contingency plans.
