// @vitest-environment node
/**
 * Dimensional guard for the tray bin's mating skirt (#3036).
 *
 * The scenario suite proves the solid is non-degenerate; this proves it is the
 * RIGHT solid. Three things could each pass a structural check while being
 * wrong: the skirt could fail to fuse (leaving two solids), the assembly could
 * be left hanging below Z=0, or the skirt could be built at a footprint that
 * does not match the body — which would show up as an unwatertight seam rather
 * than an obvious fault.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_TRAY_BOTTOM } from '@/shared/types/bin';
import type { BinParams, LidAttachment } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin, type GenerateBinFn } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import {
  assertNoDegenerateTriangles,
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
} from './__kernel-tests__/meshAssertions';

let generateBin: GenerateBinFn;

beforeAll(async () => {
  await initBrepjs();
  generateBin = getGenerateBin();
}, 30_000);

function trayParams(attachment: LidAttachment, extraHeightMm = 0): BinParams {
  return buildParams({
    width: 2,
    depth: 2,
    height: 3,
    base: {
      ...buildParams({}).base,
      style: 'lid',
      trayBottom: { ...DEFAULT_TRAY_BOTTOM, attachment, extraHeightMm },
    },
  });
}

describe('tray bin mating skirt', () => {
  it('sits on Z=0 — the skirt is lifted, not left hanging below the bed', () => {
    const mesh = generateBin(trayParams('clickRails'));
    assertStructurallyValid(mesh);
    const box = boundingBox(mesh.vertices);
    // Every downstream stage and the exporter assume Z=0 is the absolute
    // bottom; a missed lift would put the skirt underneath the print bed.
    expect(box.minZ).toBeCloseTo(0, 3);
  });

  it('sits on Z=0 with a magnetic joint, whose bosses reach past the skirt', () => {
    const mesh = generateBin(trayParams('magnetic'));
    assertStructurallyValid(mesh);
    const box = boundingBox(mesh.vertices);
    // Retention bosses hang below `wallBottomZ` so the pads they mate with can
    // pass under the skirt (#3450), exactly as click rails do. A lift computed
    // from the wall alone buries them 0.2mm under the bed — small enough that
    // every structural assertion still passes.
    expect(box.minZ).toBeCloseTo(0, 3);
  });

  it('is taller than the bin body by the skirt depth', () => {
    const mesh = generateBin(trayParams('clickRails'));
    const box = boundingBox(mesh.vertices);
    const bodyHeight = 3 * 7;
    // A skirt that failed to fuse would leave the body height untouched.
    expect(box.maxZ - box.minZ).toBeGreaterThan(bodyHeight);
  });

  it('grows by roughly the extra height when clearance is asked for', () => {
    const flush = boundingBox(generateBin(trayParams('clickRails')).vertices);
    const raised = boundingBox(generateBin(trayParams('clickRails', 12)).vertices);
    const flushHeight = flush.maxZ - flush.minZ;
    const raisedHeight = raised.maxZ - raised.minZ;
    // This is the reporter's actual need: clear contents protruding from the
    // bin below. Tolerance is loose because the cavity also absorbs plate
    // growth; the point is that the knob moves the skirt, not the body.
    expect(raisedHeight - flushHeight).toBeGreaterThan(11);
    expect(raisedHeight - flushHeight).toBeLessThan(13);
  });

  it('keeps the body footprint — the skirt does not overhang it', () => {
    const mesh = generateBin(trayParams('clickRails'));
    const box = boundingBox(mesh.vertices);
    // Body outer is `w * 42 - CLEARANCE` and the skirt is
    // `w * 42 - 2 * LID_FIT_CLEARANCE`. Both are 83.5mm, which is what lets
    // the two fuse flush; a drift in either constant shows up here.
    expect(box.maxX - box.minX).toBeCloseTo(2 * 42 - 0.5, 1);
    expect(box.maxY - box.minY).toBeCloseTo(2 * 42 - 0.5, 1);
  });

  it.each<LidAttachment>(['clickRails', 'friction', 'magnetic'])(
    'fuses into one watertight solid with %s retention',
    (attachment) => {
      const mesh = generateBin(trayParams(attachment));
      // The real proof the footprints agree: a mismatched skirt would leave a
      // seam of boundary edges rather than a clean union.
      assertWatertight(mesh, attachment);
      assertNoDegenerateTriangles(mesh, attachment);
    }
  );
});
