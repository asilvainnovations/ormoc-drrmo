# ADR-025: Anticipatory action rules aligned with RA 12287 and its IRR (v1.13.0)

Status: Accepted, 11 Nov 2026, by the lead assessor (Alvin M. Silva) for the development platform. To be confirmed by the City Legal Office and OCD VIII before the platform is used for a real declaration. Amends ADR-006's rule set for anticipatory action; migration `20261111002500_ra12287_alignment.sql`.

## Context
The IRR of RA 12287 was signed on 14 September 2026. The certified true copy (17 pages, a scan) was read page by page on 11 November 2026, together with the text of RA 12287 (signed into law 12 September 2025). The platform stated the lead time in hours, applied the 30%/70% graduation to every hazard, checked the minimum lead time only when a City request was sent, and treated every lifting as an act recorded at the moment of entry.

## Decision
1. **Lead time in days.** "An allowable or sufficient lead time of three (3) days, which may be extended to five (5) days" (RA 12287 Sec. 6(b)). Rules: `min_declaration_lead_days` = 3, `extended_declaration_lead_days` = 5, `lead_threshold_days` = 3.
2. **Minimum checked at the PDRA, at the request and at the Mayor's declaration.** The declaration "shall not go below the minimum limitations set forth under Section 6, par. (b)" (IRR Rule II Sec. 3), and the RDRRMC may take up to 24 hours (Rule III Sec. 2). Adopted provincial, regional or national declarations are adopted as issued (Rule III Sec. 3).
3. **Five days is flagged, not blocked.** A PDRA more than five days before impact shows a note asking for the reason; the operational guidelines will set per-hazard periods (Rule II Sec. 3).
4. **Graduation only for hydrometeorological and geological hazards** (IRR Rule V Sec. 2), from `hazards.aa_family`. Drought and other slow-onset hazards follow the NDRRMC operational guidelines, still pending; until then they are not graduated, but LDRRMF disbursements never exceed the year's AA allocation (Rule V Sec. 1(b)). A hazard with no family recorded is graduated (the stricter reading).
5. **Other lawful sources are not graduated**: Special Trust Fund balances, donations, ODA, other LGUs, agency budgets (Rule V Sec. 1(b) and Sec. 2).
6. **Automatic lifting.** "The State of Imminent Disaster shall automatically be lifted upon the occurrence of the hazard" (RA 12287 Sec. 7). The EOC records the occurrence time and its evidence (IRR Rule II Sec. 6(a)); the lifting time is the occurrence time, and the 45-day report counts from it (Rule VI Sec. 1). Where the IRR says "may be lifted", the statute governs.
7. **Impacts not met.** The Mayor lifts upon the RDRRMC recommendation (RA 12287 Sec. 7; IRR Rule III Sec. 4(b)); the recommendation and the lifting issuance are recorded.
8. **The 29-item checklist** is a MODE checklist derived from the ten sections of IRR Rule IV; the IRR sets no count.

## Consequences
- Requests that pass the request check can still be refused at declaration if the RDRRMC replies late; the City then acts under its own authority (city early action).
- When the NDRRMC operational guidelines and the DBM–COA guidelines are issued, the rules table and this ADR are updated, not the code, where the change is a parameter.
- Legal readings to confirm with the City Legal Office and OCD VIII: items 2, 3, 4 (unknown family, extreme heat as hydromet), 6 (statute over IRR wording) and 7 (form of the lifting issuance).
