// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, WallCutout } from '@/shared/types/bin';
import { wallCutoutsFeature } from './wallCutoutBuilder';

// cacheKey is pure — no WASM init needed.
function keyFor(params: BinParams, collarHeight = 0): string {
  const ctx = {
    params,
    dimensions: {
      shellKey: 'shell',
      innerW: 80,
      innerD: 40,
      wallHeight: 42,
      interiorHeight: 40,
      collarHeight,
      hasLip: true,
      compartmentsBakedIntoShell: false,
    },
  } as unknown as Parameters<typeof wallCutoutsFeature.cacheKey>[0];
  return wallCutoutsFeature.cacheKey(ctx);
}

function withFront(over: Partial<WallCutout>): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true, ...over },
    },
  };
}

describe('wallCutoutsFeature.cacheKey', () => {
  // The key serializes the whole `walls` object, so a new size field is covered
  // by construction — but only as long as it lives there. A field parked
  // outside `walls` would serve the previous cut back after the user edits it,
  // and a stale cut looks exactly like a correct one.
  it('changes when the absolute depth changes', () => {
    expect(keyFor(withFront({ depthMm: 10 }))).not.toBe(keyFor(withFront({ depthMm: 30 })));
  });

  it('separates an absolute depth from the percentage it overrides', () => {
    expect(keyFor(withFront({ depth: 50, depthMm: 20 }))).not.toBe(
      keyFor(withFront({ depth: 50, depthMm: null }))
    );
  });

  it('is stable for an unchanged config', () => {
    expect(keyFor(withFront({ depthMm: 20 }))).toBe(keyFor(withFront({ depthMm: 20 })));
  });

  // The cut runs up through the collar, so a taller collar is a taller cutter.
  // Keyed directly, not left to `shellKey`, which carries it for the shell alone.
  it('changes with the collar', () => {
    expect(keyFor(withFront({}), 0)).not.toBe(keyFor(withFront({}), 6));
  });

  describe('with the opening carried through the dividers', () => {
    const throughGrid = (over: Partial<BinParams> = {}): BinParams => {
      const base = withFront({});
      return {
        ...base,
        compartments: { ...base.compartments, cols: 2, rows: 2, cells: [0, 1, 2, 3] },
        walls: { ...base.walls, interior: { ...base.walls.left, enabled: true } },
        ...over,
      };
    };

    // Label tabs, raised floors and the fillet all move the path's cuts while
    // living outside `walls` and the grid, so the key carries the solved cuts.
    it('changes with label tabs on the dividers it cuts', () => {
      const tabs = { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } };
      expect(keyFor(throughGrid())).not.toBe(keyFor(throughGrid(tabs)));
    });

    it('changes with a raised floor beside a cut divider', () => {
      const plain = throughGrid();
      const raised = {
        compartments: { ...plain.compartments, floorRaises: [0, 0, 10] },
        walls: {
          ...plain.walls,
          front: { ...plain.walls.front, depth: 100 },
        },
      };
      const deep = { walls: raised.walls };
      expect(keyFor(throughGrid(deep))).not.toBe(keyFor(throughGrid(raised)));
    });

    it('changes with the interior fillet', () => {
      expect(keyFor(throughGrid())).not.toBe(keyFor(throughGrid({ interiorFilletMm: 2 })));
    });
  });
});
