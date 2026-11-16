# ADR-041a: Explicit non-goals for Slice 2 (Flood intelligence, hazard watch, EOC analytics)

Status: Accepted with ADR-041, 16 Nov 2026.  
Supplements [ADR-041](041-slice2-flood-intel-hazard-today-eoc-analytics.md). Does not change ADR-011, ADR-024, ADR-030, ADR-035 or ADR-039.

## Context

Slice 2 delivers decision-support flood intelligence, Today hazard watch, EOC risk analytics and roster scenarios **inside** the MODE architecture. Several attractive capabilities were requested or implied by prototypes and external systems. Shipping them would break offline-first design, CSP, legal clarity (who issues a warning), or the “decision support, never a trigger” rule.

This record states those **non-goals** so they are not re-opened as silent scope in the same release.

## Decision — explicit non-goals

The following are **out of scope** for MODE 1.22.x Slice 2 and are **not** to be implemented under ADR-041 without a new, superseding ADR and City approval.

### 1. Live PAGASA / PHIVOLCS API ingestion

| Not in scope | Why |
|--------------|-----|
| Scraping or polling PAGASA or PHIVOLCS into Postgres or Dexie | Official products change without City control; parsing HTML/APIs is brittle; would imply MODE hosts “the” forecast |
| Background jobs / edge functions to refresh forecasts | No custom application server or edge functions (ADR-001) |
| Storing bulletins as authoritative activation inputs | Legal clocks and authority actions remain with City process and online RPCs (ADR-006) |

**In scope instead:** outbound links on Today and Tools (`rel="noopener noreferrer"`) to PAGASA Visayas regional forecast, PAGASA weather, and PHIVOLCS earthquake monitoring.

### 2. Full D3 / Bayesian flood network inside the PWA

| Not in scope | Why |
|--------------|-----|
| Porting the engagement Bayesian HTML (CDN D3, multi-panel explorer, keyword chatbot) into React as a live model | Violates ADR-011 (tools keep data local; hazard services are links, not embedded products); CSP; maintainability by a local IT contractor |
| Presenting model outputs as residual risk, BCR or intervention probability for operational decisions | Would be mistaken for an official forecast or a declaration trigger |
| Shipping the prototype as the Assess “Flood intelligence” screen itself | Assess and Tools must use MODE design system, offline Dexie reads, and plain-language City vocabulary |

**In scope instead:** `/tools/flood-intelligence` using **DDRiVE** flood/priority rows already on the device, plus outbound links. Optional static prototype under `public/tools/` opened in a **new tab** only, labelled reference — not official.

### 3. Copernicus (or any) map embedded in the app shell

| Not in scope | Why |
|--------------|-----|
| `<iframe>` of Copernicus EMS, Global Flood Awareness, NOAH, HazardHunter, or similar | ADR-011: hazard services are links, never iframes; CSP must not be loosened to `*.copernicus.eu` / arbitrary map hosts |
| MODE as a continuous satellite mapping client | On-demand mapping is an institutional activation process, not a City live feed |

**In scope instead:** Tools entries and Flood intelligence outbound links to `https://mapping.emergency.copernicus.eu/` and related EMS products.

### 4. Auto-SitRep or auto-activation from any external feed

| Not in scope | Why |
|--------------|-----|
| Creating or submitting SitReps from PAGASA/PHIVOLCS/Copernicus/DDRiVE signals without a human duty officer | SitReps are authority records with prepared_by / approved_by and locks (ADR-006, ADR-013) |
| Changing EOC level, starting a protocol, or requesting a declaration from a feed | Authority actions are online-only and role-gated; never queued from a background poll |
| Using DDRiVE priority or flood class as an evacuation or declaration **trigger** | ADR-024 / ADR-039: decision support only |

**In scope instead:** human-operated Board, SitReps, protocols, PDRA/AA flows; DDRiVE and Flood intelligence as read-only context on Risk, Liaison, Today and Tools.

## Consequences

- Reviewers and implementers treat the four items above as **rejected for this release**, not as backlog deferred inside the same ADR.
- A future ADR may revisit any item only with: City Legal / CDRRMO Head agreement, a named data controller, offline behaviour, and an explicit statement that MODE still does not issue official warnings.
- Documentation (README Tools section, Flood intelligence page, Today Hazard watch) must keep the “not a trigger / not an official forecast” notice.

## References

- ADR-001 stack (no edge functions)  
- ADR-006 online-only authority actions  
- ADR-011 readiness tools and hazard links  
- ADR-024 DDRiVE decision support only  
- ADR-039 resources / DDRiVE decisions  
- ADR-041 Slice 2 affirmative scope  
