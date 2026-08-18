// @vitest-environment node
/**
 * Scenario tests for `buildTextSolid`. Needs a real OCCT kernel since
 * `sketchText().extrude()` materializes geometry. Kept separate from
 * `textBuilder.test.ts` so the fast planning tests don't pay the ~30s
 * kernel-init cost.
 *
 * WHERE the glyphs go is tested against the plan in
 * `@/shared/utils/typePlan.test.ts`, which needs no kernel. What is tested here
 * is that the built SOLID matches the plan: the extrusion frame, the boolean
 * epsilon lift, and the tapered section, none of which the plan can see.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildTextSolid, planTextForHost, TEXT_BOOLEAN_EPSILON } from './textBuilder';
import {
  loadFont,
  withScope,
  mesh,
  clone,
  unwrap,
  sketchText,
  type PlaneName,
  type Shape3D,
} from 'brepjs';
import { isErr } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import type { TextStyleDefaults } from '@/shared/types/bin';

async function loadTtf(filename: string, family: string): Promise<void> {
  const buffer = readFileSync(resolve(__dirname, `../../../../shared/fonts/assets/${filename}`));
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

const STYLE: TextStyleDefaults = { ...DEFAULT_TEXT_STYLE_DEFAULTS };

const BASE = {
  text: 'M4',
  style: STYLE,
  availW: 30,
  availD: 10,
  centerX: 15,
  centerY: -5,
  topZ: 12,
  depth: 0.4,
  hostThickness: 1.2,
};

type Opts = Parameters<typeof buildTextSolid>[1];

function withStyle(
  overrides: Partial<TextStyleDefaults> & { fontSizeOverride?: number },
  rest: Partial<Opts> = {}
): Opts {
  return { ...BASE, ...rest, style: { ...STYLE, ...overrides } };
}

function buildSolid(opts: Opts): Shape3D | null {
  return withScope((scope): Shape3D | null => {
    const r = buildTextSolid(scope, opts);
    return r ? unwrap(clone(r.solid)) : null;
  });
}

interface Bbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function meshVertices(solid: Shape3D): number[] {
  return Array.from(mesh(solid, { tolerance: 0.05, angularTolerance: 10 }).vertices);
}

function bboxOf(opts: Opts): Bbox {
  const solid = buildSolid(opts);
  if (!solid) throw new Error(`expected a text solid for "${opts.text}"`);
  const v = meshVertices(solid);
  const box: Bbox = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (let i = 0; i < v.length; i += 3) {
    box.minX = Math.min(box.minX, v[i]);
    box.maxX = Math.max(box.maxX, v[i]);
    box.minY = Math.min(box.minY, v[i + 1]);
    box.maxY = Math.max(box.maxY, v[i + 1]);
    box.minZ = Math.min(box.minZ, v[i + 2]);
    box.maxZ = Math.max(box.maxZ, v[i + 2]);
  }
  return box;
}

describe('buildTextSolid (engrave)', () => {
  it('returns a non-null solid for a simple ASCII string', () => {
    const r = withScope((scope) => buildTextSolid(scope, BASE));
    expect(r).not.toBeNull();
    expect(r?.op).toBe('cut');
  });

  it('returns null for empty / whitespace-only text', () => {
    expect(withScope((scope) => buildTextSolid(scope, { ...BASE, text: '' }))).toBeNull();
    expect(withScope((scope) => buildTextSolid(scope, { ...BASE, text: '   ' }))).toBeNull();
  });

  it('returns null when the font family is not loaded', () => {
    // `jetbrains-mono` isn't loaded in this test file (only Atkinson +
    // Allerta Stencil), so the runtime guard should return null.
    const r = withScope((scope) => buildTextSolid(scope, withStyle({ font: 'jetbrains-mono' })));
    expect(r).toBeNull();
  });

  it('returns null when even the minimum font size overflows the area', () => {
    const r = withScope((scope) =>
      buildTextSolid(scope, withStyle({ minFontSize: 8 }, { availW: 2 }))
    );
    expect(r).toBeNull();
  });

  it('lifts the sketch above topZ and still bottoms out exactly `depth` below it', () => {
    // The epsilon is spent ABOVE the host face, so the extrusion of
    // `depth + EPSILON` lands the floor of the pocket at exactly `depth`. An
    // engraving that reached `depth + EPSILON` would eat into whatever margin
    // the host clamped the depth against.
    const box = bboxOf(BASE);
    expect(box.maxZ).toBeCloseTo(BASE.topZ + TEXT_BOOLEAN_EPSILON, 3);
    expect(BASE.topZ - box.minZ).toBeCloseTo(BASE.depth, 3);
  });
});

describe('buildTextSolid (sizing)', () => {
  it('caps the label below the auto-fit size when an override is set', () => {
    const auto = bboxOf(BASE);
    const capped = bboxOf(withStyle({ fontSizeOverride: 4 }));
    expect(capped.maxX - capped.minX).toBeLessThan(auto.maxX - auto.minX);
    expect(capped.maxY - capped.minY).toBeLessThan(auto.maxY - auto.minY);
  });

  it('clamps an override to the band rather than overflowing it', () => {
    const auto = bboxOf(BASE);
    const huge = bboxOf(withStyle({ fontSizeOverride: 999 }));
    expect(huge.maxX - huge.minX).toBeCloseTo(auto.maxX - auto.minX, 1);
  });

  it('honours a fixed size that fits, which an override could only shrink', () => {
    // The distinction the two mechanisms exist for: `fontSizeOverride` is a
    // ceiling, `sizeMode: 'fixed'` is an instruction.
    const auto = bboxOf(withStyle({ maxFontSize: 4 }));
    const fixed = bboxOf(withStyle({ maxFontSize: 4, sizeMode: 'fixed', fixedSize: 7 }));
    expect(fixed.maxY - fixed.minY).toBeGreaterThan(auto.maxY - auto.minY);
  });
});

describe('sketchText pen convention', () => {
  it('negates startX, which is why every pen position is handed over inverted', () => {
    // Pinned against the kernel rather than trusted: this is the trap that
    // mirrored every tracked caption to the wrong side of its host, and it is
    // invisible on the fast path because a single untracked line always sketches
    // at zero. If a brepjs bump ever fixes the negation, this fails loudly
    // instead of the mirroring silently returning.
    const inkOf = (startX: number): { min: number; max: number } => {
      const solid = sketchText(
        'H',
        { fontSize: 6, fontFamily: 'atkinson', startX },
        { plane: 'XY' as PlaneName, origin: [0, 0, 0] }
      ).extrude(-1);
      const v = meshVertices(solid);
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < v.length; i += 3) {
        min = Math.min(min, v[i]);
        max = Math.max(max, v[i]);
      }
      return { min, max };
    };
    const atZero = inkOf(0);
    const atTen = inkOf(10);
    expect(atTen.min).toBeCloseTo(atZero.min - 10, 2);
    expect(atTen.max).toBeCloseTo(atZero.max - 10, 2);
  });

  it('places a tracked run where the plan says, not mirrored about the origin', () => {
    // The end-to-end consequence: with tracking on, the built ink has to land on
    // the plan's own ink box. It used to land reflected through the host centre.
    const opts = withStyle(
      { sizeMode: 'fixed', fixedSize: 6, tracking: 0.1, anchor: 'center' },
      { text: 'HI', centerX: 0, centerY: 0, availW: 40, availD: 30 }
    );
    const plan = planTextForHost(opts);
    expect(plan).not.toBeNull();
    if (!plan) return;
    const box = bboxOf(opts);
    expect(box.minX).toBeCloseTo(plan.minX, 1);
    expect(box.maxX).toBeCloseTo(plan.maxX, 1);
  });
});

describe('buildTextSolid (type controls)', () => {
  it('widens the built solid when tracking opens, without changing its height', () => {
    const flat = bboxOf(withStyle({ sizeMode: 'fixed', fixedSize: 5 }, { text: 'MMM' }));
    const tracked = bboxOf(
      withStyle({ sizeMode: 'fixed', fixedSize: 5, tracking: 0.2 }, { text: 'MMM' })
    );
    expect(tracked.maxX - tracked.minX).toBeGreaterThan(flat.maxX - flat.minX + 1);
    expect(tracked.maxY - tracked.minY).toBeCloseTo(flat.maxY - flat.minY, 1);
  });

  it('builds an authored second line below the first, at the scaled size', () => {
    const one = bboxOf(withStyle({ sizeMode: 'fixed', fixedSize: 4 }, { text: 'AB' }));
    const two = bboxOf(
      withStyle({ sizeMode: 'fixed', fixedSize: 4, lineScale: 0.6 }, { text: 'AB\nCD' })
    );
    // Two bands of ink, so the block is taller, and the second line is smaller
    // so it is not simply twice the height.
    const oneH = one.maxY - one.minY;
    const twoH = two.maxY - two.minY;
    expect(twoH).toBeGreaterThan(oneH);
    expect(twoH).toBeLessThan(oneH * 2.5);
  });

  it('renders the case transform into the geometry, not just the plan', () => {
    // Stated as an identity rather than "bigger": upper-casing a run must build
    // the same solid as typing it in capitals. Comparing sizes would depend on
    // which glyphs happen to be wider in the loaded face, which is not what the
    // transform promises.
    const pinned = { sizeMode: 'fixed' as const, fixedSize: 6 };
    const transformed = bboxOf(withStyle({ ...pinned, textCase: 'upper' }, { text: 'abc' }));
    const typed = bboxOf(withStyle(pinned, { text: 'ABC' }));
    const untransformed = bboxOf(withStyle(pinned, { text: 'abc' }));

    expect(transformed.maxX - transformed.minX).toBeCloseTo(typed.maxX - typed.minX, 3);
    expect(transformed.maxY - transformed.minY).toBeCloseTo(typed.maxY - typed.minY, 3);
    expect(transformed.maxY - transformed.minY).not.toBeCloseTo(
      untransformed.maxY - untransformed.minY,
      2
    );
  });
});

describe('buildTextSolid (cut profile)', () => {
  /**
   * Widest X span of the ink within a thin Z band. A prismatic cutter reports
   * the same span at both faces; a drafted one narrows with depth.
   */
  function spanAtZ(solid: Shape3D, zLo: number, zHi: number): number {
    const v = meshVertices(solid);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < v.length; i += 3) {
      const z = v[i + 2];
      if (z < zLo || z > zHi) continue;
      min = Math.min(min, v[i]);
      max = Math.max(max, v[i]);
    }
    return Number.isFinite(min) ? max - min : 0;
  }

  it('narrows with depth when drafted, and does not when straight', () => {
    const opts = (cutProfile: 'straight' | 'drafted'): Opts =>
      withStyle(
        { sizeMode: 'fixed', fixedSize: 8, cutProfile, draftAngleDeg: 20, depth: 0.8 },
        {
          text: 'HH',
          depth: 0.8,
        }
      );
    const band = 0.06;
    const topZ = BASE.topZ;
    // The pocket floor sits at exactly topZ - depth, so the lower probe has to
    // straddle it: a band that starts ON the floor misses every vertex to
    // float error and reports an empty span rather than a narrow one.
    const floorZ = topZ - 0.8;

    const straight = buildSolid(opts('straight'));
    const drafted = buildSolid(opts('drafted'));
    expect(straight).not.toBeNull();
    expect(drafted).not.toBeNull();
    if (!straight || !drafted) return;

    const straightTop = spanAtZ(straight, topZ - band, topZ + band);
    const straightBottom = spanAtZ(straight, floorZ - band, floorZ + band);
    const draftedTop = spanAtZ(drafted, topZ - band, topZ + band);
    const draftedBottom = spanAtZ(drafted, floorZ - band, floorZ + band);

    // A prism is the control: whatever tessellation slack the probe carries
    // shows up identically at both ends of it.
    expect(straightBottom).toBeCloseTo(straightTop, 1);
    // The drafted cutter is the same width where it meets the host face and
    // measurably narrower at depth. Stated as a delta against the prism so no
    // absolute taper figure has to be trusted.
    expect(draftedTop).toBeCloseTo(straightTop, 0);
    expect(draftedBottom).toBeLessThan(draftedTop - 0.1);
  });
});

