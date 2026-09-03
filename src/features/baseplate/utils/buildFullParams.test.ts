import { describe, it, expect } from 'vitest';
import { mm, gridUnits } from '@gridfinity/branded-types';
import {
  buildFullParams,
  hasEffectivePerimeter,
  maxCornerRadiusMm,
  plainRoundingLimit,
} from './buildFullParams';
import { computeBaseplateTiling, pieceToBaseplateParams } from './splitPlanner';
import { groupPiecesByFingerprint } from './pieceFingerprint';
import { stackGroupsFromTiling, evaluateStackPrint } from './stackPrint';
import { cornerCutVertices } from '@/shared/utils/cornerCutOutline';
import { drawerFrameShift } from '@/shared/utils/outlineFrame';
import { padOutline } from '@/shared/utils/padOutline';
import { outlineBounds } from '@/shared/utils/drawerOutlineGeometry';
import { translateOutline } from '@/shared/utils/drawerOutline';
import type { CornerCutParams, DrawerOutline } from '@/core/types';

describe('buildFullParams', () => {
  const storedBase = {
    magnetHoles: true,
    magnetDiameter: mm(6.5),
    magnetDepth: mm(2.4),
    paddingLeft: mm(1.0),
    paddingRight: mm(2.0),
    paddingFront: mm(3.0),
    paddingBack: mm(4.0),
  };

  it('passes through all stored fields', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');

    expect(result.magnetHoles).toBe(true);
    expect(result.magnetDiameter).toBe(6.5);
    expect(result.magnetDepth).toBe(2.4);
    expect(result.paddingLeft).toBe(1.0);
    expect(result.paddingRight).toBe(2.0);
    expect(result.paddingFront).toBe(3.0);
    expect(result.paddingBack).toBe(4.0);
  });

  it('forwards overTileHalfGrid when over-tile is on', () => {
    const result = buildFullParams(
      { ...storedBase, overTile: true, overTileHalfGrid: true },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(result.overTileHalfGrid).toBe(true);
  });

  it('normalizes overTileHalfGrid to undefined when over-tile is off', () => {
    const result = buildFullParams(
      { ...storedBase, overTile: false, overTileHalfGrid: true },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(result.overTileHalfGrid).toBeUndefined();
  });

  it('forwards overTileHalfGridSolidLeftover only under half-grid', () => {
    const on = buildFullParams(
      {
        ...storedBase,
        overTile: true,
        overTileHalfGrid: true,
        overTileHalfGridSolidLeftover: true,
      },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(on.overTileHalfGridSolidLeftover).toBe(true);

    // Solid-leftover is meaningless without half-grid → dropped.
    const orphaned = buildFullParams(
      {
        ...storedBase,
        overTile: true,
        overTileHalfGrid: false,
        overTileHalfGridSolidLeftover: true,
      },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(orphaned.overTileHalfGridSolidLeftover).toBeUndefined();
  });

  // The panel, the regeneration trigger and the resolver must agree on whether
  // a plate has a perimeter. They disagreed once: the control appeared for
  // radius-cut plates while the trigger still called them rectangular, so a
  // toggle changed the mesh without regenerating it.
  describe('hasEffectivePerimeter', () => {
    /** L-shape inside the 10x8 unit drawer these tests use (420 x 336mm). */
    const outline: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 420, y: 0 },
        { x: 420, y: 168 },
        { x: 168, y: 168 },
        { x: 168, y: 336 },
        { x: 0, y: 336 },
      ],
    };

    /** Same arguments buildFullParams is called with throughout this file. */
    const perimeter = (
      stored: Parameters<typeof hasEffectivePerimeter>[0],
      drawerOutline?: DrawerOutline
    ): boolean => hasEffectivePerimeter(stored, 10, 8, 42, drawerOutline, 42);

    it('is false for a plain rectangle', () => {
      expect(perimeter(storedBase)).toBe(false);
    });

    it('is true for a drawer shape while the outline applies', () => {
      expect(perimeter(storedBase, outline)).toBe(true);
      expect(perimeter({ ...storedBase, syncWithLayout: false }, outline)).toBe(false);
    });

    it('is true for a radius the resolver converts to an outline', () => {
      expect(perimeter({ ...storedBase, cornerRadius: mm(40) })).toBe(true);
      expect(perimeter({ ...storedBase, cornerRadius: mm(10) })).toBe(false);
    });

    // A custom perimeter now stacks: both a drawer shape and a
    // large-radius conversion keep their perimeter under stacking (the shaped
    // tiles dedupe by fingerprint like any others), so the answer is
    // stacking-independent — matching what generation actually produces.
    it('keeps a drawer shape AND a radius conversion under stacking (#3113)', () => {
      const stacked = { ...storedBase, stackPrint: { enabled: true, gapMm: mm(0.2) } };
      expect(perimeter(stacked, outline)).toBe(true);
      expect(perimeter({ ...stacked, cornerRadius: mm(40) })).toBe(true);
      // A small radius still leaves no perimeter (plain rounding, no outline).
      expect(perimeter({ ...stacked, cornerRadius: mm(10) })).toBe(false);
    });

    // It runs the resolver rather than restating its rules, so this walks a
    // matrix and asserts it always matches what generation actually produced.
    it('agrees with the resolver across radii, padding, sync and stacking', () => {
      for (const r of [0, 10, 22, 30, 60]) {
        for (const stacking of [false, true]) {
          for (const synced of [true, false]) {
            for (const pad of [0, 1, 20]) {
              const stored = {
                ...storedBase,
                paddingLeft: mm(pad),
                paddingRight: mm(pad),
                paddingFront: mm(pad),
                paddingBack: mm(pad),
                cornerRadius: mm(r),
                syncWithLayout: synced,
                ...(stacking ? { stackPrint: { enabled: true, gapMm: mm(0.2) } } : {}),
              };
              const resolved = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
              expect(hasEffectivePerimeter(stored, 10, 8, 42, outline, 42)).toBe(
                resolved.outline !== undefined
              );
            }
          }
        }
      }
    });
  });

  it('maps drawerWidth to width', () => {
    const result = buildFullParams(storedBase, 14, 8, 42, 'end', 'end');
    expect(result.width).toBe(14);
  });

  it('maps drawerDepth to depth', () => {
    const result = buildFullParams(storedBase, 10, 12, 42, 'end', 'end');
    expect(result.depth).toBe(12);
  });

  it('passes gridUnitMm through', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(result.gridUnitMm).toBe(42);
  });

  it('defaults gridUnitMmY to the X pitch (square)', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(result.gridUnitMmY).toBe(42);
  });

  it('threads an explicit non-square Y pitch (#2704)', () => {
    // gridUnitMmY is the last arg, after magnetAnchor.
    const result = buildFullParams(
      storedBase,
      10,
      8,
      42,
      'end',
      'end',
      undefined,
      undefined,
      'edge',
      22
    );
    expect(result.gridUnitMm).toBe(42);
    expect(result.gridUnitMmY).toBe(22);
  });

  it('passes fractionalEdgeX through', () => {
    const start = buildFullParams(storedBase, 10, 8, 42, 'start', 'end');
    expect(start.fractionalEdgeX).toBe('start');

    const end = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(end.fractionalEdgeX).toBe('end');
  });

  it('passes fractionalEdgeY through', () => {
    const start = buildFullParams(storedBase, 10, 8, 42, 'end', 'start');
    expect(start.fractionalEdgeY).toBe('start');

    const end = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(end.fractionalEdgeY).toBe('end');
  });

  it('produces correct full result with all distinct values', () => {
    const stored = {
      magnetHoles: false,
      magnetDiameter: mm(5.0),
      magnetDepth: mm(1.5),
      paddingLeft: mm(0.5),
      paddingRight: mm(1.5),
      paddingFront: mm(2.5),
      paddingBack: mm(3.5),
    };

    const result = buildFullParams(stored, 20, 16, 42, 'start', 'start');

    expect(result).toEqual({
      width: 20,
      depth: 16,
      gridUnitMm: 42,
      gridUnitMmY: 42,
      magnetHoles: false,
      magnetDiameter: mm(5.0),
      magnetDepth: mm(1.5),
      magnetAnchor: 'edge',
      paddingLeft: mm(0.5),
      paddingRight: mm(1.5),
      paddingFront: mm(2.5),
      paddingBack: mm(3.5),
      fractionalEdgeX: 'start',
      fractionalEdgeY: 'start',
      detachMargins: false,
      detachMarginConnector: false,
    });
  });

  describe('all-edge slots (issue #2866)', () => {
    const withFlag = (overrides: Record<string, unknown>) =>
      buildFullParams(
        { ...storedBase, connectorSlotsAllEdges: true, ...overrides },
        10,
        8,
        42,
        'end',
        'end'
      );

    it('resolves for a both-female style with connectors on', () => {
      expect(
        withFlag({ connectorNubs: true, connectorStyle: 'dovetailKey' }).connectorSlotsAllEdges
      ).toBe(true);
      expect(
        withFlag({ connectorNubs: true, connectorStyle: 'snapClip' }).connectorSlotsAllEdges
      ).toBe(true);
    });

    it('drops the flag for an integral style, so it cannot fragment caches', () => {
      // A tongue on an exterior edge would protrude past the drawer-facing wall.
      expect(
        withFlag({ connectorNubs: true, connectorStyle: 'puzzle' }).connectorSlotsAllEdges
      ).toBeUndefined();
      expect(
        withFlag({ connectorNubs: true, connectorStyle: undefined }).connectorSlotsAllEdges
      ).toBeUndefined();
    });

    it('drops the flag when split connectors are off', () => {
      expect(
        withFlag({ connectorNubs: false, connectorStyle: 'dovetailKey' }).connectorSlotsAllEdges
      ).toBeUndefined();
    });

    it('drops the flag when stacking strips the snap-clip style', () => {
      // The strip turns connectors off entirely, so exterior slots must go too.
      const result = withFlag({
        connectorNubs: true,
        connectorStyle: 'snapClip',
        stackPrint: { enabled: true, gapMm: mm(0.2) },
      });
      expect(result.connectorNubs).toBe(false);
      expect(result.connectorSlotsAllEdges).toBeUndefined();
    });
  });

  describe('magnetAnchor', () => {
    it("defaults to 'edge' when the argument is omitted", () => {
      const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
      expect(result.magnetAnchor).toBe('edge');
    });

    it("passes through the legacy 'center' anchor", () => {
      const result = buildFullParams(
        storedBase,
        10,
        8,
        50,
        'end',
        'end',
        undefined,
        undefined,
        'center'
      );
      expect(result.magnetAnchor).toBe('center');
    });
  });

  describe('syncWithLayout', () => {
    it('uses drawer dims when syncWithLayout is undefined', () => {
      const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
      expect(result.width).toBe(10);
      expect(result.depth).toBe(8);
    });

    it('uses drawer dims when syncWithLayout is true', () => {
      const stored = {
        ...storedBase,
        syncWithLayout: true,
        baseplateWidth: gridUnits(20),
        baseplateDepth: gridUnits(16),
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.width).toBe(10);
      expect(result.depth).toBe(8);
    });

    it('uses custom dims when syncWithLayout is false', () => {
      const stored = {
        ...storedBase,
        syncWithLayout: false,
        baseplateWidth: gridUnits(20),
        baseplateDepth: gridUnits(16),
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.width).toBe(20);
      expect(result.depth).toBe(16);
    });

    it('falls back to drawer dims when syncWithLayout is false but custom dims missing', () => {
      const stored = { ...storedBase, syncWithLayout: false };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.width).toBe(10);
      expect(result.depth).toBe(8);
    });
  });

  describe('fractionalEdge sync/unsync', () => {
    it('uses drawer fractional edge when synced', () => {
      const stored = { ...storedBase, syncWithLayout: true };
      const result = buildFullParams(stored, 10, 8, 42, 'start', 'start');
      expect(result.fractionalEdgeX).toBe('start');
      expect(result.fractionalEdgeY).toBe('start');
    });

    it('uses stored fractional edge when not synced', () => {
      const stored = {
        ...storedBase,
        syncWithLayout: false,
        fractionalEdgeX: 'start' as const,
        fractionalEdgeY: 'start' as const,
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.fractionalEdgeX).toBe('start');
      expect(result.fractionalEdgeY).toBe('start');
    });

    it("defaults stored fractional edge to 'end' when unsynced and not set", () => {
      const stored = { ...storedBase, syncWithLayout: false };
      const result = buildFullParams(stored, 10, 8, 42, 'start', 'start');
      expect(result.fractionalEdgeX).toBe('end');
      expect(result.fractionalEdgeY).toBe('end');
    });
  });

  describe('stack-print feature stripping (connectors + magnets)', () => {
    // storedBase has magnetHoles: true.
    const withFeatures = {
      ...storedBase,
      connectorNubs: true,
      connectorStyle: 'dovetailKey' as const,
    };

    it('passes connectors and magnets through when stacking is off', () => {
      const result = buildFullParams(withFeatures, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(true);
      expect(result.connectorStyle).toBe('dovetailKey');
      expect(result.magnetHoles).toBe(true);
    });

    it('keeps dovetail connectors but strips magnets when stacking (vertical prisms flip cleanly)', () => {
      const stored = {
        ...storedBase,
        connectorNubs: true,
        connectorStyle: undefined, // plain dovetail
        stackPrint: { enabled: true, gapMm: mm(0.2) },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(true);
      expect(result.connectorStyle).toBeUndefined();
      expect(result.magnetHoles).toBe(false); // magnet pockets bridge when flipped
    });

    it('keeps dovetail key connectors when stacking', () => {
      const stored = {
        ...withFeatures,
        stackPrint: { enabled: true, gapMm: mm(0.2) },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(true);
      expect(result.connectorStyle).toBe('dovetailKey');
      expect(result.magnetHoles).toBe(false);
    });

    it('strips snap clip connectors when stacking (its blind pocket bridges when flipped)', () => {
      const stored = {
        ...storedBase,
        connectorNubs: true,
        connectorStyle: 'snapClip' as const,
        stackPrint: { enabled: true, gapMm: mm(0.2) },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(false);
      expect(result.connectorStyle).toBeUndefined();
      expect(result.magnetHoles).toBe(false);
      // Stored params are untouched, so the style returns when stacking is off.
      expect(stored.connectorNubs).toBe(true);
      expect(stored.connectorStyle).toBe('snapClip');
    });

    it('keeps connectors and magnets when stackPrint exists but is disabled', () => {
      const stored = {
        ...withFeatures,
        stackPrint: { enabled: false, gapMm: mm(0.2) },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(true);
      expect(result.magnetHoles).toBe(true);
    });

    it('keeps plain corner rounding when stacking (#4081)', () => {
      // Only exterior corners round, so the fingerprint already tells corner
      // tiles apart; flattening a radius the user set bought nothing.
      const stored = {
        ...storedBase,
        cornerRadius: mm(4),
        cornerRadii: { tl: mm(4), tr: mm(4), bl: mm(0), br: mm(0) },
        stackPrint: { enabled: true, gapMm: mm(0.2) },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.cornerRadius).toBe(mm(4));
      expect(result.cornerRadii).toEqual(stored.cornerRadii);
    });
  });

  describe('detach margins × stack-print composition (#2641)', () => {
    const detached = {
      ...storedBase,
      paddingLeft: mm(10),
      paddingRight: mm(10),
      detachMargins: true,
      stackPrint: { enabled: true, gapMm: mm(0.2) },
    };

    it('keeps detachMargins active while stacking', () => {
      const result = buildFullParams(detached, 10, 8, 42, 'end', 'end');
      expect(result.detachMargins).toBe(true);
      expect(result.paddingLeft).toBe(10);
      expect(result.paddingRight).toBe(10);
    });

    it('keeps the seam connector for tongue/groove styles while stacking', () => {
      const stored = {
        ...detached,
        connectorNubs: true,
        connectorStyle: undefined,
        detachMarginConnector: true,
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.detachMargins).toBe(true);
      expect(result.detachMarginConnector).toBe(true);
    });

    it('drops the seam connector when stacking strips a snapClip style', () => {
      // Stripping snapClip resolves connectorStyle to undefined, which the seam
      // gate would read as the dovetail default — the unstacked plate has no
      // seam (snapClip is not a seam style), so the stacked one must not either.
      const stored = {
        ...detached,
        connectorNubs: true,
        connectorStyle: 'snapClip' as const,
        detachMarginConnector: true,
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.detachMargins).toBe(true);
      expect(result.detachMarginConnector).toBe(false);
    });

    it('keeps rounding while stacking, so rails round the corner they carry', () => {
      const stored = { ...detached, cornerRadius: mm(4) };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.detachMargins).toBe(true);
      expect(result.cornerRadius).toBe(mm(4));
    });
  });
});

describe('drawer outline handling', () => {
  const storedBase = {
    magnetHoles: true,
    magnetDiameter: mm(6.5),
    magnetDepth: mm(2.4),
    paddingLeft: mm(1.0),
    paddingRight: mm(2.0),
    paddingFront: mm(3.0),
    paddingBack: mm(4.0),
  };
  const outline = {
    vertices: [
      { x: 0, y: 0 },
      { x: 420, y: 0 },
      { x: 420, y: 168 },
      { x: 168, y: 168 },
      { x: 168, y: 336 },
      { x: 0, y: 336 },
    ],
  };

  // The flag only has meaning against a perimeter, so an orphaned one
  // must not fragment caches or trigger a regeneration on a plain rectangle.
  it('forwards wholeCellsOnly only when there is an outline', () => {
    const shaped = buildFullParams(
      { ...storedBase, wholeCellsOnly: true },
      10,
      8,
      42,
      'end',
      'end',
      undefined,
      outline
    );
    expect(shaped.wholeCellsOnly).toBe(true);

    const rectangular = buildFullParams(
      { ...storedBase, wholeCellsOnly: true },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(rectangular.outline).toBeUndefined();
    expect(rectangular.wholeCellsOnly).toBeUndefined();
  });

  // A plan the plate has outgrown must never reach the planner, or the
  // rendered pieces disagree with the geometry they were drawn against.
  it('forwards a split plan that still matches the plate', () => {
    const params = buildFullParams(
      { ...storedBase, splitOverride: { cols: [6, 4].map(gridUnits), rows: [8].map(gridUnits) } },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(params.splitOverride).toEqual({ cols: [6, 4], rows: [8] });
  });

  it('drops a split plan orphaned by a grid resize', () => {
    const params = buildFullParams(
      { ...storedBase, splitOverride: { cols: [6, 4].map(gridUnits), rows: [8].map(gridUnits) } },
      9,
      8,
      42,
      'end',
      'end'
    );
    expect(params.splitOverride).toBeUndefined();
  });

  it('drops a split plan whose half unit sits on the wrong fractional edge', () => {
    const plan = { cols: [2.5, 3].map(gridUnits), rows: [8].map(gridUnits) };
    expect(
      buildFullParams({ ...storedBase, splitOverride: plan }, 5.5, 8, 42, 'end', 'end')
        .splitOverride
    ).toBeUndefined();
    expect(
      buildFullParams({ ...storedBase, splitOverride: plan }, 5.5, 8, 42, 'start', 'end')
        .splitOverride
    ).toEqual({ cols: [2.5, 3], rows: [8] });
  });

  // Resolved params are what split pieces inherit, and the key is allowlisted
  // server-side without a type check, so a malformed synced value must not get
  // this far.
  it('narrows wholeCellsOnly to a literal true', () => {
    const malformed = buildFullParams(
      { ...storedBase, wholeCellsOnly: 'yes' as unknown as boolean },
      10,
      8,
      42,
      'end',
      'end',
      undefined,
      outline
    );
    expect(malformed.wholeCellsOnly).toBeUndefined();
  });

  it('composes padding into a rectilinear shape and zeroes the subsumed params', () => {
    const stored = {
      ...storedBase,
      cornerRadius: mm(4),
      cornerRadii: { tl: mm(4), tr: mm(4), bl: mm(4), br: mm(4) },
      detachMargins: true,
      detachMarginConnector: true,
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
    // Every edge offsets outward onto the padded plate extent (10x8 grid =
    // 420x336mm; +L1/R2/F3/B4 -> 423x343), grid offset by (left, front).
    expect(result.outline?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 423, y: 0 },
      { x: 423, y: 175 },
      { x: 171, y: 175 },
      { x: 171, y: 343 },
      { x: 0, y: 343 },
    ]);
    // Padding is now live (the plate spans the padded extent).
    expect(result.paddingLeft).toBe(1.0);
    expect(result.paddingRight).toBe(2.0);
    expect(result.paddingFront).toBe(3.0);
    expect(result.paddingBack).toBe(4.0);
    // Rounding and detached margins still have no outline-aware geometry.
    expect(result.cornerRadius).toBe(0);
    expect(result.cornerRadii).toBeUndefined();
    expect(result.detachMargins).toBe(false);
    expect(result.detachMarginConnector).toBe(false);
    // Stored params untouched — settings return when the shape is cleared.
    expect(stored.paddingBack).toBe(4.0);
    expect(stored.cornerRadius).toBe(4);
    expect(stored.detachMargins).toBe(true);
  });

  it('keeps magnets and solid floor working on shaped plates', () => {
    const stored = { ...storedBase, solidFloor: true, solidFloorThickness: mm(1.2) };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
    expect(result.magnetHoles).toBe(true);
    expect(result.solidFloor).toBe(true);
  });

  it('ignores the outline for unsynced (custom-size) plates', () => {
    const stored = { ...storedBase, syncWithLayout: false, paddingLeft: mm(5) };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
    expect(result.outline).toBeUndefined();
    expect(result.paddingLeft).toBe(5);
  });

  it('keeps the outline under stack printing so shaped tiles stack (#3113)', () => {
    const stored = { ...storedBase, stackPrint: { enabled: true, gapMm: mm(0.2) } };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
    // The shape survives (composed with padding), same as the non-stack path —
    // the tiles dedupe by fingerprint downstream so identical ones still stack.
    expect(result.outline).toBeDefined();
    // Magnets and solid floor still strip under stacking (the flip bridges them).
    expect(result.magnetHoles).toBe(false);
    expect(result.solidFloor).toBe(false);
  });

  it('emits no outline when the drawer has none', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(result.outline).toBeUndefined();
    expect(result.paddingLeft).toBe(1.0);
  });

  // The pen editor auto-grows the drawer to the MAX extent only
  //, so a custom perimeter usually lands in a corner-offset sub-rect of
  // the declared extent. The resolver re-bases the one derived outline so the
  // generator's socket grid and the split planner's seam bands share one frame —
  // but only by lattice-registered shifts: a sub-cell move breaks whole-cell
  // registration and drops sockets.
  describe('outline re-basing onto the socket lattice', () => {
    const zeroPad = {
      ...storedBase,
      paddingLeft: mm(0),
      paddingRight: mm(0),
      paddingFront: mm(0),
      paddingBack: mm(0),
    };
    // 3×3-unit square pinned to the bottom-left of a 4×4 drawer — half a unit of
    // grown, unused extent on the top and right.
    const drifted: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 126, y: 0 },
        { x: 126, y: 126 },
        { x: 0, y: 126 },
      ],
    };

    const bboxOf = (o: DrawerOutline): { cx: number; cy: number; w: number; h: number } => {
      const xs = o.vertices.map((v) => v.x);
      const ys = o.vertices.map((v) => v.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
    };

    it('keeps a corner-anchored whole-unit shape in place — no sub-cell shift (#3149)', () => {
      // 3u square in a 4u extent: corner-anchor already holds all 3×3 whole
      // cells; the old bbox centring (+21 per axis) left only 2×2. Both
      // registered positions (0 and 42) centre equally, so the smaller move
      // wins and the outline stays byte-identical.
      const result = buildFullParams(zeroPad, 4, 4, 42, 'end', 'end', undefined, drifted);
      expect(result.outline?.vertices).toEqual(drifted.vertices);
    });

    it('re-bases a whole-unit drift by whole cells, restoring the split frame (#3109)', () => {
      // 3u square stuck at the right of a 5u extent. A whole-unit −42 shift
      // relabels the same three cells while landing the shape centred; the
      // pure-centring −21 would have cost a cell.
      const rightStuck: DrawerOutline = {
        vertices: [
          { x: 84, y: 0 },
          { x: 210, y: 0 },
          { x: 210, y: 126 },
          { x: 84, y: 126 },
        ],
      };
      const result = buildFullParams(zeroPad, 5, 4, 42, 'end', 'end', undefined, rightStuck);
      const b = bboxOf(result.outline as DrawerOutline);
      // [84,210] → [42,168]: registered AND centred on the 210 extent.
      expect(b.cx).toBeCloseTo(105, 6);
      expect(b.w).toBeCloseTo(126, 6);
    });

    it("registers to the shifted lattice of a 'start' fractional edge", () => {
      // 4.5-unit drawer, half cell FIRST: whole cells run [21,189] in 42mm
      // steps. A 4u-wide corner shape must shift +21 onto that lattice to
      // hold all four cells; with the edge at 'end' it is already registered.
      const fourWide: DrawerOutline = {
        vertices: [
          { x: 0, y: 0 },
          { x: 168, y: 0 },
          { x: 168, y: 168 },
          { x: 0, y: 168 },
        ],
      };
      const startEdge = buildFullParams(zeroPad, 4.5, 4, 42, 'start', 'end', undefined, fourWide);
      expect(bboxOf(startEdge.outline as DrawerOutline).cx - 84).toBeCloseTo(21, 6);
      const endEdge = buildFullParams(zeroPad, 4.5, 4, 42, 'end', 'end', undefined, fourWide);
      expect(endEdge.outline?.vertices).toEqual(fourWide.vertices);
    });

    it('leaves a full-extent outline byte-identical (no drift, cache-stable)', () => {
      // `outline` fills the 10×8 extent (bbox [0,420]×[0,336]) → shift 0.
      const result = buildFullParams(zeroPad, 10, 8, 42, 'end', 'end', undefined, outline);
      expect(result.outline?.vertices).toEqual(outline.vertices);
    });

    it('registers against the PADDED lattice, composing with asymmetric padding', () => {
      // storedBase padding L1/R2/F3/B4 → padded extent 171×175, lattice
      // origin (1,3), and the outline itself padded first (x span 129,
      // y span 133). The only shift that holds a full 3-cell block lands the
      // block on padded lattice lines — [43,169]×[45,171] — putting the
      // padded bbox at 41.5 on each axis.
      const result = buildFullParams(storedBase, 4, 4, 42, 'end', 'end', undefined, drifted);
      const b = bboxOf(result.outline as DrawerOutline);
      expect(b.cx - b.w / 2).toBeCloseTo(41.5, 6);
      expect(b.cy - b.h / 2).toBeCloseTo(41.5, 6);
    });
  });
});

