# ADR-014: Sign-out keeps other accounts' unsent changes; one stuck item backs off alone (v1.7.1)

Status: Accepted, 5 Nov 2026. Amends ADR-003 and ADR-009.

## Context
ADR-009 says signing out clears the device, so nothing of one person stays readable on a shared EOC phone. Since v1.2 queued changes carry the account that made them and are sent only under that account. The 31 Oct 2026 audit (#7) found the two rules in conflict: sign-out counted only the signed-in account's queue and then deleted the whole database, so account B signing out erased account A's offline logbook entries and evidence photos. Refusals and conflicts carried no account at all, so B could "apply my change on top" of A's edit under B's name.

The audit (#8) also found that one item the server kept refusing with a temporary error (an error page, a timeout) stopped the whole queue indefinitely and showed "Offline", with no reason and no backoff.

## Decision
1. **Sign-out removes this account's data and leaves other accounts' unsent work.** `clearDeviceAfterSignOut()` keeps other accounts' queued changes, held files, refusals and conflicts, and the local rows those need; it removes everything else synced and the device's sync state. With nothing held for others it deletes the database, as before.
2. **Refusals and conflicts carry the account** that made the change. The Sync screen and the status band show only the signed-in account's items; other accounts' items are listed as held for them and are never sent or resolved under another name.
3. **Sign-out warns only about this account's unsent items.** Blocking sign-out until every account's items were sent was rejected: on a shared phone the other person may not come back for days.
4. **Temporary problems are split in two.** Connection problems (no network, expired token, rate limit, database unreachable) stop the round, as before. A server problem with one item backs that item off (15 s, doubling, at most 30 minutes) with the server's reason in `lastError`. Items that depend on it (same row, rows referring to its id, uploads under it) wait with it; independent items go. Two server problems in one round stop the round. There is no give-up limit: the item stays queued until it goes or the person deals with it, and after six tries the Sync screen marks it for attention.

## Consequences
- Another account's pending rows stay on the device after a sign-out until that account returns. They hold only what that person entered, and the other person's screens do not show their refusals or conflicts.
- Dependency detection is by id (primary key, foreign-key values, upload path). It can hold back an unrelated item that happens to carry the same id, which only delays it.
- No database change. Code: `src/lib/sync.ts` (`push`, `retryNow`, `clearDeviceAfterSignOut`, `unsentFor`), tests in `src/lib/sync.test.ts`.
