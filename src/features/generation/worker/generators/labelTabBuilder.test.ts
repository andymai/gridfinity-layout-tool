// @vitest-environment node
/**
 * Tests for the label tab builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { loadFont } from 'brepjs';
import { isErr } from '@/core/result';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

beforeAll(async () => {
  await initBrepjs();
  // Engraved-text tests need the bundled Atkinson font; load from disk since
  // the test env has no `fetch` for `?url` assets.
  const buffer = readFileSync(
    resolve(__dirname, '../assets/fonts/AtkinsonHyperlegible-Regular.ttf')
  );
  const result = await loadFont(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    'atkinson'
  );
  if (isErr(result)) throw new Error(`Font load failed: ${result.error.message}`);
}, 30_000);

describe('buildLabelTabs', () => {
  it('returns null when label disabled', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).toBeNull();
  });

  it('builds label tabs with bracket support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });

  it('builds label tabs with solid support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });

  it('builds label tabs with fillet support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'fillet' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });

  it('fillet support is positioned under the shelf, not at the bin floor', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const { mesh } = await import('brepjs');
    const wallHeight = 35;
    const wt = 1.2;
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'fillet' as const },
    };
    const result = buildLabelTabs(params, 80, 80, wallHeight, wt);
    expect(result).not.toBeNull();

    // Tessellate and check Z bounds — fillet must sit near the top of the
    // wall (wallHeight), not at Z=0 (the bin floor). Before the fix, the
    // fillet was placed at Z=0..gussetLeg instead of (wallHeight-tabHeight)..wallHeight.
    const tessellated = mesh(result!, { tolerance: 0.5, angularTolerance: 15 });
    const verts = tessellated.vertices;
    let minZ = Infinity;
    for (let i = 2; i < verts.length; i += 3) {
      if (verts[i] < minZ) minZ = verts[i];
    }
    // The tab's lowest point should be above half the wall height
    // (it sits near the top, not at the floor)
    expect(minZ).toBeGreaterThan(wallHeight / 2);
  });

  describe('engraved compartment text', () => {
    it('builds tabs without crashing when compartmentTexts is present', async () => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const params = {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          compartmentTexts: ['SCREWS'],
        },
      };
      const result = buildLabelTabs(params, 80, 80, 35, 1.2);
      expect(result).not.toBeNull();
    });

    it('cuts material from the shelf when text is present (more faces than without)', async () => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const { mesh } = await import('brepjs');

      const base = { ...DEFAULT_BIN_PARAMS, label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } };
      const withText = {
        ...base,
        compartments: { ...base.compartments, compartmentTexts: ['ABC'] },
      };

      const without = buildLabelTabs(base, 80, 80, 35, 1.2);
      const withEngraved = buildLabelTabs(withText, 80, 80, 35, 1.2);
      expect(without).not.toBeNull();
      expect(withEngraved).not.toBeNull();

      const opts = { tolerance: 0.5, angularTolerance: 15 };
      const meshA = mesh(without!, opts);
      const meshB = mesh(withEngraved!, opts);
      // Engraving adds glyph faces — vertex count strictly increases.
      expect(meshB.vertices.length).toBeGreaterThan(meshA.vertices.length);
    });

    it('skips engraving when the slot text is empty or whitespace', async () => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const { mesh } = await import('brepjs');

      const base = { ...DEFAULT_BIN_PARAMS, label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } };
      const blank = {
        ...base,
        compartments: { ...base.compartments, compartmentTexts: ['   '] },
      };

      const withoutTexts = buildLabelTabs(base, 80, 80, 35, 1.2);
      const blankText = buildLabelTabs(blank, 80, 80, 35, 1.2);
      expect(withoutTexts).not.toBeNull();
      expect(blankText).not.toBeNull();

      const opts = { tolerance: 0.5, angularTolerance: 15 };
      // Whitespace-only text must be treated as "no text" — identical vertex count.
      expect(mesh(blankText!, opts).vertices.length).toBe(
        mesh(withoutTexts!, opts).vertices.length
      );
    });
  });

  describe('tab height (vertical position)', () => {
    it('omitting height anchors the shelf at the wall top (legacy behavior)', async () => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const { mesh } = await import('brepjs');
      const wallHeight = 35;
      const wt = 1.2;
      const params = {
        ...DEFAULT_BIN_PARAMS,
        // Note: no `height` field → must produce the pre-#1898 geometry.
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' as const },
      };
      const result = buildLabelTabs(params, 80, 80, wallHeight, wt);
      expect(result).not.toBeNull();

      const tessellated = mesh(result!, { tolerance: 0.1, angularTolerance: 10 });
      const verts = tessellated.vertices;
      let maxZ = -Infinity;
      for (let i = 2; i < verts.length; i += 3) {
        if (verts[i] > maxZ) maxZ = verts[i];
      }
      // Shelf top should reach the wall top.
      expect(maxZ).toBeCloseTo(wallHeight, 1);
    });

    it('explicit height drops the shelf below the wall top', async () => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const { mesh } = await import('brepjs');
      const wallHeight = 50;
      const wt = 1.2;
      const tabDepth = 12;
      const tabHeight = 20;
      const params = {
        ...DEFAULT_BIN_PARAMS,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          support: 'bracket' as const,
          depth: tabDepth,
          height: tabHeight,
        },
      };
      const result = buildLabelTabs(params, 80, 80, wallHeight, wt);
      expect(result).not.toBeNull();

      const tessellated = mesh(result!, { tolerance: 0.1, angularTolerance: 10 });
      const verts = tessellated.vertices;
      let maxZ = -Infinity;
      let minZ = Infinity;
      for (let i = 2; i < verts.length; i += 3) {
        if (verts[i] > maxZ) maxZ = verts[i];
        if (verts[i] < minZ) minZ = verts[i];
      }
      // Shelf top must sit at the requested height, not at the wall top.
      expect(maxZ).toBeCloseTo(tabHeight, 1);
      // Gusset bottom = tabHeight - tabDepth = 8mm above the floor.
      expect(minZ).toBeCloseTo(tabHeight - tabDepth, 1);
    });

    it('returns null when height exceeds wall height', async () => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const params = {
        ...DEFAULT_BIN_PARAMS,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          height: 50, // > wallHeight
        },
      };
      // wallHeight = 35, height = 50 → invalid.
      const result = buildLabelTabs(params, 80, 80, 35, 1.2);
      expect(result).toBeNull();
    });

    it('returns null when height <= depth (no room for gusset)', async () => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const params = {
        ...DEFAULT_BIN_PARAMS,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          depth: 12,
          height: 12, // shelfTopZ - tabHeight = 0 → degenerate
        },
      };
      const result = buildLabelTabs(params, 80, 80, 35, 1.2);
      expect(result).toBeNull();
    });
  });

  it.each(['solid', 'bracket', 'fillet'] as const)(
    '%s support reaches the front edge of the shelf (no overhang gap)',
    async (support) => {
      const { buildLabelTabs } = await import('./labelTabBuilder');
      const { mesh } = await import('brepjs');
      const wallHeight = 35;
      const wt = 1.2;
      const tabDepth = 12;
      const params = {
        ...DEFAULT_BIN_PARAMS,
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          support,
          depth: tabDepth,
          width: 50,
          alignment: 'center' as const,
        },
      };
      const result = buildLabelTabs(params, 80, 80, wallHeight, wt);
      expect(result).not.toBeNull();

      // Tessellate and verify support structure extends well below the shelf.
      // The support's Z-extent is the key regression indicator: without support,
      // minZ would be near wallHeight - wt (just the shelf plate). With support,
      // minZ should reach wallHeight - tabHeight (near wallHeight - tabDepth).
      const tessellated = mesh(result!, { tolerance: 0.1, angularTolerance: 10 });
      const verts = tessellated.vertices;
      const shelfUndersideZ = wallHeight - wt;

      let minZ = Infinity;
      let hasSupportVerts = false;
      for (let i = 2; i < verts.length; i += 3) {
        if (verts[i] < minZ) minZ = verts[i];
        if (verts[i] < shelfUndersideZ - 0.1) hasSupportVerts = true;
      }
      // Support geometry must exist below the shelf
      expect(hasSupportVerts).toBe(true);
      // Support must extend well below the shelf underside (wallHeight - wt = 33.8).
      // Without support, minZ would equal shelfUndersideZ.
      // With support, minZ should be near wallHeight - tabDepth = 23.
      expect(minZ).toBeLessThan(shelfUndersideZ - 5);
    }
  );
});

describe('slide-channel socket style (#2666 follow-up)', () => {
  const socketParams = (socketStyle?: 'clickIn' | 'slideChannel') => ({
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 1,
    label: {
      ...DEFAULT_BIN_PARAMS.label,
      enabled: true,
      mode: 'socket' as const,
      depth: 14,
      ...(socketStyle !== undefined ? { socketStyle } : {}),
    },
  });

  it('builds a different solid than click-in with an open mouth at the free edge', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const { measureVolume, mesh } = await import('brepjs');
    const { isOk } = await import('@/core/result');
    const vol = (s: NonNullable<ReturnType<typeof buildLabelTabs>>): number => {
      const r = measureVolume(s);
      if (!isOk(r)) throw new Error('measureVolume failed');
      return r.value;
    };

    const click = buildLabelTabs(socketParams('clickIn'), 80, 80, 35, 1.2);
    const slide = buildLabelTabs(socketParams('slideChannel'), 80, 80, 35, 1.2);
    expect(click).not.toBeNull();
    expect(slide).not.toBeNull();
    const clickVol = vol(click as NonNullable<typeof click>);
    const slideVol = vol(slide as NonNullable<typeof slide>);
    expect(clickVol).toBeGreaterThan(0);
    expect(slideVol).toBeGreaterThan(0);
    // The styles must actually diverge (thicker shelf, deeper cavity, mouth).
    expect(Math.abs(clickVol - slideVol)).toBeGreaterThan(3);

    // Mouth check: the slide tab must have NO material across the pocket span
    // at the tab's free (compartment-facing) edge within the cavity band —
    // the corridor cuts through. The click-in tab keeps a solid wall there.
    const wallHeight = 35;
    const tabDepth = 14;
    const freeEdgeY = tabDepth; // back-anchored tab sweeps +Y? probe both signs
    const cavityMidZ = wallHeight - 1.2; // inside the pocket band for both
    const hasMaterialNear = (
      solid: NonNullable<ReturnType<typeof buildLabelTabs>>,
      y: number
    ): boolean => {
      const m = mesh(solid, { tolerance: 0.1, angularTolerance: 10 });
      const v = m.vertices;
      for (let i = 0; i < v.length; i += 3) {
        if (
          Math.abs(Math.abs(v[i + 1]) - y) < 0.4 &&
          Math.abs(v[i + 2] - cavityMidZ) < 0.5 &&
          Math.abs(v[i] - 40) < 10
        ) {
          return true;
        }
      }
      return false;
    };
    // The click-in socket keeps its far wall (vertices present at the pocket's
    // far side); the slide mouth removes the wall at the free edge entirely.
    expect(hasMaterialNear(slide as NonNullable<typeof slide>, freeEdgeY)).toBe(false);
  });

  it('defaults to click-in geometry when socketStyle is absent', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const { measureVolume } = await import('brepjs');
    const { isOk } = await import('@/core/result');
    const vol = (s: NonNullable<ReturnType<typeof buildLabelTabs>>): number => {
      const r = measureVolume(s);
      if (!isOk(r)) throw new Error('measureVolume failed');
      return r.value;
    };
    const absent = buildLabelTabs(socketParams(undefined), 80, 80, 35, 1.2);
    const click = buildLabelTabs(socketParams('clickIn'), 80, 80, 35, 1.2);
    expect(vol(absent as NonNullable<typeof absent>)).toBeCloseTo(
      vol(click as NonNullable<typeof click>),
      6
    );
  });
});
