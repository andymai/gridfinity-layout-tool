// @vitest-environment node
/**
 * Diagnostic (not a CI gate): locate stray solid material inside the cavity
 * near the corner axes on a kumiko bin — used to chase the corner-seam nub
 * artifacts seen in preview screenshots.
 */
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches } from '../shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('kumiko nub probe', () => {
  it('reports cavity-protruding vertices near corners', () => {
    clearAllCaches();
    const mesh = getGenerateBin()(
      buildParams({
        width: 1,
        depth: 1,
        height: 6,
        wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'mitsukude' },
      })
    );
    const outer = 41.5;
    const r = 3.75;
    const wt = DEFAULT_BIN_PARAMS.wallThickness;
    const rIn = r - wt;
    const cx = outer / 2 - r;
    const corners: Array<[number, number]> = [
      [cx, cx],
      [-cx, cx],
      [cx, -cx],
      [-cx, -cx],
    ];
    const verts = mesh.vertices;
    if (!verts) throw new Error('no vertices');
    const hits = new Map<string, number>();
    for (let i = 0; i < verts.length; i += 3) {
      const x = verts[i];
      const y = verts[i + 1];
      const z = verts[i + 2];
      if (z < 12 || z > 38) continue;
      for (const [ax, ay] of corners) {
        if (Math.sign(ax) !== Math.sign(x) || Math.sign(ay) !== Math.sign(y)) continue;
        if (Math.abs(x) < Math.abs(ax) - 1 || Math.abs(y) < Math.abs(ay) - 1) continue;
        const d = Math.hypot(x - ax, y - ay);
        if (d < rIn - 0.25 || d > r + 0.25) {
          const kind = d < rIn ? 'inward' : 'outward';
          const key = `${kind} corner(${ax.toFixed(1)},${ay.toFixed(1)}) r=${d.toFixed(2)} z=${z.toFixed(1)} at(${x.toFixed(2)},${y.toFixed(2)})`;
          hits.set(key, (hits.get(key) ?? 0) + 1);
        }
      }
    }
    console.log(`cavity-protruding corner vertices: ${hits.size}`);
    for (const k of [...hits.keys()].slice(0, 40)) console.log(' ', k);
  });
});
