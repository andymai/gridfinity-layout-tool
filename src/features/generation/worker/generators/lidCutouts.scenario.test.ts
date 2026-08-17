/**
 * Lid cutouts: does the hole actually open, and does the lid still hold?
 *
 * Both questions need a probe rather than an assertion on the mesh's summary.
 * A lid whose cutout silently failed to cut is watertight, correctly sized, and
 * has a plausible triangle count — every structural check passes on a lid with no
 * hole in it. So the hole is verified by shooting a ray down its footprint and
 * requiring the plate NOT to be solid there, against a control ray beside it that
 * requires the plate IS.
 *
 * The retention side is the mirror-image trap. A hole over a magnet boss opens
 * that boss's pocket, and the result is still one watertight solid — it just
 * stops holding the bin. That is checked as a DELTA: the boss band must be
 * bit-identical to the same lid with no cutouts, so "the clip protected it" is
 * distinguishable from "the clip removed it too".
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidCutouts.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  meshVolume,
  verticalSolidSpans,
} from './__kernel-tests__/meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resolveLidPlateThickness } from '@/shared/types/bin';
import { lidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import type { BinParams, Cutout, LidConfig } from '@/features/bin-designer/types';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

function makeParams(lid: Partial<LidConfig>, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...extra,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, relieveInterior: false, ...lid },
  };
}

/**
 * Solid material (mm) a vertical ray at `(x, y)` passes through inside the
 * plate's own Z band.
 *
 * A MEASUREMENT, deliberately, not a boolean. `isSolidThrough` over the same band
 * reports "not solid" for a plate that is 88% intact — a hole 0.1mm deep leaves a
 * span that simply fails to reach the upper bound — so the first version of this
 * suite passed against cutouts that were scratches. Comparing the length against
 * the unholed lid is what distinguishes "the hole opened" from "something was
 * removed somewhere".
 */
function plateSolidMm(
  mesh: MeshData,
  x: number,
  y: number,
  topZ: number,
  thickness: number
): number {
  const lo = topZ - thickness;
  let sum = 0;
  for (const [from, to] of verticalSolidSpans(mesh, x, y)) {
    sum += Math.max(0, Math.min(to, topZ) - Math.max(from, lo));
  }
  return sum;
}

