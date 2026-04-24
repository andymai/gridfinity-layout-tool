import { describe, it, expect } from 'vitest';
import { useBaseplateGeneration, hasMeshOnScreen } from './useBaseplateGeneration';

describe('useBaseplateGeneration', () => {
  it('is defined', () => {
    expect(useBaseplateGeneration).toBeDefined();
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
