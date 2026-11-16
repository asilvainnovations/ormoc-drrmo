/** ADR-040 object-scoped conversations (1.22.0). Merge these into src/types.ts. */

export type ConversationParentKind = 'response' | 'assessment_cycle' | 'eoc_activation' | 'protocol_run';
export type ConversationStatus = 'open' | 'resolved' | 'locked';

export interface ConversationThread {
  id: string;
  parent_kind: ConversationParentKind;
  parent_id: string;
  title: string | null;
  status: ConversationStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  version: number;
}

/** Append-only. No version / updated_at — corrections are new rows. */
export interface ConversationMessage {
  id: string;
  thread_id: string;
  body: string;
  in_reply_to: string | null;
  author_id?: string | null;
  created_at: string;
}
