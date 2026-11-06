import type { Role } from '@/types';

/** Roles that open the Document Vault: assessors, validators (evaluators), admin and CDRRMO staff.
 *  Mirrors app.can_use_vault() in supabase/migrations/20261016000800_document_vault.sql. */
export const VAULT_ROLES: Role[] = ['assessor', 'validator', 'admin', 'cdrrmo_head', 'eoc_manager', 'eoc_staff', 'duty_officer'];
export const canUseVault = (has: (...r: Role[]) => boolean) => has(...VAULT_ROLES);

/** Roles that may be given a restricted document. The CDRRMO Head always opens restricted documents. */
export const RESTRICTABLE_ROLES: Role[] = ['assessor', 'validator', 'eoc_manager', 'eoc_staff', 'duty_officer'];

/**
 * Who opens this document. Mirrors app.can_read_vault_doc (migration 20261106001600): a Vault role, and for a
 * restricted document the CDRRMO Head or one of its listed roles (admin passes, as in app.has_any_role).
 */
export function canReadVaultDoc(has: (...r: Role[]) => boolean, access: 'standard' | 'restricted' = 'standard', roles: Role[] = []): boolean {
  if (!canUseVault(has)) return false;
  return access === 'standard' || has('cdrrmo_head') || (roles.length > 0 && has(...roles));
}
