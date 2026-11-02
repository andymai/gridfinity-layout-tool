import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { lipNotchBlocker, resolveLipNotches } from './lipNotchPlan';

function params(over: Partial<BinParams> = {}, base: Partial<BinParams['base']> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    ...over,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, lipNotches: true, ...base },
  };
}

describe('lipNotchBlocker', () => {
  it('allows a lipped rectangular bin with an internal grid line', () => {
    expect(lipNotchBlocker(params())).toBeNull();
    expect(lipNotchBlocker(params({ width: 1.5, depth: 1 }))).toBeNull();
  });

  it.each<[string, BinParams, string]>([
    ['no lip', params({}, { stackingLip: false }), 'noLip'],
    ['a lid', params({ lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } }), 'lid'],
    ['a custom shape', params({ cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] } }), 'shape'],
    ['an overhang', params({ overhang: { right: 5 } } as Partial<BinParams>), 'overhang'],
    ['half-offset feet', params({}, { footLatticeY: 'half' }), 'lattice'],
    ['a 1.7 unit width', params({ width: 1.7 }), 'size'],
    ['a single cell', params({ width: 1, depth: 1 }), 'singleCell'],
  ])('reports %s', (_, p, expected) => {
    expect(lipNotchBlocker(p)).toBe(expected);
  });

  // The panel shows one reason at a time, so the order is the contract.
  it('names a lid before the shape it also blocks on', () => {
    const both = params({
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
    });
    expect(lipNotchBlocker(both)).toBe('lid');
  });

  // Uniform half sockets, or a fractional axis, leave the lattice inert.
  it('ignores a half-offset lattice the feet do not follow', () => {
    expect(lipNotchBlocker(params({}, { footLatticeX: 'half', halfSockets: true }))).toBeNull();
    expect(lipNotchBlocker(params({ width: 2.5 }, { footLatticeX: 'half' }))).toBeNull();
  });

  // Detachable feet replace the socket, so a stored halfSockets no longer exempts them.
  it('blocks half-offset detachable feet even with half sockets stored', () => {
    const detachable = params({}, { footLatticeX: 'half', halfSockets: true, feet: 'detachable' });
    expect(lipNotchBlocker(detachable)).toBe('lattice');
  });
});

describe('resolveLipNotches', () => {
  it('builds only when asked for and unblocked', () => {
    expect(resolveLipNotches(params())).toBe(true);
    expect(resolveLipNotches(params({}, { lipNotches: undefined }))).toBe(false);
    expect(resolveLipNotches(params({ width: 1, depth: 1 }))).toBe(false);
  });
});
