// @vitest-environment node
/**
 * Manifold-KERNEL (draft preview) crush-rib magnet holes.
 *
 * The draft kernel has no 2D B-spline of its own: brepjs hands that curve to
 * an OCCT kernel, and the draft worker registers none, so the exact build's
 * interpolated bore throws here. Each case slices the draft mesh through a
 * hole and fits the wall to the rib wave.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mesh } from 'brepjs';
import type { BinParams, ResolvedBaseplateParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { MagnetHoleStyle } from '@/shared/generation/magnetHoleStyle';
import {
  MAGNET_CRUSH_RIB_COUNT,
  magnetBoreProfile,
  magnetBoreSegments,
} from '@/shared/generation/magnetHoleStyle';
import { initManifoldKernel } from './__kernel-tests__/kernelInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import {
  boreMidZ,
  expectChamferedSection,
  expectPlainSection,
  expectRibbedSection,
  holeZSpan,
  sliceAround,
} from './__kernel-tests__/boreSection';
import type { SliceableMesh } from './__kernel-tests__/boreSection';
import { buildMagnetHoleCutter } from './magnetHoleCutter';
import { generateBin } from './binGenerator';
import { generateLid } from './lidOrchestrator';
import { generateBaseplate } from './baseplateGenerator';
import { clearAllCaches } from './shapeCache';

const R = 3.25;
const HEIGHT = 2.4;
const MID_BORE_Z = 1.6;
const MAGNET = 13;
const RIBS: MagnetHoleStyle = { crushRibs: true, chamfer: false };
const TIMEOUT = 60_000;

beforeAll(async () => {
  await initManifoldKernel();
}, 30_000);

function cutterMesh(style: MagnetHoleStyle): SliceableMesh {
  const cutter = buildMagnetHoleCutter({ radius: R, height: HEIGHT, style });
  try {
    const m = mesh(cutter, { tolerance: 0.01, angularTolerance: 0.1 });
    return { vertices: m.vertices, indices: m.triangles };
  } finally {
    cutter.delete();
  }
}

const MOUTH_DEPTH = 0.4;

function holeSection(part: SliceableMesh): ReturnType<typeof sliceAround> {
  return sliceAround(part, MAGNET, MAGNET, boreMidZ(part, MAGNET, MAGNET, R), R + 0.5);
}

/** Slice `MOUTH_DEPTH` inside the hole from the end the magnet enters. */
function mouthSection(part: SliceableMesh, end: 'bottom' | 'top'): ReturnType<typeof sliceAround> {
  const { zMin, zMax } = holeZSpan(part, MAGNET, MAGNET, R);
  const z = end === 'bottom' ? zMin + MOUTH_DEPTH : zMax - MOUTH_DEPTH;
  return sliceAround(part, MAGNET, MAGNET, z, R + 1.1);
}

function magnetBin(overrides: Partial<BinParams['base']>, lid = false): BinParams {
  return buildParams({
    width: 1,
    depth: 1,
    height: 4,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', ...overrides },
    ...(lid
      ? { lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, stackableTop: true, magnetHoles: true } }
      : {}),
  });
}

const plate = (overrides: Partial<ResolvedBaseplateParams>): ResolvedBaseplateParams => ({
  width: 1,
  depth: 1,
  gridUnitMm: 42,
  magnetHoles: true,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  ...overrides,
});

describe('Manifold draft: magnet hole cutter', () => {
  it('a plain bore reads round, so the rib fit has something to reject', () => {
    const points = sliceAround(
      cutterMesh({ crushRibs: false, chamfer: false }),
      0,
      0,
      MID_BORE_Z,
      R + 0.5
    );
    expectPlainSection(points, R, 'plain cutter');
  });

  it('a ribbed bore builds and carries the rib wave', () => {
    const points = sliceAround(cutterMesh(RIBS), 0, 0, MID_BORE_Z, R + 0.5);
    expectRibbedSection(points, R, 'ribbed cutter');
  });

  it('a ribbed bore with a chamfered mouth builds and keeps the wave past the chamfer', () => {
    const points = sliceAround(
      cutterMesh({ crushRibs: true, chamfer: true }),
      0,
      0,
      MID_BORE_Z,
      R + 0.5
    );
    expectRibbedSection(points, R, 'ribbed chamfered cutter');
  });

  it('the bore runs through the same ring points as the procedural draft', () => {
    const { vertices } = cutterMesh(RIBS);
    const ring = magnetBoreProfile(R, RIBS, magnetBoreSegments(RIBS, 32));
    expect(ring.length).toBe(MAGNET_CRUSH_RIB_COUNT * 8);
    for (const [x, y] of ring) {
      let nearest = Infinity;
      for (let i = 0; i < vertices.length; i += 3) {
        nearest = Math.min(nearest, Math.hypot(vertices[i] - x, vertices[i + 1] - y));
      }
      expect(nearest, `ring point (${x.toFixed(3)}, ${y.toFixed(3)})`).toBeLessThan(1e-4);
    }
  });
});

describe('Manifold draft: crush ribs on every part family', () => {
  it(
    'bin socket: ribbed bore, chamfered underside mouth',
    () => {
      clearAllCaches();
      const part = generateBin(
        magnetBin({ magnetCrushRibs: true, magnetChamfer: true }),
        undefined,
        false
      );
      expectRibbedSection(holeSection(part), R, 'bin socket draft');
      expectChamferedSection(mouthSection(part, 'bottom'), R, MOUTH_DEPTH, 'bin socket mouth');
    },
    TIMEOUT
  );

  it(
    'lightweight pad: the ribs reach a plain mouth',
    () => {
      clearAllCaches();
      const part = generateBin(
        magnetBin({ magnetCrushRibs: true, magnetChamfer: true, lightweight: true }),
        undefined,
        false
      );
      expectRibbedSection(holeSection(part), R, 'lightweight draft');
      expectRibbedSection(mouthSection(part, 'bottom'), R, 'lightweight mouth');
    },
    TIMEOUT
  );

  it(
    'stackable lid top: ribbed bore, chamfered mouth on the lid face',
    () => {
      clearAllCaches();
      const lid = generateLid(
        magnetBin({ magnetCrushRibs: true, magnetChamfer: true }, true),
        undefined,
        false
      );
      expect(lid).not.toBeNull();
      if (!lid) return;
      expectRibbedSection(holeSection(lid), R, 'lid draft');
      expectChamferedSection(mouthSection(lid, 'top'), R, MOUTH_DEPTH, 'lid mouth');
    },
    TIMEOUT
  );

  it(
    'baseplate: ribbed bore, chamfered mouth at the pocket floor',
    () => {
      const part = generateBaseplate(
        plate({ magnetCrushRibs: true, magnetChamfer: true }),
        () => {},
        false
      );
      expectRibbedSection(holeSection(part), R, 'baseplate draft');
      expectChamferedSection(mouthSection(part, 'top'), R, MOUTH_DEPTH, 'baseplate mouth');
    },
    TIMEOUT
  );
});
