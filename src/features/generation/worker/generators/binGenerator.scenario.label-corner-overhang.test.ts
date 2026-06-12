// @vitest-environment node
/**
 * Regression: a label tab must not poke past the bin's rounded outer corner.
 *
 * The shelf is an axis-aligned rectangle anchored to the nominal flat
 * inner-wall planes, so a full-width tab's square corner sits outside the
 * rounded wall whenever `wt < BOX_CORNER_RADIUS·(1 − 1/√2) ≈ 1.10mm` — i.e.
 * for the 0.4 / 0.6 / 0.8mm wall-thickness presets. Most visible on small
 * bins, where the tab reaches both corners (Reddit report).
 * `clipToOuterFootprint` trims the slivers flush with the wall.
 *
 * Footprint is taken from the NO-label bin (the with-label bbox would be
 * inflated by the overhang itself); a self-baseline over the no-label mesh
 * absorbs corner-radius/tessellation noise so the delta isolates the tab.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const R = GRIDFINITY.BOX_CORNER_RADIUS; // outer corner radius (mm)

interface Footprint {
  cx: number;
  cy: number;
  halfW: number;
  halfD: number;
}

/** Signed distance OUTSIDE the rounded-rect footprint (>0 means poking out). */
function outsideRoundedRect(x: number, y: number, fp: Footprint): number {
  const dx = Math.abs(x - fp.cx) - (fp.halfW - R);
  const dy = Math.abs(y - fp.cy) - (fp.halfD - R);
  const corner = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - R;
  const edge = Math.min(Math.max(dx, dy), 0);
  return corner + edge;
}

function footprintOf(vertices: Float32Array): Footprint {
  const bb = boundingBox(vertices);
  return {
    cx: (bb.minX + bb.maxX) / 2,
    cy: (bb.minY + bb.maxY) / 2,
    halfW: (bb.maxX - bb.minX) / 2,
    halfD: (bb.maxY - bb.minY) / 2,
  };
}

function maxOutside(vertices: Float32Array, fp: Footprint): number {
  let m = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const d = outsideRoundedRect(vertices[i], vertices[i + 1], fp);
    if (d > m) m = d;
  }
  return m;
}

describe('label tab corner overhang', () => {
  it('thin-wall 1×1 tab stays within the rounded outer corner', () => {
    // 0.8mm wall (a UI preset) is below the ~1.10mm overhang threshold; the
    // unclipped tab pokes ~0.42mm past the corner.
    const base: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 3,
      wallThickness: 0.8,
    };
    const noLabel = getGenerateBin()({ ...base, label: { ...base.label, enabled: false } });
    const withLabel = getGenerateBin()({ ...base, label: { ...base.label, enabled: true } });

    // Guard against a vacuous pass: the tab must actually be generated.
    expect(withLabel.triangleCount).toBeGreaterThan(noLabel.triangleCount);

    const fp = footprintOf(noLabel.vertices);
    const overhang = maxOutside(withLabel.vertices, fp) - maxOutside(noLabel.vertices, fp);
    expect(overhang).toBeLessThan(0.05);
  });
});
