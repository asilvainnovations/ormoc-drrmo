# ADR-001: Vite + React + TypeScript PWA on Supabase

Status: Accepted, 15 Oct 2026

## Context
CDRRMO staff, EOC duty officers and barangay focal persons work mostly from phones, often on weak mobile data during a hazard. The City has no in-house developers to maintain a native app for two stores. The platform must outlive the 14-week contract and be maintainable by a local IT contractor.

## Decision
- One installable Progressive Web App: Vite 5, React 18, TypeScript (strict), Tailwind 3, React Router 6.
- Supabase for Postgres, Auth, Storage and Realtime. Business rules live in the database (constraints, triggers, RLS), not in a custom API server.
- No server code of our own beyond SQL migrations. No edge functions in the first release.
- Exact dependency versions are pinned in `package.json`.

## Consequences
- One code base serves phone, tablet and desk. Installs from the browser; updates without app-store review (the user is prompted before reload).
- iOS PWA limits apply: no background sync; storage can be evicted after weeks of non-use. Mitigated by syncing on open and on reconnect, and by asking for persistent storage.
- Rules in SQL means a reviewer can audit one place, and any future client (an SMS gateway, a Power BI connection) gets the same rules.
- The skills needed to maintain it (TypeScript, SQL) are common in the local market.
