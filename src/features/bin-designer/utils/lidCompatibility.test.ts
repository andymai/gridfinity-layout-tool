import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants';
import type { BinParams } from '../types';
import type { CellMask } from '@/shared/utils/cellMask';
import { checkLidCompatibility, hasLidBlocker } from './lidCompatibility';

function withOverrides(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('checkLidCompatibility', () => {
  it('returns no issues for a vanilla 2x2x3 bin', () => {
    expect(checkLidCompatibility(DEFAULT_BIN_PARAMS)).toHaveLength(0);
  });

  describe('wall cutouts', () => {
    it('flags each enabled side', () => {
      const params = withOverrides({
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: true },
          front: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: false },
          back: { ...DEFAULT_BIN_PARAMS.walls.back, enabled: false },
        },
      });
      const issues = checkLidCompatibility(params);
      const wallIssue = issues.find((i) => i.id === 'wallCutouts');
      expect(wallIssue).toBeDefined();
      expect(wallIssue?.severity).toBe('warning');
      expect(wallIssue?.sides).toEqual(['left', 'right']);
    });

    it('skips when wall cutouts are disabled at the top level', () => {
      const params = withOverrides({
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: false,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
        },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'wallCutouts')).toBeUndefined();
    });

    it('skips when no side is individually enabled', () => {
      const params = withOverrides({
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: false },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: false },
        },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'wallCutouts')).toBeUndefined();
    });
  });

  describe('wall pattern', () => {
    it('flags when wall pattern is enabled', () => {
      const params = withOverrides({
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'wallPattern');
      expect(issue?.severity).toBe('warning');
    });
  });

  describe('short bins', () => {
    it('flags height=1 (1U)', () => {
      const params = withOverrides({ height: 1 });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'shortBin');
      expect(issue?.severity).toBe('warning');
    });

    it('does not flag height=2', () => {
      const params = withOverrides({ height: 2 });
      expect(checkLidCompatibility(params).find((i) => i.id === 'shortBin')).toBeUndefined();
    });
  });

  describe('tall divider pieces', () => {
    it('flags slotted bin with manual height exceeding interior', () => {
      const interior = DEFAULT_BIN_PARAMS.height * DEFAULT_BIN_PARAMS.heightUnitMm - 5; // SOCKET_HEIGHT
      const params = withOverrides({
        style: 'slotted',
        dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, height: interior + 5 },
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'tallDividerPieces');
      expect(issue?.severity).toBe('blocker');
    });

    it('does not flag auto-height dividers', () => {
      const params = withOverrides({
        style: 'slotted',
        dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, height: 'auto' },
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'tallDividerPieces')
      ).toBeUndefined();
    });

    it('does not flag tall dividers on non-slotted bins (the dividers are not generated)', () => {
      const params = withOverrides({
        style: 'standard',
        dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, height: 100 },
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'tallDividerPieces')
      ).toBeUndefined();
    });
  });

  describe('cellMask interior holes (O-shape)', () => {
    it('flags O-shape masks (multi-loop polygon)', () => {
      // 4×4 mask with a 2×2 hole in the middle (mask is half-bin resolution: 8×8)
      const cells: number[] = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          // Hole in the middle 4×4 cells (rows 2-5, cols 2-5)
          const isHole = r >= 2 && r <= 5 && c >= 2 && c <= 5;
          cells.push(isHole ? 0 : 1);
        }
      }
      const cellMask: CellMask = { cols: 8, rows: 8, cells };
      const params = withOverrides({ width: 4, depth: 4, cellMask });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'cellMaskHoles');
      expect(issue?.severity).toBe('warning');
    });

    it('does not flag simple solid shapes', () => {
      expect(
        checkLidCompatibility(DEFAULT_BIN_PARAMS).find((i) => i.id === 'cellMaskHoles')
      ).toBeUndefined();
    });
  });

  describe('hasLidBlocker', () => {
    it('returns true when any blocker is present', () => {
      const issues = [
        { id: 'wallCutouts' as const, severity: 'warning' as const },
        { id: 'tallDividerPieces' as const, severity: 'blocker' as const },
      ];
      expect(hasLidBlocker(issues)).toBe(true);
    });

    it('returns false for warnings-only', () => {
      const issues = [{ id: 'wallCutouts' as const, severity: 'warning' as const }];
      expect(hasLidBlocker(issues)).toBe(false);
    });

    it('returns false for empty list', () => {
      expect(hasLidBlocker([])).toBe(false);
    });
  });
});