// A shaped, larger-than-bed plate under stacking used to have its outline
// dropped, so it tiled as a rectangle and reported the confusing "single plate /
// nothing to stack" warning. With the outline kept, the shape tiles and its
// identical tiles stack while the unique perimeter tiles print singly.
describe('shaped stacking splits into stackable tiles (#3113)', () => {
  const U = 42;
  const zeroPadStacked = {
    magnetHoles: true,
    magnetDiameter: mm(6.5),
    magnetDepth: mm(2.4),
    paddingLeft: mm(0),
    paddingRight: mm(0),
    paddingFront: mm(0),
    paddingBack: mm(0),
    stackPrint: { enabled: true, gapMm: mm(0.2), copies: 1 },
  };
  // 8×8 plate with the top-right 2×2-cell corner notched out — the notch lands
  // wholly inside the top-right 4×4 tile, so the other three tiles stay full
  // squares that share a fingerprint (they stack), while the notched tile is
  // unique (prints singly).
  const notched: DrawerOutline = {
    vertices: [
      { x: 0, y: 0 },
      { x: 8 * U, y: 0 },
      { x: 8 * U, y: 6 * U },
      { x: 6 * U, y: 6 * U },
      { x: 6 * U, y: 8 * U },
      { x: 0, y: 8 * U },
    ],
  };

  it('keeps the shape, so interior tiles stack and the notched tile prints singly', () => {
    const params = buildFullParams(zeroPadStacked, 8, 8, U, 'end', 'end', undefined, notched);
    expect(params.outline).toBeDefined();

    // 8u plate on a 4u bed → a 2×2 grid of 4u tiles; the notch clips the top-right one.
    const tiling = computeBaseplateTiling(params, 4 * U, 4 * U);
    expect(tiling.isSplit).toBe(true);
    // Exactly one tile is partial (carries a window origin); the rest are full squares.
    const partial = tiling.pieces.filter((p) => p.outlineWindowOriginMm !== undefined);
    expect(partial).toHaveLength(1);

    // The three full tiles share a fingerprint → a stackable group of ≥2.
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    const maxGroup = Math.max(...[...groups.values()].map((g) => g.indices.length));
    expect(maxGroup).toBeGreaterThanOrEqual(2);

    // Status agrees: a real tower forms, not the spurious "nothing to stack".
    const stackGroups = stackGroupsFromTiling(tiling, params, 1);
    expect(evaluateStackPrint(stackGroups, 8, 5, 250)).toEqual({ kind: 'ok' });
  });

  it('shapes a large radius under stacking: interior tiles stack, rounded corners print singly (#3113)', () => {
    // 12×12 plate, uniform R60 corners → a radius-cut outline (not plain
    // rounding). On a 4u bed it tiles 3×3: the four corner tiles each carry a
    // distinct rounded corner (unique, print singly — placementRotationDeg is
    // forced to 0 on shaped tilings, so opposite corners do NOT share a mesh),
    // while the five interior/edge tiles are full squares that share a
    // fingerprint and stack.
    const stored = { ...zeroPadStacked, cornerRadius: mm(60) };
    const params = buildFullParams(stored, 12, 12, U, 'end', 'end');
    expect(params.outline).toBeDefined();
    // The radius lives in the outline arcs, so plain rounding is zeroed.
    expect(params.cornerRadius).toBe(0);

    const tiling = computeBaseplateTiling(params, 4 * U, 4 * U);
    expect(tiling.isSplit).toBe(true);
    // Four rounded-corner tiles are partial (each a distinct arc).
    const partial = tiling.pieces.filter((p) => p.outlineWindowOriginMm !== undefined);
    expect(partial).toHaveLength(4);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    // The five full square tiles dedupe into one stackable group.
    const maxGroup = Math.max(...[...groups.values()].map((g) => g.indices.length));
    expect(maxGroup).toBe(5);
    // Each rounded corner tile is its own group — no false dedup via the flip.
    const singletons = [...groups.values()].filter((g) => g.indices.length === 1);
    expect(singletons).toHaveLength(4);

    const stackGroups = stackGroupsFromTiling(tiling, params, 1);
    expect(evaluateStackPrint(stackGroups, 8, 5, 250)).toEqual({ kind: 'ok' });
  });
});

