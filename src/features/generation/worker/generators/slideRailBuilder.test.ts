// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { getBounds, withScope } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import { buildSlideRails, buildSlideTray } from './slideRailBuilder';
import { resolveSlideGeometry, rimTrackBaseZ } from './slideGeometry';
import type { SlideGeometryInput } from './slideGeometry';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
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
    const ys = planned.rails.flatMap((r) => [r.yMin, r.yMax]);
    const zs = planned.rails.flatMap((r) => [r.zMin, r.zMax]);
    expect(b.xMin).toBeCloseTo(Math.min(...xs), 3);
    expect(b.xMax).toBeCloseTo(Math.max(...xs), 3);
    expect(b.yMin).toBeCloseTo(Math.min(...ys), 3);
    expect(b.yMax).toBeCloseTo(Math.max(...ys), 3);
    expect(b.zMin).toBeCloseTo(Math.min(...zs), 3);
    expect(b.zMax).toBeCloseTo(Math.max(...zs), 3);
  });

  it('builds a hollow tray, not a solid block', () => {
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
    expect(railed.zMax).toBeCloseTo(rimTrackBaseZ(6 * 7, 0, true) + 2, 2);
  });

  it('leaves the rim untouched on an interior mount but adds material', () => {
    const plain = generate();
    const railed = generate({ railMount: 'interior' });
    expect(railed.zMax).toBeCloseTo(plain.zMax, 2);
    expect(railed.triangles).toBeGreaterThan(plain.triangles);
  });
});
