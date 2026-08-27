// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import {
  assertKernelReturnedGeometry,
  boundingBox,
  columnCrossings,
} from './__kernel-tests__/meshAssertions';
import type { MeshData } from '../../bridge/types';
import type { BinParams } from '@/shared/types/bin';
import { KNIFE_REST_HANDLE_DROP_MM } from '@/shared/types/bin';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import { knifeBlock } from './scenarios/knifeBlock';
import { generateKnifeRest } from './knifeRestBuilder';

function columnTopZ(mesh: MeshData, x: number, y: number): number {
  const crossings = columnCrossings(mesh, x, y);
  return crossings.length > 0 ? crossings[crossings.length - 1] : Number.NEGATIVE_INFINITY;
}

/** The open-ended chef block scenario, with a companion rest enabled. */
function chefBlockWithRest(): BinParams {
  return buildParams({
    ...knifeBlock[1].params,
    knifeRest: { enabled: true },
  });
}

describe('knife rest companion', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it('mates with the block: saddle sits one handle-diameter (plus drop) below the fill top', () => {
    const params = chefBlockWithRest();
    const rest = generateKnifeRest(params);
    expect(rest).not.toBeNull();
    if (!rest) return;
    assertKernelReturnedGeometry(rest, 'companion rest');

    const block = getGenerateBin()(params, undefined, undefined);
    // Fill top measured over solid fill away from the slot; saddle measured at
    // the groove centreline. Both come off real meshes — the only stated claim
    // is the physical relationship a level-lying knife needs.
    const fillTop = columnTopZ(block, 0, 10);
    const plan = planKnifeRest(params);
    expect(plan).not.toBeNull();
    if (!plan) return;
    const saddle = columnTopZ(rest, 0, plan.grooves[0].centre);
    const knife = params.cutouts[0].knife;
    expect(knife).toBeDefined();
    if (!knife) return;
    expect(fillTop - saddle).toBeCloseTo(knife.handleHeightMm + KNIFE_REST_HANDLE_DROP_MM, 1);
  }, 120_000);

  it('is a unit-height Gridfinity part with the planned footprint', () => {
    const params = chefBlockWithRest();
    const plan = planKnifeRest(params);
    const rest = generateKnifeRest(params);
    expect(plan).not.toBeNull();
    expect(rest).not.toBeNull();
    if (!plan || !rest) return;
    const bb = boundingBox(rest.vertices);
    // 1u along the knife, matching the block's 1u across; top on a whole unit.
    expect(bb.maxX - bb.minX).toBeCloseTo(plan.alongU * params.gridUnitMm - 0.5, 1);
    expect(bb.maxY - bb.minY).toBeCloseTo(plan.crossU * params.gridUnitMm - 0.5, 1);
    expect(bb.maxZ).toBeCloseTo(plan.heightUnits * params.heightUnitMm, 1);
    expect(bb.minZ).toBeCloseTo(0, 5);
    // Beside the groove the top face is the full body height.
    expect(
      columnTopZ(rest, 0, plan.grooves[0].centre + plan.grooves[0].widthMm / 2 + 3)
    ).toBeCloseTo(bb.maxZ, 1);
  }, 120_000);

  it('returns null without an enabled rest or without any open-ended slot', () => {
    expect(generateKnifeRest(buildParams(knifeBlock[1].params))).toBeNull();
    expect(
      generateKnifeRest(buildParams({ ...knifeBlock[0].params, knifeRest: { enabled: true } }))
    ).toBeNull();
  }, 120_000);
});