describe('corner-cut shape + padding composition', () => {
  const storedBase = {
    magnetHoles: true,
    magnetDiameter: mm(6.5),
    magnetDepth: mm(2.4),
    paddingLeft: mm(1.0),
    paddingRight: mm(2.0),
    paddingFront: mm(3.0),
    paddingBack: mm(4.0),
  };
  const cuts: CornerCutParams = {
    tl: { kind: 'radius', r: 60 },
    tr: { kind: 'radius', r: 60 },
    bl: { kind: 'chamfer', size: 20 },
    br: { kind: 'none' },
  };
  // 10×8 drawer at 42mm → 420×336mm grid.
  const cornerOutline: DrawerOutline = {
    vertices: cornerCutVertices(420, 336, cuts),
    authoring: { kind: 'corners', corners: cuts },
  };

  it('re-inscribes the cuts on the padded rectangle and keeps padding', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end', undefined, cornerOutline);
    expect(result.paddingLeft).toBe(1.0);
    expect(result.paddingRight).toBe(2.0);
    expect(result.paddingFront).toBe(3.0);
    expect(result.paddingBack).toBe(4.0);
    // totalW = 420 + 1 + 2 = 423, totalD = 336 + 3 + 4 = 343.
    expect(result.outline?.vertices).toEqual(cornerCutVertices(423, 343, cuts));
    expect(result.outline?.authoring).toEqual(cornerOutline.authoring);
  });

  it('reuses the stored outline identity at zero padding', () => {
    const stored = {
      ...storedBase,
      paddingLeft: mm(0),
      paddingRight: mm(0),
      paddingFront: mm(0),
      paddingBack: mm(0),
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, cornerOutline);
    expect(result.outline).toBe(cornerOutline);
    expect(result.paddingLeft).toBe(0);
  });

  it('still zeroes rounding and detach for corner-cut shapes', () => {
    const stored = {
      ...storedBase,
      cornerRadius: mm(4),
      cornerRadii: { tl: mm(4), tr: mm(4), bl: mm(4), br: mm(4) },
      detachMargins: true,
      detachMarginConnector: true,
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, cornerOutline);
    expect(result.cornerRadius).toBe(0);
    expect(result.cornerRadii).toBeUndefined();
    expect(result.detachMargins).toBe(false);
    expect(result.detachMarginConnector).toBe(false);
  });

  it('composes padding as a freeform shape when the authoring echo drifted', () => {
    const drifted: DrawerOutline = {
      // Vertices from DIFFERENT cuts than the echo claims, so the corner-cut
      // fast path is skipped and the shape composes edge-by-edge instead.
      vertices: cornerCutVertices(420, 336, { ...cuts, tl: { kind: 'radius', r: 30 } }),
      authoring: { kind: 'corners', corners: cuts },
    };
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end', undefined, drifted);
    expect(result.outline).toBeDefined();
    expect(result.outline).not.toBe(drifted);
    // Padding is live (passed through), not zeroed.
    expect(result.paddingLeft).toBe(1);
    expect(result.paddingBack).toBe(4);
  });
});

