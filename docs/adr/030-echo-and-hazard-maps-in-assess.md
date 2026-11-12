# ADR-030: ECHO (Evacuation and Camp Handling Operations) and Hazard maps in Assess (v1.16.0)

Status: Proposed, 12 Nov 2026, by the lead assessor (Alvin M. Silva). For the CDRRMO Head, with the CSWDO (camp management lead under JMC No. 02 s. 2021) and the CHO (WASH and health). Migration `20261112002800_echo_camp_management.sql`.

## Context
The City asked for ECHO as a core EOC tool, built from a standalone prototype (MODE-ECHO-Simulator.html and its exercise JSON, 11 Nov 2026), and for Hazard maps to move from the EOC module to Assess, just below the IAT, with a wide map. The platform had an unused `evacuation_centers` table (0004), barangay-level evacuation counts and the hazard sheets (ADR-028), but no camp records. Evacuation centres and displaced families are covered by RA 12076, RA 10821, the DSWD-DILG-DOH-DepEd JMC No. 02 s. 2021, Sphere and IOM CCCM guidance, which use different figures for different purposes.

## Decision
1. **Hazard maps in Assess** at `/assess/hazard-maps`, a sub-item of Assess in the rail and a tab beside the IAT. The map comes first, full width (up to 120 rem, height up to 78 dvh), with a full-screen switch that keeps the tools; layers, colouring, results and instructions sit under the map. `/eoc/hazard-maps` redirects.
2. **ECHO at `/tools/echo`** with three connected components:
   - *Simulator* (eight modules from the prototype): exercise kept in the browser like the other readiness tools; JSON export and import (also of the prototype's file); printable report. Training only.
   - *Evacuation intelligence*: the hazard sheets, DDRiVE exposure and the centre inventory on one map; centre screening and route screening (sheets sampled about every 50 m). Screening flags what to check; it never marks a site or route safe; the map is not navigation.
   - *Camp Management Information System* and *EOC dashboard*: synced records (below), SitRep text and resource requests that enter the EOC's existing workflows.
3. **Standards kept distinct** in `src/domain/echo.ts`, each with its source and place: Sphere 15 L per person per day (initial) vs the JMC's 52 L (prolonged); Sphere 3.5 m² covered space; JMC toilets 1:50 short-term and 1:20 long-term vs RA 12076 Sec. 4(c)(2) 1 per 20 males, 1 per 20 females and 1 per 8 persons with disability or older persons. RA 12076's minimum standards are in **Sec. 4** (the request cited Secs. 3–6). The JMC gives two accessible-toilet ratios (4 in 10 on p. 12; 1 in 10 on p. 14): both are shown, neither is a pass mark.
4. **Records** (aggregates only; RA 10173): `evacuation_centers` extended (capacity, area, WASH counts, RA 12076 items, hazard screening note, structural assessment reference; `field_verified` means the record was checked in the field and reverts to pending when its facts change); `camp_reports` append-only, with groups no larger than persons and persons at least families; `camp_feedback` with summaries fixed once logged. No names, DAFAC data or case narratives.
5. **Authority stays where it is.** Opening, closing and closure of a centre are recorded with an authority reference by the EOC Manager or the CDRRMO Head, sent online only (`insertOnline`). ECHO issues no evacuation order and certifies nothing.

## Consequences
- Until the inventory is filled and field-verified, the simulator uses illustrative training sites, clearly labelled.
- The SitRep keeps its evacuated totals from barangay reports (all evacuees); ECHO adds inside-centre figures as text, and the dashboard estimates those outside centres only when every count is reported.
- To confirm with the CSWDO and CHO: which toilet ratio and water figure the City applies per phase; whether camp reports should also feed DROMIC reporting.
