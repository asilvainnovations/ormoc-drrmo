import { describe, expect, it } from 'vitest';
import fixture from '@/test/fixtures/scoring-parity.json';
import { uuidv5 } from './ids';

describe('uuidv5 matches PostgreSQL uuid_generate_v5', () => {
  it.each(fixture.uuidv5)('$name in $ns', async ({ ns, name, id }) => {
    expect(await uuidv5(name, ns)).toBe(id);
  });
});
