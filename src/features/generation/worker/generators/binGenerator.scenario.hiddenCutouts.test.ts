// @vitest-environment node
/**
 * Hiding a cutout must actually stop it cutting.
 *
 * The store has always classified `hidden` as geometry-affecting, so every
 * toggle of the eye icon bumps the generation epoch and rebuilds the part — but
 * the cavity loop never read the flag, so the rebuild produced identical
 * geometry and the toggle changed nothing outside the 2D editor. The mesh
 * imprint path, the lid cutout builder and `checkLidCompatibility` all already
 * read it; the bin's BREP shapes were the one consumer that did not.
 *
 * Stated as a DELTA, never against a chosen threshold: a hidden cutout must
 * export the SAME volume as one that was deleted, and a different volume from
 * one that is shown. The tolerance is derived from the cavity being measured,
 * so no number here has to be guessed — if the cut still lands, the gap is the
 * whole cavity rather than a rounding error, three orders of magnitude out.
 *
 * None of this is visible to a bounding-box, triangle-count or watertight
 * assertion: a bin carrying a pocket the user hid is perfectly valid geometry,
 * it is just not the part they asked for.
 *
 * `setLastSolid(null)` before every export is load-bearing, for the same reason
 * `paramDifferential` needs it: `exportBin`'s last-solid cache is param-blind,
 * so without the reset the second run re-exports the first solid and every
 * differential goes vacuously green.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadFont, isErr } from 'brepjs';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { makeCutout } from './__kernel-tests__/scenarioTypes';
import { stlSolidVolume } from './__kernel-tests__/meshAssertions';
import { exportBin } from './binExporter';
import { setLastSolid } from './shapeCache';

/** Solid bin — `dim.solid` is what gates the interior cutout stage. */
const BASE: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 1,
  height: 3,
  style: 'solid',
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
};

/** Export a bin to STL and measure its enclosed solid volume. Forces a fresh solid. */
async function exportVolume(cutouts: readonly Cutout[]): Promise<number> {
  setLastSolid(null); // defeat the param-blind last-solid cache — see file header
  const result = await exportBin({ ...BASE, cutouts: [...cutouts] }, 'stl');
  const parsed = parseSTLBinary(result.data);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  return stlSolidVolume(parsed.value.vertices);
}

/**
 * Assert two exports describe the same solid.
 *
 * `tolerance` is always DERIVED from the quantity under test, never picked: a
 * feature that survived hiding differs by its whole contribution, so any bound
 * an order of magnitude or two below that separates "the same solid,
 * retessellated" from "the filter never reached the geometry". Each call site
 * says which contribution it measured and how it measured it.
 */
function expectSameSolid(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
}

beforeAll(async () => {
  await initBrepjs();
  // Without the font, `buildTextSolid` returns null and the engraved-label case
  // below measures nothing while still going green — the same trap
  // `textEngraving.scenario` documents for its stencil font.
  const buffer = readFileSync(
    resolve(__dirname, '../assets/fonts/AtkinsonHyperlegible-Regular.ttf')
  );
  const loaded = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(loaded)) throw new Error(`Font load failed: ${loaded.error.message}`);
}, 60_000);

describe('hidden cutouts are absent from the generated bin', () => {
  it('a hidden cutout exports the same solid as one that was deleted', async () => {
    const cutout = makeCutout({ id: 'plain', x: 12, y: 10, width: 20, depth: 20 });

    const absent = await exportVolume([]);
    const shown = await exportVolume([cutout]);
    const hidden = await exportVolume([{ ...cutout, hidden: true }]);

    // The control: without this the delta below is satisfied by a cutout that
    // never cut in the first place, and the test passes for the wrong reason.
    const cavity = absent - shown;
    expect(cavity).toBeGreaterThan(500);

    expectSameSolid(hidden, absent, cavity / 1000);
  }, 120_000);

  it('hiding a group member drops it from the boolean', async () => {
    // A minus B: the cavity is A with a bite taken out of its right half. Hiding
    // B removes the subtrahend, so the cavity becomes the whole of A — hiding a
    // shape here makes the bin cut MORE, which is the point. A member that kept
    // subtracting while hidden would leave the bite in place.
    const a = makeCutout({
      id: 'a',
      groupId: 'g',
      groupOp: 'subtract',
      x: 10,
      y: 8,
      width: 24,
      depth: 24,
    });
    const b = makeCutout({
      id: 'b',
      groupId: 'g',
      groupOp: 'subtract',
      x: 22,
      y: 8,
      width: 12,
      depth: 24,
    });

    const onlyA = await exportVolume([a]);
    const both = await exportVolume([a, b]);
    const hiddenB = await exportVolume([a, { ...b, hidden: true }]);

    // B's bite is material the group leaves behind, so subtracting it must give
    // back volume relative to cutting all of A.
    const bite = both - onlyA;
    expect(bite).toBeGreaterThan(500);

    expectSameSolid(hiddenB, onlyA, bite / 1000);
  }, 120_000);

  it('a hidden cutout takes its engraved label with it', async () => {
    // The label loop carried a `hidden` guard of its own, which the upstream
    // filter made dead. Measured against the ENGRAVING rather than the cavity:
    // bounding this by the cavity would pass on a leaked label, since the label
    // is three orders of magnitude smaller than the pocket it sits in.
    const plain = makeCutout({ id: 'labelled', x: 12, y: 10, width: 24, depth: 20 });
    const labelled: Cutout = { ...plain, label: 'HIDE', engraveLabel: true };

    const absent = await exportVolume([]);
    const withoutLabel = await exportVolume([plain]);
    const withLabel = await exportVolume([labelled]);
    const hidden = await exportVolume([{ ...labelled, hidden: true }]);

    // The engraving is the only difference between these two exports, so it is
    // the quantity the assertion below has to be able to resolve.
    const engraving = withoutLabel - withLabel;
    expect(engraving).toBeGreaterThan(1);

    expectSameSolid(hidden, absent, engraving / 10);
  }, 120_000);
});
