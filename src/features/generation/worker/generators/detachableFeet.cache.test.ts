// @vitest-environment node

import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { clearAllCaches, getAllShapeCacheStats } from './shapeCache';

const feetBin = (style: 'standard' | 'screw') =>
  buildParams({
    width: 2,
    depth: 1,
    height: 4,
    base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable', style },
  });

function holedHits(): number {
  return getAllShapeCacheStats().find((s) => s.name === 'feet-holed-body')?.hits ?? 0;
}

function sameGeometry(a: MeshData, b: MeshData): boolean {
  if (a.triangleCount !== b.triangleCount || a.vertices.length !== b.vertices.length) return false;
  return a.vertices.every((v, i) => v === b.vertices[i]);
}

describe('detachable-feet holed body cache', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it('reuses the holed body for identical params and rebuilds when a hole input changes', () => {
    const generateBin = getGenerateBin();

    clearAllCaches();
    const coldA = generateBin(feetBin('standard'), undefined, false);
    const hitsBefore = holedHits();
    const warmA = generateBin(feetBin('standard'), undefined, false);
    expect(holedHits()).toBe(hitsBefore + 1);
    expect(sameGeometry(warmA, coldA)).toBe(true);

    clearAllCaches();
    const coldB = generateBin(feetBin('screw'), undefined, false);
    expect(sameGeometry(coldB, coldA)).toBe(false);

    // A screw base adds through-bores to the floor; with the plain body's holed
    // entry cached, it must still get them.
    clearAllCaches();
    generateBin(feetBin('standard'), undefined, false);
    const warmB = generateBin(feetBin('screw'), undefined, false);
    expect(sameGeometry(warmB, coldB)).toBe(true);
  }, 300_000);
});
