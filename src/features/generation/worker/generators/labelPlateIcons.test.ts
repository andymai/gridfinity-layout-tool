// @vitest-environment node
/**
 * Silhouette-level checks for plate hardware icons — every icon in the catalog,
 * without the expensive plate boolean. The per-icon emboss/deboss sweep against
 * a real plate lives in `labelPlateIcons.plate.test.ts` so CI can shard the two
 * apart as the catalog grows.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume } from 'brepjs';
import { isOk } from '@/core/result';
import { LABEL_ICON_PATHS } from '@/shared/constants/labelIconPaths';
import { LABEL_PLATE_ICONS } from '@/shared/constants/labelPlates';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { ICON_MAX_WIDTH_MM, TEXT_BAND_MM } from './labelPlateBuilder';
import { buildIconSolid, measureIconBox } from './labelPlateIcons';
import { sketch } from './meshUtils';
import { drawingFromSvgPath } from './svgDrawing';
import { TEXT_BOOLEAN_EPSILON } from './textBuilder';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const DEPTH_MM = 0.4;
/** Extruded height of an emboss solid, epsilon included. */
const SOLID_HEIGHT_MM = DEPTH_MM + TEXT_BOOLEAN_EPSILON;

/** Volume of the icon solid the plate builder actually fuses. */
const solidVolume = (icon: LabelPlateIconId): number => {
  const built = buildIconSolid({
    icon,
    heightMm: TEXT_BAND_MM,
    maxWidthMm: ICON_MAX_WIDTH_MM,
    centerX: 0,
    centerY: 0,
    topZ: 0,
    depthMm: DEPTH_MM,
    mode: 'emboss',
  });
  if (!built) throw new Error(`buildIconSolid returned null for ${icon}`);
  try {
    const r = measureVolume(built.solid);
    if (!isOk(r)) throw new Error('measureVolume failed');
    return r.value;
  } finally {
    built.solid.delete();
  }
};

describe('labelPlateIcons catalog', () => {
  it('has path data for every id in the allowlist', () => {
    expect(Object.keys(LABEL_ICON_PATHS).sort()).toEqual([...LABEL_PLATE_ICONS].sort());
  });

  it('imports every outline into a non-degenerate drawing', () => {
    for (const icon of LABEL_PLATE_ICONS) {
      const drawing = drawingFromSvgPath(LABEL_ICON_PATHS[icon].outline);
      expect(drawing, icon).not.toBeNull();
      const { width, height } = drawing?.boundingBox ?? { width: 0, height: 0 };
      expect(width, icon).toBeGreaterThan(0);
      expect(height, icon).toBeGreaterThan(0);
    }
  });

  it('builds a positive-volume solid for every icon', () => {
    for (const icon of LABEL_PLATE_ICONS) {
      expect(solidVolume(icon), icon).toBeGreaterThan(0);
    }
  });

  // Icons are fitted by their own silhouette bounds, not a shared design
  // frame: the side-view fasteners only ink 52-68% of a +/-5 frame vertically,
  // so a frame-relative box rendered a bolt at ~2/3 the visual weight of a
  // washer and left both dwarfed by the (ink-fitted) text.
  it('fits every icon to the readable band or the width cap', () => {
    for (const icon of LABEL_PLATE_ICONS) {
      const box = measureIconBox(icon, TEXT_BAND_MM, ICON_MAX_WIDTH_MM);
      expect(box, icon).not.toBeNull();
      if (!box) continue;
      expect(box.heightMm, icon).toBeLessThanOrEqual(TEXT_BAND_MM + 1e-6);
      expect(box.widthMm, icon).toBeLessThanOrEqual(ICON_MAX_WIDTH_MM + 1e-6);
      // Every icon is as large as the box allows — one axis is always at its
      // limit, so none can render at an arbitrary fraction of the band.
      const fillsBand = Math.abs(box.heightMm - TEXT_BAND_MM) < 1e-6;
      const widthCapped = Math.abs(box.widthMm - ICON_MAX_WIDTH_MM) < 1e-6;
      expect(fillsBand || widthCapped, icon).toBe(true);
    }
  });
});

