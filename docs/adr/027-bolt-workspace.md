# ADR-027: Bolt.new as a sandbox, not a path to `main` (proposed)

Status: Proposed, 11 Nov 2026. For Alvin M. Silva to accept, amend or reject.

## Context
The repository carries a `.bolt/` folder: `mcp.json` enables six connectors for the Bolt agent (GitHub, Sentry, Notion, Resend, Linear, Miro), and `.bolt/skills/` holds an older copy of the platform skill that describes 1.10.0 as current. None of the six services is named in SECURITY.md or the City's subprocessor list, and Bolt edits can reach `main` without review.

## Proposal
1. Bolt works on a branch and opens a pull request; nothing reaches `main` without CI passing.
2. Connectors are on only while needed; any that receives project data is listed in SECURITY.md and the subprocessor record.
3. The bundled skill carries a notice that it is out of date and points to `docs/system-design.md`, `DEPLOY.md` and the ADRs as the current sources (done in 1.13.0).

## Consequences
- One review path for all changes, whatever tool made them.
- The DPO sees every external service that may hold City data.
