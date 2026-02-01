import { describe, it, expect } from 'vitest';
import {
  buildHoneycombFloorCuts,
  buildHoneycombWallCuts,
  buildSinusoidalWallBox,
} from './ecoBuilder';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

describe('ecoBuilder', () => {
  const baseParams: BinParams = { ...DEFAULT_BIN_PARAMS };

  describe('buildHoneycombFloorCuts', () => {
    it('returns null when honeycomb floor is disabled', () => {
      const result = buildHoneycombFloorCuts(baseParams, 80, 80);
      expect(result).toBeNull();
    });

    it('returns null when inner dimensions are too small', () => {
      const params: BinParams = {
        ...baseParams,
        eco: {
          ...baseParams.eco,
          honeycombFloor: { enabled: true, cellSize: 'auto', margin: 2.5 },
        },
      };
      // Very small inner dimensions (< 2 × margin + cell circumradius)
      const result = buildHoneycombFloorCuts(params, 3, 3);
      expect(result).toBeNull();
    });
  });

  describe('buildHoneycombWallCuts', () => {
    it('returns null when wall honeycomb mode is none', () => {
      const result = buildHoneycombWallCuts(baseParams, 81.1, 81.1, 16);
      expect(result).toBeNull();
    });

    it('returns null when wall height minus margins leaves no room', () => {
      const params: BinParams = {
        ...baseParams,
        eco: {
          ...baseParams.eco,
          honeycombWall: { mode: 'pocketed', cellSize: 'auto', topMargin: 10, bottomMargin: 10 },
        },
      };
      // Wall height of 5mm with 10mm top + 10mm bottom margin = negative pattern height
      const result = buildHoneycombWallCuts(params, 81.1, 81.1, 5);
      expect(result).toBeNull();
    });
  });

  // buildSinusoidalWallBox requires Replicad WASM, so we only verify it's callable
  describe('buildSinusoidalWallBox', () => {
    it('is exported as a function', () => {
      expect(typeof buildSinusoidalWallBox).toBe('function');
    });
  });
});
