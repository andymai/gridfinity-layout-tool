/**
 * Magnetic lid + asymmetric overhang (issue #3048).
 *
 * Overhang grows and shifts the bin's outer body, its stacking lip, and the
 * lid that wraps them. The retention magnets hug that lip, so they have to
 * move with it. They used to stay on the nominal footprint, which left them
 * `overhang`mm inboard of the corner on the overhung side.
 *
 * Both parts are built here from the reporter's configuration (1.5 x 4.5 bin,
 * 9mm of left-only overhang) so the bin pad and the lid boss are asserted to
 * land on the same XY — the mating invariant the whole feature rests on.
 *
 *   pnpm exec vitest run src/features/generation/worker/generators/lidGenerator.scenario.overhangMagnets
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { retentionBossRadius, retentionMagnetInset } from './retentionMagnetGeometry';
import { LID_MAGNET_LIP_CLEARANCE } from './lidConstants';
import type { BinParams } from '@/features/bin-designer/types';

const OVERHANG_MM = 9;
const MAGNET_DIAMETER = 6;

function makeParams(overhang: Partial<BinParams['overhang']> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 1.5,
    depth: 4.5,
    height: 9,
    overhang: {
      ...DEFAULT_BIN_PARAMS.overhang,
      enabled: true,
      left: 0,
      right: 0,
      front: 0,
      back: 0,
      ...overhang,
    },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'magnetic',
      retentionMagnet: {
        ...DEFAULT_BIN_PARAMS.lid.retentionMagnet,
        diameter: MAGNET_DIAMETER,
        depth: 2,
        edgeMagnets: 0,
      },
    },
  };
}

describe('magnetic lid with asymmetric overhang (#3048)', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it('builds a structurally valid lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({ left: OVERHANG_MM }));
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '1.5x4.5 magnetic lid, 9mm left overhang');
  });

  it('grows the lid leftward by the overhang', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const nominal = generateLid(makeParams());
    const overhung = generateLid(makeParams({ left: OVERHANG_MM }));
    expect(nominal).not.toBeNull();
    expect(overhung).not.toBeNull();

    const a = boundingBox(nominal!.vertices);
    const b = boundingBox(overhung!.vertices);
    // All the growth is on -X; the +X edge is untouched.
    expect(b.minX).toBeCloseTo(a.minX - OVERHANG_MM, 1);
    expect(b.maxX).toBeCloseTo(a.maxX, 1);
  });

  it('keeps both magnets the designed distance inboard of the lip', async () => {
    const { resolveLidInputs } = await import('./lidInputs');
    const { retentionMagnetPositions } = await import('./retentionMagnetGeometry');
    const params = makeParams({ left: OVERHANG_MM });
    const inputs = resolveLidInputs(params);
    const bossRadius = retentionBossRadius(MAGNET_DIAMETER);

    const positions = retentionMagnetPositions(
      params.width,
      params.depth,
      params.gridUnitMm,
      params.gridUnitMm,
      retentionMagnetInset(MAGNET_DIAMETER),
      0,
      bossRadius,
      {
        addW: inputs.overhangAddW,
        addD: inputs.overhangAddD,
        offsetX: inputs.outerOffsetX,
        offsetY: inputs.outerOffsetY,
      }
    );

    // The lip runs along the expanded, shifted footprint.
    const halfW = (params.width * params.gridUnitMm + OVERHANG_MM) / 2;
    const lipLeft = inputs.outerOffsetX - halfW;
    const lipRight = inputs.outerOffsetX + halfW;
    const xs = positions.map((p) => p.x);

    expect(Math.min(...xs) - bossRadius - lipLeft).toBeCloseTo(LID_MAGNET_LIP_CLEARANCE, 6);
    expect(lipRight - (Math.max(...xs) + bossRadius)).toBeCloseTo(LID_MAGNET_LIP_CLEARANCE, 6);
  });

  it('builds the bosses on the shifted corners, leaving the nominal ones empty', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const overhung = generateLid(makeParams({ left: OVERHANG_MM }));
    expect(overhung).not.toBeNull();

    const bossRadius = retentionBossRadius(MAGNET_DIAMETER);
    // A bounding box can't see the bosses (the outer slab dominates) and
    // neither can a Z-plane scan (the lid walls hang lower). Count mesh
    // vertices inside each candidate boss footprint instead.
    const verticesNear = (cx: number, cy: number): number => {
      let n = 0;
      for (let i = 0; i < overhung!.vertices.length; i += 3) {
        const dx = overhung!.vertices[i] - cx;
        const dy = overhung!.vertices[i + 1] - cy;
        if (Math.hypot(dx, dy) <= bossRadius + 0.5) n++;
      }
      return n;
    };

    const { resolveLidInputs } = await import('./lidInputs');
    const { retentionMagnetPositions } = await import('./retentionMagnetGeometry');
    const params = makeParams({ left: OVERHANG_MM });
    const inputs = resolveLidInputs(params);
    const inset = retentionMagnetInset(MAGNET_DIAMETER);
    const expected = retentionMagnetPositions(
      params.width,
      params.depth,
      params.gridUnitMm,
      params.gridUnitMm,
      inset,
      0,
      bossRadius,
      {
        addW: inputs.overhangAddW,
        addD: inputs.overhangAddD,
        offsetX: inputs.outerOffsetX,
        offsetY: inputs.outerOffsetY,
      }
    );

    for (const { x, y } of expected) {
      expect(verticesNear(x, y)).toBeGreaterThan(0);
    }

    // The pre-fix left-hand position — 9mm inboard of the overhung corner —
    // must now be bare cavity.
    const nominalLeftX = -((params.width * params.gridUnitMm) / 2 - inset);
    const nominalLeftY = -((params.depth * params.gridUnitMm) / 2 - inset);
    expect(verticesNear(nominalLeftX, nominalLeftY)).toBe(0);
  });

  it('leaves the un-overhung lid geometry unchanged', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const off = generateLid({ ...makeParams(), overhang: makeParams().overhang });
    const zeroed = generateLid(makeParams({ enabled: false }));
    expect(off).not.toBeNull();
    expect(zeroed).not.toBeNull();
    expect(zeroed?.triangleCount).toBe(off?.triangleCount);
  });

  it('builds a valid bin whose retention pads survive the overhang', async () => {
    const { generateBin } = await import('./binGenerator');
    const result = generateBin(makeParams({ left: OVERHANG_MM }));
    expect(result).not.toBeNull();
    assertStructurallyValid(result, '1.5x4.5 magnetic bin, 9mm left overhang');
  });
});
