import { describe, it, expect } from 'vitest';
import { resolveSlideGeometry, interiorRailCeiling, rimTrackBaseZ } from './slideGeometry';
import type { SlideGeometryInput } from './slideGeometry';
import { DEFAULT_SLIDE_CONFIG } from '@/features/bin-designer/types/slide';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import type { SlideConfig } from '@/shared/types/bin';

/** A 3x2x6 bin at stock wall thickness. */
function input(slide: Partial<SlideConfig> = {}, over: Partial<SlideGeometryInput> = {}) {
  const wallThickness = 1.2;
  const outerW = 3 * 42 - 0.5;
  const outerD = 2 * 42 - 0.5;
  return {
    slide: { ...DEFAULT_SLIDE_CONFIG, enabled: true, ...slide },
    innerW: outerW - 2 * wallThickness,
    innerD: outerD - 2 * wallThickness,
    outerW,
    outerD,
    wallThickness,
    wallHeight: 42,
    collarHeight: 0,
    hasLip: true,
    gridUnitMmX: 42,
    ...over,
  } satisfies SlideGeometryInput;
}

describe('interiorRailCeiling', () => {
  it('keeps a rail clear of the lip taper on a lipped bin', () => {
    // The lip reaches LIP_TAPER_WIDTH below its own base plane; a rail above
    // this either back-fills the taper or is silently thinned by it.
    expect(interiorRailCeiling(42, true)).toBe(42 - LIP_TAPER_WIDTH);
  });

  it('allows the full wall height when there is no lip', () => {
    expect(interiorRailCeiling(42, false)).toBe(42);
  });
});

describe('rimTrackBaseZ', () => {
  it('stands on the wall top when there is no lip', () => {
    expect(rimTrackBaseZ(42, 0, false)).toBe(42);
  });

  it('stands on the lip when there is one', () => {
    expect(rimTrackBaseZ(42, 0, true)).toBe(42 + LIP_HEIGHT);
  });

  it('rides the collar up', () => {
    expect(rimTrackBaseZ(42, 5, false)).toBe(47);
  });
});

