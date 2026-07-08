import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants';
import type { BinParams } from '../types';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  checkLidCompatibility,
  computeDisabledRails,
  hasLidBlocker,
  isLidBlockedBySection,
} from './lidCompatibility';

function withOverrides(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('checkLidCompatibility', () => {
  it('returns no issues for a vanilla 2x2x3 bin', () => {
    expect(checkLidCompatibility(DEFAULT_BIN_PARAMS)).toHaveLength(0);
  });

  describe('wall cutouts', () => {
    it('flags each enabled side as a warning', () => {
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

    it('upgrades to a blocker when ALL four sides have cutouts (no lip remaining)', () => {
      const params = withOverrides({
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: true },
          back: { ...DEFAULT_BIN_PARAMS.walls.back, enabled: true },
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: true },
        },
      });
      const issues = checkLidCompatibility(params);
      const allSidesIssue = issues.find((i) => i.id === 'wallCutoutsAllSides');
      expect(allSidesIssue?.severity).toBe('blocker');
      expect(allSidesIssue?.sides).toEqual(['front', 'back', 'left', 'right']);
      // The "some sides" warning shouldn't ALSO fire on the same params.
      expect(issues.find((i) => i.id === 'wallCutouts')).toBeUndefined();
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

    it('skips on polygon (cellMask) bins — wall cutouts are gated off by FeatureGate even when the flag is true', () => {
      const cells = Array<number>(64).fill(1);
      cells[0] = 0; // any partial mask qualifies
      const params = withOverrides({
        width: 4,
        depth: 4,
        cellMask: { cols: 8, rows: 8, cells },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
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

    it('skips on polygon bins — wall pattern is gated off by FeatureGate', () => {
      const cells = Array<number>(64).fill(1);
      cells[0] = 0;
      const params = withOverrides({
        width: 4,
        depth: 4,
        cellMask: { cols: 8, rows: 8, cells },
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'wallPattern')).toBeUndefined();
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

  describe('tall lid on a short bin (leverage)', () => {
    const withLid = (height: number, extraHeightMm: number): BinParams =>
      withOverrides({ height, lid: { ...DEFAULT_BIN_PARAMS.lid, extraHeightMm } });

    it('warns when a tall lid sits on a 1U bin', () => {
      const issue = checkLidCompatibility(withLid(1, 40)).find((i) => i.id === 'tallLidShortBin');
      expect(issue?.severity).toBe('warning');
    });

    it('does not warn for a small extra height on a 1U bin', () => {
      expect(
        checkLidCompatibility(withLid(1, 5)).find((i) => i.id === 'tallLidShortBin')
      ).toBeUndefined();
    });

    it('does not warn for a tall lid on a taller bin (grip is not marginal)', () => {
      expect(
        checkLidCompatibility(withLid(3, 40)).find((i) => i.id === 'tallLidShortBin')
      ).toBeUndefined();
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

  describe('compartment dividers', () => {
    it('flags when the bin has multiple compartments (dividers are built)', () => {
      const params = withOverrides({
        compartments: {
          cols: 2,
          rows: 1,
          thickness: 1.2,
          cells: [0, 1], // two distinct compartments → divider between them
        },
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'compartmentDividers');
      expect(issue?.severity).toBe('warning');
    });

    it('does not flag when all cells share one compartment (no dividers)', () => {
      const params = withOverrides({
        compartments: {
          cols: 2,
          rows: 1,
          thickness: 1.2,
          cells: [0, 0],
        },
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'compartmentDividers')
      ).toBeUndefined();
    });

    it('does not flag solid bins (no compartments are built)', () => {
      const params = withOverrides({
        style: 'solid',
        compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'compartmentDividers')
      ).toBeUndefined();
    });

    it('does not flag slotted bins (uses slot rails, not compartment walls)', () => {
      // Switching from a compartment style to 'slotted' leaves stale
      // `compartments.cells` data; we must not warn on that since slotted
      // bins never generate divider walls.
      const params = withOverrides({
        style: 'slotted',
        compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'compartmentDividers')
      ).toBeUndefined();
    });

    it('does not flag polygon bins (compartments are gated off by FeatureGate)', () => {
      const cells = Array<number>(64).fill(1);
      cells[0] = 0;
      const params = withOverrides({
        width: 4,
        depth: 4,
        cellMask: { cols: 8, rows: 8, cells },
        compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'compartmentDividers')
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

  describe('severity ordering', () => {
    it('sorts blockers before warnings', () => {
      // Build a bin that triggers both a blocker (tallDividerPieces) AND
      // multiple warnings (shortBin + wallPattern).
      const params = withOverrides({
        height: 1, // shortBin warning
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true }, // warning
        style: 'slotted',
        dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, height: 100 }, // blocker
      });
      const issues = checkLidCompatibility(params);
      // First issue must be the blocker; remaining must all be warnings.
      expect(issues[0]?.severity).toBe('blocker');
      expect(issues.slice(1).every((i) => i.severity === 'warning')).toBe(true);
    });
  });

  describe('isLidBlockedBySection', () => {
    function lidEnabled(overrides: Partial<BinParams> = {}): BinParams {
      return withOverrides({
        ...overrides,
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      });
    }

    it('returns false when the lid is disabled (no point flagging)', () => {
      const params = withOverrides({
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: true },
          back: { ...DEFAULT_BIN_PARAMS.walls.back, enabled: true },
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: true },
        },
      });
      expect(isLidBlockedBySection(params, 'walls')).toBe(false);
    });

    it('returns false when the bin has no stacking lip (lid is gated separately)', () => {
      const params = lidEnabled({
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: true },
          back: { ...DEFAULT_BIN_PARAMS.walls.back, enabled: true },
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: true },
        },
      });
      expect(isLidBlockedBySection(params, 'walls')).toBe(false);
    });

    it('returns true when wall cutouts on all 4 sides block an enabled lid', () => {
      const params = lidEnabled({
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: true },
          back: { ...DEFAULT_BIN_PARAMS.walls.back, enabled: true },
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: true },
        },
      });
      expect(isLidBlockedBySection(params, 'walls')).toBe(true);
    });

    it('returns false for warning-only (non-blocker) wall cutouts', () => {
      const params = lidEnabled({
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
        },
      });
      // This is a warning, not a blocker — section badge is for blockers only.
      expect(isLidBlockedBySection(params, 'walls')).toBe(false);
    });

    it('reports per-section, not blanket — wallPattern blocker would not flag walls section', () => {
      // Currently no wallPattern blockers exist (only warning); confirm
      // that even hypothetically, asking about walls returns false when
      // the conflict is actually owned by another section.
      const params = lidEnabled({
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
      });
      expect(isLidBlockedBySection(params, 'walls')).toBe(false);
    });
  });

  describe('label tabs', () => {
    it('warns and lists back as the affected side', () => {
      const params = withOverrides({
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'labelTabs');
      expect(issue?.severity).toBe('warning');
      expect(issue?.sides).toEqual(['back']);
    });

    it('skips on polygon (cellMask) bins', () => {
      const cells = Array<number>(64).fill(1);
      cells[0] = 0;
      const params = withOverrides({
        width: 4,
        depth: 4,
        cellMask: { cols: 8, rows: 8, cells },
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'labelTabs')).toBeUndefined();
    });
  });

  describe('handles', () => {
    // Defaults: 2x2x3 bin → interiorHeight 14mm, lipBottom 9.6mm. With
    // verticalPosition 0.7 and height 15mm clamped by margins, the hole
    // top lands at 12.6mm > 9.6mm → intrudes.
    it('warns when an enabled handle side intrudes into the lip Z range', () => {
      const params = withOverrides({
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.handles.front, enabled: true },
          back: { ...DEFAULT_BIN_PARAMS.handles.back, enabled: false },
          left: { ...DEFAULT_BIN_PARAMS.handles.left, enabled: false },
          right: { ...DEFAULT_BIN_PARAMS.handles.right, enabled: false },
        },
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'handles');
      expect(issue?.severity).toBe('warning');
      expect(issue?.sides).toEqual(['front']);
    });

    it('does NOT warn when the handle sits clear of the lip (low verticalPosition)', () => {
      const params = withOverrides({
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          verticalPosition: 0.2,
          front: { ...DEFAULT_BIN_PARAMS.handles.front, enabled: true },
        },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'handles')).toBeUndefined();
    });

    it('upgrades to blocker (handlesAllSides) when all four sides intrude', () => {
      const params = withOverrides({
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.handles.front, enabled: true },
          back: { ...DEFAULT_BIN_PARAMS.handles.back, enabled: true },
          left: { ...DEFAULT_BIN_PARAMS.handles.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.handles.right, enabled: true },
        },
      });
      const issues = checkLidCompatibility(params);
      const blocker = issues.find((i) => i.id === 'handlesAllSides');
      expect(blocker?.severity).toBe('blocker');
      expect(blocker?.sides).toEqual(['front', 'back', 'left', 'right']);
      expect(issues.find((i) => i.id === 'handles')).toBeUndefined();
    });

    it('isLidBlockedBySection returns true for the handles section on the all-sides blocker', () => {
      const params = withOverrides({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        handles: {
          ...DEFAULT_BIN_PARAMS.handles,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.handles.front, enabled: true },
          back: { ...DEFAULT_BIN_PARAMS.handles.back, enabled: true },
          left: { ...DEFAULT_BIN_PARAMS.handles.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.handles.right, enabled: true },
        },
      });
      expect(isLidBlockedBySection(params, 'handles')).toBe(true);
    });
  });

  describe('top-down cutouts at lip', () => {
    it('warns when a solid-bin cutout reaches the lip Z range', () => {
      // Bin interior = height (3) * heightUnitMm (7) − SOCKET_HEIGHT (7) = 14mm.
      // Lip bottom = 14 − LIP_HEIGHT (4.4) = 9.6mm. A cutout with
      // topOffset=0 and cutDepth=6mm reaches from 14 down to 8 → crosses
      // the lip boundary.
      const params = withOverrides({
        style: 'solid',
        cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig, topOffset: 0 },
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            x: 10,
            y: 10,
            width: 20,
            depth: 20,
            cutDepth: 6,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'topDownCutoutsAtLip');
      expect(issue?.severity).toBe('warning');
    });

    it('skips when the cutout stays below the lip', () => {
      // cutDepth=2 from topOffset=10 reaches Z=4 → never touches the lip
      // (which starts at 9.6mm). Cutout `topZ = 14-10 = 4mm` is also below
      // the lipBottom, so the condition `topZ > lipBottom` already fails.
      const params = withOverrides({
        style: 'solid',
        cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig, topOffset: 10 },
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            x: 10,
            y: 10,
            width: 20,
            depth: 20,
            cutDepth: 2,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'topDownCutoutsAtLip')
      ).toBeUndefined();
    });

    it('skips on non-solid bins (top-down cutouts only apply to solid)', () => {
      const params = withOverrides({
        cutouts: [
          {
            id: 'c1',
            shape: 'rectangle',
            x: 10,
            y: 10,
            width: 20,
            depth: 20,
            cutDepth: 6,
            rotation: 0,
            cornerRadius: 0,
            label: '',
            groupId: null,
          },
        ],
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'topDownCutoutsAtLip')
      ).toBeUndefined();
    });
  });

  describe('computeDisabledRails', () => {
    it('is empty for a vanilla bin', () => {
      expect(computeDisabledRails(checkLidCompatibility(DEFAULT_BIN_PARAMS)).size).toBe(0);
    });

    it('disables only the BACK rail when label tabs are enabled', () => {
      const params = withOverrides({
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      const set = computeDisabledRails(checkLidCompatibility(params));
      expect(set.has('back')).toBe(true);
      expect(set.has('front')).toBe(false);
      expect(set.has('left')).toBe(false);
      expect(set.has('right')).toBe(false);
    });

    it('aggregates wall cutouts + label tabs across multiple sides', () => {
      // Explicitly disable right (default is enabled) so we only assert
      // the left-only wall cutout case.
      const params = withOverrides({
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: false },
        },
      });
      const set = computeDisabledRails(checkLidCompatibility(params));
      expect(set.has('back')).toBe(true);
      expect(set.has('left')).toBe(true);
      expect(set.has('front')).toBe(false);
      expect(set.has('right')).toBe(false);
    });

    it('ignores issues without a sides array', () => {
      // wallPattern is side-less and shouldn't contribute to disabledRails.
      const params = withOverrides({
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
      });
      expect(computeDisabledRails(checkLidCompatibility(params)).size).toBe(0);
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
