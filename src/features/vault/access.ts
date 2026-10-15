import type { Role } from '@/types';

/** Roles that open the Document Vault: assessors, validators (evaluators), admin and CDRRMO staff.
 *  Mirrors app.can_use_vault() in supabase/migrations/20261016000800_document_vault.sql. */
export const VAULT_ROLES: Role[] = ['assessor', 'validator', 'admin', 'cdrrmo_head', 'eoc_manager', 'eoc_staff', 'duty_officer'];
export const canUseVault = (has: (...r: Role[]) => boolean) => has(...VAULT_ROLES);
