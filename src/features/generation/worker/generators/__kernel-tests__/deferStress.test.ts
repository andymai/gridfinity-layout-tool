// @vitest-environment node
/**
 * Robustness guards for the deferred-socket preview path (defer-socket-fuse):
 * disposal stability across repeated generations and face-group/origin survival
 * through the body+socket mesh merge (multicolor).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

const hasNaN = (a: ArrayLike<number>): boolean => {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return true;
  return false;
};

describe('defer-socket robustness', () => {
  it('repeated preview+export generations are stable and deterministic', () => {
    const gen = getGenerateBin();
    const p = buildParams({
      width: 4,
      depth: 3,
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
    });
    let previewTris = 0;
    let exportTris = 0;
    for (let i = 0; i < 8; i++) {
      const preview = gen(p, undefined, false);
      const exp = gen(p, undefined, true);
      expect(preview.triangleCount).toBeGreaterThan(0);
      expect(exp.triangleCount).toBeGreaterThan(0);
      expect(hasNaN(preview.vertices)).toBe(false);
      expect(hasNaN(exp.vertices)).toBe(false);
      if (i > 0) {
        // No disposal/state corruption: identical output every repeat.
        expect(preview.triangleCount).toBe(previewTris);
        expect(exp.triangleCount).toBe(exportTris);
      }
      previewTris = preview.triangleCount;
      exportTris = exp.triangleCount;
    }
  }, 120_000);

  it('preview face groups survive the body+socket merge (socket tagged for multicolor)', () => {
    const gen = getGenerateBin();
    const preview = gen(
      buildParams({
        width: 2,
        depth: 2,
        height: 4,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
      }),
      undefined,
      false
    );
    expect(preview.faceGroups).toBeDefined();
    const tags = new Set((preview.faceGroups ?? []).map((g) => g.tag));
    expect(tags.size).toBeGreaterThan(1); // distinct zones preserved
    expect(tags.has(3)).toBe(true); // FeatureTag.SOCKET — socket faces present + tagged
  }, 60_000);
});
