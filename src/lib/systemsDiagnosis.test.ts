import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYSTEMS_DIAGNOSIS_LABEL, SYSTEMS_DIAGNOSIS_TIP, SYSTEMS_DIAGNOSIS_URL } from './systemsDiagnosis';

describe('Systems Diagnosis configuration', () => {
  it('points to the static page in public/', () => {
    expect(SYSTEMS_DIAGNOSIS_URL).toMatch(/\/systems-diagnosis\.html$/);
    expect(existsSync(join(__dirname, '..', '..', 'public', 'systems-diagnosis.html'))).toBe(true);
  });
  it('has a label and a tooltip that says it opens in a new tab', () => {
    expect(SYSTEMS_DIAGNOSIS_LABEL).toBe('Systems Diagnosis');
    expect(SYSTEMS_DIAGNOSIS_TIP).toMatch(/new tab/);
  });
});
