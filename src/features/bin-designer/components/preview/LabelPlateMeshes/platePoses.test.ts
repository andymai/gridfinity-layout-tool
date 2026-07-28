import { describe, it, expect } from 'vitest';
import type { LabelPlateMeshData } from '@/shared/types/generation';
import { MAX_SLIDE_MM, REFERENCE_GAP, ROW_GAP, referenceRowPoses, seatedPose } from './platePoses';

function plate(over: Partial<LabelPlateMeshData> = {}): LabelPlateMeshData {
  return {
    vertices: new Float32Array(0),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    triangleCount: 0,
    seatX: 10,
    seatY: -20,
    seatZ: 30,
    slideY: -1,
    widthMm: 36,
    ...over,
  };
}

describe('seatedPose', () => {
  it('sits exactly at the socket when assembled', () => {
    expect(seatedPose(plate(), 0)).toEqual([10, -20, 30]);
  });

  // Back- and front-anchored shelves protrude opposite ways, so their plates
  // must withdraw opposite ways rather than all sliding together.
  it('withdraws along the plate’s own socket axis', () => {
    expect(seatedPose(plate({ slideY: -1 }), 10)).toEqual([10, -30, 30]);
    expect(seatedPose(plate({ slideY: 1 }), 10)).toEqual([10, -10, 30]);
  });

  it('never moves in X or Z', () => {
    const [x, , z] = seatedPose(plate(), MAX_SLIDE_MM);

    expect(x).toBe(10);
    expect(z).toBe(30);
  });

  it('caps withdrawal so a large explode cannot fling plates off-screen', () => {
    const far = seatedPose(plate(), 500);
    const capped = seatedPose(plate(), MAX_SLIDE_MM);

    expect(far).toEqual(capped);
  });

  it('ignores a negative offset', () => {
    expect(seatedPose(plate(), -5)).toEqual(seatedPose(plate(), 0));
  });
});

describe('referenceRowPoses', () => {
  it('returns nothing for an empty set', () => {
    expect(referenceRowPoses([], 84)).toEqual([]);
  });

  it('centres a single plate on the bin', () => {
    const [pose] = referenceRowPoses([plate()], 84);

    expect(pose[0]).toBe(0);
  });

  // Parked beyond the BACK face, so clearance scales with depth — a deep bin
  // must not have the row landing on top of it.
  it('parks the row clear of the bin’s back face', () => {
    const shallow = referenceRowPoses([plate()], 84)[0][1];
    const deep = referenceRowPoses([plate()], 168)[0][1];

    expect(shallow).toBe(84 / 2 + REFERENCE_GAP);
    expect(deep).toBe(168 / 2 + REFERENCE_GAP);
    expect(deep).toBeGreaterThan(shallow);
  });

  it('spaces plates by their own widths plus the gap', () => {
    const poses = referenceRowPoses([plate({ widthMm: 36 }), plate({ widthMm: 36 })], 84);

    expect(poses[1][0] - poses[0][0]).toBe(36 + ROW_GAP);
  });

  it('keeps the row centred with mixed plate widths', () => {
    const poses = referenceRowPoses(
      [plate({ widthMm: 36 }), plate({ widthMm: 78 }), plate({ widthMm: 36 })],
      84
    );
    const totalW = 36 + 78 + 36 + 2 * ROW_GAP;

    // Left edge of the first and right edge of the last straddle zero evenly.
    expect(poses[0][0] - 36 / 2).toBeCloseTo(-totalW / 2, 6);
    expect(poses[2][0] + 36 / 2).toBeCloseTo(totalW / 2, 6);
  });

  it('lays the row flat on the floor plane', () => {
    for (const pose of referenceRowPoses([plate(), plate()], 84)) {
      expect(pose[2]).toBe(0);
    }
  });
});
