// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  SNAP_PEG_DIAMETER,
  SNAP_PEG_INSET,
  SNAP_PEG_LENGTH,
  SNAP_SADDLE_WIDTH,
  SNAP_SADDLE_LENGTH_MARGIN,
  SNAP_SADDLE_BASE_HEIGHT,
  SNAP_SADDLE_ARCH_RISE,
  SNAP_HOLE_DIAMETER,
  SNAP_HOLE_CLEARANCE,
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

describe('snap clip geometry', () => {
  it('peg fits its blind hole with the configured clearance', () => {
    expect(SNAP_HOLE_DIAMETER).toBeCloseTo(SNAP_PEG_DIAMETER + 2 * SNAP_HOLE_CLEARANCE, 5);
    expect(SNAP_HOLE_CLEARANCE).toBeGreaterThan(0);
  });

  it('exported STL bbox matches saddle dimensions', async () => {
    const result = await exportSnapClip('stl');
    const bbox = stlBbox(result.data);

    const expectedLen = 2 * (SNAP_PEG_INSET + SNAP_SADDLE_LENGTH_MARGIN);
    expect(bbox.maxX - bbox.minX).toBeCloseTo(expectedLen, 1);
    expect(bbox.maxY - bbox.minY).toBeCloseTo(SNAP_SADDLE_WIDTH, 1);

    // Z range: from peg tip (-PEG_LENGTH) up to top of arch (BASE_HEIGHT + ARCH_RISE).
    const expectedH = SNAP_PEG_LENGTH + SNAP_SADDLE_BASE_HEIGHT + SNAP_SADDLE_ARCH_RISE;
    expect(bbox.maxZ - bbox.minZ).toBeCloseTo(expectedH, 1);
    expect(bbox.minZ).toBeCloseTo(-SNAP_PEG_LENGTH, 1);
  }, 30000);
});