describe('large corner radius → outline conversion', () => {
  const storedBase = {
    magnetHoles: false,
    magnetDiameter: mm(6.5),
    magnetDepth: mm(2.4),
    paddingLeft: mm(0),
    paddingRight: mm(0),
    paddingFront: mm(0),
    paddingBack: mm(0),
  };

  it('keeps the plain rounding path for radii within the limit', () => {
    // Limit with zero padding: 42/2 = 21.
    const result = buildFullParams(
      { ...storedBase, cornerRadius: mm(21) },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(result.outline).toBeUndefined();
    expect(result.cornerRadius).toBe(21);
  });

  it('padding raises the plain rounding limit', () => {
    const stored = {
      ...storedBase,
      paddingLeft: mm(10),
      paddingRight: mm(10),
      paddingFront: mm(10),
      paddingBack: mm(10),
      cornerRadius: mm(30),
    };
    expect(plainRoundingLimit(42, 10)).toBe(31);
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
    expect(result.outline).toBeUndefined();
    expect(result.cornerRadius).toBe(30);
  });

  it('converts a beyond-limit radius to a radius-cut outline', () => {
    const result = buildFullParams(
      { ...storedBase, cornerRadius: mm(60) },
      10,
      8,
      42,
      'end',
      'end'
    );
    const r60: CornerCutParams = {
      tl: { kind: 'radius', r: 60 },
      tr: { kind: 'radius', r: 60 },
      bl: { kind: 'radius', r: 60 },
      br: { kind: 'radius', r: 60 },
    };
    expect(result.outline?.vertices).toEqual(cornerCutVertices(420, 336, r60));
    expect(result.cornerRadius).toBe(0);
    expect(result.cornerRadii).toBeUndefined();
    expect(result.detachMargins).toBe(false);
  });

  it('converts when ANY per-corner radius exceeds the limit', () => {
    const stored = { ...storedBase, cornerRadii: { tl: mm(60), tr: mm(4), bl: mm(0), br: mm(4) } };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(420, 336, {
        tl: { kind: 'radius', r: 60 },
        tr: { kind: 'radius', r: 4 },
        bl: { kind: 'none' },
        br: { kind: 'radius', r: 4 },
      })
    );
  });

  it('clamps converted radii to the geometric ceiling', () => {
    // 2×2 grid → 84×84mm; ceiling is 84/2 − 0.1 = 41.9.
    const result = buildFullParams(
      { ...storedBase, cornerRadius: mm(100) },
      2,
      2,
      42,
      'end',
      'end'
    );
    expect(maxCornerRadiusMm(84, 84)).toBeCloseTo(41.9);
    const r: CornerCutParams['tl'] = { kind: 'radius', r: 41.9 };
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(84, 84, { tl: r, tr: r, bl: r, br: r })
    );
  });

  it('converts with padding kept — the padded extent hosts the arcs', () => {
    const stored = {
      ...storedBase,
      paddingLeft: mm(11),
      paddingRight: mm(11),
      paddingFront: mm(11),
      paddingBack: mm(11),
      cornerRadius: mm(45),
    };
    const result = buildFullParams(stored, 4, 6, 42, 'end', 'end');
    // totalW = 168 + 22 = 190, totalD = 252 + 22 = 274.
    const r: CornerCutParams['tl'] = { kind: 'radius', r: 45 };
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(190, 274, { tl: r, tr: r, bl: r, br: r })
    );
    expect(result.paddingLeft).toBe(11);
  });

  it('converts while stacking too, so the rounded tiles stack (#3113)', () => {
    const stored = {
      ...storedBase,
      cornerRadius: mm(60),
      stackPrint: { enabled: true, gapMm: mm(0.2) },
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
    // The radius becomes a radius-cut outline (same as the non-stacking path), so
    // the rounded perimeter survives instead of being flattened under stacking.
    const r: CornerCutParams['tl'] = { kind: 'radius', r: 60 };
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(420, 336, { tl: r, tr: r, bl: r, br: r })
    );
    // The radius lives in the outline arcs now, so plain rounding is zeroed.
    expect(result.cornerRadius).toBe(0);
  });

  it('converts on unsynced custom-size plates too', () => {
    const stored = {
      ...storedBase,
      syncWithLayout: false,
      baseplateWidth: gridUnits(5),
      baseplateDepth: gridUnits(5),
      cornerRadius: mm(60),
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
    const r: CornerCutParams['tl'] = { kind: 'radius', r: 60 };
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(210, 210, { tl: r, tr: r, bl: r, br: r })
    );
  });
});

