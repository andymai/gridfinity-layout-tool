// @vitest-environment node
/**
 * Tests for the label tab builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { DividerOverride } from '@/shared/types/bin';
import { loadFont, measureVolume } from 'brepjs';
import { isErr, isOk } from '@/core/result';
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

  it('lip drops the shelf and tops the rim at the ceiling (#2971)', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const { mesh } = await import('brepjs');
    const wallHeight = 35;
    const wt = 1.2;
    const lipH = 2;
    const base = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' as const },
    };
    const noLip = buildLabelTabs(base, 80, 80, wallHeight, wt);
    const withLip = buildLabelTabs(
      { ...base, label: { ...base.label, lip: true, lipHeight: lipH } },
      80,
      80,
      wallHeight,
      wt
    );
    expect(noLip).not.toBeNull();
    expect(withLip).not.toBeNull();

    const zBounds = (s: NonNullable<typeof noLip>) => {
      const v = mesh(s, { tolerance: 0.5, angularTolerance: 15 }).vertices;
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = 2; i < v.length; i += 3) {
        if (v[i] < mn) mn = v[i];
        if (v[i] > mx) mx = v[i];
      }
      return { mn, mx };
    };
    const a = zBounds(noLip!);
    const b = zBounds(withLip!);
    // Both top out at the ceiling — the rim tops where the flat shelf used to,
    // so a lipped tab never stands proud and breaks stacking.
    expect(b.mx).toBeCloseTo(a.mx, 1);
    // Enabling the lip dropped the whole shelf+gusset assembly by the lip height.
    expect(b.mn).toBeCloseTo(a.mn - lipH, 0);
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
        // Note: no `height` field → must produce the older geometry.
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
      // Center the socket so the probes below can target the pocket at x=0
      // (the default left alignment parks it ~21mm off-center).
      alignment: 'center' as const,
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

    // Mouth check, self-validating against the world transform: probe BOTH
    // Y-extremes of each tab across the pocket's central X span at cavity
    // height. The click-in tab has walls at both extremes (0 open edges);
    // the slide mouth cuts one extreme fully open (exactly 1). Asserting the
    // click count too guards against probing a vacuously-empty location.
    const wallHeight = 35;
    // Inside the click pocket band AND the slide cavity band
    // (0.6–1.95 below the shelf top).
    const cavityMidZ = wallHeight - 1.0;
    // Exact point-in-triangle occupancy on each Y-extreme's edge plane at
    // the pocket center (x=0, cavity height). Bbox/vertex probes both give
    // wrong answers here: plain faces tessellate corner-only, and faces
    // AROUND the mouth hole produce sliver triangles whose bounding boxes
    // span the hole. A Y-extreme is closed when the probe point lies inside
    // some on-plane triangle.
    const openEdgeCount = (solid: NonNullable<ReturnType<typeof buildLabelTabs>>): number => {
      const m = mesh(solid, { tolerance: 0.1, angularTolerance: 10 });
      const v = m.vertices;
      const tris = m.triangles;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < v.length; i += 3) {
        if (v[i] < minY) minY = v[i];
        if (v[i] > maxY) maxY = v[i];
      }
      const pointInTriangle = (
        px: number,
        pz: number,
        ax: number,
        az: number,
        bx: number,
        bz: number,
        cx: number,
        cz: number
      ): boolean => {
        const s1 = (bx - ax) * (pz - az) - (bz - az) * (px - ax);
        const s2 = (cx - bx) * (pz - bz) - (cz - bz) * (px - bx);
        const s3 = (ax - cx) * (pz - cz) - (az - cz) * (px - cx);
        const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
        const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
        return !(hasNeg && hasPos);
      };
      let open = 0;
      for (const edgeY of [minY, maxY]) {
        let material = false;
        for (let ti = 0; ti < tris.length; ti += 3) {
          const idx = [tris[ti], tris[ti + 1], tris[ti + 2]];
          if (!idx.every((k) => Math.abs(v[k * 3 + 1] - edgeY) < 0.6)) continue;
          if (
            pointInTriangle(
              0,
              cavityMidZ,
              v[idx[0] * 3],
              v[idx[0] * 3 + 2],
              v[idx[1] * 3],
              v[idx[1] * 3 + 2],
              v[idx[2] * 3],
              v[idx[2] * 3 + 2]
            )
          ) {
            material = true;
            break;
          }
        }
        if (!material) open++;
      }
      return open;
    };
    expect(openEdgeCount(click as NonNullable<typeof click>)).toBe(0);
    expect(openEdgeCount(slide as NonNullable<typeof slide>)).toBe(1);
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

describe('resolveUniformTabTextSize', () => {
  const TAB_DEPTH = 6;
  const LABEL_PARAMS = {
    ...DEFAULT_BIN_PARAMS,
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
  };

  const sizeForSlots = async (
    slots: readonly { text: string; tabWidth: number }[]
  ): Promise<number | undefined> => {
    const { resolveUniformTabTextSize } = await import('./labelTabBuilder');
    return resolveUniformTabTextSize(LABEL_PARAMS, slots, TAB_DEPTH);
  };

  /** Uniform size for a row of equally wide (30mm) tabs carrying `texts`. */
  const size = (...texts: string[]): Promise<number | undefined> =>
    sizeForSlots(texts.map((text) => ({ text, tabWidth: 30 })));

  /** As `size`, asserting the row resolved to a real size. */
  const fitted = async (...texts: string[]): Promise<number> => {
    const resolved = await size(...texts);
    if (resolved === undefined) throw new Error(`expected [${texts.join('|')}] to fit`);
    return resolved;
  };

  /**
   * Built-tab volume for one grid as a function of the per-cell strings.
   * Differencing two calls that differ in a single string isolates what that
   * tab's text alone engraves, at whatever size the build actually chose.
   */
  const tabVolumeFor = async (grid: {
    cols: number;
    rows: number;
    cells: number[];
  }): Promise<(compartmentTexts: string[]) => number> => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    return (compartmentTexts) => {
      const solid = buildLabelTabs(
        {
          ...LABEL_PARAMS,
          compartments: { ...LABEL_PARAMS.compartments, ...grid, compartmentTexts },
        },
        80,
        80,
        35,
        1.2
      );
      if (!solid) throw new Error('expected tabs');
      const volume = measureVolume(solid);
      if (!isOk(volume)) throw new Error('measureVolume failed');
      return volume.value;
    };
  };

  it('collapses a mismatched row to the smallest fitting size', async () => {
    // "gjpqy" inks 0.907em against "KABEL"'s 0.669em, so it fits ~26% smaller
    // in the same band. Sized independently the two tabs visibly disagree.
    expect(await fitted('KABEL', 'gjpqy')).toBeLessThan(await fitted('KABEL', 'KABEL'));
    expect(await fitted('KABEL', 'gjpqy')).toBeCloseTo(await fitted('gjpqy', 'gjpqy'), 6);
  });

  it('ignores blank slots and returns undefined when nothing carries text', async () => {
    expect(await fitted('KABEL', '   ')).toBeCloseTo(await fitted('KABEL'), 6);
    expect(await size('', '  ')).toBeUndefined();
    expect(await size()).toBeUndefined();
  });

  it('excludes tabs whose text cannot fit at all', async () => {
    // A tab that renders no text must not pin the bin: this run overflows even
    // at minFontSize, so the size comes from "KABEL" alone.
    expect(await fitted('KABEL', 'WRENCHES SOCKETS AND DRIVERS')).toBeCloseTo(
      await fitted('KABEL'),
      6
    );
  });

  it('is driven by the narrowest tab, not just the text', async () => {
    const narrowed = await sizeForSlots([
      { text: 'KABEL', tabWidth: 30 },
      { text: 'KABEL', tabWidth: 12 },
    ]);
    if (narrowed === undefined) throw new Error('expected the narrow tab to fit');
    expect(narrowed).toBeLessThan(await fitted('KABEL', 'KABEL'));
  });

  it('is what the built geometry actually uses', async () => {
    const tabVolume = await tabVolumeFor({ cols: 2, rows: 1, cells: [0, 1] });

    // A neighbour carrying a descender shrinks the shared size, so the first tab
    // removes strictly less material than it does alone. Sized per-tab these two
    // deltas are equal by construction, which is what makes this fail if the
    // uniform pass is not wired into the build.
    const alone = tabVolume(['', '']) - tabVolume(['KABEL', '']);
    const withNeighbour = tabVolume(['', 'gjpqy']) - tabVolume(['KABEL', 'gjpqy']);
    expect(withNeighbour).toBeLessThan(alone * 0.9);
  });

  it('is scoped per row, so one row cannot shrink another', async () => {
    // 2x2 grid: cells 0,1 on the front row and 2,3 on the back row. Every cell
    // gets its own tab, so each row is an independent sizing group.
    const tabVolume = await tabVolumeFor({ cols: 2, rows: 2, cells: [0, 1, 2, 3] });

    // Same isolation as above, but the descender now sits in the OTHER row. Cell
    // 0 must be unaffected by it — under bin-wide scoping both deltas would
    // shrink together and this would fail.
    const alone = tabVolume(['', '', '', '']) - tabVolume(['KABEL', '', '', '']);
    const otherRow = tabVolume(['', '', '', 'gjpqy']) - tabVolume(['KABEL', '', '', 'gjpqy']);
    expect(otherRow).toBeCloseTo(alone, 3);
  });
});

