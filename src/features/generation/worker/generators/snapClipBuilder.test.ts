// @vitest-environment node
/**
 * Geometry tests for the snap-clip part and snap-hole cutter.
 *
 * The clip's mechanical behavior depends on a precise asymmetric barb:
 * - Steep retention shoulder above (~27° from vertical)
 * - Gentle lead-in cone below (~37° from vertical)
 * - Wide point of barb between them, sized to fit the through-hole
 *   under elastic PETG compression
 *
 * Bbox checks confirm every constant is wired correctly: tiny errors in
 * prong/bridge dimensions silently produce unprintable or unsnapping clips.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  SNAP_PRONG_DIAMETER,
  SNAP_PRONG_INSET,
  SNAP_PRONG_OVERSHOOT,
  SNAP_BRIDGE_THICKNESS,
  SNAP_BRIDGE_WIDTH,
  SNAP_BRIDGE_LENGTH_MARGIN,
  SNAP_BARB_FLARE,
  SNAP_BARB_RETAIN_HEIGHT,
  SNAP_BARB_LEAD_HEIGHT,
  SNAP_TIP_RADIUS,
  SNAP_HOLE_DIAMETER,
  SNAP_HOLE_CLEARANCE,
} from './generatorConstants';

type ExportClip = (slabThickness: number, format: 'stl') => Promise<{ data: ArrayBuffer }>;

let exportSnapClip: ExportClip;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./snapClipBuilder');
  exportSnapClip = mod.exportSnapClip;
}, 30000);

interface Bbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function stlBbox(stl: ArrayBuffer): Bbox {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const v = parsed.value.vertices;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < v.length; i += 3) {
    if (v[i] < minX) minX = v[i];
    if (v[i] > maxX) maxX = v[i];
    if (v[i + 1] < minY) minY = v[i + 1];
    if (v[i + 1] > maxY) maxY = v[i + 1];
    if (v[i + 2] < minZ) minZ = v[i + 2];
    if (v[i + 2] > maxZ) maxZ = v[i + 2];
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

describe('snap clip geometry', () => {
  describe('asymmetric barb invariants', () => {
    it('barb max radius exceeds hole radius (interference for snap retention)', () => {
      const prongR = SNAP_PRONG_DIAMETER / 2;
      const barbR = prongR + SNAP_BARB_FLARE;
      const holeR = SNAP_HOLE_DIAMETER / 2;
      expect(barbR).toBeGreaterThan(holeR);
      // …but stays within PETG elastic range (interference < 0.15mm radial)
      expect(barbR - holeR).toBeLessThan(0.15);
    });

    it('retention shoulder is shorter than lead-in cone (asymmetric snap)', () => {
      // The asymmetry that makes "easy push, hard pull" lives in the *heights*,
      // not the cone angles: the retention shoulder concentrates its radial
      // change (prong → barb-max) over a small height, producing an abrupt
      // click on pull-out. The lead-in cone spreads its radial change
      // (barb-max → tip) over a longer height, so insertion feels gradual.
      expect(SNAP_BARB_RETAIN_HEIGHT).toBeLessThan(SNAP_BARB_LEAD_HEIGHT);
    });

    it('barb radial flare maps to a non-trivial retention slope', () => {
      // A degenerate flare (≈0) would make pull-out frictionless. Sanity-check
      // that the wide-point's radial offset is at least 1× the hole clearance,
      // i.e. the barb is genuinely wider than what the hole accommodates.
      expect(SNAP_BARB_FLARE).toBeGreaterThanOrEqual(SNAP_HOLE_CLEARANCE);
    });

    it('hole clearance leaves room for prong shaft', () => {
      // Shaft sits in hole with `SNAP_HOLE_CLEARANCE` per side. Prevents jamming.
      expect(SNAP_HOLE_CLEARANCE).toBeGreaterThan(0);
      expect(SNAP_HOLE_DIAMETER).toBeCloseTo(SNAP_PRONG_DIAMETER + 2 * SNAP_HOLE_CLEARANCE, 5);
    });

    it('tip radius is small but printable', () => {
      // FDM elephant's-foot effect rounds anything below ~0.4mm radius.
      expect(SNAP_TIP_RADIUS).toBeGreaterThanOrEqual(0.5);
      expect(SNAP_TIP_RADIUS).toBeLessThan(SNAP_PRONG_DIAMETER / 2);
    });
  });

  describe('exported STL bbox', () => {
    it('matches expected dimensions for a 5mm slab', async () => {
      const slabThickness = 5;
      const result = await exportSnapClip(slabThickness, 'stl');
      const bbox = stlBbox(result.data);

      // X (along seam): bridge length = 2 × (INSET + LENGTH_MARGIN)
      const expectedLen = 2 * (SNAP_PRONG_INSET + SNAP_BRIDGE_LENGTH_MARGIN);
      expect(bbox.maxX - bbox.minX).toBeCloseTo(expectedLen, 1);

      // Y (perpendicular to seam): bridge width
      expect(bbox.maxY - bbox.minY).toBeCloseTo(SNAP_BRIDGE_WIDTH, 1);

      // Z (print height): bridge + (shaft = slab + overshoot) + barb total.
      // The overshoot is what places the barb's wide point below the slab
      // bottom in use orientation, giving real mechanical engagement.
      const expectedH =
        SNAP_BRIDGE_THICKNESS +
        slabThickness +
        SNAP_PRONG_OVERSHOOT +
        SNAP_BARB_RETAIN_HEIGHT +
        SNAP_BARB_LEAD_HEIGHT;
      expect(bbox.maxZ - bbox.minZ).toBeCloseTo(expectedH, 1);

      // Bridge sits on Z=0 (print orientation: build plate)
      expect(bbox.minZ).toBeCloseTo(0, 1);
    }, 30000);

    it('prong shaft length scales with slab thickness', async () => {
      const a = await exportSnapClip(5, 'stl');
      const b = await exportSnapClip(10, 'stl');
      const heightDiff = stlBbox(b.data).maxZ - stlBbox(a.data).maxZ;
      expect(heightDiff).toBeCloseTo(5, 1);
    }, 30000);

    it('shaft applies SNAP_PRONG_OVERSHOOT (barb seats below slab bottom)', async () => {
      // Regression guard: an earlier draft defined SNAP_PRONG_OVERSHOOT but
      // forgot to add it to shaftLen, leaving the barb shoulder flush with
      // the slab bottom instead of below it. Verify the overshoot is in the
      // total clip height by comparing the actual bbox to the no-overshoot
      // baseline.
      const slab = 5;
      const result = await exportSnapClip(slab, 'stl');
      const totalH = stlBbox(result.data).maxZ - stlBbox(result.data).minZ;
      const withoutOvershoot =
        SNAP_BRIDGE_THICKNESS + slab + SNAP_BARB_RETAIN_HEIGHT + SNAP_BARB_LEAD_HEIGHT;
      expect(totalH - withoutOvershoot).toBeCloseTo(SNAP_PRONG_OVERSHOOT, 1);
    }, 30000);
  });
});
