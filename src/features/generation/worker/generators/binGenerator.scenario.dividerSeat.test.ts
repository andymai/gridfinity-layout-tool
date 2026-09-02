/**
 * Scenario test: a removable divider can reach its lock.
 *
 * The wall slot's head pocket and throat only work if the divider can seat at
 * the pocket. Every base style carries a 2mm interior floor (binFloorMm), so a
 * slot that starts inside that floor buries the pocket where no divider can
 * drop to it, and the divider's full-thickness head lands on the throat
 * instead. That is what shipped for the first two retention attempts. This
 * probes the real body at one slot: the pocket is open from the seat up, the
 * wall is solid below the seat, the throat nubs stand above the floor top, and
 * the floor groove clears the divider line so the seat is reachable.
 *
 * Cross-kernel:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --project=generators dividerSeat
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateSlotPositions,
  getDividerLockPlan,
  getEffectiveSlotDimensions,
} from '@/shared/utils/slotMath';
import { LIP_TAPER_WIDTH } from './generatorConstants';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('removable divider seat through the real kernel', () => {
  for (const floorGroove of [true, false]) {
    it(`slots open at the seat and the throat sits above the floor (groove ${floorGroove ? 'on' : 'off'})`, async () => {
      const { box, intersect, measureVolume, unwrap } = await import('brepjs');
      const { createInitialContext, runPipeline } = await import('./pipeline');
      const { shellStage } = await import('./pipeline/stages/shellStage');
      const { featuresStage } = await import('./pipeline/stages/featuresStage');
      const { booleanStage } = await import('./pipeline/stages/booleanStage');

      const params: BinParams = buildParams({
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 40 },
          y: { enabled: false, pitch: 40 },
        },
        dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, floorGroove },
      });
      const ctx = runPipeline(
        [shellStage, featuresStage, booleanStage],
        createInitialContext(params, undefined, true)
      );
      const bin = ctx.solid;
      expect(bin).not.toBeNull();
      if (!bin) return;
      const dim = ctx.dimensions;
      expect(dim.dividerGrooveDepth).toBe(floorGroove ? 0.8 : 0);

      const floorTop = dim.floorThickness;
      const seat = floorTop - dim.dividerGrooveDepth;
      const { thickness, clearance } = params.dividerPieces;
      const lock = getDividerLockPlan(thickness, clearance);
      const { slotWidth, slotDepth } = getEffectiveSlotDimensions(
        params.wallThickness,
        thickness,
        clearance
      );
      const lipOverhang = dim.hasLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
      // X-axis slots sit on the left/right walls, spaced along the depth.
      const [crossY] = calculateSlotPositions(dim.innerD, params.slotConfig.x.pitch, lipOverhang);
      expect(crossY).toBeDefined();
      const wallX = -(dim.innerW / 2 + slotDepth / 2);

      // Fraction of a probe box that is solid bin.
      const solidFraction = (
        w: number,
        d: number,
        h: number,
        at: [number, number, number]
      ): number => {
        const probe = box(w, d, h, { at });
        try {
          const hit = unwrap(intersect(bin, probe, { optimisation: 'none' }));
          try {
            return unwrap(measureVolume(hit)) / (w * d * h);
          } finally {
            hit.delete();
          }
        } catch {
          return 0;
        } finally {
          probe.delete();
        }
      };

      // Head pocket: open across the pocket width from the seat up.
      const pocketBand = lock.headHeight - 0.2;
      expect(
        solidFraction(slotDepth * 0.5, lock.pocketWidth * 0.8, pocketBand, [
          wallX,
          crossY,
          seat + lock.headHeight / 2,
        ])
      ).toBeLessThan(0.05);

      // Below the seat the wall (and floor) stay solid: the slot never cuts
      // into whatever the divider is meant to stand on.
      expect(
        solidFraction(slotDepth * 0.5, lock.pocketWidth * 0.8, 0.4, [wallX, crossY, seat - 0.3])
      ).toBeGreaterThan(0.95);

      // Throat: above the floor top, the slot narrows. The nubs on either side
      // of the throat width are solid; the throat itself is open.
      const throatZ = seat + lock.headHeight + lock.throatHeight / 2;
      const nubY = crossY + (lock.throatWidth + lock.pocketWidth) / 4;
      const nubWidth = (lock.pocketWidth - lock.throatWidth) / 2;
      expect(throatZ).toBeGreaterThan(floorTop);
      expect(
        solidFraction(slotDepth * 0.5, nubWidth * 0.6, lock.throatHeight * 0.6, [
          wallX,
          nubY,
          throatZ,
        ])
      ).toBeGreaterThan(0.9);
      expect(
        solidFraction(slotDepth * 0.5, lock.throatWidth * 0.6, lock.throatHeight * 0.6, [
          wallX,
          crossY,
          throatZ,
        ])
      ).toBeLessThan(0.05);

      // The floor along the divider line is cut down to the seat when the
      // groove is on, and untouched when it is off; the floor beside the line
      // is solid either way.
      const grooveZ = floorTop - 0.4;
      const onLine = solidFraction(6, slotWidth * 0.6, 0.6, [0, crossY, grooveZ]);
      const offLine = solidFraction(6, slotWidth * 0.6, 0.6, [0, crossY + slotWidth + 3, grooveZ]);
      expect(offLine).toBeGreaterThan(0.95);
      if (floorGroove) {
        expect(onLine).toBeLessThan(0.05);
      } else {
        expect(onLine).toBeGreaterThan(0.95);
      }

      bin.delete();
    }, 180_000);
  }
});