// Full-width labels: one shelf per row rather than one per compartment.
describe('buildLabelTabs — span full width', () => {
  const spanParams = (over: Record<string, unknown> = {}) => ({
    ...DEFAULT_BIN_PARAMS,
    compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, span: true },
    ...over,
  });

  it('builds a spanning shelf for a divided bin', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');

    const result = buildLabelTabs(spanParams(), 80, 80, 35, 1.2);

    expect(result).not.toBeNull();
  });

  // A spanning shelf crosses every column, so it must be wider than the
  // per-compartment tabs the same grid produces.
  it('produces more material than per-compartment tabs on the same grid', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');

    const spanned = buildLabelTabs(spanParams(), 80, 80, 35, 1.2);
    const perCompartment = buildLabelTabs(
      spanParams({
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, span: false },
      }),
      80,
      80,
      35,
      1.2
    );

    expect(spanned).not.toBeNull();
    expect(perCompartment).not.toBeNull();
    const spannedVolume = measureVolume(spanned!);
    const perCompartmentVolume = measureVolume(perCompartment!);
    expect(isOk(spannedVolume)).toBe(true);
    expect(isOk(perCompartmentVolume)).toBe(true);
    if (isOk(spannedVolume) && isOk(perCompartmentVolume)) {
      expect(spannedVolume.value).toBeGreaterThan(perCompartmentVolume.value);
    }
  });

  // Rows that merge across the boundary have no wall to hang a full-width
  // shelf from, so only the outer back wall hosts one.
  it('skips a row whose compartments merge through the boundary', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');

    // Column 1 spans both rows (id 1), so the row 0/1 boundary has no wall.
    const merged = buildLabelTabs(
      spanParams({
        compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 1, 5] },
      }),
      80,
      80,
      35,
      1.2
    );
    const fullyDivided = buildLabelTabs(spanParams(), 80, 80, 35, 1.2);

    expect(merged).not.toBeNull();
    const mergedVolume = measureVolume(merged!);
    const dividedVolume = measureVolume(fullyDivided!);
    if (isOk(mergedVolume) && isOk(dividedVolume)) {
      // One spanning tab instead of two.
      expect(mergedVolume.value).toBeLessThan(dividedVolume.value);
    }
  });

  it('engraves the row caption rather than compartment text', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');

    const withRowText = buildLabelTabs(
      spanParams({
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          span: true,
          rowTexts: ['CABLES', 'ADAPTERS'],
        },
      }),
      80,
      80,
      35,
      1.2
    );
    const blank = buildLabelTabs(spanParams(), 80, 80, 35, 1.2);

    expect(withRowText).not.toBeNull();
    const engraved = measureVolume(withRowText!);
    const plain = measureVolume(blank!);
    if (isOk(engraved) && isOk(plain)) {
      // Engraving removes material from the shelf face.
      expect(engraved.value).toBeLessThan(plain.value);
    }
  });
});

