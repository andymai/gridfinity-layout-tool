/**
 * The empty-mesh diagnosis is the whole point of `assertKernelReturnedGeometry`
 * (#3184): a zero-triangle result is a kernel failure, and reporting it as a
 * bare numeric assertion is what sent a memory-pressure flake to a bisect for a
 * regression that did not exist. Pinned here so the wording cannot decay back
 * into an anonymous `expected +0 to be greater than +0`.
 *
 * Pure assertion logic over hand-built MeshData — no kernel needed.
 *
 * Deliberately NOT colocated beside `__kernel-tests__/meshAssertions.ts`: every
 * Vitest project excludes the `__kernel-tests__` directory, so a test written
 * there never runs. One directory up it lands in the `generators` project.
 */
import { describe, it, expect } from 'vitest';
import {
  assertKernelReturnedGeometry,
  assertStructurallyValid,
} from './__kernel-tests__/meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';

/** One degenerate-but-nonempty triangle: enough to pass every structural check.
 * Fully typed (no cast) so a change to the MeshData contract surfaces here. */
function mesh(overrides: Partial<MeshData> = {}): MeshData {
  return {
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    edgeVertices: new Float32Array(0),
    triangleCount: 1,
    ...overrides,
  };
}

const empty = (): MeshData =>
  mesh({
    vertices: new Float32Array([]),
    normals: new Float32Array([]),
    indices: new Uint32Array([]),
    triangleCount: 0,
  });

describe('assertKernelReturnedGeometry (#3184)', () => {
  it('passes a mesh that has geometry', () => {
    expect(() => assertKernelReturnedGeometry(mesh(), 'ok')).not.toThrow();
  });

  it('names the failure class rather than the number', () => {
    let message = '';
    try {
      assertKernelReturnedGeometry(empty(), 'L-shape with front cutout');
    } catch (error) {
      message = (error as Error).message;
    }
    // The three things a reader needs: what happened, that it is not geometry
    // drift, and what to do next.
    expect(message).toContain('EMPTY mesh');
    expect(message).toContain('not a geometry change');
    expect(message).toContain('re-run this file alone');
    // ...and which scenario, since a whole domain file shares one runner.
    expect(message).toContain('L-shape with front cutout');
  });

  it('describes the count-without-buffers case as itself, not as "no triangles"', () => {
    // A kernel can hand back a count with no buffer. Reporting that as
    // "0 triangles" would be the same misdiagnosis this helper exists to
    // prevent, so each half states what it actually observed.
    let message = '';
    try {
      assertKernelReturnedGeometry(mesh({ triangleCount: 7, vertices: new Float32Array([]) }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('7 triangles but no vertex data');
    expect(message).not.toContain('no triangles');
  });

  it('catches an empty mesh that still claims triangles', () => {
    // A kernel can hand back a count with no buffer; both halves are checked so
    // neither shape of emptiness slips into a snapshot comparison.
    expect(() => assertKernelReturnedGeometry(mesh({ vertices: new Float32Array([]) }))).toThrow(
      /EMPTY mesh/
    );
  });
});

describe('assertStructurallyValid diagnoses emptiness first', () => {
  it('reports an empty mesh as a kernel failure, not as a mismatch', () => {
    // Every downstream check (normals match, indices match) is also violated by
    // an empty mesh, and each of those reads as geometry drift. Emptiness has to
    // win the race or the diagnosis is lost.
    expect(() => assertStructurallyValid(empty(), 'scenario')).toThrow(/EMPTY mesh/);
  });

  it('still reports real structural damage on a non-empty mesh', () => {
    expect(() =>
      assertStructurallyValid(mesh({ normals: new Float32Array([0, 0, 1]) }), 'scenario')
    ).toThrow(/normals should match vertices/);
  });

  it('still catches NaN', () => {
    expect(() =>
      assertStructurallyValid(mesh({ vertices: new Float32Array([0, 0, 0, NaN, 0, 0, 0, 1, 0]) }))
    ).toThrow(/NaN\/Infinity/);
  });
});
