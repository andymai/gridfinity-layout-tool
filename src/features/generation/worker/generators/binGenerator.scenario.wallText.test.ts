/**
 * Wall surface-text scenarios.
 *
 * Hand-written (not the snapshot runner) because text generation needs fonts
 * in the brepjs registry, and because the interesting claims are positional —
 * engrave must not move the outer bbox, emboss must extend it by exactly the
 * clamped relief — which triangleCount snapshots can't express.
 *
 *   pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.wallText
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadTestFonts } from '@/test/loadTestFonts';
import { loadFont, isErr } from 'brepjs';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import type { BoundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, WallTextSide } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import { canBinUseDirectMesh } from './binDirectMesh';
import { WALL_TEXT_MAX_EMBOSS } from './wallTextLayout';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
  for (const [file, family] of [
    ['AtkinsonHyperlegible-Regular.ttf', 'atkinson'],
    ['AllertaStencil-Regular.ttf', 'allerta-stencil'],
  ] as const) {
    const buf = readFileSync(resolve(__dirname, `../../../../shared/fonts/assets/${file}`));
    const result = await loadFont(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      family
    );
    if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
  }
}, 30_000);

function makeParams(
  surfaceText: BinParams['surfaceText'],
  extra: Partial<BinParams> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    ...extra,
    ...(surfaceText !== undefined ? { surfaceText } : {}),
  };
}

describe('wall surface text scenarios', () => {
  it('engraved front text changes the mesh without moving the outer bbox', () => {
    const generateBin = getGenerateBin();
    const plain = generateBin(makeParams(undefined));
    const engraved = generateBin(makeParams({ walls: { front: 'ABC' } }));
    assertStructurallyValid(engraved, 'engraved wall text');
    expect(engraved.triangleCount).not.toBe(plain.triangleCount);
    const a = boundingBox(plain.vertices);
    const b = boundingBox(engraved.vertices);
    expect(Math.abs(b.minY - a.minY)).toBeLessThan(0.01);
    expect(Math.abs(b.maxY - a.maxY)).toBeLessThan(0.01);
  });

  it('embossed text extends the front face by the clamped relief', () => {
    const generateBin = getGenerateBin();
    const plain = generateBin(makeParams(undefined));
    const embossed = generateBin(
      // depth 5 must clamp to WALL_TEXT_MAX_EMBOSS so the relief can't ram
      // an adjacent bin on the grid.
      makeParams({ walls: { front: 'ABC' }, style: { mode: 'emboss', depth: 5 } })
    );
    assertStructurallyValid(embossed, 'embossed wall text');
    const delta = boundingBox(plain.vertices).minY - boundingBox(embossed.vertices).minY;
    expect(delta).toBeGreaterThan(WALL_TEXT_MAX_EMBOSS - 0.1);
    expect(delta).toBeLessThan(WALL_TEXT_MAX_EMBOSS + 0.1);
  });

  it('through-cut text pierces the wall (stencil auto-swap) and stays valid', () => {
    const generateBin = getGenerateBin();
    const plain = generateBin(makeParams(undefined));
    const pierced = generateBin(
      makeParams({ walls: { front: 'AB' }, style: { mode: 'through-cut' } })
    );
    assertStructurallyValid(pierced, 'through-cut wall text');
    expect(pierced.triangleCount).not.toBe(plain.triangleCount);
  });

  it('renders text on all four walls at once', () => {
    const generateBin = getGenerateBin();
    const result = generateBin(
      makeParams({ walls: { front: 'A', back: 'B', left: 'C', right: 'D' } })
    );
    assertStructurallyValid(result, 'four-wall text');
  });

  it('engraves EVERY requested wall, not just the first', () => {
    // The feature pipeline applies only the first shape a builder returns, so
    // `wallTextBuilder` has to fuse its per-wall solids. Structural validity
    // can't see the difference — cut material can. The bin is square and every
    // wall carries the same string, so each wall contributes equally.
    const generateBin = getGenerateBin();
    const plain = generateBin(makeParams(undefined)).triangleCount;
    const oneWall = generateBin(makeParams({ walls: { front: 'ABC' } })).triangleCount - plain;
    const allWalls =
      generateBin(makeParams({ walls: { front: 'ABC', back: 'ABC', left: 'ABC', right: 'ABC' } }))
        .triangleCount - plain;

    expect(oneWall).toBeGreaterThan(0);
    expect(allWalls).toBeGreaterThan(oneWall * 3.5);
  });

  it('stays manifold with all four walls embossed or pierced', () => {
    // The per-wall solids are fused before the body boolean, so four walls put
    // four disjoint glyph compounds through one fuse/cut — and coplanar and
    // T-junction fuses are this pipeline's known source of non-manifold output.
    const generateBin = getGenerateBin();
    const walls = { front: 'ABC', back: 'ABC', left: 'ABC', right: 'ABC' };
    for (const mode of ['emboss', 'through-cut'] as const) {
      const result = generateBin(makeParams({ walls, style: { mode } }));
      assertStructurallyValid(result, `four-wall ${mode} text`);
    }
  });

  it('embosses every wall outward, one side at a time', () => {
    // Requested alone, a side must push its OWN face outward — a builder that
    // applies only the first of its per-wall solids still passes every
    // all-four-walls check above.
    const generateBin = getGenerateBin();
    const plain = boundingBox(generateBin(makeParams(undefined)).vertices);
    const outwardRelief: Record<WallTextSide, (box: BoundingBox) => number> = {
      front: (box) => plain.minY - box.minY,
      back: (box) => box.maxY - plain.maxY,
      left: (box) => plain.minX - box.minX,
      right: (box) => box.maxX - plain.maxX,
    };
    for (const [side, relief] of Object.entries(outwardRelief)) {
      const box = boundingBox(
        generateBin(makeParams({ walls: { [side]: 'ABC' }, style: { mode: 'emboss' } })).vertices
      );
      expect(relief(box), side).toBeGreaterThan(0.3);
    }
  });

  it('clears the honeycomb pattern behind the text', () => {
    const generateBin = getGenerateBin();
    const wallPattern = { enabled: true, pattern: 'honeycomb', scale: 0.5 } as const;
    const patternOnly = generateBin(makeParams(undefined, { wallPattern }));
    const patternAndText = generateBin(makeParams({ walls: { front: 'ABC' } }, { wallPattern }));
    assertStructurallyValid(patternAndText, 'pattern + wall text');
    // The cleared pattern loses hex prisms AND gains glyph cuts — the mesh
    // can't be identical to pattern-only.
    expect(patternAndText.triangleCount).not.toBe(patternOnly.triangleCount);
  });

  it('auto-avoids a wall cutout on the same wall', () => {
    const generateBin = getGenerateBin();
    const walls = {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: true, width: 70, depth: 50 },
    };
    const result = generateBin(makeParams({ walls: { front: 'ABC' } }, { walls }));
    assertStructurallyValid(result, 'wall text + cutout');
  });

  it('stays valid on a half-grid width bin', () => {
    const generateBin = getGenerateBin();
    const result = generateBin(makeParams({ walls: { front: 'AB' } }, { width: 2.5 }));
    assertStructurallyValid(result, 'half-grid wall text');
  });

  it('stays valid with asymmetric overhang', () => {
    const generateBin = getGenerateBin();
    const result = generateBin(
      makeParams(
        { walls: { front: 'ABC' } },
        { overhang: { left: 0, right: 8, front: 0, back: 0 } }
      )
    );
    assertStructurallyValid(result, 'overhang wall text');
  });

  it('polygon (cellMask) bins ignore wall text', () => {
    const generateBin = getGenerateBin();
    const mask: CellMask = {
      cols: 4,
      rows: 4,
      cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    };
    const plain = generateBin(makeParams(undefined, { cellMask: mask }));
    const withText = generateBin(makeParams({ walls: { front: 'ABC' } }, { cellMask: mask }));
    expect(withText.triangleCount).toBe(plain.triangleCount);
  });

  // Solid bins used to skip wall text entirely, which left a shadow board with
  // several tool pockets no practical way to identify itself from the outside.
  // The outer face is the same wall a hollow bin engraves.
  it('engraves a solid bin without moving its outer bbox', () => {
    const generateBin = getGenerateBin();
    const solid: Partial<BinParams> = {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    };
    const plain = generateBin(makeParams(undefined, solid));
    const engraved = generateBin(makeParams({ walls: { front: 'ABC' } }, solid));
    assertStructurallyValid(engraved, 'solid bin wall text');
    expect(engraved.triangleCount).not.toBe(plain.triangleCount);
    const a = boundingBox(plain.vertices);
    const b = boundingBox(engraved.vertices);
    expect(Math.abs(b.minY - a.minY)).toBeLessThan(0.01);
    expect(Math.abs(b.maxY - a.maxY)).toBeLessThan(0.01);
  });

  it('embosses a solid bin outward by the clamped relief', () => {
    const generateBin = getGenerateBin();
    const solid: Partial<BinParams> = {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    };
    const plain = generateBin(makeParams(undefined, solid));
    const embossed = generateBin(
      makeParams(
        {
          walls: { front: 'ABC' },
          style: { mode: 'emboss', depth: WALL_TEXT_MAX_EMBOSS },
        },
        solid
      )
    );
    assertStructurallyValid(embossed, 'solid bin embossed wall text');
    const a = boundingBox(plain.vertices);
    const b = boundingBox(embossed.vertices);
    expect(a.minY - b.minY).toBeGreaterThan(0);
    expect(a.minY - b.minY).toBeLessThanOrEqual(WALL_TEXT_MAX_EMBOSS + 0.01);
  });

  it('keeps engraving a solid bin that also carries cutouts', () => {
    const generateBin = getGenerateBin();
    const solid: Partial<BinParams> = {
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        {
          id: 'pocket',
          shape: 'circle',
          x: 20,
          y: 20,
          width: 20,
          depth: 20,
          cutDepth: 8,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        },
      ],
    };
    const withoutText = generateBin(makeParams(undefined, solid));
    const withText = generateBin(makeParams({ walls: { front: 'ABC' } }, solid));
    assertStructurallyValid(withText, 'solid bin cutouts plus wall text');
    expect(withText.triangleCount).not.toBe(withoutText.triangleCount);
  });

  // Half-grid is the recurring crash class for any new geometry path (integer
  // assumptions on fractional dims), and solid mode reaches the wall through a
  // different branch than the hollow one this file already covers.
  it('stays valid on a half-grid solid bin', () => {
    const generateBin = getGenerateBin();
    const result = generateBin(
      makeParams(
        { walls: { front: 'AB' } },
        {
          style: 'solid',
          base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
          width: 2.5,
          depth: 1.5,
        }
      )
    );
    assertStructurallyValid(result, 'half-grid solid wall text');
  });

  it('wall text rejects the direct-mesh draft path', () => {
    expect(canBinUseDirectMesh(makeParams(undefined))).toBe(true);
    expect(canBinUseDirectMesh(makeParams({ walls: { front: 'ABC' } }))).toBe(false);
    // Blank strings don't disqualify the draft.
    expect(canBinUseDirectMesh(makeParams({ walls: { front: '   ' } }))).toBe(true);
  });
});