/** A rectangular hole, sized and placed in the window frame. */
function rect(x: number, y: number, width: number, depth: number, id = 'c1'): Cutout {
  return {
    id,
    shape: 'rectangle',
    x,
    y,
    width,
    depth,
    // Deliberately a value the host must override: a lid cutout always goes
    // through, so a 0.2mm request here must still produce a hole.
    cutDepth: 0.2,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}

describe('lid cutouts', () => {
  it('opens a hole clean through the plate', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const base = makeParams({}, { width: 2, depth: 2, height: 3 });
    const window = lidCutoutWindow({ ...base, lid: { ...base.lid, cutouts: [rect(0, 0, 1, 1)] } });
    expect(window).not.toBeNull();

    // A 20x10 slot centred in the window — a bag-dispenser opening.
    const w = 20;
    const d = 10;
    const slot = rect((window!.spanW - w) / 2, (window!.spanD - d) / 2, w, d);
    const params = makeParams({ cutouts: [slot] }, { width: 2, depth: 2, height: 3 });

    const result = generateLid(params, undefined, true);
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '2x2 lid with slot');
    assertWatertight(result!, '2x2 lid with slot');

    // The plate spans [-plate, 0] in lid-local Z.
    const plate = resolveLidPlateThickness(params);

    // Inside the slot: no plate material at all. The window frame's origin is the
    // window's front-left corner, and the window's centre sits at its own offset
    // in model space, so rebase the slot's centre onto that.
    const cx = slot.x + w / 2 - window!.spanW / 2 + window!.offsetX;
    const cy = slot.y + d / 2 - window!.spanD / 2 + window!.offsetY;
    expect(plateSolidMm(result!, cx, cy, 0, plate)).toBeLessThan(0.01);

    // Control, 2mm outside the slot's long edge: the FULL plate is still there.
    // Without this the assertion above passes on a lid that never built a plate,
    // and asserting the full thickness rather than "some" is what fails a cut
    // that only scratched the surface.
    const outsideY = cy + d / 2 + 2;
    expect(plateSolidMm(result!, cx, outsideY, 0, plate)).toBeCloseTo(plate, 2);
  }, 120_000);

  it('removes material — the hole is not a no-op the volume cannot see', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const dims = { width: 2, depth: 2, height: 3 };
    const plain = generateLid(makeParams({}, dims), undefined, true);
    const holed = generateLid(
      makeParams({ cutouts: [rect(10, 10, 20, 10)] }, dims),
      undefined,
      true
    );
    expect(plain).not.toBeNull();
    expect(holed).not.toBeNull();

    const removed = meshVolume(plain!) - meshVolume(holed!);
    const plate = resolveLidPlateThickness(makeParams({}, dims));
    // A 20x10 through-cut removes 200mm^2 of plate. Allow generous slack for the
    // tessellation, but require most of the nominal prism: a fraction of it would
    // mean the cut was clamped to some other depth.
    expect(removed).toBeGreaterThan(20 * 10 * plate * 0.8);
  }, 120_000);

  it('leaves a magnetic lid its retention bosses', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const dims = { width: 2, depth: 2, height: 3 };
    const magnetic: Partial<LidConfig> = { attachment: 'magnetic' };

    const plain = generateLid(makeParams(magnetic, dims), undefined, true);
    expect(plain).not.toBeNull();
    const window = lidCutoutWindow(makeParams({ ...magnetic, cutouts: [rect(0, 0, 1, 1)] }, dims));
    expect(window).not.toBeNull();
    expect(window!.keepouts.length).toBeGreaterThan(0);

    // A hole spanning the WHOLE window, which without the clip would swallow
    // every boss. The bosses must survive it.
    const greedy = rect(0, 0, window!.spanW, window!.spanD);
    const holed = generateLid(
      makeParams({ ...magnetic, cutouts: [greedy] }, dims),
      undefined,
      true
    );
    expect(holed).not.toBeNull();
    assertWatertight(holed!, 'magnetic lid with greedy hole');

    // Stated as a DELTA against the unholed lid rather than as an absolute: the
    // question is whether the clip protected the boss, and only the pair can tell
    // that apart from a boss that was thin there to begin with.
    const originX = window!.offsetX - window!.spanW / 2;
    const originY = window!.offsetY - window!.spanD / 2;
    const plate = resolveLidPlateThickness(makeParams(magnetic, dims));
    for (const k of window!.keepouts) {
      const x = k.x + originX;
      const y = k.y + originY;
      const before = plateSolidMm(plain!, x, y, 0, plate);
      expect(before).toBeGreaterThan(0.1);
      expect(plateSolidMm(holed!, x, y, 0, plate)).toBeCloseTo(before, 2);
    }

    // ...and the hole itself still opened, at the window's centre, well clear of
    // every boss. Otherwise the assertion above is satisfied by a clip that threw
    // the whole tool away.
    expect(plateSolidMm(holed!, window!.offsetX, window!.offsetY, 0, plate)).toBeLessThan(0.01);
  }, 180_000);

  it('cuts nothing when a gate refuses the lid a flat top', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const dims = { width: 2, depth: 2, height: 3 };
    const cutouts = [rect(10, 10, 20, 10)];
    // A FULL stack grid owns the top face, exactly as it does for lid text.
    const stacked = { stackableTop: true, stackLipOnly: false };
    const withHole = generateLid(makeParams({ ...stacked, cutouts }, dims), undefined, true);
    const without = generateLid(makeParams(stacked, dims), undefined, true);
    expect(withHole).not.toBeNull();
    expect(without).not.toBeNull();
    // Identical volume: the gate refused, so the shapes are inert data.
    expect(meshVolume(withHole!)).toBeCloseTo(meshVolume(without!), 3);
  }, 180_000);
});
