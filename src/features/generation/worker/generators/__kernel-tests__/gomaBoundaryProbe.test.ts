// @vitest-environment node
/**
 * Diagnostic (not a CI gate): locate the boundary (hole) edges in goma's
 * exported STL — chases the export-integrity failure on the goma scenario.
 */
import { describe, it, beforeAll } from 'vitest';
import { isOk } from '@/core/result';
import { initBrepjs } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches, setLastSolid } from '../shapeCache';
import { parseSTLBinary } from '@/shared/generation/stlParser';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('goma boundary probe', () => {
  it('prints boundary edge locations', async () => {
    clearAllCaches();
    setLastSolid(null);
    const { exportBin } = await import('../binExporter');
    const result = await exportBin(
      buildParams({
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'goma' },
      }),
      'stl'
    );
    const parsed = parseSTLBinary(result.data);
    if (!isOk(parsed)) throw new Error('parse failed');
    const { vertices } = parsed.value;
    const triangleCount = vertices.length / 9;

    const QUANTIZE = 1e4;
    const vKey = (x: number, y: number, z: number): string =>
      `${Math.round(x * QUANTIZE) / QUANTIZE},${Math.round(y * QUANTIZE) / QUANTIZE},${Math.round(z * QUANTIZE) / QUANTIZE}`;
    const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const edgeCount = new Map<string, number>();
    for (let t = 0; t < triangleCount; t++) {
      const base = t * 9;
      const keys = [
        vKey(vertices[base], vertices[base + 1], vertices[base + 2]),
        vKey(vertices[base + 3], vertices[base + 4], vertices[base + 5]),
        vKey(vertices[base + 6], vertices[base + 7], vertices[base + 8]),
      ];
      for (let i = 0; i < 3; i++) {
        edgeCount.set(
          eKey(keys[i], keys[(i + 1) % 3]),
          (edgeCount.get(eKey(keys[i], keys[(i + 1) % 3])) ?? 0) + 1
        );
      }
    }
    const boundary = [...edgeCount.entries()].filter(([, c]) => c === 1);
    console.log(`boundary edges: ${boundary.length}`);
    for (const [k] of boundary.slice(0, 20)) console.log(' ', k);
  }, 600_000);
});
