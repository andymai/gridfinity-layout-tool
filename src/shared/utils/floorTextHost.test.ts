import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { resolveDetachableFeet } from './detachableFeetPlan';
import { floorTextHostBlock } from './floorTextHost';

const bin = (over: Partial<BinParams> = {}, base: Partial<BinParams['base']> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  ...over,
  base: { ...DEFAULT_BIN_PARAMS.base, ...base },
});

describe('floorTextHostBlock', () => {
  it('accepts a standard bin with a closed floor', () => {
    expect(floorTextHostBlock(bin())).toBeNull();
  });

  it('names a polygon footprint apart from other hosts', () => {
    expect(floorTextHostBlock(bin({ cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] } }))).toBe(
      'polygon'
    );
  });

  it.each<[string, Partial<BinParams>, Partial<BinParams['base']>]>([
    ['solid', { style: 'solid' }, { solid: true }],
    ['slotted', { style: 'slotted' }, {}],
    ['spacer', {}, { spacer: true }],
    ['base-only', {}, { tile: true }],
    ['open lightweight floor', {}, { lightweight: true }],
  ])('refuses a %s bin', (_name, over, base) => {
    expect(floorTextHostBlock(bin(over, base))).toBe('host');
  });

  it.each<[string, Partial<BinParams['base']>]>([
    ['underside relief', { lightweight: true, lightweightMode: 'underside' }],
    ['detachable feet', { lightweight: true, feet: 'detachable' }],
    ['flat base', { lightweight: true, spacer: true, tile: true, style: 'flat' }],
  ])('keeps the floor that lightweight leaves under %s', (_name, base) => {
    expect(floorTextHostBlock(bin({}, base))).toBeNull();
  });

  it('opens the floor when requested detachable feet place nothing', () => {
    const params = bin(
      { width: 1, depth: 2 },
      { lightweight: true, feet: 'detachable', footLatticeX: 'half' }
    );
    expect(resolveDetachableFeet(params).placements).toHaveLength(0);
    expect(floorTextHostBlock(params)).toBe('host');
  });
});