// Seats for the swappable-label plate preview. Planned rather than observed:
// label tabs are a cached pipeline feature, so a cache hit rebuilds nothing.
describe('planLabelPlateSeats', () => {
  const socketParams = (over: Record<string, unknown> = {}) => ({
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    compartments: { cols: 3, rows: 1, thickness: 1.2, cells: [0, 1, 2] },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket' as const, depth: 14 },
    ...over,
  });

  it('returns nothing when labels are disabled', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');
    const params = socketParams({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: false, mode: 'socket' as const },
    });

    expect(planLabelPlateSeats(params, 120, 80, 35, 1.2)).toEqual([]);
  });

  // Text-mode tabs engrave directly; there is no pocket and so no plate.
  it('returns nothing in text mode', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');
    const params = socketParams({
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'text' as const },
    });

    expect(planLabelPlateSeats(params, 120, 80, 35, 1.2)).toEqual([]);
  });

  it('seats one plate per socket', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');

    const seats = planLabelPlateSeats(socketParams(), 120, 80, 35, 1.2);

    expect(seats.length).toBeGreaterThan(0);
    for (const seat of seats) {
      expect(Number.isFinite(seat.x)).toBe(true);
      expect(Number.isFinite(seat.y)).toBe(true);
      expect(Number.isFinite(seat.z)).toBe(true);
      expect(seat.plateWidthU).toBeGreaterThan(0);
    }
  });

  // Back-anchored tabs protrude toward -Y, so their plates withdraw that way.
  it('reports the withdrawal direction of a back-anchored socket', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');

    const seats = planLabelPlateSeats(socketParams(), 120, 80, 35, 1.2);

    expect(seats.every((s) => s.slideY === -1)).toBe(true);
  });

  it('seats a plate on each edge under edges: both', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');

    const backOnly = planLabelPlateSeats(socketParams(), 120, 80, 35, 1.2);
    const both = planLabelPlateSeats(
      socketParams({
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          mode: 'socket' as const,
          depth: 14,
          edges: 'both' as const,
        },
      }),
      120,
      80,
      35,
      1.2
    );

    expect(both.length).toBe(backOnly.length * 2);
    expect(both.some((s) => s.slideY === 1)).toBe(true);
    expect(both.some((s) => s.slideY === -1)).toBe(true);
  });

  it('carries the compartment caption onto its plate', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');
    const params = socketParams({
      compartments: {
        cols: 3,
        rows: 1,
        thickness: 1.2,
        cells: [0, 1, 2],
        compartmentTexts: ['M3', 'M4', 'M5'],
      },
    });

    const seats = planLabelPlateSeats(params, 120, 80, 35, 1.2);

    expect(seats.map((s) => s.text).sort()).toEqual(['M3', 'M4', 'M5']);
  });

  // Span mode labels rows, so captions come from `label.rowTexts`.
  it('reads row captions in span mode', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');
    const params = socketParams({
      compartments: {
        cols: 3,
        rows: 1,
        thickness: 1.2,
        cells: [0, 1, 2],
        compartmentTexts: ['ignored', 'ignored', 'ignored'],
      },
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        mode: 'socket' as const,
        depth: 14,
        span: true,
        rowTexts: ['FASTENERS'],
      },
    });

    const seats = planLabelPlateSeats(params, 120, 80, 35, 1.2);

    expect(seats).toHaveLength(1);
    expect(seats[0].text).toBe('FASTENERS');
  });

  // The bin-spanning fallback plans against a synthetic 1x1 grid, so its slot
  // cellId indexes THAT grid — reading compartment metadata by it would engrave
  // compartment 0's caption onto a plate representing the whole bin.
  it('does not inherit compartment 0 metadata in the bin-spanning fallback', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');
    // 12 narrow columns: no compartment can host a plate, so the socket plan
    // degrades to one bin-spanning tab.
    const params = socketParams({
      compartments: {
        cols: 12,
        rows: 1,
        thickness: 1.2,
        cells: Array.from({ length: 12 }, (_, i) => i),
        compartmentTexts: ['LEAK', ...Array.from({ length: 11 }, () => '')],
        labelIcons: ['screw', ...Array.from({ length: 11 }, () => null)],
      },
    });

    const seats = planLabelPlateSeats(params, 80, 80, 35, 1.2);

    for (const seat of seats) {
      expect(seat.text).toBe('');
      expect(seat.icon).toBeUndefined();
    }
  });

  // Every seat must correspond to a socket the builder actually cut.
  it('seats nothing when no compartment can host a plate', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');
    // 12 columns across an 80mm interior leaves ~6mm per tab — far under a 1U plate.
    const params = socketParams({
      compartments: {
        cols: 12,
        rows: 1,
        thickness: 1.2,
        cells: Array.from({ length: 12 }, (_, i) => i),
      },
    });

    const seats = planLabelPlateSeats(params, 80, 80, 35, 1.2);

    // Either no seats, or the bin-spanning fallback's single seat — never a
    // seat for a compartment too narrow to hold a plate.
    expect(seats.length).toBeLessThanOrEqual(1);
  });
});

