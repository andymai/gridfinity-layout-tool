import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { modifiedGroups } from './groupModified';

describe('modifiedGroups', () => {
  it('reports nothing modified for a stock bin', () => {
    expect(modifiedGroups(DEFAULT_BIN_PARAMS)).toEqual({
      shape: false,
      lid: false,
      interior: false,
      base: false,
      finishing: false,
    });
  });

  it('is insensitive to key order, so a rebuilt params object is still stock', () => {
    // Params are reassembled by spreading all over the app; a compare that
    // depended on insertion order would light every dot after any edit.
    const reordered = Object.fromEntries(
      Object.entries(DEFAULT_BIN_PARAMS).reverse()
    ) as typeof DEFAULT_BIN_PARAMS;

    expect(modifiedGroups(reordered).shape).toBe(false);
  });

  it('treats an explicitly-undefined field as absent', () => {
    const withUndefined = { ...DEFAULT_BIN_PARAMS, cellMask: undefined };

    expect(modifiedGroups(withUndefined).shape).toBe(false);
  });

  it.each(['featureColors', 'floorPattern', 'lid', 'base'] as const)(
    'reads a legacy design omitting %s as unmodified, not changed',
    (key) => {
      // Persisted designs predate several fields and every read site falls back
      // to the default, so an absent key is a design running on the default.
      // Comparing it against the populated default marked a group changed over
      // something its owner never touched.
      const { [key]: _omitted, ...legacy } = DEFAULT_BIN_PARAMS;

      expect(modifiedGroups(legacy as typeof DEFAULT_BIN_PARAMS)).toEqual({
        shape: false,
        lid: false,
        interior: false,
        base: false,
        finishing: false,
      });
    }
  );

  it('attributes a base change to Base alone', () => {
    const result = modifiedGroups({
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, spacer: true },
    });

    expect(result.base).toBe(true);
    expect(result.shape).toBe(false);
    expect(result.interior).toBe(false);
    expect(result.finishing).toBe(false);
  });

  it('attributes a lid change to Lid alone', () => {
    const result = modifiedGroups({
      ...DEFAULT_BIN_PARAMS,
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: !DEFAULT_BIN_PARAMS.lid.enabled },
    });

    expect(result.lid).toBe(true);
    expect(result.base).toBe(false);
  });

  it('attributes the units to Finishing, not Shape', () => {
    const result = modifiedGroups({ ...DEFAULT_BIN_PARAMS, gridUnitMm: 40 });

    expect(result.finishing).toBe(true);
    expect(result.shape).toBe(false);
  });

  it('attributes dimensions to Shape', () => {
    const result = modifiedGroups({ ...DEFAULT_BIN_PARAMS, width: 5 });

    expect(result.shape).toBe(true);
    expect(result.finishing).toBe(false);
  });

  it('attributes an interior change to Interior', () => {
    const result = modifiedGroups({
      ...DEFAULT_BIN_PARAMS,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    });

    expect(result.interior).toBe(true);
    expect(result.shape).toBe(false);
  });

  it('lights no dot for text, which is edited from two groups', () => {
    // Attributing `surfaceText` to one group would mark the wrong one half the
    // time; a dot that is sometimes wrong is worse than one that is absent.
    const result = modifiedGroups({
      ...DEFAULT_BIN_PARAMS,
      surfaceText: { lid: 'hello' },
    } as typeof DEFAULT_BIN_PARAMS);

    expect(result).toEqual({
      shape: false,
      lid: false,
      interior: false,
      base: false,
      finishing: false,
    });
  });

  // The identity fast path must agree with the structural compare, or an
  // untouched field and a deep-equal copy of it would report differently.
  it('agrees whether a field is the default object or a deep-equal copy of it', () => {
    const shared = { ...DEFAULT_BIN_PARAMS };
    const copied = {
      ...DEFAULT_BIN_PARAMS,
      base: structuredClone(DEFAULT_BIN_PARAMS.base),
      compartments: structuredClone(DEFAULT_BIN_PARAMS.compartments),
      lid: structuredClone(DEFAULT_BIN_PARAMS.lid),
    };

    expect(modifiedGroups(copied)).toEqual(modifiedGroups(shared));
  });

  it('still detects a change to a field it holds by reference elsewhere', () => {
    // Guards the fast path against reporting unmodified for a branch that was
    // replaced rather than mutated, which is how the store applies edits.
    const edited = {
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    };

    expect(modifiedGroups(edited).base).toBe(true);
    expect(modifiedGroups(edited).interior).toBe(false);
  });

  it('marks several groups at once', () => {
    const result = modifiedGroups({
      ...DEFAULT_BIN_PARAMS,
      width: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true },
    });

    expect(result.shape).toBe(true);
    expect(result.base).toBe(true);
    expect(result.lid).toBe(false);
  });
});
