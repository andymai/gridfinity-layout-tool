/**
 * Generation across the designer's whole grid-pitch range.
 *
 * The designer accepts a 1-200mm pitch (`DESIGNER_GRID_UNIT_MM_MIN`/`_MAX`),
 * and every tapered section along the socket, box, lip, taper, lid and
 * baseplate profiles derives its size and its corner radius from the same
 * inset. `safeSectionRect` is what keeps a section's radius under half its own
 * shorter side; brepjs answers a violation with a hard
 * `Bug in Sketcher2d.tangentArc` rather than a clamp.
 *
 * Several of these builders sit behind a try/catch that falls back to simpler
 * geometry, so a structural assertion alone cannot tell a built feature from a
 * silently dropped one. The differential cases below compare a feature on
 * against off and require the two to differ.
 *
 *   pnpm run test:run src/features/generation/worker/generators/smallGridPitch.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import { generateBin } from './binGenerator';
import { generateLid } from './lidOrchestrator';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

/** Both ends of the designer's range, clustered where the profile insets bite. */
const PITCHES = [1, 2, 3, 4, 6, 6.5, 7, 12, 42, 200] as const;

/** The pitch at which every section is driven to its floor. */
const MIN_PITCH = 1;

const NO_OP = (): void => {};

function params(pitch: number, stackableTop: boolean): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 3,
    height: 3,
    gridUnitMm: pitch,
    gridUnitMmY: pitch,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'friction',
      stackableTop,
    },
  };
}

/** 2x2 L-shape with one cell cleared, at half-bin mask resolution. */
const L_MASK: CellMask = {
  cols: 4,
  rows: 4,
  cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0],
};

describe('grid pitch range', () => {
  it.each(PITCHES)('builds a bin at a %smm pitch', (pitch) => {
    assertStructurallyValid(generateBin(params(pitch, false), undefined, true), `bin @ ${pitch}mm`);
  });

  it.each(PITCHES)('builds a lid at a %smm pitch', (pitch) => {
    const lid = generateLid(params(pitch, false), undefined, true);
    expect(lid, `lid @ ${pitch}mm`).not.toBeNull();
    if (lid) assertStructurallyValid(lid, `lid @ ${pitch}mm`);
  });

  it.each(PITCHES)('builds a stack-grid lid at a %smm pitch', (pitch) => {
    const lid = generateLid(params(pitch, true), undefined, true);
    expect(lid, `stack lid @ ${pitch}mm`).not.toBeNull();
    if (lid) assertStructurallyValid(lid, `stack lid @ ${pitch}mm`);
  });

  it.each(PITCHES)('builds a baseplate at a %smm pitch', (pitch) => {
    const plate: ResolvedBaseplateParams = {
      width: 3,
      depth: 3,
      gridUnitMm: pitch,
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2.4,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      fractionalEdgeX: 'end',
      fractionalEdgeY: 'end',
      lightweight: true,
    };
    assertStructurallyValid(getGenerateBaseplate()(plate, NO_OP, true), `baseplate @ ${pitch}mm`);
  });

  it('builds the preview path, which uses a different socket builder', () => {
    // `buildSimplifiedCellSocket` serves preview/lightweight generation and
    // carries its own section sampler, so an export-only sweep never reaches it.
    for (const pitch of [MIN_PITCH, 4, 42]) {
      assertStructurallyValid(
        generateBin(params(pitch, false), undefined, false),
        `preview bin @ ${pitch}mm`
      );
    }
  });

  it('builds the stacking-lip-only top, whose cutter spans the whole footprint', () => {
    const p = params(MIN_PITCH, true);
    const lid = generateLid({ ...p, lid: { ...p.lid, stackLipOnly: true } }, undefined, true);
    expect(lid).not.toBeNull();
    if (lid) assertStructurallyValid(lid, 'stack-lip-only lid');
  });

  it('builds a polygon lid, whose sections round through the mask builder', () => {
    // The mask builder squares off a corner below its own arc threshold, so a
    // section radius under that floor would give one loft two corner topologies.
    const p: BinParams = { ...params(MIN_PITCH, true), width: 2, depth: 2, cellMask: L_MASK };
    assertStructurallyValid(generateBin(p, undefined, true), 'polygon bin');
    const lid = generateLid(p, undefined, true);
    expect(lid).not.toBeNull();
    if (lid) assertStructurallyValid(lid, 'polygon lid');
    const lipOnly = generateLid({ ...p, lid: { ...p.lid, stackLipOnly: true } }, undefined, true);
    expect(lipOnly).not.toBeNull();
    if (lipOnly) assertStructurallyValid(lipOnly, 'polygon stack-lip-only lid');
  });

  it('builds a half-unit bin whose footprint is narrower than twice the box radius', () => {
    // 0.5 units at an 18mm pitch is an 8.5mm body against a fixed 3.75mm corner
    // radius, so the footprint cap binds while the foot still clears
    // MIN_FOOT_TILE_MM and survives.
    const p: BinParams = { ...params(18, false), width: 0.5, depth: 1 };
    assertStructurallyValid(generateBin(p, undefined, true), 'half-unit bin @ 18mm');
  });

  it('rejects a bin with no printable foot by name, not by kernel crash', () => {
    // 0.5 units at the minimum pitch is a 0.5mm foot, under MIN_FOOT_TILE_MM, so
    // every cell is dropped. That is a domain rejection and must stay one — the
    // footprint floor exists so this never reaches brepjs as a degenerate draw.
    const p: BinParams = { ...params(MIN_PITCH, false), width: 0.5, depth: 1 };
    expect(() => generateBin(p, undefined, true)).toThrow(/at least one cell required/);
  });

  it('builds a non-square pitch whose axes straddle the old threshold', () => {
    const p = { ...params(42, true), gridUnitMm: 4, gridUnitMmY: 20 };
    assertStructurallyValid(generateBin(p, undefined, true), 'bin @ 4x20mm');
    const lid = generateLid(p, undefined, true);
    expect(lid).not.toBeNull();
    if (lid) assertStructurallyValid(lid, 'stack lid @ 4x20mm');
  });
});

describe('grid pitch range — features survive rather than falling back', () => {
  it('keeps the stacking lip at the minimum pitch', () => {
    // `shellStage` catches a failed lip build and returns the bare body, so a
    // structural assertion passes on a bin that quietly lost its lip.
    const base = params(MIN_PITCH, false);
    const withLip = generateBin(
      { ...base, base: { ...base.base, stackingLip: true } },
      undefined,
      true
    );
    const without = generateBin(
      { ...base, base: { ...base.base, stackingLip: false } },
      undefined,
      true
    );
    assertStructurallyValid(withLip, 'lipped bin @ 1mm');
    expect(boundingBox(withLip.vertices).maxZ).toBeGreaterThan(boundingBox(without.vertices).maxZ);
  });

  it('keeps the outer wall taper at the minimum pitch', () => {
    // `buildBinBox` catches a failed tapered loft and falls back to a plain
    // shell, which reads as a valid bin that simply is not tapered.
    const base = params(MIN_PITCH, false);
    const overhang = { enabled: true, left: 2, right: 2, front: 2, back: 2 };
    const taper = {
      enabled: true,
      profile: 'chamfer' as const,
      bandHeight: 4,
      left: 2,
      right: 2,
      front: 2,
      back: 2,
    };
    const tapered = generateBin({ ...base, overhang: { ...overhang, taper } }, undefined, true);
    const straight = generateBin({ ...base, overhang }, undefined, true);
    assertStructurallyValid(tapered, 'tapered bin @ 1mm');
    expect(tapered.indices.length).not.toBe(straight.indices.length);
  });
});
