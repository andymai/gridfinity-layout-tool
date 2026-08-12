import { describe, it, expect } from 'vitest';
import { mm, gridUnits } from '@gridfinity/branded-types';
import type { StoredBaseplateParams } from '@/core/types';
import {
  useBaseplateGeneration,
  hasMeshOnScreen,
  selectGenerationTriggers,
} from './useBaseplateGeneration';

describe('useBaseplateGeneration', () => {
  it('is defined', () => {
    expect(useBaseplateGeneration).toBeDefined();
  });
});

/** Mirror of `useShallow`'s comparison: top-level Object.is over every key. */
function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => Object.is(a[k], b[k]));
}

describe('selectGenerationTriggers', () => {
  const makeState = (
    connectorStyle: 'dovetail' | 'dovetailKey' | undefined,
    overrides: Partial<StoredBaseplateParams> = {}
  ): Parameters<typeof selectGenerationTriggers>[0] =>
    ({
      layout: {
        gridUnitMm: 42,
        printBedSize: 256,
        printBedDepth: 256,
        drawer: { width: 400, depth: 300, fractionalEdgeX: 'end', fractionalEdgeY: 'end' },
        baseplateParams: {
          magnetHoles: false,
          magnetDiameter: mm(6),
          magnetDepth: mm(2),
          paddingLeft: mm(0),
          paddingRight: mm(0),
          paddingFront: mm(0),
          paddingBack: mm(0),
          connectorNubs: true,
          syncWithLayout: true,
          baseplateWidth: gridUnits(10),
          baseplateDepth: gridUnits(10),
          cornerRadius: mm(0),
          invertDovetails: false,
          preferIdenticalPieces: false,
          connectorStyle,
          ...overrides,
        },
      },
    }) as unknown as Parameters<typeof selectGenerationTriggers>[0];

  /**
   * Regression (#1610 follow-up): switching Dovetail -> Dovetail key changes only
   * `connectorStyle`. If that field is absent from the regeneration trigger set,
   * `useShallow` reports the selection unchanged and the piece meshes never
   * regenerate — the exploded preview keeps showing male dovetails while the
   * separately-generated dovetail keys appear. The trigger object MUST change.
   */
  it('produces a different trigger selection when connectorStyle changes', () => {
    const dovetail = selectGenerationTriggers(makeState('dovetail'));
    const dovetailKey = selectGenerationTriggers(makeState('dovetailKey'));
    expect(shallowEqual(dovetail, dovetailKey)).toBe(false);
  });

  it('produces an equal trigger selection when nothing changes', () => {
    const a = selectGenerationTriggers(makeState('dovetailKey'));
    const b = selectGenerationTriggers(makeState('dovetailKey'));
    expect(shallowEqual(a, b)).toBe(true);
  });

  /**
   * Regression (#2378): toggling half-grid margin fill changes only
   * `overTileHalfGrid`. If that field is absent from the trigger set, the
   * preview never regenerates and keeps the plain over-tile mesh.
   */
  it('produces a different trigger selection when overTileHalfGrid changes', () => {
    const makeFillState = (overTileHalfGrid: boolean) =>
      makeState(undefined, { overTile: true, overTileHalfGrid });
    const plain = selectGenerationTriggers(makeFillState(false));
    const halfGrid = selectGenerationTriggers(makeFillState(true));
    expect(shallowEqual(plain, halfGrid)).toBe(false);
  });

  /**
   * Regression: enabling the solid floor or dragging its thickness changes only
   * `solidFloor`/`solidFloorThickness`. If those are absent from the trigger set,
   * the preview never regenerates and the plate keeps its old height/underside.
   */
  it('produces a different trigger selection when solidFloor toggles', () => {
    const off = makeState(undefined);
    const on = makeState(undefined, { solidFloor: true });
    expect(shallowEqual(selectGenerationTriggers(off), selectGenerationTriggers(on))).toBe(false);
  });

  it('produces a different trigger selection when solidFloorThickness changes (floor on)', () => {
    const thin = makeState(undefined, { solidFloor: true, solidFloorThickness: mm(0.8) });
    const thick = makeState(undefined, { solidFloor: true, solidFloorThickness: mm(2) });
    expect(shallowEqual(selectGenerationTriggers(thin), selectGenerationTriggers(thick))).toBe(
      false
    );
  });

  it('ignores solidFloorThickness while the floor is off (no needless regen)', () => {
    const a = makeState(undefined, { solidFloor: false, solidFloorThickness: mm(0.8) });
    const b = makeState(undefined, { solidFloor: false, solidFloorThickness: mm(2) });
    expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(true);
  });

  /**
   * Regression: toggling mount-down screws (or editing any screw field)
   * changed only `screwHoles`, which was absent from the trigger set — the
   * preview kept the stale plate until an unrelated param changed.
   */
  describe('mount-down screw params', () => {
    const screws = (over: Partial<StoredBaseplateParams['screwHoles'] & object> = {}) =>
      ({
        enabled: true,
        diameter: mm(3.4),
        headStyle: 'countersink',
        ...over,
      }) as StoredBaseplateParams['screwHoles'];

    it('produces a different trigger selection when screws toggle', () => {
      const off = makeState(undefined);
      const on = makeState(undefined, { screwHoles: screws() });
      expect(shallowEqual(selectGenerationTriggers(off), selectGenerationTriggers(on))).toBe(false);
    });

    it('produces a different trigger selection when the shaft diameter changes', () => {
      const a = makeState(undefined, { screwHoles: screws({ diameter: mm(3.4) }) });
      const b = makeState(undefined, { screwHoles: screws({ diameter: mm(4.5) }) });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(false);
    });

    it('produces a different trigger selection when the head style changes', () => {
      const a = makeState(undefined, { screwHoles: screws({ headStyle: 'countersink' }) });
      const b = makeState(undefined, { screwHoles: screws({ headStyle: 'counterbore' }) });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(false);
    });

    it('produces a different trigger selection when screws per piece changes', () => {
      const a = makeState(undefined, { screwHoles: screws({ screwsPerPiece: 4 }) });
      const b = makeState(undefined, { screwHoles: screws({ screwsPerPiece: 6 }) });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(false);
    });

    it('produces a different trigger selection when the counterbore depth changes (counterbore head)', () => {
      const a = makeState(undefined, {
        screwHoles: screws({ headStyle: 'counterbore', counterboreDepth: mm(2) }),
      });
      const b = makeState(undefined, {
        screwHoles: screws({ headStyle: 'counterbore', counterboreDepth: mm(3) }),
      });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(false);
    });

    it('ignores screw geometry fields while screws are disabled (no needless regen)', () => {
      const a = makeState(undefined, { screwHoles: screws({ enabled: false, diameter: mm(3.4) }) });
      const b = makeState(undefined, { screwHoles: screws({ enabled: false, diameter: mm(4.5) }) });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(true);
    });

    it('ignores screw fields while stacking strips them (no needless regen)', () => {
      const stack = { enabled: true, gapMm: mm(0.2) } as const;
      const a = makeState(undefined, { stackPrint: stack, screwHoles: screws() });
      const b = makeState(undefined, {
        stackPrint: stack,
        screwHoles: screws({ diameter: mm(4.5) }),
      });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(true);
    });
  });

  /**
   * Regression: the connector fit offset shifts every connector clearance, but
   * was absent from the trigger set — stepping it left the exploded preview's
   * tongues and grooves at the old clearance until an unrelated param changed.
   */
  describe('connectorFitOffset', () => {
    it('produces a different trigger selection when the offset changes (connectors on)', () => {
      const a = makeState('dovetail', { connectorFitOffset: 0 });
      const b = makeState('dovetail', { connectorFitOffset: 0.2 });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(false);
    });

    it('produces a different trigger selection when the offset changes (margin seam on, connectors off)', () => {
      const seam = {
        connectorNubs: false,
        detachMargins: true,
        detachMarginConnector: true,
      } as const;
      const a = makeState(undefined, { ...seam, connectorFitOffset: 0 });
      const b = makeState(undefined, { ...seam, connectorFitOffset: 0.2 });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(false);
    });

    it('ignores the offset when nothing can consume it (no needless regen)', () => {
      const a = makeState(undefined, { connectorNubs: false, connectorFitOffset: 0 });
      const b = makeState(undefined, { connectorNubs: false, connectorFitOffset: 0.2 });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(true);
    });
  });

  /**
   * Regression: `lightweight` reaches the generator (the underside cross
   * cutter) but was absent from the trigger set. No UI writes it today, but
   * synced/imported params can carry it.
   */
  describe('lightweight', () => {
    it('produces a different trigger selection when lightweight changes (magnets on)', () => {
      const a = makeState(undefined, { magnetHoles: true, lightweight: true });
      const b = makeState(undefined, { magnetHoles: true, lightweight: false });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(false);
    });

    it('ignores lightweight while magnets are off (no needless regen)', () => {
      const a = makeState(undefined, { magnetHoles: false, lightweight: true });
      const b = makeState(undefined, { magnetHoles: false, lightweight: false });
      expect(shallowEqual(selectGenerationTriggers(a), selectGenerationTriggers(b))).toBe(true);
    });
  });
});

