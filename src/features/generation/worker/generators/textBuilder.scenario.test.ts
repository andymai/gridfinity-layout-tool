// @vitest-environment node
/**
 * Scenario tests for `buildTextSolid` — needs a real OCCT kernel since
 * `sketchText().extrude()` materializes geometry. Kept separate from
 * `textBuilder.test.ts` so the fast `fitFontSize` unit tests don't pay the
 * ~30s kernel-init cost.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildTextSolid, TEXT_BOOLEAN_EPSILON } from './textBuilder';
import { loadFont, withScope, mesh, clone, unwrap, type Shape3D } from 'brepjs';
import { isErr } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function loadTtf(filename: string, family: string): Promise<void> {
  const buffer = readFileSync(resolve(__dirname, `../assets/fonts/${filename}`));
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    family
  );
  if (isErr(result)) throw new Error(`Font load failed for ${family}: ${result.error.message}`);
}

beforeAll(async () => {
  await initBrepjs();
  // Atkinson covers engrave/emboss; Allerta Stencil is required for the
  // through-cut path because `resolveEffectiveFont` auto-swaps to it.
  await loadTtf('AtkinsonHyperlegible-Regular.ttf', 'atkinson');
  await loadTtf('AllertaStencil-Regular.ttf', 'allerta-stencil');
}, 30_000);

const BASE = {
  text: 'M4',
  fontFamily: 'atkinson' as const,
  mode: 'engrave' as const,
  availW: 30,
  availD: 10,
  centerX: 15,
  centerY: -5,
  topZ: 12,
  depth: 0.4,
  hostThickness: 1.2,
  margin: 1.5,
  minFontSize: 3,
  maxFontSize: 20,
};

describe('buildTextSolid (engrave)', () => {
  it('returns a non-null solid for a simple ASCII string', () => {
    const r = withScope((scope) => buildTextSolid(scope, BASE));
    expect(r).not.toBeNull();
    expect(r!.op).toBe('cut');
  });

  it('returns null for empty / whitespace-only text', () => {
    expect(withScope((scope) => buildTextSolid(scope, { ...BASE, text: '' }))).toBeNull();
    expect(withScope((scope) => buildTextSolid(scope, { ...BASE, text: '   ' }))).toBeNull();
  });

  it('returns null when the font family is not loaded', () => {
    // `jetbrains-mono` isn't loaded in this test file (only Atkinson +
    // Allerta Stencil) — the runtime guard should return null.
    const r = withScope((scope) =>
      buildTextSolid(scope, { ...BASE, fontFamily: 'jetbrains-mono' })
    );
    expect(r).toBeNull();
  });

  it('returns null when even the minimum font size overflows the area', () => {
    const r = withScope((scope) => buildTextSolid(scope, { ...BASE, availW: 2, minFontSize: 8 }));
    expect(r).toBeNull();
  });

  it('starts just above topZ (EPSILON lift) and extrudes downward by depth + EPSILON', () => {
    // `clone(...)` lifts the shape out of the disposal scope so we can call
    // `mesh()` on it after the scope's scratch handles are freed.
    const solid = withScope((scope): Shape3D | null => {
      const r = buildTextSolid(scope, BASE);
      return r ? unwrap(clone(r.solid)) : null;
    });
    expect(solid).not.toBeNull();
    const tessellated = mesh(solid!, { tolerance: 0.5, angularTolerance: 15 });
    let maxZ = -Infinity;
    let minZ = Infinity;
    for (let i = 2; i < tessellated.vertices.length; i += 3) {
      const z = tessellated.vertices[i];
      if (z > maxZ) maxZ = z;
      if (z < minZ) minZ = z;
    }
    // Top sits at topZ + EPSILON; bottom at topZ - (depth + EPSILON).
    // Mesh tessellation introduces up to `tolerance` (0.5mm) of slack.
    const MESH_SLACK = 0.5;
    expect(maxZ).toBeGreaterThan(BASE.topZ);
    expect(minZ).toBeLessThan(BASE.topZ);
    expect(BASE.topZ - minZ).toBeLessThan(BASE.depth + TEXT_BOOLEAN_EPSILON + MESH_SLACK);
  });
});

describe('buildTextSolid (fontSizeOverride)', () => {
  /** XY footprint (width × height of the tessellated bbox) of a built solid. */
  function footprint(opts: Parameters<typeof buildTextSolid>[1]): { w: number; h: number } {
    const solid = withScope((scope): Shape3D | null => {
      const r = buildTextSolid(scope, opts);
      return r ? unwrap(clone(r.solid)) : null;
    });
    expect(solid).not.toBeNull();
    const t = mesh(solid!, { tolerance: 0.5, angularTolerance: 15 });
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < t.vertices.length; i += 3) {
      const x = t.vertices[i];
      const y = t.vertices[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { w: maxX - minX, h: maxY - minY };
  }

  it('caps the label below the auto-fit size when an override is set', () => {
    const auto = footprint(BASE);
    const capped = footprint({ ...BASE, fontSizeOverride: 4 });
    // The band (availD 10 − 2·margin) lets auto-fit grow well past 4mm, so the
    // override must shrink the footprint on both axes.
    expect(capped.w).toBeLessThan(auto.w);
    expect(capped.h).toBeLessThan(auto.h);
  });

  it('is clamped to the band, never grown past what fits', () => {
    // A 999mm override can't fit the band, so the rendered size collapses to
    // the auto-fit maximum rather than overflowing — footprint matches auto.
    const auto = footprint(BASE);
    const huge = footprint({ ...BASE, fontSizeOverride: 999 });
    expect(huge.w).toBeCloseTo(auto.w, 1);
    expect(huge.h).toBeCloseTo(auto.h, 1);
  });

  it('floors a sub-minFontSize override at the legibility floor', () => {
    // A 1mm override is below the 3mm floor; it must render at minFontSize, not
    // below it. Footprint matches an explicit 3mm build, not a 1mm one.
    const atFloor = footprint({ ...BASE, fontSizeOverride: BASE.minFontSize });
    const belowFloor = footprint({ ...BASE, fontSizeOverride: 1 });
    expect(belowFloor.w).toBeCloseTo(atFloor.w, 1);
    expect(belowFloor.h).toBeCloseTo(atFloor.h, 1);
  });
});

