/**
 * The whole-bin measurements that color classification reads off a mesh: the
 * lip's footprint (for corner and band cells) and the accent cut planes (from
 * the model's Z extent).
 *
 * A split bin is classified one piece at a time, and a piece measured on its
 * own puts the lip center in the middle of that piece, so every piece would
 * get all four lip corners. Measuring once over every piece and handing the
 * result to each one colors the pieces as the unsplit bin would be.
 */

import type { FaceGroupData } from '@/shared/types/generation';
import { accentCutPlanes } from '../types/featureColors';
import type { AccentCutPlanes, FeatureColorConfig } from '../types/featureColors';
import { computeLipGeom } from './lipCornerClassifier';
import type { LipGeom } from './lipCornerClassifier';

export interface ColorFrame {
  readonly lipGeom: LipGeom | null;
  readonly accentCuts: AccentCutPlanes;
}

/** One mesh of an assembly, in the assembly's shared frame. */
export interface ColorFramePart {
  readonly vertices: ArrayLike<number>;
  /** Absent for a flat (STL-order) buffer whose corners are already in triangle order. */
  readonly indices?: ArrayLike<number>;
  readonly faceGroups: readonly FaceGroupData[];
}

/** Flat 9-floats-per-triangle copy of `part`, so parts of either layout merge. */
function flatTriangles(part: ColorFramePart): Float32Array {
  const { vertices, indices } = part;
  if (!indices) return Float32Array.from(vertices);
  const out = new Float32Array(indices.length * 3);
  for (let c = 0; c < indices.length; c++) {
    const v = indices[c] * 3;
    out[c * 3] = vertices[v];
    out[c * 3 + 1] = vertices[v + 1];
    out[c * 3 + 2] = vertices[v + 2];
  }
  return out;
}

/** Every part as one flat mesh, face groups offset to match. */
export interface MergedColorParts {
  readonly vertices: Float32Array;
  readonly faceGroups: readonly FaceGroupData[];
}

/** The mesh-only half of the frame, so a color edit does not re-merge the parts. */
export function mergeColorFrameParts(parts: readonly ColorFramePart[]): MergedColorParts {
  const flats = parts.map(flatTriangles);
  const vertices = new Float32Array(flats.reduce((n, f) => n + f.length, 0));
  const faceGroups: FaceGroupData[] = [];
  let floatOffset = 0;
  parts.forEach((part, i) => {
    vertices.set(flats[i], floatOffset);
    const indexOffset = floatOffset / 3;
    for (const g of part.faceGroups) faceGroups.push({ ...g, start: g.start + indexOffset });
    floatOffset += flats[i].length;
  });
  return { vertices, faceGroups };
}

export function colorFrameOf(
  merged: MergedColorParts,
  featureColors: FeatureColorConfig
): ColorFrame {
  const { vertices, faceGroups } = merged;
  return {
    lipGeom: computeLipGeom(faceGroups, (t) => vertices.subarray(t * 9, t * 9 + 9)),
    accentCuts: accentCutPlanes(featureColors, vertices, faceGroups),
  };
}

export function assemblyColorFrame(
  parts: readonly ColorFramePart[],
  featureColors: FeatureColorConfig
): ColorFrame {
  return colorFrameOf(mergeColorFrameParts(parts), featureColors);
}