describe('resolveSlideGeometry', () => {
  it('produces nothing when disabled', () => {
    const g = resolveSlideGeometry(input({ enabled: false }));
    expect(g.rails).toEqual([]);
    expect(g.tray).toBeNull();
    expect(g.rejection).toBe('disabled');
  });

  describe('interior mount', () => {
    const interior = (slide: Partial<SlideConfig> = {}) =>
      resolveSlideGeometry(input({ railMount: 'interior', ...slide }));

    it('builds one ledge on each of the front and back walls', () => {
      const g = interior();
      expect(g.rejection).toBeNull();
      expect(g.rails).toHaveLength(2);
      const [front, back] = g.rails;
      expect(front.yMin).toBeLessThan(0);
      expect(back.yMax).toBeGreaterThan(0);
      // Mirrored about Y=0, so the tray sits level.
      expect(front.yMax - front.yMin).toBeCloseTo(back.yMax - back.yMin, 9);
      expect(front.zMin).toBeCloseTo(back.zMin, 9);
    });

    it('clamps the rail top under the lip taper even at zero drop', () => {
      const g = interior({ railDropMm: 0 });
      expect(g.rails[0].zMax).toBe(interiorRailCeiling(42, true));
    });

    it('honours a drop below that ceiling', () => {
      const g = interior({ railDropMm: 10 });
      expect(g.rails[0].zMax).toBe(32);
    });

    it('leaves the tray narrower than its track by the clearance', () => {
      // THE fit invariant. Getting this backwards binds the tray solid, and
      // no bounding-box or watertight assertion would notice.
      const slide = { railMount: 'interior' as const, clearanceMm: 0.45 };
      const g = resolveSlideGeometry(input(slide));
      const inp = input(slide);
      expect(g.tray?.depthMm).toBeCloseTo(inp.innerD - 2 * 0.45, 9);
      expect(inp.innerD - (g.tray?.depthMm ?? 0)).toBeCloseTo(2 * 0.45, 9);
    });

    it('rests the tray above the ledge by the clearance', () => {
      const g = interior({ clearanceMm: 0.3 });
      expect(g.tray?.restZ).toBeCloseTo(g.rails[0].zMax + 0.3, 9);
    });

    it('rejects a rail that would sit in the floor slab', () => {
      // A 2u-high bin with a big drop puts the ledge below the floor, which is
      // a solid block filling the cavity rather than a track.
      const g = resolveSlideGeometry(
        input({ railMount: 'interior', railDropMm: 20 }, { wallHeight: 14 })
      );
      expect(g.rejection).toBe('rail-below-floor');
      expect(g.tray).toBeNull();
    });

    it('rejects a bin too shallow for the ledges to leave a floor', () => {
      const g = resolveSlideGeometry(
        input({ railMount: 'interior', railProtrusionMm: 6 }, { innerD: 10, outerD: 12.4 })
      );
      expect(g.rejection).toBe('bin-too-shallow');
    });
  });

  describe('rim mount', () => {
    const rim = (slide: Partial<SlideConfig> = {}, over: Partial<SlideGeometryInput> = {}) =>
      resolveSlideGeometry(input({ railMount: 'rim', ...slide }, over));

    it('tops the strips out one thickness above the lip', () => {
      const g = rim();
      expect(g.rejection).toBeNull();
      expect(g.rails).toHaveLength(2);
      expect(g.rails[0].zMax).toBe(
        rimTrackBaseZ(42, 0, true) + DEFAULT_SLIDE_CONFIG.railThicknessMm
      );
    });

    it('sinks the strips below the nominal lip top so they weld', () => {
      // The lip's peak is filleted a little below `wallHeight + LIP_HEIGHT`, so
      // a strip starting exactly at the nominal height floats clear of it and
      // fuses as a disconnected island — watertight, right bounding box, and it
      // falls off the print.
      const g = rim();
      expect(g.rails[0].zMin).toBeLessThan(rimTrackBaseZ(42, 0, true));
    });

    it('stops the strips short of the corner arcs', () => {
      // A bar run into the rounded corner hangs off the silhouette, and the
      // gap is what lets a neighbour's strip pick the track up.
      const g = rim();
      const inp = input({ railMount: 'rim' });
      expect(g.rails[0].xMax).toBeLessThan(inp.outerW / 2);
      expect(g.rails[0].xMax).toBeCloseTo(inp.outerW / 2 - 3.75, 9);
    });

    it('puts the tray above every wall so it can cross to a neighbour', () => {
      const g = rim();
      const inp = input({ railMount: 'rim' });
      const rimTop = inp.wallHeight + inp.collarHeight + LIP_HEIGHT;
      expect(g.tray?.restZ).toBeGreaterThanOrEqual(rimTop);
    });

    it('fits the tray into the channel between the strips', () => {
      const g = rim({ clearanceMm: 0.5 });
      const inp = input({ railMount: 'rim' });
      const channel = 2 * (inp.outerD / 2 - inp.wallThickness);
      expect(g.tray?.depthMm).toBeCloseTo(channel - 1, 9);
      expect(g.tray?.depthMm).toBeLessThan(channel);
    });

    it('sizes the tray from grid units, not from the host bin', () => {
      // This is what makes the multi-bin case work: a tray wider than its host
      // is the whole point, so nothing may clamp it to the bin.
      const wide = rim({ trayWidthUnits: 6 });
      const inp = input({ railMount: 'rim' });
      expect(wide.tray?.widthMm).toBeGreaterThan(inp.outerW);
      expect(wide.tray?.widthMm).toBeCloseTo(6 * 42 - DEFAULT_SLIDE_CONFIG.clearanceMm, 9);
    });

    it('rejects a tray width that collapses to nothing', () => {
      const g = rim({ trayWidthUnits: 0.5 }, { gridUnitMmX: 2 });
      expect(g.rejection).toBe('bin-too-narrow');
    });
  });
});