describe('grid↔perimeter frame parity (#3157)', () => {
  const U = 42;
  /** 84×84mm square at (10,10) inside a 4×4 extent — off-lattice by design;
   * the two-cell block registers at 42..126 per axis (shift +32, +32). */
  const OFF_LATTICE: DrawerOutline = {
    vertices: [
      { x: 10, y: 10 },
      { x: 94, y: 10 },
      { x: 94, y: 94 },
      { x: 10, y: 94 },
    ],
  };

  it.each([
    { padding: 0, gridShiftX: 0, gridShiftY: 0 },
    { padding: 3.5, gridShiftX: 0, gridShiftY: 0 },
    { padding: 3.5, gridShiftX: 7, gridShiftY: -4.25 },
  ])(
    'the plate outline is the padded shape translated by the shared frame shift (padding=$padding, shift=$gridShiftX/$gridShiftY)',
    ({ padding, gridShiftX, gridShiftY }) => {
      const stored = {
        magnetHoles: false,
        magnetDiameter: mm(6.5),
        magnetDepth: mm(2.4),
        paddingLeft: mm(padding),
        paddingRight: mm(padding),
        paddingFront: mm(padding),
        paddingBack: mm(padding),
      };
      const drawer = {
        width: gridUnits(4),
        depth: gridUnits(4),
        outline: OFF_LATTICE,
        gridShiftX: mm(gridShiftX),
        gridShiftY: mm(gridShiftY),
      };

      const plate = buildFullParams(
        stored,
        4,
        4,
        U,
        'end',
        'end',
        undefined,
        OFF_LATTICE,
        'edge',
        U,
        gridShiftX,
        gridShiftY
      );

      // The layout side derives its translation from the same module; the
      // plate's resolved outline must be exactly the padded shape carried by
      // that shift, or a placeable layout cell and a kept socket can disagree.
      const shift = drawerFrameShift(drawer, stored, U, U);
      const padded =
        padding > 0
          ? padOutline(OFF_LATTICE, {
              left: padding,
              right: padding,
              front: padding,
              back: padding,
            })
          : OFF_LATTICE;
      expect(padded).not.toBeNull();
      if (padded === null) throw new Error('unreachable');
      const expected =
        shift.x === 0 && shift.y === 0 ? padded : translateOutline(padded, shift.x, shift.y);
      expect(plate.outline?.vertices).toEqual(expected.vertices);
      expect(shift.x).toBeCloseTo(32 - gridShiftX, 9);
      expect(shift.y).toBeCloseTo(32 - gridShiftY, 9);
    }
  );
});

