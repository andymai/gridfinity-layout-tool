// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFont, getFont } from 'brepjs/text';
import { buildWallTextOutline } from './wallTextOutline';
import { createTypeMeasurer, type GlyphFont, type TypeMeasurer } from '@/shared/utils/typePlan';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import type { BinParams, SurfaceTextConfig } from '@/features/bin-designer/types';

let measurer: TypeMeasurer;

beforeAll(async () => {
  const file = resolve(
    import.meta.dirname,
    '../../../../../shared/fonts/assets/AtkinsonHyperlegible-Regular.ttf'
  );
  const buf = readFileSync(file);
  await loadFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'atkinson');
  measurer = createTypeMeasurer((f) => getFont(f) as GlyphFont | undefined);
});

const params = (surfaceText: SurfaceTextConfig): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 4,
  textDefaults: { ...DEFAULT_BIN_PARAMS.textDefaults, font: 'atkinson' },
  surfaceText,
});

function points(p: BinParams): [number, number, number][] {
  const geometry = buildWallTextOutline(p, measurer);
  if (!geometry) throw new Error('no outline');
  const a = geometry.getAttribute('position').array;
  const out: [number, number, number][] = [];
  for (let i = 0; i < a.length; i += 3) out.push([a[i], a[i + 1], a[i + 2]]);
  return out;
}

describe('buildWallTextOutline', () => {
  const backInside = params({ walls: { back: 'L' }, wallFaces: { back: 'inside' } });
  const backOutside = params({ walls: { back: 'L' } });

  it('draws an inside caption on the inner face and an outside one on the outer face', () => {
    const { innerD } = cutoutInterior(backInside);
    // Within the small lift that keeps an outline off the face it sits on.
    const near = (y: number, face: number): boolean => Math.abs(y - face) < 0.1;
    for (const [, y] of points(backInside)) expect(near(y, innerD / 2)).toBe(true);
    const wall = DEFAULT_BIN_PARAMS.wallThickness;
    for (const [, y] of points(backOutside)) expect(near(y, innerD / 2 + wall)).toBe(true);
  });

  // An L's top is its stem alone, so where the top sits says which way it reads.
  it('reads from inside: an inside L has its stem at -X, the outside one at +X', () => {
    const stemSide = (p: BinParams): number => {
      const pts = points(p);
      const zTop = Math.max(...pts.map(([, , z]) => z));
      const zSpan = zTop - Math.min(...pts.map(([, , z]) => z));
      const mean = (vs: typeof pts): number => vs.reduce((s, [x]) => s + x, 0) / vs.length;
      return mean(pts.filter(([, , z]) => z > zTop - zSpan * 0.25)) - mean(pts);
    };
    expect(stemSide(backInside)).toBeLessThan(0);
    expect(stemSide(backOutside)).toBeGreaterThan(0);
  });
});
