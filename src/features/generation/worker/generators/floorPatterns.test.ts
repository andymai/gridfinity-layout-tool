import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { deriveDimensions } from './pipeline/context';
import { floorPatternApplies, planFloorPattern } from './floorPatterns';
import { floorWindowInset } from './floorPatternWindow';
import { CLEARANCE, INSET_BOT, SIZE, SOCKET_HEIGHT } from './generatorConstants';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    floorPattern: { enabled: true, pattern: 'round', scale: 0.5 },
    ...overrides,
  };
}

function plan(params: BinParams) {
  return planFloorPattern(params, deriveDimensions(params, false));
}

describe('floorPatternApplies', () => {
  it('requires the feature to be enabled', () => {
    const off = makeParams({ floorPattern: { enabled: false, pattern: 'round' } });
    expect(floorPatternApplies(off, deriveDimensions(off, false))).toBe(false);
    expect(floorPatternApplies(makeParams(), deriveDimensions(makeParams(), false))).toBe(true);
  });

  it('treats a design saved before the feature as off', () => {
    const legacy = makeParams({ floorPattern: undefined });
    expect(floorPatternApplies(legacy, deriveDimensions(legacy, false))).toBe(false);
  });

  it('rejects solid bins (no floor distinct from the body)', () => {
    const solid = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, solid: true } });
    expect(floorPatternApplies(solid, deriveDimensions(solid, false))).toBe(false);
  });

  it('rejects a lightweight base (already open, no slab to perforate)', () => {
    const lite = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true } });
    expect(floorPatternApplies(lite, deriveDimensions(lite, false))).toBe(false);
  });
});

describe('planFloorPattern windows', () => {
  it('emits one window per socket cell, inset for the foot underside', () => {
    const result = plan(makeParams());
    expect(result?.windows).toHaveLength(4);

    const inset = floorWindowInset(DEFAULT_BIN_PARAMS.wallThickness);
    const expectedSpan = SIZE - CLEARANCE - 2 * inset;
    for (const window of result?.windows ?? []) {
      expect(window.patternSpan).toBeCloseTo(expectedSpan, 6);
      expect(window.patternDepth).toBeCloseTo(expectedSpan, 6);
    }
  });

  it('keeps every window inside the flat part of its foot', () => {
    const result = plan(makeParams());
    // A foot's underside stops INSET_BOT in from the cell edge; anything past
    // that would exit through the baseplate-mating taper.
    const flatHalfSpan = (SIZE - CLEARANCE) / 2 - INSET_BOT;
    for (const window of result?.windows ?? []) {
      const cellCenterX = Math.sign(window.x) * (SIZE / 2);
      expect(Math.abs(window.x - cellCenterX) + window.patternSpan / 2).toBeLessThanOrEqual(
        flatHalfSpan
      );
    }
  });

  it('spans the floor slab and the socket below it', () => {
    const result = plan(makeParams());
    expect(result?.cutZ0).toBeLessThan(-SOCKET_HEIGHT);
    expect(result?.cutZ1).toBeGreaterThan(DEFAULT_BIN_PARAMS.wallThickness);
  });

  it('gives a flat base one interior-wide window and stops at the floor', () => {
    const params = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } });
    const result = plan(params);
    expect(result?.windows).toHaveLength(1);
    expect(result?.cutZ0).toBeGreaterThan(-SOCKET_HEIGHT);

    const dim = deriveDimensions(params, false);
    expect(result?.windows[0]?.patternSpan).toBeLessThan(dim.innerW);
  });

  it('splits each foot into four windows under half sockets', () => {
    const params = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true } });
    expect(plan(params)?.windows).toHaveLength(16);
  });

  it('skips cells the mask leaves empty', () => {
    const params = makeParams({
      cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
    });
    expect(plan(params)?.windows).toHaveLength(3);
  });

  it('widens the inset when the wall is thicker than the foot taper', () => {
    const thick = 2 * INSET_BOT;
    const params = makeParams({ wallThickness: thick });
    const result = plan(params);
    expect(result?.windows[0]?.patternSpan).toBeCloseTo(
      SIZE - CLEARANCE - 2 * floorWindowInset(thick),
      6
    );
  });
});

describe('planFloorPattern keep-outs', () => {
  it('reserves the magnet pockets', () => {
    const params = makeParams({
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
    });
    const window = plan(params)?.windows[0];
    // Four corner pockets per foot, all inside the window.
    expect(window?.keepOuts).toHaveLength(4);
  });

  it('reserves the footprint of a divider that crosses a foot', () => {
    expect(plan(makeParams())?.windows[0]?.keepOuts).toHaveLength(0);

    // Three columns across a two-cell bin puts a divider mid-foot.
    const divided = plan(
      makeParams({
        compartments: { cols: 3, rows: 1, cells: [0, 1, 2], thickness: 1.2 },
      })
    )?.windows[0];
    expect(divided?.keepOuts.length ?? 0).toBeGreaterThan(0);
  });

  it('needs no keep-out for a divider that lands on a cell boundary', () => {
    // The window inset already holds more material aside than the divider
    // occupies, so a 2-column split of a 2-cell bin clears itself.
    const divided = plan(
      makeParams({
        compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      })
    );
    expect(divided?.windows.every((w) => w.keepOuts.length === 0)).toBe(true);
  });

  it('reserves the scoop ramp footing', () => {
    const scooped = plan(
      makeParams({
        height: 6,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      })
    );
    const anyKeepOut = (scooped?.windows ?? []).some((w) => w.keepOuts.length > 0);
    expect(anyKeepOut).toBe(true);
  });
});
