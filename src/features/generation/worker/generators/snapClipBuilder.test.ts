// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  SNAP_CLIP_LENGTH,
  SNAP_CLIP_WIDTH,
  SNAP_CLIP_DEPTH,
  SNAP_CLIP_SNAP,
  SNAP_CLIP_THICKNESS,
  SNAP_CLIP_COMPRESSION,
  SNAP_CLIP_CLEARANCE,
} from './generatorConstants';

type ExportClip = (format: 'stl') => Promise<{ data: ArrayBuffer }>;

let exportSnapClip: ExportClip;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./snapClipBuilder');
  exportSnapClip = mod.exportSnapClip;
}, 30000);

interface Bbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function stlBbox(stl: ArrayBuffer): Bbox {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const v = parsed.value.vertices;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < v.length; i += 3) {
    if (v[i] < minX) minX = v[i];
    if (v[i] > maxX) maxX = v[i];
    if (v[i + 1] < minY) minY = v[i + 1];
    if (v[i + 1] > maxY) maxY = v[i + 1];
    if (v[i + 2] < minZ) minZ = v[i + 2];
    if (v[i + 2] > maxZ) maxZ = v[i + 2];
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

describe('rabbit snap clip geometry', () => {
  it('clearance is positive and smaller than snap (so the clip can squeeze in)', () => {
    expect(SNAP_CLIP_CLEARANCE).toBeGreaterThan(0);
    expect(SNAP_CLIP_CLEARANCE).toBeLessThan(SNAP_CLIP_SNAP);
  });

  it('ear width exceeds nominal — the over-width is what makes the snap engage', () => {
    // After compression, the ear protrudes past the socket's nominal width.
    // This interference is what produces the audible click on insertion.
    expect(SNAP_CLIP_COMPRESSION).toBeGreaterThan(0);
  });

  it('exported STL bbox matches the double clip dimensions', async () => {
    const result = await exportSnapClip('stl');
    const bbox = stlBbox(result.data);

    // X axis (width): nominal width + 2*compression at the ears.
    const expectedX = SNAP_CLIP_WIDTH + 2 * SNAP_CLIP_COMPRESSION;
    expect(bbox.maxX - bbox.minX).toBeCloseTo(expectedX, 0);

    // Y axis (length): both pin halves extend on either side of Y=0. Each half
    // is foreshortened by BOSL2's scaledLen formula, so we accept anything
    // within ~80–100% of (2 * length).
    const yExtent = bbox.maxY - bbox.minY;
    expect(yExtent).toBeGreaterThan(SNAP_CLIP_LENGTH * 1.6);
    expect(yExtent).toBeLessThanOrEqual(SNAP_CLIP_LENGTH * 2.05);

    // Z axis: lay-flat extrusion at the configured depth.
    expect(bbox.maxZ - bbox.minZ).toBeCloseTo(SNAP_CLIP_DEPTH, 1);

    // Sanity: clip wall is thinner than the clip is deep.
    expect(SNAP_CLIP_THICKNESS).toBeLessThan(SNAP_CLIP_DEPTH);
  }, 30000);
});
