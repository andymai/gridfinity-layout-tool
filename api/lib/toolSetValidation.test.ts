import { describe, expect, it } from 'vitest';
import { validateCutoutToolSets } from './toolSetValidation.js';

const spec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['8', '10', '13'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

describe('validateCutoutToolSets', () => {
  it('accepts an absent map and a valid spec', () => {
    expect(validateCutoutToolSets(undefined)).toBeNull();
    expect(validateCutoutToolSets({ 'set-1': spec })).toBeNull();
    const { fingerChannel: _omit, ...withoutChannel } = spec;
    expect(validateCutoutToolSets({ 'set-1': withoutChannel })).toBeNull();
  });

  it.each([
    ['an unknown family', { ...spec, family: 'hammer' }],
    ['an unknown unit system', { ...spec, units: 'imperial' }],
    ['no sizes', { ...spec, sizes: [] }],
    ['too many sizes', { ...spec, sizes: Array.from({ length: 31 }, (_, i) => String(i)) }],
    ['an over-long size key', { ...spec, sizes: ['1234567890123'] }],
    ['a clearance out of range', { ...spec, clearanceMm: 3 }],
    ['a label size out of range', { ...spec, labelSizeMm: -1 }],
    ['an unknown field', { ...spec, note: 'x' }],
    ['a non-boolean channel', { ...spec, fingerChannel: 'yes' }],
  ])('refuses %s', (_label, bad) => {
    expect(validateCutoutToolSets({ 'set-1': bad })).not.toBeNull();
  });

  it('refuses a bad key and a non-object map', () => {
    expect(validateCutoutToolSets({ ['x'.repeat(65)]: spec })).not.toBeNull();
    expect(validateCutoutToolSets([])).not.toBeNull();
  });
});
