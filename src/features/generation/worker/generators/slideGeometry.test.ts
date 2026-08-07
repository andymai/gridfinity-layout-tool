import { describe, it, expect } from 'vitest';
import {
  resolveSlideGeometry,
  interiorRailCeiling,
  rimTrackBaseZ,
  sectionBounds,
} from './slideGeometry';
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

  it('rejects a wall thick enough to collapse the tray in X', () => {
    // Depth alone was checked at first, so a fat wall on a narrow tray closed
    // the cavity in X and the builder returned the un-hollowed outer solid: a
    // printable block the resolver still called a tray.
    const g = resolveSlideGeometry(
      input({ trayWidthUnits: 0.5, trayWallMm: 2.4 }, { gridUnitMmX: 12 })
    );
    expect(g.rejection).toBe('tray-too-thin');
    expect(g.tray).toBeNull();
  });

  describe('interior mount', () => {
    const interior = (slide: Partial<SlideConfig> = {}) =>
      resolveSlideGeometry(input({ railMount: 'interior', ...slide }));

    it('builds one ledge on each of the front and back walls', () => {
      const g = interior();
      expect(g.rejection).toBeNull();
      expect(g.rails).toHaveLength(2);
      const [front, back] = g.rails.map(sectionBounds);
      expect(front.yMin).toBeLessThan(0);
      expect(back.yMax).toBeGreaterThan(0);
      // Mirrored about Y=0, so the tray sits level.
      expect(front.yMax - front.yMin).toBeCloseTo(back.yMax - back.yMin, 9);
      expect(front.zMin).toBeCloseTo(back.zMin, 9);
    });

    it('clamps the rail top under the lip taper even at zero drop', () => {
      const g = interior({ railDropMm: 0 });
      expect(sectionBounds(g.rails[0]).zMax).toBe(interiorRailCeiling(42, true));
    });

    it('honours a drop below that ceiling', () => {
      const g = interior({ railDropMm: 10 });
      expect(sectionBounds(g.rails[0]).zMax).toBe(32);
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

    it('rests the tray on the ledge', () => {
      // Clearance is a SIDE gap; vertically the tray settles onto its shelf.
      const g = interior({ clearanceMm: 0.3 });
      expect(g.tray?.restZ).toBeCloseTo(sectionBounds(g.rails[0]).zMax, 9);
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

    it('builds a shelf and a guide on each side', () => {
      const g = rim();
      expect(g.rejection).toBeNull();
      expect(g.rails).toHaveLength(4);
    });

    it('rests the tray on the shelf, above the lip', () => {
      const g = rim();
      const shelfTop = rimTrackBaseZ(42, 0, true) + DEFAULT_SLIDE_CONFIG.railThicknessMm;
      expect(g.tray?.restZ).toBe(shelfTop);
      // Above every wall, which is what lets it cross to a neighbouring bin.
      expect(g.tray?.restZ).toBeGreaterThan(42);
    });

    it('sinks the shelf below the nominal lip top so it welds', () => {
      // The lip's peak is filleted a little below `wallHeight + LIP_HEIGHT`, so
      // a bar starting exactly at the nominal height can float clear of it.
      const g = rim();
      expect(Math.min(...g.rails.map((r) => sectionBounds(r).zMin))).toBeLessThan(
        rimTrackBaseZ(42, 0, true)
      );
    });

    it('keeps the guide off the opening so it never overhangs', () => {
      // The guide stands on the wall band only. Reaching inward would put an
      // unsupported bar over the cavity.
      const g = rim();
      const inp = input({ railMount: 'rim' });
      const shelfTop = rimTrackBaseZ(42, 0, true) + DEFAULT_SLIDE_CONFIG.railThicknessMm;
      const guides = g.rails.map(sectionBounds).filter((b) => b.zMin >= shelfTop - 1e-9);
      expect(guides).toHaveLength(2);
      for (const guide of guides) {
        expect(Math.min(Math.abs(guide.yMin), Math.abs(guide.yMax))).toBeGreaterThanOrEqual(
          inp.innerD / 2 - 1e-9
        );
      }
    });

    it('stops the bars short of the corner arcs', () => {
      const g = rim();
      const inp = input({ railMount: 'rim' });
      expect(g.rails[0].xMax).toBeCloseTo(inp.outerW / 2 - 3.75, 9);
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

  describe('clearance default', () => {
    it('matches the per-side gap Gridfinity itself uses', () => {
      // 41.5mm foot in a 42mm cell is 0.5mm total, so 0.25mm per side. A
      // printer calibrated to seat bins in a baseplate needs no retuning, and
      // the earlier 0.45 was nearly double this and would have rattled.
      expect(DEFAULT_SLIDE_CONFIG.clearanceMm).toBe(0.25);
    });

    it('holds the gap on each side, not across the pair', () => {
      // The total is TWICE the parameter. Reading it as a total is how the
      // shared CLEARANCE (0.5mm, measured across a whole cell) would double if
      // it were borrowed here.
      const g = resolveSlideGeometry(input({ railMount: 'interior', clearanceMm: 0.25 }));
      const inp = input({ railMount: 'interior' });
      expect(g.tray).not.toBeNull();
      if (!g.tray) return;
      expect(inp.innerD - g.tray.depthMm).toBeCloseTo(0.5, 9);
    });
  });

  describe('style and shape gates', () => {
    it('rejects a solid bin: no cavity for a tray', () => {
      const g = resolveSlideGeometry({ ...input(), isSolid: true });
      expect(g.rejection).toBe('no-cavity');
      expect(g.rails).toEqual([]);
    });

    it('rejects a slotted bin: divider slots share the rail walls', () => {
      const g = resolveSlideGeometry({ ...input(), isSlotted: true });
      expect(g.rejection).toBe('slot-conflict');
    });

    it('rejects a custom-shape bin explicitly rather than silently', () => {
      // The pipeline already filters builders without supportsCellMask, so this
      // exists so the panel can SAY why nothing appeared.
      const g = resolveSlideGeometry({ ...input(), isPolygon: true });
      expect(g.rejection).toBe('unsupported-shape');
    });
  });

  describe('bearing (both mounts)', () => {
    // The invariant that the first `rim` design violated: its strips sat
    // OUTBOARD of the tray, so the tray was narrower than the opening, rested
    // on nothing and dropped onto the lip's taper. Every structural assertion
    // passed. This is the check that catches it, and it is deliberately
    // written against both mounts so neither can drift.
    for (const railMount of ['interior', 'rim'] as const) {
      it(`carries the tray on real material (${railMount})`, () => {
        const slide = { railMount, railProtrusionMm: 2, clearanceMm: 0.25 };
        const g = resolveSlideGeometry(input(slide));
        const tray = g.tray;
        expect(tray).not.toBeNull();
        if (!tray) return;
        const trayHalf = tray.depthMm / 2;
        // The shelf a tray actually lands on is the bar whose top is at restZ.
        const shelves = g.rails
          .map(sectionBounds)
          .filter((b) => Math.abs(b.zMax - tray.restZ) < 1e-6);
        expect(shelves.length).toBeGreaterThan(0);
        const reach = Math.min(...shelves.map((b) => Math.min(Math.abs(b.yMin), Math.abs(b.yMax))));
        expect(trayHalf - reach).toBeCloseTo(2 - 0.25, 9);
        expect(trayHalf).toBeGreaterThan(reach);
      });
    }

    it('rejects a shelf that reaches in less than the clearance', () => {
      // Held back by the clearance, the tray would pass straight by such a
      // shelf and fall through.
      const g = resolveSlideGeometry(input({ railProtrusionMm: 0.8, clearanceMm: 1.5 }));
      expect(g.rejection).toBe('no-bearing');
      expect(g.tray).toBeNull();
    });
  });

  describe('tray vertical extent', () => {
    it('rejects rather than half-building on a bin too short for the default drop', () => {
      // The default sinks the tray ~21mm, which a 3u bin (21mm of wall) cannot
      // give. Rejecting is the safe outcome, but it is SILENT: the panel has to
      // surface `rejection`, or the user enables the feature and nothing
      // appears. Pinned so that stays a known behaviour rather than a surprise.
      const g = resolveSlideGeometry(input({ railMount: 'interior' }, { wallHeight: 21 }));
      expect(g.rejection).toBe('rail-below-floor');
      expect(g.rails).toEqual([]);
      expect(g.tray).toBeNull();
    });

    it('keeps the default interior tray inside the bin', () => {
      // The shipped default used to leave the tray standing ~18mm proud of the
      // rim, which breaks stacking and looks like a bug.
      const g = resolveSlideGeometry(input({ railMount: 'interior' }));
      const top = (g.tray?.restZ ?? 0) + (g.tray?.heightMm ?? 0);
      expect(top).toBeLessThanOrEqual(42);
    });
  });
});