describe('outline overhang (#3169)', () => {
  // The reporter's setup: a 396 x 295.5mm perimeter on an 8.5 x 7.5
  // drawer at 48 x 42 pitch, so the extent is 408 x 315 and the shape is
  // anchored at the origin — touching the left and front edges.
  const REPORTED: DrawerOutline = {
    vertices: [
      { x: 0, y: 0 },
      { x: 396, y: 0 },
      { x: 396, y: 295.5 },
      { x: 0, y: 295.5 },
    ],
  };
  const noPadding = {
    magnetHoles: false,
    magnetDiameter: mm(6.5),
    magnetDepth: mm(2.4),
    paddingLeft: mm(0),
    paddingRight: mm(0),
    paddingFront: mm(0),
    paddingBack: mm(0),
  };
  const TOTAL_W = 8.5 * 48;
  const TOTAL_D = 7.5 * 42;

  const build = (shiftX: number, shiftY: number) =>
    buildFullParams(
      noPadding,
      8.5,
      7.5,
      48,
      'end',
      'end',
      undefined,
      REPORTED,
      undefined,
      42,
      shiftX,
      shiftY
    );

  it.each([
    [0, 0],
    [4.5, 0],
    [0, 4.5],
    [-4.5, -4.5],
    [24, -21],
  ])('bounds the whole perimeter at shift (%s, %s)', (shiftX, shiftY) => {
    const plate = build(shiftX, shiftY);
    const b = outlineBounds(plate.outline as DrawerOutline);
    const oh = plate.outlineOverhang;
    // The generator's slab spans [-left, totalW + right]; the outline is
    // intersected against it, so anything outside is cut off the plate.
    expect(-(oh?.left ?? 0)).toBeLessThanOrEqual(b.minX);
    expect(TOTAL_W + (oh?.right ?? 0)).toBeGreaterThanOrEqual(b.maxX);
    expect(-(oh?.front ?? 0)).toBeLessThanOrEqual(b.minY);
    expect(TOTAL_D + (oh?.back ?? 0)).toBeGreaterThanOrEqual(b.maxY);
  });

  it('measures the reported +4.5mm shift as a 4.5mm left overhang', () => {
    expect(build(4.5, 0).outlineOverhang).toEqual({
      left: 4.5,
      right: 0,
      front: 0,
      back: 0,
    });
    expect(build(0, 4.5).outlineOverhang).toEqual({
      left: 0,
      right: 0,
      front: 4.5,
      back: 0,
    });
  });

  it('stays absent when the shape fits its extent, keeping plates cache-stable', () => {
    expect(build(0, 0).outlineOverhang).toBeUndefined();
    // Shifts that move the shape into the extent's own slack overhang nothing.
    expect(build(-4.5, -4.5).outlineOverhang).toBeUndefined();
  });

  it('gives only the outermost split pieces their side of the overhang', () => {
    const plate = build(4.5, 0);
    const tiling = computeBaseplateTiling(plate, 180, 180);
    expect(tiling.isSplit).toBe(true);
    for (const piece of tiling.pieces) {
      const pieceParams = pieceToBaseplateParams(piece, plate);
      if (piece.gridOffsetX === 0) {
        // The piece slab IS its clip window, so the edge piece must carry the
        // overhang or it re-clips the strip the widened window kept.
        expect(pieceParams.outlineOverhang?.left).toBe(4.5);
      } else {
        expect(pieceParams.outlineOverhang).toBeUndefined();
      }
    }
  });
});

