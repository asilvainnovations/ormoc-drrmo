# ADR-002: City-owned Supabase project in Singapore; portable to self-hosting

Status: Accepted, 15 Oct 2026

## Context
The City is the personal information controller under RA 10173 (Data Privacy Act). The IAT methodology commits that assessment records stay under City control and that the platform holds no personal data of affected persons or informants. The consultant must not own or hold the production account.

## Decision
- Production runs in a Supabase project created and billed under a City-owned organisation, region `ap-southeast-1` (Singapore), the nearest region to Ormoc.
- The consultant gets time-boxed developer access, removed at turnover.
- Data held: staff names, emails, roles and office; institutional records (assessments, SOPs, logbook, SitReps, declarations, fund tranches). Barangay figures are aggregate counts only (families, persons, centres); there are no fields for names of evacuees, patients or informants, and screens remind users not to type them.
- Evidence files are in a private bucket; access is by signed URL, scoped by RLS.
- Everything is plain Postgres + SQL migrations, so the system can move to self-hosted Supabase or any Postgres 15+ host on City premises or a government cloud without code changes.

## Consequences
- Cross-border transfer to Singapore must be covered in the City's privacy notice and in a data-sharing / outsourcing agreement with the provider (the DPO confirms the requirements under the DPA IRR and current NPC circulars).
- Backups follow the Supabase plan; the City should enable point-in-time recovery on a paid plan before go-live.
- Free-text fields (logbook, notes) can still receive personal data by mistake. The DPO's retention and redaction procedure covers them; the audit log records who wrote what.
