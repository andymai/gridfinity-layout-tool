import { describe, it, expect } from 'vitest';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_PLATE_TEXT_DEPTH_MAX_MM,
  LABEL_PLATE_THICKNESS_MM,
  LABEL_PLATE_V1_CAVITY_TOP_MM,
  LABEL_SOCKET_CLEARANCE_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_FLOOR_MM,
  LABEL_SOCKET_LIP_THICKNESS_MM,
  LABEL_SOCKET_POCKET_DEPTH_MM,
  LABEL_SOCKET_RIB_HEIGHT_MM,
  LABEL_SOCKET_RIB_PROTRUSION_MM,
  LABEL_SOCKET_RIB_START_MM,
  LABEL_SOCKET_SHELF_THICKNESS_MM,
  LABEL_SOCKET_SLIDE_SHELF_THICKNESS_MM,
  LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM,
  LABEL_SOCKET_STACK_RELIEF_MM,
  LABEL_PLATE_WIDTHS_U,
  LABEL_TAB_LIP_HEIGHT_MAX_MM,
  LABEL_TAB_LIP_HEIGHT_MIN_MM,
  MIN_LABEL_SOCKET_TAB_DEPTH_MM,
  defaultLabelShelfTopMm,
  labelLipReservationMm,
  effectiveLabelSocketClearance,
  isLabelPlateWidthU,
  labelPlateV1ChannelsFitText,
  labelPlateV1RoofMm,
  labelPlateWidthMm,
  labelShelfCeilingMm,
  labelSocketOuterWidthMm,
  largestFittingPlateWidthU,
  resolveLabelShelfTopMm,
} from './labelPlates';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

