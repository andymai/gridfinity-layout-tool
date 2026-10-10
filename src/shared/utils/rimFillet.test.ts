import { describe, expect, it } from 'vitest';
import { effectiveRimFilletRadius } from './rimFillet';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { validateBase } from '../../../api/lib/designerBaseValidation';

describe('rim settings', () => {
  it('keeps older designs unchanged and caps imported oversized radii', () => {
    expect(effectiveRimFilletRadius(DEFAULT_BIN_PARAMS)).toBe(0);
    const params = {
      ...DEFAULT_BIN_PARAMS,
      wallThickness: 1.2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false, rimFillet: true, rimFilletRadius: 4 },
    };
    expect(effectiveRimFilletRadius(params)).toBe(0.59);
    expect(
      effectiveRimFilletRadius({ ...params, base: { ...params.base, stackingLip: true } })
    ).toBe(0);
  });

  it('validates persisted settings and rejects invalid values', () => {
    expect(
      validateBase({ ...DEFAULT_BIN_PARAMS.base, rimFillet: true, rimFilletRadius: 0.4 })
    ).toBeNull();
    expect(validateBase({ ...DEFAULT_BIN_PARAMS.base, rimFillet: 'true' })).not.toBeNull();
    for (const radius of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '0.4']) {
      expect(validateBase({ ...DEFAULT_BIN_PARAMS.base, rimFilletRadius: radius })).not.toBeNull();
    }
  });
});