describe('hasMeshOnScreen', () => {
  /**
   * Regression: an earlier version used `mesh?.vertices !== null`, which
   * short-circuits to `undefined !== null === true` when `mesh` itself is
   * `null`. That caused BREP failures on a blank canvas to take the
   * "graceful preview" branch (toast only) instead of showing the red error
   * overlay — leaving the user with nothing visible AND no clear error.
   */
  it('reports false on a blank canvas (mesh is null, no pieces)', () => {
    expect(
      hasMeshOnScreen({
        pieceMeshes: { length: 0 },
        generation: { mesh: null },
      })
    ).toBe(false);
  });

  it('reports false when mesh exists but vertices are null', () => {
    expect(
      hasMeshOnScreen({
        pieceMeshes: { length: 0 },
        generation: { mesh: { vertices: null } },
      })
    ).toBe(false);
  });

  it('reports true when single-piece mesh has vertices', () => {
    expect(
      hasMeshOnScreen({
        pieceMeshes: { length: 0 },
        generation: { mesh: { vertices: new Float32Array([0, 0, 0]) } },
      })
    ).toBe(true);
  });

  it('reports true when split pieces are present', () => {
    expect(
      hasMeshOnScreen({
        pieceMeshes: { length: 4 },
        generation: { mesh: null },
      })
    ).toBe(true);
  });
});