/**
 * The overhang widens a piece's slab OUTWARD from its padded extent, so
 * the piece must frame its outline exactly as the whole plate does — extent at
 * 0, overhang negative. Deriving the piece-local outline from the widened
 * window origin instead slid the perimeter inward by the overhang: the outer
 * strip fell outside the piece's own clip and the shape sat displaced against
 * that piece's sockets, on the outer pieces only (hence "asymmetrical").
 */
describe('split-piece outline frame vs. its overhang-widened slab (#3212)', () => {
  // The reporter's plate: a 393 × 295.5mm perimeter on an 8 × 7 drawer at
  // 48 × 42 pitch (extent 384 × 294). The oversize shape auto-centres now
  //, so no manual grid shift is needed to reach the case where BOTH
  // sides of BOTH axes overhang. A 256mm bed tiles it 2 × 2.
  const REPORTED: DrawerOutline = {
    vertices: [
      { x: 0, y: 0 },
      { x: 106, y: 0 },
      { x: 106, y: 80 },
      { x: 290, y: 80 },
      { x: 290, y: 0 },
      { x: 393, y: 0 },
      { x: 393, y: 295.5 },
      { x: 0, y: 295.5 },
    ],
  };
  const plate = buildFullParams(
    {
      magnetHoles: false,
      magnetDiameter: mm(6.5),
      magnetDepth: mm(2.4),
      paddingLeft: mm(0),
      paddingRight: mm(0),
      paddingFront: mm(0),
      paddingBack: mm(0),
      wholeCellsOnly: true,
    },
    8,
    7,
    48,
    'end',
    'end',
    undefined,
    REPORTED,
    undefined,
    42,
    0,
    0
  );

  it('overhangs all four sides — the case a single-sided shift never reached', () => {
    expect(plate.outlineOverhang).toEqual({ left: 4.5, right: 4.5, front: 0.75, back: 0.75 });
  });

  it('auto-centres the oversize shape the reporter hand-shifted', () => {
    // (4.5, 0.75) is exactly what they typed into the grid-shift steppers; the
    // registration now supplies it, so the manual shift starts (and stays) 0.
    const b = outlineBounds(plate.outline as DrawerOutline);
    expect(b.minX).toBeCloseTo(-4.5, 9);
    expect(b.maxX).toBeCloseTo(388.5, 9);
    expect(b.minY).toBeCloseTo(-0.75, 9);
    expect(b.maxY).toBeCloseTo(294.75, 9);
  });

  it('starts every piece outline at minus its own overhang, not at zero', () => {
    const tiling = computeBaseplateTiling(plate, 256, 256);
    expect(tiling.isSplit).toBe(true);
    const partials = tiling.pieces.filter((p) => p.outlineWindowOriginMm !== undefined);
    expect(partials.length).toBeGreaterThan(0);
    // Every partial piece must reach its outer overhang; a piece whose outline
    // started at 0 would leave that strip unclipped-away and misplace the shape.
    for (const piece of partials) {
      const pieceParams = pieceToBaseplateParams(piece, plate);
      const oh = pieceParams.outlineOverhang;
      const b = outlineBounds(pieceParams.outline as DrawerOutline);
      if ((oh?.left ?? 0) > 0) expect(b.minX).toBeCloseTo(-(oh?.left ?? 0), 9);
      if ((oh?.front ?? 0) > 0) expect(b.minY).toBeCloseTo(-(oh?.front ?? 0), 9);
    }
  });

  it('reaches the far side of every piece slab the overhang widened', () => {
    const tiling = computeBaseplateTiling(plate, 256, 256);
    for (const piece of tiling.pieces) {
      const pieceParams = pieceToBaseplateParams(piece, plate);
      if (pieceParams.outline === undefined) continue;
      const oh = pieceParams.outlineOverhang;
      const totalW = piece.widthUnits * 48 + piece.paddingLeft + piece.paddingRight;
      const totalD = piece.depthUnits * 42 + piece.paddingFront + piece.paddingBack;
      const b = outlineBounds(pieceParams.outline);
      // The outline is NOT pre-clipped to the piece — the slab does that in 3D
      // — so on every widened side it must still reach past the slab's outer
      // face, or that strip has no perimeter to keep it.
      expect(b.minX).toBeLessThanOrEqual(-(oh?.left ?? 0) + 1e-9);
      expect(b.minY).toBeLessThanOrEqual(-(oh?.front ?? 0) + 1e-9);
      expect(b.maxX).toBeGreaterThanOrEqual(totalW + (oh?.right ?? 0) - 1e-9);
      expect(b.maxY).toBeGreaterThanOrEqual(totalD + (oh?.back ?? 0) - 1e-9);
    }
  });
});