describe('labelPlates', () => {
  // Pinned against the Cullenect v2.0.0 SCAD source — these are interchange
  // dimensions; a drift here breaks compatibility with ecosystem plates.
  it('matches the pinned v2.0.0 plate spec', () => {
    expect(labelPlateWidthMm(1)).toBe(36);
    expect(labelPlateWidthMm(2)).toBe(78);
    expect(labelPlateWidthMm(3)).toBe(120);
    expect(LABEL_PLATE_HEIGHT_MM).toBe(11);
    expect(LABEL_PLATE_THICKNESS_MM).toBe(1.2);
    expect(LABEL_SOCKET_CLEARANCE_MM).toBe(0.3);
    expect(LABEL_SOCKET_POCKET_DEPTH_MM).toBe(1.2);
    expect(LABEL_SOCKET_RIB_PROTRUSION_MM).toBe(0.2);
    expect(LABEL_SOCKET_RIB_HEIGHT_MM).toBe(0.4);
    expect(LABEL_SOCKET_RIB_START_MM).toBe(0.2);
  });

  // Click-in and slide-channel pockets deliberately differ in depth: click-in
  // recesses the plate so it can't stand proud, while a slide plate is clamped
  // to the floor by its lip and would rattle with the same slack. Deriving one
  // shelf from the other is what would silently collapse them.
  it('shelf thickness hosts each style pocket plus the solid floor', () => {
    expect(LABEL_SOCKET_SHELF_THICKNESS_MM).toBeCloseTo(
      LABEL_SOCKET_CLICK_POCKET_DEPTH_MM + LABEL_SOCKET_FLOOR_MM
    );
    expect(LABEL_SOCKET_SLIDE_SHELF_THICKNESS_MM).toBeCloseTo(
      LABEL_SOCKET_POCKET_DEPTH_MM +
        LABEL_SOCKET_FLOOR_MM +
        LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM +
        LABEL_SOCKET_LIP_THICKNESS_MM
    );
  });

  it('guards plate width values', () => {
    expect(LABEL_PLATE_WIDTHS_U).toEqual([1, 2, 3]);
    expect(isLabelPlateWidthU(2)).toBe(true);
    expect(isLabelPlateWidthU(4)).toBe(false);
    expect(isLabelPlateWidthU(null)).toBe(false);
    expect(isLabelPlateWidthU('1')).toBe(false);
  });

  describe('effectiveLabelSocketClearance', () => {
    it('returns the spec clearance at baseline with no offset', () => {
      expect(effectiveLabelSocketClearance(undefined, undefined)).toBe(0.3);
      expect(effectiveLabelSocketClearance(0.4, 0)).toBe(0.3);
    });

    it('applies the signed fit offset', () => {
      expect(effectiveLabelSocketClearance(undefined, 0.1)).toBeCloseTo(0.4);
      expect(effectiveLabelSocketClearance(undefined, -0.2)).toBeCloseTo(0.1);
    });

    it('grows with nozzles above the baseline', () => {
      expect(effectiveLabelSocketClearance(0.6, 0)).toBeCloseTo(0.4);
    });

    it('never goes negative and ignores non-finite offsets', () => {
      expect(effectiveLabelSocketClearance(undefined, -5)).toBe(0);
      expect(effectiveLabelSocketClearance(undefined, Number.NaN)).toBe(0.3);
    });
  });

  describe('shelf planes', () => {
    // Ties the socket constants to the bin-stacking geometry they live under.
    // Lip and base carry the same 45° taper offset by the fit clearance, so a
    // stacked bin's foot comes to rest TOLERANCE/2 above the interior ceiling,
    // and the worst case — a plate perched on the rib tops instead of clicking
    // home, carrying the deepest emboss — has to fit under that. Asserting the
    // relief against its own definition instead would pass for any value.
    it('keeps the worst-case plate under the plane a stacked bin seats on', () => {
      const perchedPlateTopAboveShelf =
        LABEL_SOCKET_RIB_START_MM +
        LABEL_SOCKET_RIB_HEIGHT_MM +
        LABEL_PLATE_THICKNESS_MM -
        LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;
      expect(perchedPlateTopAboveShelf).toBeGreaterThan(0);

      // Heights relative to the interior ceiling (negative = below it).
      const shelfTop = -LABEL_SOCKET_STACK_RELIEF_MM;
      const worstCasePlateTop =
        shelfTop + perchedPlateTopAboveShelf + LABEL_PLATE_TEXT_DEPTH_MAX_MM;
      expect(worstCasePlateTop).toBeLessThanOrEqual(GRIDFINITY_SPEC.TOLERANCE / 2);
    });

    // The relief costs tab-height budget: the shortest bin that can host a
    // socket must still leave the depth floor strictly below the shelf.
    it('leaves a 3u lipped bin able to host the minimum socket depth', () => {
      const shelfTop = defaultLabelShelfTopMm(labelShelfCeilingMm(16, true), true, {
        mode: 'socket',
      });
      expect(shelfTop).toBeGreaterThan(MIN_LABEL_SOCKET_TAB_DEPTH_MM);
    });

    // A flush pocket has no Z play, so an over-extruded plate or an elephant's
    // foot on its bottom flange stands proud of the shelf.
    it('recesses a seated click-in plate below the shelf top', () => {
      expect(LABEL_SOCKET_CLICK_POCKET_DEPTH_MM).toBeGreaterThan(LABEL_PLATE_THICKNESS_MM);
    });

    it('ceiling subtracts the lip bottom taper only when a lip exists', () => {
      expect(labelShelfCeilingMm(16, true)).toBeCloseTo(15.3);
      expect(labelShelfCeilingMm(16, false)).toBe(16);
    });

    it('sinks the default shelf for click-in sockets on lipped bins only', () => {
      const clickIn = { mode: 'socket' as const };
      expect(defaultLabelShelfTopMm(15.3, true, clickIn)).toBeCloseTo(
        15.3 - LABEL_SOCKET_STACK_RELIEF_MM
      );
      // Explicit clickIn style behaves like the absent-default.
      expect(
        defaultLabelShelfTopMm(15.3, true, { ...clickIn, socketStyle: 'clickIn' })
      ).toBeCloseTo(15.3 - LABEL_SOCKET_STACK_RELIEF_MM);
      // No lip → nothing locates on top → no relief.
      expect(defaultLabelShelfTopMm(16, false, clickIn)).toBe(16);
      // Slide-channel plates already ride below the lip band → no relief.
      expect(defaultLabelShelfTopMm(15.3, true, { ...clickIn, socketStyle: 'slideChannel' })).toBe(
        15.3
      );
      // Text mode never shifts.
      expect(defaultLabelShelfTopMm(15.3, true, {})).toBe(15.3);
      expect(defaultLabelShelfTopMm(15.3, true, { mode: 'text' })).toBe(15.3);
    });

    // The label lip reserves shelf headroom so the rim tops at the ceiling.
    it('reserves the lip height only on enabled text-mode tabs', () => {
      expect(labelLipReservationMm({ lip: true, lipHeight: 1 })).toBe(1);
      expect(labelLipReservationMm({ lip: true, lipHeight: 1, mode: 'text' })).toBe(1);
      // Absent lipHeight → default (1mm).
      expect(labelLipReservationMm({ lip: true })).toBe(1);
      // Disabled, or socket mode → nothing reserved.
      expect(labelLipReservationMm({ lip: false, lipHeight: 2 })).toBe(0);
      expect(labelLipReservationMm({ lip: true, lipHeight: 2, mode: 'socket' })).toBe(0);
      expect(labelLipReservationMm({})).toBe(0);
      // Out-of-range stored values are clamped to the supported band.
      expect(labelLipReservationMm({ lip: true, lipHeight: 99 })).toBe(LABEL_TAB_LIP_HEIGHT_MAX_MM);
      expect(labelLipReservationMm({ lip: true, lipHeight: 0.01 })).toBe(
        LABEL_TAB_LIP_HEIGHT_MIN_MM
      );
    });

    it('drops the default shelf top by the lip height on text-mode tabs', () => {
      expect(defaultLabelShelfTopMm(15.3, true, { lip: true, lipHeight: 1 })).toBeCloseTo(14.3);
      expect(defaultLabelShelfTopMm(16, false, { lip: true, lipHeight: 2 })).toBe(14);
      // No lip → unchanged (byte-identical to legacy configs).
      expect(defaultLabelShelfTopMm(16, false, {})).toBe(16);
      // Socket relief and lip are mutually exclusive; the larger reservation wins.
      expect(defaultLabelShelfTopMm(15.3, true, { mode: 'socket', lip: true, lipHeight: 5 })).toBe(
        15.3 - LABEL_SOCKET_STACK_RELIEF_MM
      );
    });

    it('caps an explicit height at the lip-relieved plane (keeps lower heights)', () => {
      // Explicit height above ceiling−lip is lowered so the rim stays under the ceiling.
      expect(
        resolveLabelShelfTopMm(15.3, false, { lip: true, lipHeight: 1, height: 15.3 })
      ).toBeCloseTo(14.3);
      // A custom tuck-under below that plane is left untouched.
      expect(resolveLabelShelfTopMm(15.3, false, { lip: true, lipHeight: 1, height: 10 })).toBe(10);
    });

    it('resolveLabelShelfTopMm honors an explicit height below the cap', () => {
      expect(resolveLabelShelfTopMm(15.3, true, { mode: 'socket', height: 12 })).toBe(12);
      expect(resolveLabelShelfTopMm(15.3, true, { mode: 'socket' })).toBeCloseTo(
        15.3 - LABEL_SOCKET_STACK_RELIEF_MM
      );
    });

    it('caps an explicit height at the relieved plane where the relief applies', () => {
      // Click-in socket on a lipped bin: the ceiling is exactly where the next
      // bin up seats, so an explicit height there breaks stacking.
      expect(resolveLabelShelfTopMm(15.3, true, { mode: 'socket', height: 15.3 })).toBeCloseTo(
        15.3 - LABEL_SOCKET_STACK_RELIEF_MM
      );
      // Nothing to relieve → the explicit height stands, including the
      // out-of-range value the silent-drop warning exists to flag.
      expect(resolveLabelShelfTopMm(15.3, true, { mode: 'text', height: 15.8 })).toBe(15.8);
      expect(resolveLabelShelfTopMm(16, false, { mode: 'socket', height: 16 })).toBe(16);
      expect(
        resolveLabelShelfTopMm(15.3, true, {
          mode: 'socket',
          socketStyle: 'slideChannel',
          height: 15.3,
        })
      ).toBe(15.3);
    });
  });

  describe('v1 back-compat channels', () => {
    // At the default 0.4mm deboss the engraving floor lands exactly on the
    // cavity roof — a zero-thickness membrane that slices as an open hole.
    it('rejects the channels when a debossed glyph would breach the roof', () => {
      expect(labelPlateV1RoofMm('deboss', LABEL_PLATE_TEXT_DEPTH_MAX_MM)).toBeCloseTo(0);
      expect(labelPlateV1ChannelsFitText('deboss', LABEL_PLATE_TEXT_DEPTH_MAX_MM)).toBe(false);
      expect(labelPlateV1ChannelsFitText('deboss', 0.2)).toBe(false);
    });

    it('keeps the channels for embossed text, which adds material', () => {
      expect(labelPlateV1RoofMm('emboss', LABEL_PLATE_TEXT_DEPTH_MAX_MM)).toBeCloseTo(
        LABEL_PLATE_THICKNESS_MM - LABEL_PLATE_V1_CAVITY_TOP_MM
      );
      expect(labelPlateV1ChannelsFitText('emboss', LABEL_PLATE_TEXT_DEPTH_MAX_MM)).toBe(true);
      expect(labelPlateV1ChannelsFitText('deboss', 0)).toBe(true);
    });
  });

  describe('largestFittingPlateWidthU', () => {
    it('picks the largest standard width whose socket fits', () => {
      // 1U bin interior at default walls: 39.1mm — hosts a 1U socket (38.3).
      expect(largestFittingPlateWidthU(39.1, 0.3)).toBe(1);
      expect(largestFittingPlateWidthU(labelSocketOuterWidthMm(2, 0.3), 0.3)).toBe(2);
      expect(largestFittingPlateWidthU(1000, 0.3)).toBe(3);
    });

    it('returns null when even 1U does not fit', () => {
      expect(largestFittingPlateWidthU(38, 0.3)).toBeNull();
      expect(largestFittingPlateWidthU(0, 0.3)).toBeNull();
    });
  });
});