describe('buildTextSolid (emboss)', () => {
  it('reports op:fuse and starts BELOW topZ (negative EPSILON lift)', () => {
    let op: 'cut' | 'fuse' | null = null;
    const solid = withScope((scope): Shape3D | null => {
      const r = buildTextSolid(scope, withStyle({ mode: 'emboss' }));
      op = r?.op ?? null;
      return r ? unwrap(clone(r.solid)) : null;
    });
    expect(op).toBe('fuse');
    expect(solid).not.toBeNull();
    if (!solid) return;
    const v = meshVertices(solid);
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < v.length; i += 3) {
      minZ = Math.min(minZ, v[i]);
      maxZ = Math.max(maxZ, v[i]);
    }
    // The solid must extend BELOW topZ by EPSILON so the fuse surfaces overlap.
    expect(minZ).toBeLessThan(BASE.topZ);
    expect(maxZ).toBeGreaterThan(BASE.topZ);
  });
});

describe('buildTextSolid (through-cut)', () => {
  it('reports op:cut and extends through the full hostThickness (stencil auto-swapped)', () => {
    // Request `jetbrains-mono`, deliberately NOT loaded by `beforeAll`. If the
    // auto-swap is intact, `resolveEffectiveFont` returns `allerta-stencil`,
    // which IS loaded, and the build succeeds. If the swap is ever broken the
    // build returns null, which makes this a load-bearing check of the swap.
    let op: 'cut' | 'fuse' | null = null;
    const solid = withScope((scope): Shape3D | null => {
      const r = buildTextSolid(scope, withStyle({ mode: 'through-cut', font: 'jetbrains-mono' }));
      op = r?.op ?? null;
      return r ? unwrap(clone(r.solid)) : null;
    });
    expect(op).toBe('cut');
    expect(solid).not.toBeNull();
    if (!solid) return;
    const v = meshVertices(solid);
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < v.length; i += 3) {
      minZ = Math.min(minZ, v[i]);
      maxZ = Math.max(maxZ, v[i]);
    }
    expect(maxZ - minZ).toBeGreaterThanOrEqual(BASE.hostThickness);
    expect(maxZ).toBeGreaterThan(BASE.topZ);
    expect(BASE.topZ - minZ).toBeGreaterThanOrEqual(BASE.hostThickness - TEXT_BOOLEAN_EPSILON);
  });

  it('stays prismatic under a drafted profile, since a taper would close the cut', () => {
    const solid = buildSolid(
      withStyle({ mode: 'through-cut', cutProfile: 'drafted', draftAngleDeg: 20 })
    );
    expect(solid).not.toBeNull();
    if (!solid) return;
    const v = meshVertices(solid);
    let topMin = Infinity;
    let topMax = -Infinity;
    let botMin = Infinity;
    let botMax = -Infinity;
    const bottomZ = BASE.topZ - BASE.hostThickness;
    for (let i = 0; i < v.length; i += 3) {
      const z = v[i + 2];
      if (z > BASE.topZ - 0.05) {
        topMin = Math.min(topMin, v[i]);
        topMax = Math.max(topMax, v[i]);
      } else if (z < bottomZ + 0.05) {
        botMin = Math.min(botMin, v[i]);
        botMax = Math.max(botMax, v[i]);
      }
    }
    expect(botMax - botMin).toBeCloseTo(topMax - topMin, 1);
  });
});
