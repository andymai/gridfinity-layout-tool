// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { loadTestFonts } from '@/test/loadTestFonts';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, SurfaceTextConfig, TextQuarterTurn } from '@/features/bin-designer/types';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
}, 30_000);

function lidParams(size: { width: number; depth: number }, surfaceText: SurfaceTextConfig) {
  const params: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    ...size,
    height: 3,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, relieveInterior: false },
    surfaceText,
  };
  return params;
}

interface Ink {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * XY extent of the embossed glyphs: everything above the plain lid's top is a
 * raised glyph, so this probes the caption itself rather than the outer slab.
 */
async function embossedInk(params: BinParams): Promise<Ink | null> {
  const { generateLid } = await import('./lidOrchestrator');
  const plain = generateLid({ ...params, surfaceText: undefined });
  const lid = generateLid(params);
  if (!plain || !lid) throw new Error('expected a lid');
  assertStructurallyValid(lid, 'lid text');
  const plainTop = boundingBox(plain.vertices).maxZ;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < lid.vertices.length; i += 3) {
    if (lid.vertices[i + 2] <= plainTop + 1e-3) continue;
    minX = Math.min(minX, lid.vertices[i]);
    maxX = Math.max(maxX, lid.vertices[i]);
    minY = Math.min(minY, lid.vertices[i + 1]);
    maxY = Math.max(maxY, lid.vertices[i + 1]);
  }
  return minX > maxX ? null : { minX, maxX, minY, maxY };
}

const EMBOSS = { mode: 'emboss', textCase: 'as-typed' } as const;

describe('lid text rotation', () => {
  it('runs a caption along the long side of a narrow lid when turned a quarter', async () => {
    const size = { width: 0.5, depth: 3 };
    const upright = await embossedInk(
      lidParams(size, { lidText: 'Cables', style: { ...EMBOSS, sizeMode: 'auto' } })
    );
    const turned = await embossedInk(
      lidParams(size, {
        lidText: 'Cables',
        lidTextRotation: 90,
        style: { ...EMBOSS, sizeMode: 'auto' },
      })
    );
    // Upright, the caption has to fit across the 21mm side, and at the
    // legibility floor it does not, so the lid ships blank.
    expect(upright).toBeNull();
    expect(turned).not.toBeNull();
    if (!turned) return;
    const across = turned.maxX - turned.minX;
    const along = turned.maxY - turned.minY;
    expect(along).toBeGreaterThan(3 * across);
    expect(Math.max(Math.abs(turned.minY), Math.abs(turned.maxY))).toBeLessThan((3 * 42) / 2);
    expect(Math.max(Math.abs(turned.minX), Math.abs(turned.maxX))).toBeLessThan(42 / 4);
  });

  it.each<[TextQuarterTurn, 'neg' | 'pos', 'neg' | 'pos']>([
    [0, 'neg', 'neg'],
    [90, 'neg', 'pos'],
    [180, 'pos', 'pos'],
    [270, 'pos', 'neg'],
  ])(
    'turns the bottom-left anchor clockwise with the frame (%s°)',
    async (rotation, xSide, ySide) => {
      const ink = await embossedInk(
        lidParams(
          { width: 2, depth: 2 },
          {
            lidText: 'AB',
            ...(rotation !== 0 ? { lidTextRotation: rotation } : {}),
            style: { ...EMBOSS, anchor: 'bottom-left', sizeMode: 'fixed', fixedSize: 8 },
          }
        )
      );
      expect(ink).not.toBeNull();
      if (!ink) return;
      const cx = (ink.minX + ink.maxX) / 2;
      const cy = (ink.minY + ink.maxY) / 2;
      expect(Math.sign(cx)).toBe(xSide === 'pos' ? 1 : -1);
      expect(Math.sign(cy)).toBe(ySide === 'pos' ? 1 : -1);
      expect(Math.abs(cx)).toBeGreaterThan(10);
      expect(Math.abs(cy)).toBeGreaterThan(10);
    }
  );
});
