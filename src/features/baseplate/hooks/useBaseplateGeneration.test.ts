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
