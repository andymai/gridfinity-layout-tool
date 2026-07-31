// @vitest-environment node
/**
 * Outer-wall taper on solid (cutout) bins — #3033.
 *
 * The taper used to be stripped for solid bins, so a tool holder could never
 * be drawer-fit. Enabling it exposes a geometry problem the hollow path never
 * had: `OverhangConfig` is stored rim-anchored, so a pocket flush with the
 * interior edge has only `wallThickness - flare` of material left at the floor
 * — negative for any flare wider than the wall. Cutout tools are therefore
 * clipped to a lofted inner envelope that holds `wallThickness` at every
 * height, rather than to the rim-sized prism.
 *
 * NOTE on what these assert. For a HOLLOW bin a breach shows up in the Euler
 * characteristic (cavity and outside join into a passage). A solid bin's pocket
 * is open at the top already, so a side breach just turns it into a notch —
 * still genus 0, still watertight, still structurally valid. No topology signal
 * discriminates. The decisive check is to sample the solid itself: a point half
 * a wall inside the tapered face, at the floor, must be plastic.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams, makeCutout } from './__kernel-tests__/scenarioTypes';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { SOCKET_HEIGHT } from './generatorConstants';
import type { MeshData } from '@/features/generation/bridge/types';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const FLARE = 10;
const WALL = DEFAULT_BIN_PARAMS.wallThickness;
const OVH = { left: FLARE, right: FLARE, front: FLARE, back: FLARE };
const SOLID = { ...DEFAULT_BIN_PARAMS.base, solid: true };

const taperOf = (
  profile: 'chamfer' | 'fillet'
): NonNullable<typeof DEFAULT_BIN_PARAMS.overhang> => ({
  ...OVH,
  taper: { profile, bandHeight: 20, left: FLARE, right: FLARE, front: FLARE, back: FLARE },
});

/**
 * A pocket flush with the interior's left edge, cut deep enough to reach the
 * floor. `x: 0` is the interior edge, and `cutDepth` clamps to the fill
 * surface — so this is the worst case for the wall the taper is thinning.
 */
const EDGE_POCKET = makeCutout({
  shape: 'rectangle',
  x: 0,
  y: 10,
  width: 25,
  depth: 25,
  cutDepth: 60,
});

function solidBin(overrides: Partial<Parameters<typeof buildParams>[0]> = {}): MeshData {
  return getGenerateBin()(
    buildParams({ width: 2, depth: 2, height: 6, style: 'solid', base: SOLID, ...overrides }),
    undefined,
    true
  );
}

/**
 * Is `point` inside the closed mesh? Parity of a +X ray's crossings.
 *
 * Reading the wall off vertex positions does not work here: the kernel
 * tessellates a planar face as a fan over its boundary, so the middle of the
 * outer wall carries no vertex at all, and the rounded corners contribute arc
 * points fractions of a mm apart that read as a phantom second face. Sampling
 * the solid itself sidesteps both.
 */
function isInside(mesh: MeshData, point: [number, number, number]): boolean {
  const { vertices, indices } = mesh;
  const [px, py, pz] = point;
  let crossings = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    // Möller–Trumbore against the +X ray, specialised to direction (1,0,0).
    const e1y = vertices[b + 1] - vertices[a + 1];
    const e1z = vertices[b + 2] - vertices[a + 2];
    const e2y = vertices[c + 1] - vertices[a + 1];
    const e2z = vertices[c + 2] - vertices[a + 2];
    // det = dir · (e1 × e2), with dir = +X
    const det = e1y * e2z - e1z * e2y;
    if (Math.abs(det) < 1e-12) continue;
    const invDet = 1 / det;
    const ty = py - vertices[a + 1];
    const tz = pz - vertices[a + 2];
    const u = (ty * e2z - tz * e2y) * invDet;
    if (u < 0 || u > 1) continue;
    const v = (e1y * tz - e1z * ty) * invDet;
    if (v < 0 || u + v > 1) continue;
    const tHit =
      vertices[a] - px + u * (vertices[b] - vertices[a]) + v * (vertices[c] - vertices[a]);
    if (tHit > 1e-9) crossings++;
  }
  return crossings % 2 === 1;
}

/** Rim half-width of the 2×2 test bin, including the flare. */
const RIM_HALF_W = (2 * DEFAULT_BIN_PARAMS.gridUnitMm - 0.5) / 2 + FLARE;
/** Outer face on the -X side at the box floor, where the flare is fully retracted. */
const FLOOR_FACE_X = -(RIM_HALF_W - FLARE);

/**
 * A point that must be solid plastic: half a wall thickness inside the tapered
 * outer face, at the pocket's mid-span, a hair above the box floor.
 *
 * Unclipped, the pocket's face lands at the RIM interior edge — a full flare
 * further out than the wall exists down here — so this point falls inside the
 * pocket and the test reads "outside the solid". That is the breach, and it is
 * invisible to watertightness, Euler characteristic, and validity alike.
 */
