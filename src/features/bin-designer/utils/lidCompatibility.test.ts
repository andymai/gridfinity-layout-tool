import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants';
import type { BinParams, LidSlideConfig } from '../types';
import { DEFAULT_LID_SLIDE_CONFIG } from '../types/lid';
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

/** Handle holes of `width` percent on every side, reaching the lip. */
function allFourHandles(width: number): BinParams['handles'] {
  const side = { enabled: true, width: null, height: null, cornerRadius: null };
  return {
    ...DEFAULT_BIN_PARAMS.handles,
    enabled: true,
    width,
    front: { ...side },
    back: { ...side },
    left: { ...side },
    right: { ...side },
  };
}

/**
 * Wall cutouts of `width` percent on every side. The width is load-bearing
 *: the blocker asks whether any lip survives, not how many sides
 * carry a cutout, so 70 and 100 give different verdicts.
 */
function allFourCutouts(width: number): BinParams['walls'] {
  const side = {
    enabled: true,
    width,
    depth: 50,
    alignment: 'center' as const,
    offset: 0,
    widthMm: null,
  };
  return {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    front: { ...side },
    back: { ...side },
    left: { ...side },
    right: { ...side },
  };
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

    it('stays a warning on all four sides while each window leaves lip (#3483)', () => {
      // The default 70% cutout leaves 30% of every wall, and the rail keeps
      // those stretches. Blocking here refused a lid to a bin that generated
      // one happily with the same cutouts on three walls.
      const issues = checkLidCompatibility(withOverrides({ walls: allFourCutouts(70) }));
      expect(issues.find((i) => i.id === 'wallCutoutsAllSides')).toBeUndefined();
      const warning = issues.find((i) => i.id === 'wallCutouts');
      expect(warning?.severity).toBe('warning');
      expect(warning?.sides).toEqual(['front', 'back', 'left', 'right']);
    });

    it('upgrades to a blocker when the cutouts leave no lip at all', () => {
      const issues = checkLidCompatibility(withOverrides({ walls: allFourCutouts(100) }));
      const allSidesIssue = issues.find((i) => i.id === 'wallCutoutsAllSides');
      expect(allSidesIssue?.severity).toBe('blocker');
      expect(allSidesIssue?.sides).toEqual(['front', 'back', 'left', 'right']);
      // The "some sides" warning shouldn't ALSO fire on the same params.
      expect(issues.find((i) => i.id === 'wallCutouts')).toBeUndefined();
    });

    it('keeps three full-width walls out of the blocker', () => {
      const walls = allFourCutouts(100);
      const issues = checkLidCompatibility(
        withOverrides({ walls: { ...walls, back: { ...walls.back, enabled: false } } })
      );
      expect(issues.find((i) => i.id === 'wallCutoutsAllSides')).toBeUndefined();
      expect(issues.find((i) => i.id === 'wallCutouts')?.sides).toEqual(['front', 'left', 'right']);
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

    it('warns on a polygon bin too, whose cutouts really are cut (#3482)', () => {
      // This used to assert the opposite, on the premise that `FeatureGate`
      // disables wall cutouts for a custom shape. It does not: the gate only
      // makes the CONTROLS inert, `wallCutoutsFeature` declares
      // `supportsCellMask`, and `setCellMask` does not clear `walls.enabled` —
      // so the cut is made and the rail over it gripped nothing.
      const cells = Array<0 | 1>(64).fill(1);
      cells[0] = 0; // any partial mask qualifies
      const params = withOverrides({
        width: 4,
        depth: 4,
        cellMask: { cols: 8, rows: 8, cells },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          // Off explicitly — the default has it on, and the point here is which
          // walls the polygon plan reports, not how many the defaults enable.
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: false },
        },
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'wallCutouts');
      expect(issue?.severity).toBe('warning');
      expect(issue?.sides).toEqual(['left']);
    });

    it('never blocks a polygon bin, whose walls are not four sides', () => {
      // "All four sides" does not describe a shape with six walls, and a custom
      // shape's rails are clipped per edge, so it warns and keeps what is left.
      const cells = Array<0 | 1>(64).fill(1);
      cells[0] = 0;
      const params = withOverrides({
        width: 4,
        depth: 4,
        cellMask: { cols: 8, rows: 8, cells },
        walls: allFourCutouts(100),
      });
      expect(hasLidBlocker(checkLidCompatibility(params))).toBe(false);
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

    it('still flags when only one wall is patterned (#2966)', () => {
      const params = withOverrides({
        wallPattern: {
          ...DEFAULT_BIN_PARAMS.wallPattern,
          enabled: true,
          sides: { left: false, right: false, front: true, back: false },
        },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'wallPattern')?.severity).toBe(
        'warning'
      );
    });

    it('skips a divider-only pattern — the lip is never perforated (#2966)', () => {
      const params = withOverrides({
        wallPattern: {
          ...DEFAULT_BIN_PARAMS.wallPattern,
          enabled: true,
          dividers: true,
          sides: { left: false, right: false, front: false, back: false },
        },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'wallPattern')).toBeUndefined();
    });

    it('skips on polygon bins — wall pattern is gated off by FeatureGate', () => {
      const cells = Array<0 | 1>(64).fill(1);
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

    // A thick floor plate deepens the cavity just like extraHeightMm does
    //, so it lengthens the same lever arm and counts toward the
    // threshold — 6mm of extra height alone would not trip it.
    it('counts a thick floor plate toward the leverage threshold', () => {
      const params = withOverrides({
        height: 1,
        lid: { ...DEFAULT_BIN_PARAMS.lid, extraHeightMm: 6, topThicknessMm: 5 },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'tallLidShortBin')?.severity).toBe(
        'warning'
      );
      expect(
        checkLidCompatibility(withLid(1, 6)).find((i) => i.id === 'tallLidShortBin')
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
    const twoCompartments = {
      cols: 2,
      rows: 1,
      thickness: 1.2,
      cells: [0, 1], // two distinct compartments → divider between them
    };

    it('flags the walls whose rail is notched around a divider', () => {
      const issue = checkLidCompatibility(withOverrides({ compartments: twoCompartments })).find(
        (i) => i.id === 'compartmentDividers'
      );
      expect(issue?.severity).toBe('warning');
      // A column boundary runs wall to wall, so both ends take a notch.
      expect(issue?.sides).toEqual(['front', 'back']);
    });

    it('never disables a wall outright — the rail keeps the stretches between', () => {
      const issues = checkLidCompatibility(withOverrides({ compartments: twoCompartments }));
      expect(computeDisabledRails(issues).size).toBe(0);
    });

    it('does not flag a magnetic lid, whose skirt stops above the dividers', () => {
      const params = withOverrides({
        compartments: twoCompartments,
        lid: { ...DEFAULT_BIN_PARAMS.lid, attachment: 'magnetic' },
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'compartmentDividers')
      ).toBeUndefined();
    });

    it('does not flag dividers shortened clear of the rail band', () => {
      const params = withOverrides({
        compartments: { ...twoCompartments, dividerHeight: 12 },
      });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'compartmentDividers')
      ).toBeUndefined();
    });

    it('does not flag when a collar lifts the rail band clear', () => {
      const params = withOverrides({ compartments: twoCompartments, extraWallHeightMm: 4 });
      expect(
        checkLidCompatibility(params).find((i) => i.id === 'compartmentDividers')
      ).toBeUndefined();
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
      const cells = Array<0 | 1>(64).fill(1);
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
      const cells: (0 | 1)[] = [];
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

    it('returns true when full-width cutouts on all 4 sides block an enabled lid', () => {
      expect(isLidBlockedBySection(lidEnabled({ walls: allFourCutouts(100) }), 'walls')).toBe(true);
    });

    it('returns false when the same four walls keep some lip', () => {
      expect(isLidBlockedBySection(lidEnabled({ walls: allFourCutouts(70) }), 'walls')).toBe(false);
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
      const cells = Array<0 | 1>(64).fill(1);
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

    it('stays a warning on all four sides while each wall keeps usable lip (#3483)', () => {
      const issues = checkLidCompatibility(withOverrides({ handles: allFourHandles(50) }));
      expect(issues.find((i) => i.id === 'handlesAllSides')).toBeUndefined();
      expect(issues.find((i) => i.id === 'handles')?.sides).toEqual([
        'front',
        'back',
        'left',
        'right',
      ]);
    });

    it('upgrades to blocker (handlesAllSides) when the holes leave no usable lip', () => {
      // `computeMultiHandleOffsets` always reserves 3mm at each end, so no
      // handle ever clears a whole wall — the blocker's bar is a stretch long
      // enough to carry a rail, and 92% of an 81.1mm wall leaves 3.24mm.
      // (93% does not fit those end gaps at all and cuts no hole; see
      // `lipGapPlan.test.ts`.)
      const issues = checkLidCompatibility(withOverrides({ handles: allFourHandles(92) }));
      const blocker = issues.find((i) => i.id === 'handlesAllSides');
      expect(blocker?.severity).toBe('blocker');
      expect(blocker?.sides).toEqual(['front', 'back', 'left', 'right']);
      expect(issues.find((i) => i.id === 'handles')).toBeUndefined();
    });

    it('isLidBlockedBySection returns true for the handles section on the all-sides blocker', () => {
      const params = withOverrides({
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
        handles: allFourHandles(92),
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

  describe('finger scoop at the lip', () => {
    // A radius that lands in the click rail's band. `autoScoopCeiling` holds an
    // AUTO scoop clear of it, so only a height the user typed can get
    // there — which is exactly what this warning is now about.
    const TALL_SCOOP = { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 40 } as const;

    const scooped = (over: Partial<BinParams> = {}): BinParams =>
      withOverrides({
        scoop: { ...TALL_SCOOP, side: 'front' },
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        ...over,
      });

    it('warns on the scooped wall only', () => {
      const issue = checkLidCompatibility(scooped()).find((i) => i.id === 'scoopFillsLip');
      expect(issue?.severity).toBe('warning');
      expect(issue?.sides).toEqual(['front']);
    });

    it('leaves an auto scoop alone — it is held clear of the band (#3434)', () => {
      // The regression shipped: every scooped wall lost its rail, because
      // the gate asked whether the ramp took a lip offset rather than whether
      // it reached the band the rail drops into.
      const params = scooped({
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto', side: 'front' },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')).toBeUndefined();
      expect(computeDisabledRails(checkLidCompatibility(params)).size).toBe(0);
    });

    it('follows the configured side', () => {
      const params = scooped({ scoop: { ...TALL_SCOOP, side: 'left' } });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')?.sides).toEqual([
        'left',
      ]);
    });

    it('treats a side-less legacy scoop as front, matching resolveScoopSide', () => {
      const params = scooped({ scoop: { enabled: true, radius: 40 } });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')?.sides).toEqual([
        'front',
      ]);
    });

    it('skips without a stacking lip, which is what the ramp reaches up to', () => {
      const params = scooped({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')).toBeUndefined();
    });

    it('skips on styles where buildScoopRamps builds nothing', () => {
      for (const style of ['slotted', 'solid'] as const) {
        expect(
          checkLidCompatibility(scooped({ style })).find((i) => i.id === 'scoopFillsLip')
        ).toBeUndefined();
      }
    });

    it('skips on a lightweight floor, which suppresses the ramp', () => {
      const params = scooped({
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, lightweight: true },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')).toBeUndefined();
    });

    it('skips on a spacer, which shells its floor away whatever the lite flag says', () => {
      // `deriveDimensions` folds the spacer into `dimensions.lightweight`, and
      // that is what suppresses the ramp. Reading `base.lightweight` alone
      // would drop a rail the worker never puts a fill against.
      const params = scooped({
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, spacer: true },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')).toBeUndefined();
    });

    it('still warns on a socketless base, where the lite flag is inert', () => {
      // A tray bottom has no socket to shell, so `dimensions.lightweight` is
      // false and the ramp is built.
      const params = scooped({
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'lid', stackingLip: true, lightweight: true },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')?.sides).toEqual([
        'front',
      ]);
    });

    it('still warns when the wall is as thick as the lip inset', () => {
      // At 2.6mm `computeLipOffset` is 0, so there is no inward offset and no
      // chute. gated on that and kept the rail; the ramp's own arc still
      // fills the band, which is what actually buries the rail.
      expect(
        checkLidCompatibility(scooped({ wallThickness: 2.6 })).find((i) => i.id === 'scoopFillsLip')
          ?.sides
      ).toEqual(['front']);
    });

    it('skips a scoop that stops short of the band', () => {
      const params = scooped({
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 6, side: 'front' },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')).toBeUndefined();
    });

    it('skips for a friction lid, whose shell seats on a lip the ramp never removes', () => {
      const params = scooped({
        lid: { ...DEFAULT_BIN_PARAMS.lid, attachment: 'friction' },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')).toBeUndefined();
    });

    it('skips for a magnetic lid, which holds by corner magnets rather than rails', () => {
      const params = scooped({
        lid: { ...DEFAULT_BIN_PARAMS.lid, attachment: 'magnetic' },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')).toBeUndefined();
    });

    it('skips when every compartment on that wall has a tilted edge', () => {
      // `buildScoopRamps` skips a compartment one end of a `dividerOverride`,
      // so a wall made only of those keeps its lip and its rail.
      const params = scooped({
        compartments: {
          cols: 1,
          rows: 2,
          cells: [0, 1],
          thickness: 0.8,
          dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 3, offsetEnd: -3 }],
        },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')).toBeUndefined();
    });

    it('still warns when an untilted compartment shares the wall', () => {
      const params = scooped({
        compartments: {
          cols: 2,
          rows: 2,
          cells: [0, 1, 2, 3],
          thickness: 0.8,
          dividerOverrides: [{ compartmentA: 0, compartmentB: 2, offsetStart: 3, offsetEnd: -3 }],
        },
      });
      expect(checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip')?.sides).toEqual([
        'front',
      ]);
    });

    it('disables the rail on that wall', () => {
      const set = computeDisabledRails(checkLidCompatibility(scooped()));
      expect([...set]).toEqual(['front']);
    });
  });

  describe('computeDisabledRails', () => {
    it('is empty for a vanilla bin', () => {
      expect(computeDisabledRails(checkLidCompatibility(DEFAULT_BIN_PARAMS)).size).toBe(0);
    });

    it('disables no rail for label tabs, which the builder segments around', () => {
      // Label tabs used to disable their anchor wall outright. Since the
      // rail builder splits the run around the tab footprints and keeps any
      // stretch left over, so deciding here would throw those gaps away before
      // anything measured them. A wall the tabs fully cover still ends up with
      // no rail, but that is the segmentation's call, not this function's.
      const params = withOverrides({
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      const set = computeDisabledRails(checkLidCompatibility(params));
      expect(set.size).toBe(0);
    });

    it('still reports the anchor wall on the label-tab issue itself', () => {
      // The warning copy names the wall, so the issue keeps its `sides` even
      // though they no longer force a disable.
      const params = withOverrides({
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'labelTabs');
      expect(issue?.sides).toEqual(['back']);
    });

    it('leaves a wall cutout to the segment pass rather than disabling its wall', () => {
      // A cutout takes its own span, so the rail keeps the stretches
      // either side. Disabling the wall here would throw them away before
      // anything measured them, exactly as it did for label tabs before.
      const params = withOverrides({
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: false },
        },
      });
      expect(computeDisabledRails(checkLidCompatibility(params)).size).toBe(0);
    });

    it('still disables the wall a finger scoop fills, which has no gaps to keep', () => {
      // The one side-bearing warning that really does take its whole wall: the
      // ramp fills the rail's pocket along the entire run it is built against.
      const params = withOverrides({
        height: 6,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 40 },
        lid: { ...DEFAULT_BIN_PARAMS.lid, relieveInterior: false },
      });
      const issue = checkLidCompatibility(params).find((i) => i.id === 'scoopFillsLip');
      expect(issue).toBeDefined();
      expect(computeDisabledRails(checkLidCompatibility(params))).toEqual(
        new Set(issue?.sides ?? [])
      );
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

describe('checkLidCompatibility — magnetic attachment (#2694)', () => {
  function magnetic(overrides: Partial<BinParams>, lid: Partial<BinParams['lid']> = {}): BinParams {
    return {
      ...DEFAULT_BIN_PARAMS,
      ...overrides,
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic', ...lid },
    };
  }

  it('does NOT block on all-side wall cutouts — magnets hold independent of the lip', () => {
    const params = magnetic({
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
    expect(issues.find((i) => i.id === 'wallCutoutsAllSides')).toBeUndefined();
    expect(hasLidBlocker(issues)).toBe(false);
  });

  it('suppresses rail-grip warnings (label tabs) in magnetic mode', () => {
    const params = magnetic({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    });
    expect(checkLidCompatibility(params).find((i) => i.id === 'labelTabs')).toBeUndefined();
  });

  it('warns that custom shapes fall back to friction (no corner magnets)', () => {
    const mask: CellMask = { cols: 4, rows: 4, cells: new Array(16).fill(1) as (0 | 1)[] };
    mask.cells[0] = 0; // make it a partial (polygon) mask
    const issues = checkLidCompatibility(magnetic({ cellMask: mask }));
    const issue = issues.find((i) => i.id === 'magnetsPolygonUnsupported');
    expect(issue?.severity).toBe('warning');
  });

  it('blocks when the bin is too small to fit corner magnets', () => {
    // A 0.5-unit-wide bin (half-width 10.5mm) can't hold the 6mm magnet's
    // corner pads (need >= 5 + diameter = 11mm half-extent).
    const params = magnetic(
      { width: 0.5 },
      { retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 0 } }
    );
    const issue = checkLidCompatibility(params).find((i) => i.id === 'magnetBinTooSmall');
    expect(issue?.severity).toBe('blocker');
  });

  it('does not flag a normal 2x2 bin as too small', () => {
    const params = magnetic({ width: 2, depth: 2 });
    expect(checkLidCompatibility(params).some((i) => i.id === 'magnetBinTooSmall')).toBe(false);
  });

  it('allows a 1x1 bin with the max magnet now that the posts are slimmer', () => {
    // Half-width 21mm; with the 1.0mm boss wall the gusset pads need only
    // 3.5 + 15 + 2*1.0 = 20.5mm half-extent, so a full 1-unit bin clears even
    // the largest magnet (it was blocked at the old 1.5mm wall).
    const params = magnetic(
      { width: 1, depth: 1 },
      { retentionMagnet: { diameter: 15, depth: 2, edgeMagnets: 0 } }
    );
    expect(checkLidCompatibility(params).some((i) => i.id === 'magnetBinTooSmall')).toBe(false);
  });

  it('blocks when the retention magnet is deeper than the bin interior', () => {
    const params = magnetic(
      { height: 1 },
      { retentionMagnet: { diameter: 6, depth: 6, edgeMagnets: 0 } }
    );
    const issues = checkLidCompatibility(params);
    const issue = issues.find((i) => i.id === 'magnetTooDeepForBin');
    expect(issue?.severity).toBe('blocker');
  });

  it('warns when the retaining floor under the magnet gets marginal', () => {
    // 1U bin interior ≈ 2mm; a 1.5mm magnet leaves only ~0.5mm floor (< 0.6mm).
    const params = magnetic(
      { height: 1 },
      { retentionMagnet: { diameter: 6, depth: 1.5, edgeMagnets: 0 } }
    );
    const issue = checkLidCompatibility(params).find((i) => i.id === 'magnetTooDeepForBin');
    expect(issue?.severity).toBe('warning');
  });
});

/**
 * A sliding lid answers a different set of questions entirely: it has no
 * mating shell, so nothing about a lip's grip applies to it. What replaces
 * those checks is the set of ways a plate can fail to travel.
 */
describe('checkLidCompatibility — sliding attachment', () => {
  // `slide` is spread onto DEFAULT_LID_SLIDE_CONFIG, never onto
  // `DEFAULT_BIN_PARAMS.lid.slide` — that field is deliberately ABSENT on a
  // design that has never used a sliding lid, so spreading it would build a
  // half-filled config whose missing keys read as NaN in the plan.
  const slideParams = (
    overrides: Partial<BinParams> = {},
    slide: Partial<LidSlideConfig> = {}
  ): BinParams => ({
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    ...overrides,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      ...overrides.lid,
      enabled: true,
      attachment: 'slide',
      relieveInterior: overrides.lid?.relieveInterior ?? true,
      slide: { ...DEFAULT_LID_SLIDE_CONFIG, ...slide },
    },
  });

  const ids = (p: BinParams): string[] => checkLidCompatibility(p).map((i) => i.id);

  it('drops every cap-lid check', () => {
    // Wall cutouts on all four sides is a BLOCKER for a click lid — its rails
    // have nothing to grip. A sliding plate grips nothing, so the same bin is
    // fine and must not inherit the verdict.
    const p = slideParams({ walls: allFourCutouts(100) });
    expect(ids(p)).not.toContain('wallCutoutsAllSides');
    expect(hasLidBlocker(checkLidCompatibility(p))).toBe(false);
  });

  it('blocks the rim placement on a lipped bin, and offers the fix', () => {
    const issues = checkLidCompatibility(slideParams({}, { placement: 'flush' }));
    expect(issues.map((i) => i.id)).toContain('slideFlushNeedsNoLip');
    expect(hasLidBlocker(issues)).toBe(true);
    expect(isLidBlockedBySection(slideParams({}, { placement: 'flush' }), 'base')).toBe(true);
  });

  it('clears the rim placement once the lip is off', () => {
    const p = slideParams(
      { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } },
      { placement: 'flush' }
    );
    expect(ids(p)).not.toContain('slideFlushNeedsNoLip');
    expect(hasLidBlocker(checkLidCompatibility(p))).toBe(false);
  });

  it('says nothing else while the lip question is open', () => {
    // The plan would be resolved against a design the user is about to change,
    // so every downstream verdict would be about a joint that will not exist.
    const issues = checkLidCompatibility(slideParams({}, { placement: 'flush' }));
    expect(issues.map((i) => i.id)).toEqual(['slideFlushNeedsNoLip']);
  });

  it('blocks a bin the channel cannot be built in', () => {
    // 1U: the joint needs more depth than the whole interior has.
    const p = slideParams({ height: 1 });
    expect(ids(p)).toContain('slideUnbuildable');
    expect(hasLidBlocker(checkLidCompatibility(p))).toBe(true);
  });

  it('blocks a solid bin, which has no cavity to cover', () => {
    expect(ids(slideParams({ style: 'solid' }))).toContain('slideUnbuildable');
  });

  it('reports the interrupted rim on the entry wall only', () => {
    const issues = checkLidCompatibility(slideParams({}, { entrySide: 'right' }));
    const rim = issues.find((i) => i.id === 'slideRimInterrupted');
    expect(rim).toBeDefined();
    expect(rim?.severity).toBe('warning');
    expect(rim?.sides).toEqual(['right']);
  });

  it('says nothing about the rim on a lipless bin', () => {
    const p = slideParams({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } });
    expect(ids(p)).not.toContain('slideRimInterrupted');
  });

  it('warns when the interior relief is off and something stands in the way', () => {
    const blocked = slideParams({
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      lid: { ...DEFAULT_BIN_PARAMS.lid, relieveInterior: false },
    });
    expect(ids(blocked)).toContain('slideInteriorBlocked');
  });

  it('stays quiet once the relief is on', () => {
    const relieved = slideParams({
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
    });
    expect(ids(relieved)).not.toContain('slideInteriorBlocked');
  });

  it('warns about a span wide enough to bow', () => {
    // Entered from a short wall, a 5-wide bin spans ~200mm between its runners.
    expect(ids(slideParams({ width: 5, depth: 2 }, { entrySide: 'front' }))).toContain(
      'slideLongSpan'
    );
    // Entered from the long wall instead, the same bin spans its depth and is fine.
    expect(ids(slideParams({ width: 5, depth: 2 }, { entrySide: 'left' }))).not.toContain(
      'slideLongSpan'
    );
  });

  it('warns when a wall pattern perforates the walls the runners weld to', () => {
    const patterned = slideParams({
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
    });
    expect(ids(patterned)).toContain('slideWallPattern');
  });

  it('warns when a cutout opens a channel wall, naming only that wall', () => {
    // Front entry: the runners live on left and right. A left cutout opens a
    // window the shelf bar will fuse straight across.
    const cutLeft = slideParams(
      {
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: false },
        },
      },
      { entrySide: 'front' }
    );
    const issue = checkLidCompatibility(cutLeft).find((i) => i.id === 'slideChannelInterrupted');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
    expect(issue?.sides).toEqual(['left']);
  });

  it('does not charge the channel for an opening on the entry axis', () => {
    // A front cutout sits on the wall the notch opens anyway; the runners on
    // left and right are untouched.
    const cutFront = slideParams(
      {
        walls: {
          ...DEFAULT_BIN_PARAMS.walls,
          enabled: true,
          front: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: true, width: 50, depth: 30 },
          left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: false },
          right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: false },
        },
      },
      { entrySide: 'front' }
    );
    expect(ids(cutFront)).not.toContain('slideChannelInterrupted');
  });

  it('names both channel walls when both are opened', () => {
    const p = slideParams({ walls: allFourCutouts(50) }, { entrySide: 'front' });
    const issue = checkLidCompatibility(p).find((i) => i.id === 'slideChannelInterrupted');
    expect(issue?.sides).toEqual(['left', 'right']);
  });
});
