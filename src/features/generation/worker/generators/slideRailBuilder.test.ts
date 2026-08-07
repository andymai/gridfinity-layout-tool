// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { getBounds, withScope, intersect, draw } from 'brepjs';
import type { DisposalScope, ValidSolid } from 'brepjs';
import { buildSlideRails, buildSlideTray } from './slideRailBuilder';
import { resolveSlideGeometry, rimTrackBaseZ, sectionBounds } from './slideGeometry';
import type { SlideGeometryInput } from './slideGeometry';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { verticalSolidSpans } from './__kernel-tests__/meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';
import type * as BinExporterModule from './binExporter';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { clearAllCaches } from './shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { SlideConfig } from '@/shared/types/bin';

const WT = 1.2;

function input(slide: Partial<SlideConfig> = {}): SlideGeometryInput {
  const outerW = 3 * 42 - 0.5;
  const outerD = 2 * 42 - 0.5;
  return {
    slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true, ...slide },
    innerW: outerW - 2 * WT,
    innerD: outerD - 2 * WT,
    outerW,
    outerD,
    wallThickness: WT,
    wallHeight: 42,
    collarHeight: 0,
    hasLip: true,
    gridUnitMmX: 42,
  };
}

describe('slide rail solids', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it('returns nothing when the feature is off', () => {
    expect(buildSlideRails(input({ enabled: false }))).toBeNull();
    expect(buildSlideTray(input({ enabled: false }))).toBeNull();
  });

  it('occupies exactly the bounds the resolver planned', () => {
    // The resolver is the single source both the bin rail and the tray read,
    // so a builder that drifts from it would put the tray on a track that is
    // not where the rail actually is.
    const inp = input({ railMount: 'interior' });
    const planned = resolveSlideGeometry(inp);
    const b = withScope((scope: DisposalScope) => {
      const rails = buildSlideRails(inp);
      if (!rails) throw new Error('expected rails');
      return getBounds(scope.register(rails));
    });
    const xs = planned.rails.flatMap((r) => [r.xMin, r.xMax]);
    const ys = planned.rails.flatMap((r) => [sectionBounds(r).yMin, sectionBounds(r).yMax]);
    const zs = planned.rails.flatMap((r) => [sectionBounds(r).zMin, sectionBounds(r).zMax]);
    expect(b.xMin).toBeCloseTo(Math.min(...xs), 3);
    expect(b.xMax).toBeCloseTo(Math.max(...xs), 3);
    expect(b.yMin).toBeCloseTo(Math.min(...ys), 3);
    expect(b.yMax).toBeCloseTo(Math.max(...ys), 3);
    expect(b.zMin).toBeCloseTo(Math.min(...zs), 3);
    expect(b.zMax).toBeCloseTo(Math.max(...zs), 3);
  });

  it('sits at the planned outer size, floor down', () => {
    const inp = input();
    const planned = resolveSlideGeometry(inp);
    const b = withScope((scope: DisposalScope) => {
      const tray = buildSlideTray(inp);
      if (!tray) throw new Error('expected a tray');
      return getBounds(scope.register(tray));
    });
    expect(b.xMax - b.xMin).toBeCloseTo(planned.tray?.widthMm ?? 0, 3);
    expect(b.yMax - b.yMin).toBeCloseTo(planned.tray?.depthMm ?? 0, 3);
    // Floor on Z=0 is the print orientation; a tray built upside down would
    // still have the right bounding box height.
    expect(b.zMin).toBeCloseTo(0, 3);
    expect(b.zMax).toBeCloseTo(planned.tray?.heightMm ?? 0, 3);
  });

  it('is actually hollow', () => {
    // Bounding box says nothing here: a failed cavity boolean returns the outer
    // solid at exactly these bounds. Probe the middle of where the cavity
    // should be — a hollow tray has no material there.
    const inp = input();
    const planned = resolveSlideGeometry(inp);
    const height = planned.tray?.heightMm ?? 0;
    const empty = withScope((scope: DisposalScope) => {
      const tray = scope.register(buildSlideTray(inp) as ValidSolid);
      const probe = scope.register(
        draw([-1, -1])
          .lineTo([1, -1])
          .lineTo([1, 1])
          .lineTo([-1, 1])
          .close()
          .sketchOnPlane('XY', height / 2)
          .extrude(1)
      );
      const hit = intersect(tray, probe as ValidSolid);
      if (!hit.ok) return true;
      // An empty intersection has no geometry to bound, and the kernel throws
      // rather than returning a degenerate box — that throw IS the "nothing
      // there" answer.
      try {
        const hb = getBounds(scope.register(hit.value));
        return hb.xMax - hb.xMin < 1e-6;
      } catch {
        return true;
      }
    });
    expect(empty).toBe(true);
  });
});

