import { describe, it, expect } from 'vitest';
import { validateBase } from './designerBaseValidation.js';

const base = {
  style: 'magnet',
  magnetDiameter: 6.5,
  magnetDepth: 2,
  screwDiameter: 3,
  stackingLip: true,
};

describe('validateBase magnet press-fit options', () => {
  it('accepts the flags absent or boolean', () => {
    expect(validateBase(base)).toBeNull();
    expect(validateBase({ ...base, magnetCrushRibs: true, magnetChamfer: false })).toBeNull();
  });

  it('rejects a non-boolean', () => {
    expect(validateBase({ ...base, magnetCrushRibs: 1 })).toContain('magnetCrushRibs');
    expect(validateBase({ ...base, magnetChamfer: 'yes' })).toContain('magnetChamfer');
  });
});
