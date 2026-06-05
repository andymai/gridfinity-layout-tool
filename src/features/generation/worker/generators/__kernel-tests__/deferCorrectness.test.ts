// @vitest-environment node
import { writeFileSync } from 'node:fs';
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams, makeCutout } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

// Signed volume of a triangle mesh (divergence theorem). For the preview's
// concatenated body+socket, the hidden coincident interface faces ~cancel, so
// this ≈ the true solid volume — and DIVERGES from export only if the preview
// wrongly keeps material a cut removed (e.g. a foot blocking a through-cut).
function signedVolume(verts: ArrayLike<number>, idx: ArrayLike<number>): number {
  let v = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3,
      b = idx[i + 1] * 3,
      c = idx[i + 2] * 3;
    const ax = verts[a],
      ay = verts[a + 1],
      az = verts[a + 2];
    const bx = verts[b],
      by = verts[b + 1],
      bz = verts[b + 2];
    const cx = verts[c],
      cy = verts[c + 1],
      cz = verts[c + 2];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(v);
}

function compare(
  label: string,
  p: BinParams
): { label: string; previewSV: number; exportSV: number; diffPct: number } {
  const gen = getGenerateBin();
  const e = gen(p, undefined, true);
  const pr = gen(p, undefined, false);
  const exportSV = signedVolume(e.vertices, e.indices);
  const previewSV = signedVolume(pr.vertices, pr.indices);
  const diffPct = (Math.abs(previewSV - exportSV) / exportSV) * 100;
  return { label, previewSV, exportSV, diffPct };
}

describe('defer-socket correctness vs features that reach the socket', () => {
  it('preview solid volume matches export (no foot blocking a cut)', () => {
    const rows: ReturnType<typeof compare>[] = [];
    // Control: plain socket bin (socket never cut) — should match.
    rows.push(
      compare(
        'plain socket',
        buildParams({
          width: 2,
          depth: 2,
          height: 3,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
        })
      )
    );
    // Solid bin with a DEEP cutout that may punch through to the socket.
    rows.push(
      compare(
        'solid deep cutout',
        buildParams({
          width: 2,
          depth: 2,
          height: 3,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', solid: true, stackingLip: true },
          cutouts: [makeCutout({ shape: 'circle', width: 16, depth: 16, cutDepth: 40 })],
        })
      )
    );
    // Magnet bin (magnet holes are cut INSIDE the socket build — should still match).
    rows.push(
      compare(
        'magnet socket',
        buildParams({
          width: 2,
          depth: 2,
          height: 3,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
        })
      )
    );

    writeFileSync(
      '/tmp/perfbench/defer-correctness.txt',
      rows
        .map(
          (r) =>
            `  ${r.label.padEnd(20)}: preview ${r.previewSV.toFixed(0)} vs export ${r.exportSV.toFixed(0)}  diff ${r.diffPct.toFixed(2)}%`
        )
        .join('\n') + '\n'
    );
    for (const r of rows) {
      // >1% solid-volume divergence = preview kept material a cut removed.
      expect(r.diffPct, `${r.label} preview/export volume divergence`).toBeLessThan(1);
    }
  }, 120_000);
});