describe('slide rails on a generated bin', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  const generate = (slide?: Partial<SlideConfig>) => {
    clearAllCaches();
    const mesh = getGenerateBin()(
      buildParams({
        width: 3,
        depth: 2,
        height: 6,
        ...(slide ? { slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true, ...slide } } : {}),
      })
    );
    const v = mesh.vertices;
    if (!v) throw new Error('no vertices');
    let zMax = -Infinity;
    for (let i = 2; i < v.length; i += 3) if (v[i] > zMax) zMax = v[i];
    return { zMax, triangles: v.length / 9 };
  };

  it('tops the rim track out at the planned height', () => {
    // The load-bearing assertion that the feature actually ran: a builder
    // returning null would leave a bin that still passes every structural
    // check, and the tray would then ride on nothing.
    //
    // Asserted against the PLANNED top rather than a delta from the plain bin:
    // the lip's peak is filleted a little below its nominal height, so a delta
    // silently absorbs a strip that floats clear of the lip instead of welding
    // to it.
    const plain = generate();
    const railed = generate({ railMount: 'rim', railThicknessMm: 2 });
    expect(railed.zMax).toBeGreaterThan(plain.zMax);
    // Shelf then guide, so the L tops out two thicknesses above the lip.
    expect(railed.zMax).toBeCloseTo(rimTrackBaseZ(6 * 7, 0, true) + 2 * 2, 2);
  });

  it('leaves the rim untouched on an interior mount but adds material', () => {
    const plain = generate();
    const railed = generate({ railMount: 'interior' });
    expect(railed.zMax).toBeCloseTo(plain.zMax, 2);
    expect(railed.triangles).toBeGreaterThan(plain.triangles);
  });
});

describe('rail survives other wall features', () => {
  let exportBin: typeof BinExporterModule.exportBin;

  beforeAll(async () => {
    await initBrepjs();
    exportBin = (await import('./binExporter')).exportBin;
  }, 120_000);

  /** Minimal binary-STL reader: verticalSolidSpans needs the fused export mesh. */
  function parseStl(data: ArrayBuffer): MeshData {
    const bytes = new Uint8Array(data);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(80, true);
    const vertices = new Float32Array(count * 9);
    const indices = new Uint32Array(count * 3);
    for (let t = 0; t < count; t++) {
      for (let v = 0; v < 3; v++) {
        const o = 84 + t * 50 + 12 + v * 12;
        vertices[t * 9 + v * 3] = view.getFloat32(o, true);
        vertices[t * 9 + v * 3 + 1] = view.getFloat32(o + 4, true);
        vertices[t * 9 + v * 3 + 2] = view.getFloat32(o + 8, true);
        indices[t * 3 + v] = t * 3 + v;
      }
    }
    return { vertices, indices } as MeshData;
  }

  it('is not carved away by a wall pattern', async () => {
    // The pipeline fuses the rail and THEN pattern-cuts, so without a keep-out
    // the hex prisms carve it out entirely. Measured 0/23 before the keep-out
    // existed, and the keep-out was itself inert until the wall defs it needs
    // stopped being gated on wall text being present.
    const mesh = parseStl(
      (
        await exportBin(
          buildParams({
            width: 3,
            depth: 2,
            height: 6,
            wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
            slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true, railMount: 'interior' },
          }),
          'stl'
        )
      ).data
    );
    let present = 0;
    let total = 0;
    for (let x = -55; x <= 55; x += 5) {
      total++;
      if (verticalSolidSpans(mesh, x, 39.0).some(([lo, hi]) => lo < 20.95 && hi > 20.95)) {
        present++;
      }
    }
    expect(present).toBe(total);
  }, 120_000);

  it('is not carved away by a kumiko wrap either', async () => {
    // Kumiko has its own clipping call site, which did not pass the keep-out at
    // first. A bin whose ONLY clip is the rail also used to skip the clipping
    // pass entirely, so both the guard and the call had to learn about it.
    const mesh = parseStl(
      (
        await exportBin(
          buildParams({
            width: 3,
            depth: 2,
            height: 6,
            wallPattern: {
              ...DEFAULT_BIN_PARAMS.wallPattern,
              enabled: true,
              pattern: 'mitsukude',
            },
            slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true, railMount: 'interior' },
          }),
          'stl'
        )
      ).data
    );
    let present = 0;
    let total = 0;
    for (let x = -55; x <= 55; x += 5) {
      total++;
      if (verticalSolidSpans(mesh, x, 39.0).some(([lo, hi]) => lo < 20.95 && hi > 20.95)) {
        present++;
      }
    }
    expect(present).toBe(total);
  }, 180_000);
});

describe('style gates', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  const triangles = (params: Parameters<typeof buildParams>[0]): number => {
    clearAllCaches();
    const mesh = getGenerateBin()(buildParams(params));
    return (mesh.vertices?.length ?? 0) / 9;
  };

  const withSlide = { ...DEFAULT_BIN_PARAMS.slide, enabled: true, railMount: 'interior' as const };

  it('builds nothing on a solid bin', () => {
    // No cavity, so a tray has nowhere to sit and the rail would be buried in
    // filled material. Note `dim.solid` comes from base.solid, NOT style.
    const base = { ...DEFAULT_BIN_PARAMS.base, solid: true };
    expect(triangles({ width: 3, depth: 2, height: 6, base, slide: withSlide })).toBe(
      triangles({ width: 3, depth: 2, height: 6, base })
    );
  });

  it('builds nothing on a slotted bin', () => {
    // slotBuilder cuts divider slots into the FRONT and BACK walls, which is
    // exactly where the rail runs, and cuts are applied after fuses — so the
    // slots would notch the rail's bearing face.
    expect(triangles({ width: 3, depth: 2, height: 6, style: 'slotted', slide: withSlide })).toBe(
      triangles({ width: 3, depth: 2, height: 6, style: 'slotted' })
    );
  });

  it('still builds on a standard bin', () => {
    expect(triangles({ width: 3, depth: 2, height: 6, slide: withSlide })).toBeGreaterThan(
      triangles({ width: 3, depth: 2, height: 6 })
    );
  });
});
