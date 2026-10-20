// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { initTestKernel } from '@/test/initTestKernel';
import { boundingBox, sectionHalfWidth } from './__kernel-tests__/meshAssertions';
import {
  SOCKET_HEIGHT,
  PLATE_PROFILE_HEIGHT,
  LOW_PROFILE_BAND_CUT_MM,
  toIndexedMeshData,
} from './generatorTypes';
import { buildScrewCutters } from './baseplateScrews';

const COUNTERSINK: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'countersink',
};

const COUNTERBORE: ScrewHoleParams = { ...COUNTERSINK, headStyle: 'counterbore' };

describe('buildScrewCutters', () => {
  beforeAll(async () => {
    await initTestKernel();
  });

  const totalHeight = SOCKET_HEIGHT + 3.1;

  /** Tessellate a cutter so its extents can be measured. */
  function bbox(shape: Shape3D) {
    return boundingBox(mesh(shape, { tolerance: 0.01, angularTolerance: 5 }).vertices);
  }

  it('builds nothing for no holes', () => {
    expect(buildScrewCutters([], COUNTERSINK, totalHeight, PLATE_PROFILE_HEIGHT)).toEqual([]);
  });

  it('builds one solid per hole', () => {
    const cutters = buildScrewCutters(
      [
        { x: -13, y: -13, site: 'floor' },
        { x: 13, y: 13, site: 'floor' },
      ],
      COUNTERSINK,
      totalHeight,
      PLATE_PROFILE_HEIGHT
    );
    try {
      expect(cutters).toHaveLength(2);
      for (const c of cutters) expect(c).toBeDefined();
    } finally {
      for (const c of cutters) c.delete();
    }
  });

  it('reaches the underside from a margin entry', () => {
    // A margin screw enters at the top face and must run clear through, or it
    // fastens nothing.
    const [cutter] = buildScrewCutters(
      [{ x: 0, y: 0, site: 'margin' }],
      COUNTERSINK,
      totalHeight,
      PLATE_PROFILE_HEIGHT
    );
    try {
      const bb = bbox(cutter);
      expect(bb.minZ).toBeLessThanOrEqual(-totalHeight);
      expect(bb.maxZ).toBeGreaterThan(0);
    } finally {
      cutter.delete();
    }
  });

  it('enters a floor hole at the pocket floor, not the top face', () => {
    // The head recess belongs at the pocket floor; starting it at the top would
    // carve a cone through the middle of the socket a bin seats in.
    const [cutter] = buildScrewCutters(
      [{ x: 0, y: 0, site: 'floor' }],
      COUNTERSINK,
      totalHeight,
      PLATE_PROFILE_HEIGHT
    );
    try {
      const bb = bbox(cutter);
      expect(bb.maxZ).toBeLessThan(0);
      expect(bb.maxZ).toBeGreaterThan(-SOCKET_HEIGHT);
      expect(bb.minZ).toBeLessThanOrEqual(-totalHeight);
    } finally {
      cutter.delete();
    }
  });

  it('moves a floor entry up with a low-profile pocket floor', () => {
    const lowProfile = PLATE_PROFILE_HEIGHT - LOW_PROFILE_BAND_CUT_MM;
    const lowTotal = totalHeight - LOW_PROFILE_BAND_CUT_MM;
    const [standard] = buildScrewCutters(
      [{ x: 0, y: 0, site: 'floor' }],
      COUNTERSINK,
      totalHeight,
      PLATE_PROFILE_HEIGHT
    );
    const [low] = buildScrewCutters(
      [{ x: 0, y: 0, site: 'floor' }],
      COUNTERSINK,
      lowTotal,
      lowProfile
    );
    try {
      const a = bbox(standard);
      const b = bbox(low);
      expect(b.maxZ - a.maxZ).toBeCloseTo(LOW_PROFILE_BAND_CUT_MM, 2);
      expect(b.minZ).toBeLessThanOrEqual(-lowTotal);
    } finally {
      standard.delete();
      low.delete();
    }
  });

  it('makes the countersink as wide as the head at its entry plane', () => {
    const [cutter] = buildScrewCutters(
      [{ x: 0, y: 0, site: 'floor' }],
      COUNTERSINK,
      totalHeight,
      PLATE_PROFILE_HEIGHT
    );
    try {
      const bb = bbox(cutter);
      expect(bb.maxX - bb.minX).toBeCloseTo(8, 1);
    } finally {
      cutter.delete();
    }
  });

  it('survives a head no wider than the shaft', () => {
    // Reachable from the UI: the shaft slider tops out at 8mm and the
    // countersink head defaults to 8mm, so the cone collapses to zero depth and
    // a loft between two coincident sections would throw.
    const flat: ScrewHoleParams = { ...COUNTERSINK, diameter: mm(8) };
    const cutters = buildScrewCutters(
      [{ x: 0, y: 0, site: 'floor' }],
      flat,
      totalHeight,
      PLATE_PROFILE_HEIGHT
    );
    try {
      expect(cutters).toHaveLength(1);
      const bb = bbox(cutters[0]);
      expect(bb.maxX - bb.minX).toBeCloseTo(8, 1);
      expect(bb.minZ).toBeLessThanOrEqual(-totalHeight);
    } finally {
      for (const c of cutters) c.delete();
    }
  });

  it('survives a head narrower than the shaft', () => {
    const inverted: ScrewHoleParams = { ...COUNTERSINK, diameter: mm(6), headDiameter: mm(4) };
    const cutters = buildScrewCutters(
      [{ x: 0, y: 0, site: 'floor' }],
      inverted,
      totalHeight,
      PLATE_PROFILE_HEIGHT
    );
    try {
      expect(cutters).toHaveLength(1);
      const bb = bbox(cutters[0]);
      expect(bb.maxX - bb.minX).toBeCloseTo(6, 1);
    } finally {
      for (const c of cutters) c.delete();
    }
  });

  it('makes a counterbore a flat pocket of the head diameter', () => {
    const [cutter] = buildScrewCutters(
      [{ x: 0, y: 0, site: 'floor' }],
      COUNTERBORE,
      totalHeight,
      PLATE_PROFILE_HEIGHT
    );
    try {
      const bb = bbox(cutter);
      expect(bb.maxX - bb.minX).toBeCloseTo(5.5, 1);
    } finally {
      cutter.delete();
    }
  });

  it('bores a junction hole head-wide from the top face down to its seat', () => {
    const m3: ScrewHoleParams = { ...COUNTERSINK, headDiameter: mm(6) };
    const seat = 1.25;
    const [cutter] = buildScrewCutters(
      [{ x: 0, y: 0, site: 'junction', seatBelowTopMm: seat }],
      m3,
      PLATE_PROFILE_HEIGHT,
      PLATE_PROFILE_HEIGHT
    );
    try {
      const tessellated = toIndexedMeshData(mesh(cutter, { tolerance: 0.01, angularTolerance: 5 }));
      const bb = boundingBox(tessellated.vertices);
      expect(bb.maxZ).toBeGreaterThan(0);
      expect(bb.minZ).toBeLessThanOrEqual(-PLATE_PROFILE_HEIGHT);
      expect(sectionHalfWidth(tessellated, -seat / 2)).toBeCloseTo(3, 1);
      expect(sectionHalfWidth(tessellated, -(seat + 1.3 + 0.5))).toBeCloseTo(1.7, 1);
    } finally {
      cutter.delete();
    }
  });

  it('builds a template per junction seat, so each hole narrows at its own', () => {
    const m3: ScrewHoleParams = { ...COUNTERSINK, headDiameter: mm(6) };
    const cutters = buildScrewCutters(
      [
        { x: 0, y: 0, site: 'junction', seatBelowTopMm: 1 },
        { x: 0, y: 0, site: 'junction', seatBelowTopMm: 2 },
      ],
      m3,
      PLATE_PROFILE_HEIGHT,
      PLATE_PROFILE_HEIGHT
    );
    try {
      const [shallow, deep] = cutters.map((c) =>
        toIndexedMeshData(mesh(c, { tolerance: 0.01, angularTolerance: 5 }))
      );
      expect(sectionHalfWidth(shallow, -1.5)).toBeLessThan(2.9);
      expect(sectionHalfWidth(deep, -1.5)).toBeCloseTo(3, 1);
    } finally {
      for (const c of cutters) c.delete();
    }
  });
});
