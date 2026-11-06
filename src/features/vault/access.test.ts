import { describe, expect, it } from 'vitest';
import { canReadVaultDoc } from './access';
import type { Role } from '@/types';

const as = (...mine: Role[]) => (...r: Role[]) => r.some((x) => mine.includes(x) || mine.includes('admin'));

describe('canReadVaultDoc mirrors app.can_read_vault_doc', () => {
  it('a standard document opens for any Vault role', () => expect(canReadVaultDoc(as('duty_officer'))).toBe(true));
  it('nobody outside the Vault roles', () => expect(canReadVaultDoc(as('viewer'), 'standard')).toBe(false));
  it('a restricted document opens for the CDRRMO Head', () => expect(canReadVaultDoc(as('cdrrmo_head'), 'restricted', ['assessor'])).toBe(true));
  it('and for a listed role', () => expect(canReadVaultDoc(as('assessor'), 'restricted', ['assessor', 'validator'])).toBe(true));
  it('but not for other Vault roles', () => expect(canReadVaultDoc(as('eoc_staff'), 'restricted', ['assessor'])).toBe(false));
  it('admin passes, as has_any_role counts admin', () => expect(canReadVaultDoc(as('admin'), 'restricted', ['assessor'])).toBe(true));
});