const WALL_PROBE: [number, number, number] = [FLOOR_FACE_X + WALL / 2, -28, SOCKET_HEIGHT + 0.01];

describe('solid bin outer-wall taper (#3033)', () => {
  it('tapers a plain solid bin: rim held, base pulled in, material removed', () => {
    const flat = solidBin({ overhang: OVH });
    const tapered = solidBin({ overhang: taperOf('chamfer') });
    assertStructurallyValid(tapered, 'solid chamfer taper');
    assertWatertight(tapered, 'solid chamfer taper');

    const flatBB = boundingBox(flat.vertices);
    const tapBB = boundingBox(tapered.vertices);
    // The rim is full-size, so the outer envelope is unchanged...
    expect(tapBB.maxX - tapBB.minX).toBeCloseTo(flatBB.maxX - flatBB.minX, 1);
    expect(tapBB.maxY - tapBB.minY).toBeCloseTo(flatBB.maxY - flatBB.minY, 1);
    expect(tapBB.maxZ - tapBB.minZ).toBeCloseTo(flatBB.maxZ - flatBB.minZ, 1);
    // ...while the band carves a wedge out of the base.
    expect(meshVolume(tapered)).toBeLessThan(meshVolume(flat));
  });

  it('keeps a full wall between an edge pocket and the tapered face', () => {
    const tapered = solidBin({ overhang: taperOf('chamfer'), cutouts: [EDGE_POCKET] });
    assertStructurallyValid(tapered, 'tapered solid bin with an edge pocket');
    assertWatertight(tapered, 'tapered solid bin with an edge pocket');

    // Sanity: the probe really does sit inside the retracted footprint — the
    // rim reaches a full flare further out than the floor does.
    expect(boundingBox(tapered.vertices).minX).toBeCloseTo(FLOOR_FACE_X - FLARE, 0);

    expect(isInside(tapered, WALL_PROBE)).toBe(true);
  });

  it('clips the pocket rather than the whole bin: less removed than on a flat wall', () => {
    const flatNoCut = solidBin({ overhang: OVH });
    const flatCut = solidBin({ overhang: OVH, cutouts: [EDGE_POCKET] });
    const tapNoCut = solidBin({ overhang: taperOf('chamfer') });
    const tapCut = solidBin({ overhang: taperOf('chamfer'), cutouts: [EDGE_POCKET] });

    // The pocket must actually cut on both bins...
    expect(meshVolume(flatCut)).toBeLessThan(meshVolume(flatNoCut));
    expect(meshVolume(tapCut)).toBeLessThan(meshVolume(tapNoCut));
    // ...but the tapered bin's clip trims it, so it removes strictly less.
    expect(meshVolume(tapNoCut) - meshVolume(tapCut)).toBeLessThan(
      meshVolume(flatNoCut) - meshVolume(flatCut)
    );
  });

  it('holds the wall for a fillet band too (concave chord bulges outward)', () => {
    const tapered = solidBin({ overhang: taperOf('fillet'), cutouts: [EDGE_POCKET] });
    assertStructurallyValid(tapered, 'fillet taper + edge pocket');
    assertWatertight(tapered, 'fillet taper + edge pocket');

    expect(isInside(tapered, WALL_PROBE)).toBe(true);
  });

  it('builds the recessed-fill body as one solid (cutoutTopOffset > 0)', () => {
    const recessed = solidBin({
      overhang: taperOf('chamfer'),
      cutoutConfig: { topOffset: 6 },
      cutouts: [EDGE_POCKET],
    });
    assertStructurallyValid(recessed, 'tapered solid bin with a lowered fill surface');
    assertWatertight(recessed, 'tapered solid bin with a lowered fill surface');

    // The recess is a tray cut out of the lofted outer, so it removes material
    // the flush-topped bin keeps. (Comparing the two WITH pockets would not say
    // anything: a lowered fill surface also shortens the pocket under it.)
    const recessedNoCut = solidBin({
      overhang: taperOf('chamfer'),
      cutoutConfig: { topOffset: 6 },
    });
    const flushNoCut = solidBin({ overhang: taperOf('chamfer') });
    expect(meshVolume(recessedNoCut)).toBeLessThan(meshVolume(flushNoCut));

    expect(isInside(recessed, WALL_PROBE)).toBe(true);
  });

  it('is a no-op without overhang: the clamp keeps the base at nominal', () => {
    const plain = solidBin({ cutouts: [EDGE_POCKET] });
    const tapered = solidBin({
      overhang: {
        left: 0,
        right: 0,
        front: 0,
        back: 0,
        taper: { profile: 'chamfer', bandHeight: 20, left: 10, right: 10, front: 10, back: 10 },
      },
      cutouts: [EDGE_POCKET],
    });
    expect(meshVolume(tapered)).toBeCloseTo(meshVolume(plain), 0);
  });
});
