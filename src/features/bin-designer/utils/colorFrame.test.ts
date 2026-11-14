import { describe, it, expect } from 'vitest';
import { FeatureTag } from '@/shared/types/generation';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { assemblyColorFrame } from './colorFrame';
import { computeLipGeom } from './lipCornerClassifier';

/** Flat sliver triangle at (x, y, z), 9 floats. */
function sliver(x: number, y: number, z: number): number[] {
  return [x, y, z, x + 0.1, y, z, x, y + 0.1, z];
}

function flatPart(tris: number[][], tag: number) {
  const vertices = new Float32Array(tris.flat());
  return { vertices, faceGroups: [{ start: 0, count: tris.length * 3, tag }] };
}

const featureColors = {
  ...DEFAULT_BIN_PARAMS.featureColors,
  enabled: true,
  topAccent: { ...DEFAULT_BIN_PARAMS.featureColors.topAccent, enabled: true, heightMm: 2 },
};

describe('assemblyColorFrame', () => {
  it('centers the lip on the whole assembly, not on one piece', () => {
    const left = flatPart([sliver(-30, -10, 20), sliver(-10, 10, 20)], FeatureTag.LIP);
    const right = flatPart([sliver(10, -10, 20), sliver(30, 10, 20)], FeatureTag.LIP);

    const frame = assemblyColorFrame([left, right], featureColors);
    const leftAlone = computeLipGeom(left.faceGroups, (t) =>
      left.vertices.subarray(t * 9, t * 9 + 9)
    );

    expect(frame.lipGeom?.cx).toBeCloseTo(0.0333, 3);
    expect(leftAlone?.cx).toBeLessThan(-15);
  });

  it('takes the accent planes from the Z extent of every piece', () => {
    const low = flatPart([sliver(0, 0, 0), sliver(5, 0, 12)], FeatureTag.UNKNOWN);
    const high = flatPart([sliver(40, 0, 3), sliver(45, 0, 30)], FeatureTag.UNKNOWN);

    const frame = assemblyColorFrame([low, high], featureColors);

    expect(frame.accentCuts.topZ).toBeCloseTo(28, 5);
  });

  it('merges indexed and flat parts with their face groups offset', () => {
    const indexed = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 50, 50, 20, 51, 50, 20, 50, 51, 20]),
      indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
      faceGroups: [
        { start: 0, count: 3, tag: FeatureTag.UNKNOWN },
        { start: 3, count: 3, tag: FeatureTag.LIP },
      ],
    };
    const flat = flatPart([sliver(-50, -50, 20)], FeatureTag.LIP);

    const frame = assemblyColorFrame([indexed, flat], featureColors);

    // Lip centroids at (50.33, 50.33) and (-49.97, -49.97).
    expect(frame.lipGeom?.cx).toBeCloseTo(0.183, 2);
    expect(frame.lipGeom?.cy).toBeCloseTo(0.183, 2);
  });

  it('has no lip geometry when no piece carries the LIP tag', () => {
    const frame = assemblyColorFrame(
      [flatPart([sliver(0, 0, 0)], FeatureTag.UNKNOWN)],
      featureColors
    );
    expect(frame.lipGeom).toBeNull();
  });
});