describe('buildTextSolid (emboss)', () => {
  it('reports op:fuse and starts BELOW topZ (negative EPSILON lift)', () => {
    const solid = withScope((scope): Shape3D | null => {
      const r = buildTextSolid(scope, { ...BASE, mode: 'emboss' });
      expect(r).not.toBeNull();
      expect(r!.op).toBe('fuse');
      return r ? unwrap(clone(r.solid)) : null;
    });
    const tessellated = mesh(solid!, { tolerance: 0.5, angularTolerance: 15 });
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < tessellated.vertices.length; i += 3) {
      const z = tessellated.vertices[i];
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    // The fix: solid must extend BELOW topZ by EPSILON so the fuse surfaces
    // overlap. Top of the raised text sits at topZ + depth.
    expect(minZ).toBeLessThan(BASE.topZ);
    expect(maxZ).toBeGreaterThan(BASE.topZ);
  });
});

describe('buildTextSolid (through-cut)', () => {
  it('reports op:cut and extends through the full hostThickness (stencil auto-swapped)', () => {
    // Request `jetbrains-mono` — deliberately NOT loaded by `beforeAll`.
    // If the auto-swap is intact, `resolveEffectiveFont('jetbrains-mono',
    // 'through-cut')` returns `'allerta-stencil'`, which IS loaded, and the
    // build succeeds. If the swap is ever broken, `getFont('jetbrains-mono')`
    // returns undefined and `buildTextSolid` returns null — making this test
    // a load-bearing check of the swap behavior, not just an unloaded-font
    // assertion.
    let opCaptured: 'cut' | 'fuse' | null = null;
    const solid = withScope((scope): Shape3D | null => {
      const r = buildTextSolid(scope, {
        ...BASE,
        mode: 'through-cut',
        fontFamily: 'jetbrains-mono',
      });
      expect(r).not.toBeNull();
      opCaptured = r!.op;
      return unwrap(clone(r!.solid));
    });
    expect(opCaptured).toBe('cut');
    const tessellated = mesh(solid!, { tolerance: 0.5, angularTolerance: 15 });
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < tessellated.vertices.length; i += 3) {
      const z = tessellated.vertices[i];
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    // Span: topZ + EPSILON down to topZ - hostThickness - EPSILON. The
    // total Z extent must reach hostThickness so the cut produces a clean
    // exit on both faces of the host.
    expect(maxZ - minZ).toBeGreaterThanOrEqual(BASE.hostThickness);
    expect(maxZ).toBeGreaterThan(BASE.topZ);
    expect(BASE.topZ - minZ).toBeGreaterThanOrEqual(BASE.hostThickness - TEXT_BOOLEAN_EPSILON);
  });
});
