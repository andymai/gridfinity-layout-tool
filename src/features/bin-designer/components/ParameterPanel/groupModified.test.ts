import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { modifiedGroups, type PanelGroup } from './groupModified';

/** Override one param with a value guaranteed to differ structurally from its default. */
const modify = (key: string, value: unknown): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  [key]: value,
});

const GROUPS: readonly PanelGroup[] = ['shape', 'lid', 'interior', 'base', 'finishing'];
const NONE: Record<PanelGroup, boolean> = {
  shape: false,
  lid: false,
  interior: false,
  base: false,
  finishing: false,
};

describe('modifiedGroups', () => {
  it('marks nothing on stock defaults', () => {
    expect(modifiedGroups(DEFAULT_BIN_PARAMS)).toEqual(NONE);
  });

  const cases: ReadonlyArray<[string, unknown, PanelGroup]> = [
    // Shape owns size, walls, custom footprint, drawer fit, and split by fallback.
    ['width', 99, 'shape'],
    ['wallThickness', 9, 'shape'],
    ['walls', { modified: true }, 'shape'],
    ['splitConnectors', { modified: true }, 'shape'],
    ['cellMask', { modified: true }, 'shape'],
    ['overhang', { modified: true }, 'shape'],
    ['extraWallHeightMm', 5, 'shape'],
    ['lid', { modified: true }, 'lid'],
    ['handles', { modified: true }, 'lid'],
    ['style', 'solid', 'interior'],
    ['compartments', { modified: true }, 'interior'],
    ['scoop', { modified: true }, 'interior'],
    ['knifeRest', { modified: true }, 'interior'],
    ['slide', { modified: true }, 'interior'],
    ['base', { modified: true }, 'base'],
    ['featureColors', { modified: true }, 'finishing'],
    ['wallPattern', { modified: true }, 'finishing'],
    ['floorPattern', { modified: true }, 'finishing'],
    ['heightUnitMm', 9, 'finishing'],
    ['gridUnitMm', 43, 'finishing'],
  ];

  it.each(cases)('routes %s to the %s group only', (key, value, group) => {
    const result = modifiedGroups(modify(key, value));
    expect(result[group]).toBe(true);
    for (const other of GROUPS) {
      if (other !== group) expect(result[other]).toBe(false);
    }
  });

  it('excludes text params that span groups', () => {
    expect(modifiedGroups(modify('surfaceText', { modified: true }))).toEqual(NONE);
    expect(modifiedGroups(modify('textDefaults', { modified: true }))).toEqual(NONE);
  });
});