describe('planSpanningDividerClips', () => {
  const fourColumns = { cols: 4, rows: 1, thickness: 1.2, cells: [0, 1, 2, 3] };
  const INNER_W = 123.1;
  const INNER_D = 123.1;
  const INTERIOR_H = 15.3;

  const spanParams = (over: Record<string, unknown> = {}) => ({
    ...DEFAULT_BIN_PARAMS,
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, ...fourColumns },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, span: true, ...over },
  });

  it('produces no clips for per-compartment tabs', async () => {
    const { planSpanningDividerClips } = await import('./labelTabBuilder');
    const params = spanParams({ span: false });
    expect(planSpanningDividerClips(params, INNER_W, INNER_D, INTERIOR_H, 1.2)).toHaveLength(0);
  });

  it('produces no clips when labels are disabled', async () => {
    const { planSpanningDividerClips } = await import('./labelTabBuilder');
    const params = spanParams({ enabled: false });
    expect(planSpanningDividerClips(params, INNER_W, INNER_D, INTERIOR_H, 1.2)).toHaveLength(0);
  });

  it('clips at the shelf underside for a full-width span', async () => {
    const { planSpanningDividerClips } = await import('./labelTabBuilder');
    const clips = planSpanningDividerClips(spanParams(), INNER_W, INNER_D, INTERIOR_H, 1.2);

    expect(clips).toHaveLength(1);
    // Text mode: shelf is one wallThickness thick and tops out at the ceiling.
    expect(clips[0].zMin).toBeCloseTo(INTERIOR_H - 1.2, 5);
    // The footprint reaches the dividers it has to clear.
    expect(clips[0].xMax - clips[0].xMin).toBeCloseTo(INNER_W, 5);
    expect(clips[0].yMax - clips[0].yMin).toBeCloseTo(DEFAULT_BIN_PARAMS.label.depth, 5);
  });

  // The reporter's case: a click-in socket on a lipped bin sinks the
  // shelf below the ceiling, so full-height dividers stood proud of it.
  it('clips below the interior ceiling for a click-in socket on a lipped bin', async () => {
    const { planSpanningDividerClips } = await import('./labelTabBuilder');
    const params = {
      ...spanParams({ mode: 'socket' as const, socketStyle: 'clickIn' as const, depth: 14 }),
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };

    const clips = planSpanningDividerClips(params, INNER_W, INNER_D, INTERIOR_H, 1.2);

    expect(clips).toHaveLength(1);
    expect(clips[0].zMin).toBeLessThan(INTERIOR_H);
  });

  // The socket plan degrades to one bin-wide tab when no column can host a
  // plate — that shelf spans the dividers too, without `label.span`.
  // A divider already ending below the shelf has nothing to clip; the feature
  // builder filters those out so the cache key can't churn on identical geometry.
  it('reports clips above a shortened divider so callers can filter them', async () => {
    const { planSpanningDividerClips } = await import('./labelTabBuilder');
    const clips = planSpanningDividerClips(spanParams(), INNER_W, INNER_D, INTERIOR_H, 1.2);

    expect(clips).toHaveLength(1);
    // A 5mm divider ends well under the shelf underside, so nothing bites.
    expect(clips.filter((c) => c.zMin < 5)).toHaveLength(0);
    // A full-height divider does.
    expect(clips.filter((c) => c.zMin < INTERIOR_H)).toHaveLength(1);
  });

  it('clips for the socket bin-spanning fallback even with span off', async () => {
    const { planSpanningDividerClips } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 12,
        rows: 1,
        thickness: 1.2,
        cells: Array.from({ length: 12 }, (_, i) => i),
      },
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        span: false,
        mode: 'socket' as const,
        depth: 14,
      },
    };

    const clips = planSpanningDividerClips(params, INNER_W, INNER_D, INTERIOR_H, 1.2);

    expect(clips.length).toBeGreaterThan(0);
  });
});

