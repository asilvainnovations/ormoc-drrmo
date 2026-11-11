# ADR-027: Bolt.new as the working space, not a path to `main`

Status: Accepted by Alvin M. Silva, 12 Nov 2026. The repository is the source of truth; Bolt works only on branches with pull requests.

## Context
The repository carries a `.bolt/` folder: `mcp.json` enables six connectors for the Bolt agent (GitHub, Sentry, Notion, Resend, Linear, Miro), and `.bolt/skills/` holds an older copy of the platform skill that describes 1.10.0 as current. None of the six services is named in SECURITY.md or the City's subprocessor list, and Bolt edits can reach `main` without review.

## Proposal
1. Bolt works on a branch and opens a pull request; nothing reaches `main` without CI passing.
2. Connectors are on only while needed; any that receives project data is listed in SECURITY.md and the subprocessor record.
3. The bundled skill carries a notice that it is out of date and points to `docs/system-design.md`, `DEPLOY.md` and the ADRs as the current sources (done in 1.13.0).

## Consequences
- One review path for all changes, whatever tool made them.
- The DPO sees every external service that may hold City data.

## Decision (12 Nov 2026)
Accepted. Bolt is Alvin's working space (like a Codespace): it has a terminal for `npm` commands (`npm run dev`, `npm test`, `npm run build`) and an immediate preview of the app. That use continues. What changes is the route to production: Bolt work goes on a branch and reaches `main` only through a pull request that CI has passed. Connectors stay off unless a task needs one.
