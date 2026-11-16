# Merge patches for MODE 1.22.0 (ADR-040 Slice 1)

Apply these changes by hand (or as a single PR) on top of 1.21.0 main.

## 1. `src/types.ts`

Append (or merge from `src/types.conversation.ts`):

```ts
export type ConversationParentKind = 'response' | 'assessment_cycle' | 'eoc_activation' | 'protocol_run';
export type ConversationStatus = 'open' | 'resolved' | 'locked';

export interface ConversationThread extends Versioned {
  parent_kind: ConversationParentKind;
  parent_id: string;
  title: string | null;
  status: ConversationStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_by?: string | null;
  created_at?: string;
}

/** Append-only. No version column — corrections are new rows. */
export interface ConversationMessage {
  id: string;
  thread_id: string;
  body: string;
  in_reply_to: string | null;
  author_id?: string | null;
  created_at: string;
}
```

## 2. `src/lib/tables.ts`

Add before the closing of `TABLES` (after sitrep_cutoffs):

```ts
  // 1.22.0 (ADR-040): object-scoped conversations. Messages are insert-only; thread status
  // changes (resolve) are authority actions and should use callOnline / updateOnline.
  { name: 'conversation_threads', pk: 'id', cursor: 'updated_at', write: 'upsert',
    omit: ['created_at', 'updated_at', 'created_by', 'resolved_by', 'resolved_at'] },
  { name: 'conversation_messages', pk: 'id', cursor: 'created_at', write: 'insert',
    omit: ['created_at', 'author_id'] },
```

Optional: add `'conversation_messages'` to `REALTIME_TABLES` if the EOC board should nudge live.

## 3. `src/lib/db.ts`

### Table declarations (class body, with the other `!` fields)

```ts
  conversation_threads!: Table<T.ConversationThread, string>;
  conversation_messages!: Table<T.ConversationMessage, string>;
```

### Schema version 10 (after version 9)

```ts
    // v10 (1.22.0): object-scoped conversations (ADR-040).
    this.version(10).stores({
      conversation_threads: 'id, [parent_kind+parent_id], parent_kind, parent_id, status, updated_at',
      conversation_messages: 'id, thread_id, created_at',
    });
```

## 4. `src/features/iat/IndicatorPage.tsx`

Import and render when a response row exists:

```tsx
import { ConversationPanel } from '@/components/ConversationPanel';

// Inside the main return, after evidence / ModeLinks sections:
{resp && (
  <ConversationPanel
    parentKind="response"
    parentId={resp.id}
    label={indicatorId}
  />
)}
```

Only show when `resp` is persisted (has been saved at least once). For a brand-new draft response, start the conversation after the first save.

## 5. `src/features/iat/CycleOverview.tsx`

```tsx
import { ConversationPanel } from '@/components/ConversationPanel';

// Near the bottom of the cycle overview:
<ConversationPanel
  parentKind="assessment_cycle"
  parentId={cycle.id}
  label={cycle.name}
/>
```

## 6. `supabase/migrations/migration_status.sql`

Add to the values list (before the closing):

```sql
  ('20261116003300_conversations', exists (select 1 from pg_proc
                                            where proname = 'guard_conversation_thread'
                                              and pronamespace = 'app'::regnamespace)),
```

## 7. `supabase/tests/10_rules_and_security.sql`

Append the checks from `supabase/tests/conversations_checks.sql` in this zip.

## 8. `package.json`

Bump `"version"` to `"1.22.0"`.

## 9. `DEPLOY.md`

Add a “To 1.22.0” entry: apply migration `20261116003300_conversations.sql`; no seed; tag `v1.22.0`.