// A divider shifted off its grid line moves the compartment walls the shelves
// hang between. Planning them against the nominal line left each shelf floating
// off its own wall and overhanging into the neighbour.
describe('shifted dividers', () => {
  const INNER_W = 160;
  const INNER_D = 38;
  const INTERIOR_H = 35;

  const twoUp = (dividerOverrides?: DividerOverride[]) => ({
    ...DEFAULT_BIN_PARAMS,
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 2,
      rows: 1,
      thickness: 1.2,
      cells: [0, 1],
      ...(dividerOverrides ? { dividerOverrides } : {}),
    },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket' as const, depth: 14 },
  });

  it('seats the plate against the shifted wall, not the grid line', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');

    const nominal = planLabelPlateSeats(twoUp(), INNER_W, INNER_D, INTERIOR_H, 1.2);
    const shifted = planLabelPlateSeats(
      twoUp([{ compartmentA: 0, compartmentB: 1, offsetStart: -30, offsetEnd: -30 }]),
      INNER_W,
      INNER_D,
      INTERIOR_H,
      1.2
    );

    expect(nominal).toHaveLength(2);
    expect(shifted).toHaveLength(2);
    // Compartment 0 keeps its outer wall, so its left-aligned pocket is
    // unmoved; compartment 1's wall came 30mm left and its pocket follows.
    expect(shifted[1].x).toBeLessThan(nominal[1].x);
    // A wider compartment now hosts a wider plate.
    expect(shifted[1].plateWidthU).toBeGreaterThan(nominal[1].plateWidthU);
  });

  it('keeps each tab inside its own compartment', async () => {
    const { planLabelPlateSeats } = await import('./labelTabBuilder');
    const wallX = -INNER_W / 2 + INNER_W / 2 - 30; // shifted divider centre

    const seats = planLabelPlateSeats(
      twoUp([{ compartmentA: 0, compartmentB: 1, offsetStart: -30, offsetEnd: -30 }]),
      INNER_W,
      INNER_D,
      INTERIOR_H,
      1.2
    );

    expect(seats[0].x).toBeLessThan(wallX);
    expect(seats[1].x).toBeGreaterThan(wallX);
  });

  it('builds a mesh for a shifted-divider design', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');

    const result = buildLabelTabs(
      twoUp([{ compartmentA: 0, compartmentB: 1, offsetStart: -30, offsetEnd: -30 }]),
      INNER_W,
      INNER_D,
      INTERIOR_H,
      1.2
    );

    expect(result).not.toBeNull();
    if (result) {
      const volume = measureVolume(result);
      expect(isOk(volume)).toBe(true);
      if (isOk(volume)) expect(volume.value).toBeGreaterThan(0);
    }
  });
});
