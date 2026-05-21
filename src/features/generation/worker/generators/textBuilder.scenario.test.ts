// @vitest-environment node
/**
 * Scenario tests for `buildEngraveCutSolid` — needs a real OCCT kernel
 * since `sketchText().extrude()` materializes geometry. Kept separate from
 * `textBuilder.test.ts` so the fast `fitFontSize` unit tests don't pay the
 * ~30s kernel-init cost.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildEngraveCutSolid } from './textBuilder';
import { loadFont, withScope, mesh, clone, unwrap, type Shape3D } from 'brepjs';
import { isErr } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

beforeAll(async () => {
  await initBrepjs();
  const buffer = readFileSync(
    resolve(__dirname, '../assets/fonts/AtkinsonHyperlegible-Regular.ttf')
  );
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
}, 30_000);

const BASE = {
  text: 'M4',
  fontFamily: 'atkinson' as const,
  availW: 30,
  availD: 10,
  centerX: 15,
  centerY: -5,
  topZ: 12,
  depth: 0.4,
  margin: 1.5,
  minFontSize: 3,
  maxFontSize: 20,
};

describe('buildEngraveCutSolid', () => {
  it('returns a non-null solid for a simple ASCII string', () => {
    const solid = withScope((scope) => buildEngraveCutSolid(scope, BASE));
    expect(solid).not.toBeNull();
  });

  it('returns null for empty / whitespace-only text', () => {
    expect(withScope((scope) => buildEngraveCutSolid(scope, { ...BASE, text: '' }))).toBeNull();
    expect(withScope((scope) => buildEngraveCutSolid(scope, { ...BASE, text: '   ' }))).toBeNull();
  });

  it('returns null when the font family is not loaded', () => {
    const solid = withScope((scope) =>
      buildEngraveCutSolid(scope, {
        ...BASE,
        // @ts-expect-error — testing runtime guard with an unregistered family
        fontFamily: 'jetbrains-mono',
      })
    );
    expect(solid).toBeNull();
  });

  it('returns null when even the minimum font size overflows the area', () => {
    const solid = withScope((scope) =>
      buildEngraveCutSolid(scope, { ...BASE, availW: 2, minFontSize: 8 })
    );
    expect(solid).toBeNull();
  });

  it('places the solid below the topZ plane (extruded downward into the host)', () => {
    // `clone(...)` lifts the shape out of the disposal scope so we can call
    // `mesh()` on it after the scope's scratch handles are freed.
    const solid = withScope((scope): Shape3D | null => {
      const s = buildEngraveCutSolid(scope, BASE);
      return s ? unwrap(clone(s)) : null;
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
    // Top of the solid sits just above topZ (the EPSILON lift); bottom sits
    // at most `depth + EPSILON` below it.
    expect(maxZ).toBeGreaterThan(BASE.topZ);
    expect(minZ).toBeLessThan(BASE.topZ);
    expect(BASE.topZ - minZ).toBeLessThan(BASE.depth + 0.1);
  });
});