describe('SVG conversion fidelity', () => {
  // Locks the six originally hand-authored brepjs draw() chains against the
  // sizes they rendered at before the SVG port. A silhouette that drifts here
  // is a changed physical print, not a refactor.
  const RENDERED_BOX_MM: Record<string, readonly [number, number]> = {
    bolt: [11.470588, 7.8],
    screw: [11.5, 7.36],
    woodScrew: [11.5, 5.98],
    nut: [6.754998, 7.8],
    washer: [7.8, 7.8],
    nail: [11.5, 6.9],
  };

  it('renders the ported icons at their pre-port sizes', () => {
    for (const [icon, [w, h]] of Object.entries(RENDERED_BOX_MM)) {
      const box = measureIconBox(icon as LabelPlateIconId, TEXT_BAND_MM, ICON_MAX_WIDTH_MM);
      expect(box, icon).not.toBeNull();
      expect(box?.widthMm, `${icon} width`).toBeCloseTo(w, 5);
      expect(box?.heightMm, `${icon} height`).toBeCloseTo(h, 5);
    }
  });

  it('imports arcs as exact circles rather than polylines', () => {
    // The washer is a plain disc scaled to the band, so its outer boundary is
    // analytic: a faceted approximation would fall short well outside this
    // tolerance. Radius 5 fits to a 7.8mm band, i.e. scale 0.78.
    const outerRadius = 5 * 0.78;
    const boreRadius = 2.6 * 0.78;
    expect(solidVolume('washer')).toBeCloseTo(
      Math.PI * (outerRadius ** 2 - boreRadius ** 2) * SOLID_HEIGHT_MM,
      6
    );
  });

  // A bore that fails to cut leaves the bounding box untouched and still adds
  // volume to the plate, so it passes every existing assertion. Only the
  // solid's own volume catches it — this is how the washer shipped as a disc.
  it('cuts real bores in the holed icons', () => {
    const scale = 0.78;
    const hexArea = 1.5 * Math.sqrt(3) * (5 * scale) ** 2;
    expect(solidVolume('nut')).toBeCloseTo(
      (hexArea - Math.PI * (2.4 * scale) ** 2) * SOLID_HEIGHT_MM,
      6
    );

    // Guard the specific regression: an uncut washer would measure the full
    // disc, ~37% more material.
    const uncutDisc = Math.PI * (5 * scale) ** 2 * SOLID_HEIGHT_MM;
    expect(solidVolume('washer')).toBeLessThan(uncutDisc * 0.95);
  });

  // A split washer differs from a plain one by its gap alone, so an outline
  // that closed the gap — or opened it into a C — would still be a ring of the
  // right size on the plate. Enclosed area is the only measure that sees it.
  it('leaves the lock washer a ring with a gap in it', () => {
    const scale = TEXT_BAND_MM / 10;
    const gapFraction = 20 / 360;
    const annulus = Math.PI * (5 ** 2 - 2.6 ** 2) * scale ** 2;
    // Loose to the path's own 3dp endpoints, tight enough to reject both a ring
    // with no gap and one opened out into a C.
    expect(solidVolume('lockWasher')).toBeCloseTo(annulus * (1 - gapFraction) * SOLID_HEIGHT_MM, 2);
  });

  // The horseshoe's outer boundary meets its legs tangentially, which collapses
  // a true-arc wire to roughly half its area while leaving the bounding box
  // correct. Hence the polyline arch — and hence this guard. A 1% band is far
  // tighter than that failure (48% low) and loose enough for the polyline.
  it('keeps the horseshoe arch at its full enclosed area', () => {
    const magnetScale = TEXT_BAND_MM / 8.3;
    const arch = (Math.PI * (4.4 ** 2 - 1.8 ** 2)) / 2 + 2 * (2.6 * 3.9);
    const poleFaces = 2 * (1.8 * 1.0);
    const expected = (arch - poleFaces) * magnetScale ** 2 * SOLID_HEIGHT_MM;
    const actual = solidVolume('magnet');
    expect(actual).toBeGreaterThan(expected * 0.99);
    expect(actual).toBeLessThan(expected * 1.01);
  });

  /**
   * Enclosed area of a design-frame path, via a unit-height extrusion. brepjs
   * has no 2D area measure, and volume of a known height is exact.
   */
  const pathArea = (d: string): number => {
    const drawing = drawingFromSvgPath(d);
    if (!drawing) throw new Error('drawingFromSvgPath returned null');
    const solid = sketch(drawing, 'XY', 0).extrude(1);
    try {
      const r = measureVolume(solid);
      if (!isOk(r)) throw new Error('measureVolume failed');
      return r.value;
    } finally {
      solid.delete();
    }
  };

  // Generalises the nut and washer checks above to every other holed icon,
  // including ones whose boundaries are curves with no closed-form area. Area
  // is measured in the design frame and carried across by scale², because holes
  // take the same transform as the outline they sit in.
  //
  // Bounded rather than exact: `eyeBolt`'s bore crosses its own outline where
  // the eye meets the shank, so the part of it outside the silhouette removes
  // nothing, and full-hole equality would fail on an icon that is fine. The
  // floor still fails a bore that cut nothing at all, which is the defect —
  // this is how the washer shipped as a disc.
  it('cuts every declared hole in every holed icon', () => {
    const checked: LabelPlateIconId[] = [];
    for (const icon of LABEL_PLATE_ICONS) {
      const def = LABEL_ICON_PATHS[icon];
      if (!def.holes?.length) continue;

      const outline = drawingFromSvgPath(def.outline);
      const box = measureIconBox(icon, TEXT_BAND_MM, ICON_MAX_WIDTH_MM);
      expect(outline, icon).not.toBeNull();
      expect(box, icon).not.toBeNull();
      if (!outline || !box) continue;

      const perMm2 = (box.heightMm / outline.boundingBox.height) ** 2 * SOLID_HEIGHT_MM;
      const declared = def.holes.reduce((sum, hole) => sum + pathArea(hole), 0) * perMm2;
      const removed = pathArea(def.outline) * perMm2 - solidVolume(icon);

      expect(removed, `${icon} bore did not cut`).toBeGreaterThan(declared * 0.75);
      expect(removed, `${icon} removed more than its holes`).toBeLessThan(declared * 1.001);
      checked.push(icon);
    }
    // Guards the guard: a rename that emptied this loop would pass silently.
    expect(checked).toEqual(
      expect.arrayContaining([
        'spatula',
        'whisk',
        'bottleOpener',
        'peeler',
        'nut',
        'washer',
        'clip',
      ])
    );
  });

  it('returns null rather than throwing on unparseable path data', () => {
    expect(drawingFromSvgPath('')).toBeNull();
    expect(drawingFromSvgPath('not a path')).toBeNull();
  });
});
