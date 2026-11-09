# ADR-021: The production project runs in Tokyo (ap-northeast-1) (v1.11.0)

Status: Accepted, 8 Nov 2026. Amends ADR-002 (region only).

## Context
ADR-002 planned the City's Supabase project for `ap-southeast-1` (Singapore). The project that was actually created is `jmctsspadywjcbbqwweh` ("ormoc-drrmo", organisation "City Government of Ormoc"). The City's Supabase dashboard (Settings → General) shows its region as **`ap-northeast-1`, Northeast Asia (Tokyo)**. The City confirmed this on 8 Nov 2026. ADR-002 had never been checked against the live project. The 1.10.0 policies, SECURITY.md and ADR-020 therefore repeated the planned region, not the real one.

## Decision
1. **Records follow the live project.** Every document and public page names `ap-northeast-1` (Tokyo, Japan) as the region of the database, sign-in and file storage.
2. **The cross-border transfer is to Japan.** The privacy notice says so. The data-sharing or outsourcing arrangement with the provider, and the DPO's assessment under the DPA IRR and NPC issuances, cover Japan, not Singapore.
3. **No move is planned.** A move would mean a new project, a data migration and new keys. If the City wants a different region later, it records that in a new ADR.
4. **The rest of ADR-002 stands:** City ownership, time-boxed developer access, the data held, private buckets, and portability.

## Consequences
- The direct and pooler connection strings come from the project's Connect panel (the pooler host contains `ap-northeast-1`). DEPLOY §1 no longer gives a region to choose.
- Latency from Ormoc is somewhat higher than to Singapore. The local-first design (ADR-003) keeps screens independent of it.
- The DPO reviews the privacy notice again for the Japan transfer before go-live.
