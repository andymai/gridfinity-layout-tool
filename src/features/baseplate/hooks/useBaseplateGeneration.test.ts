import { describe, it, expect } from 'vitest';
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
    connectorStyle: 'dovetail' | 'dovetailKey' | undefined
  ): Parameters<typeof selectGenerationTriggers>[0] =>
    ({
      layout: {
        gridUnitMm: 42,
        printBedSize: 256,
        printBedDepth: 256,
        drawer: { width: 400, depth: 300, fractionalEdgeX: 'end', fractionalEdgeY: 'end' },
        baseplateParams: {
          magnetHoles: false,
          magnetDiameter: 6,
          magnetDepth: 2,
          paddingLeft: 0,
          paddingRight: 0,
          paddingFront: 0,
          paddingBack: 0,
          connectorNubs: true,
          syncWithLayout: true,
          baseplateWidth: 10,
          baseplateDepth: 10,
          cornerRadius: 0,
          invertDovetails: false,
          preferIdenticalPieces: false,
          connectorStyle,
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
