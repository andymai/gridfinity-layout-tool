/** The bin's top shape: the lip peak finish and the loft or sweep that carries the wall profile up to it. */

import {
  draw,
  drawRoundedRectangle,
  drawRectangle,
  unwrap,
  fuse,
  cut,
  fillet,
  chamfer,
  edgeFinder,
  getBounds,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, Plane, Sketch, Vec3, DisposalScope, Drawing } from 'brepjs';
import {
  SIZE,
  CLEARANCE,
  BOX_CORNER_RADIUS,
  LIP_SMALL_TAPER,
  LIP_VERTICAL_PART,
  LIP_BIG_TAPER,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  LIP_OVERLAP,
  safeSectionRect,
} from './generatorTypes';
import { getLipCache, setLipCache } from './shapeCache';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { resolvePitch, pitchKeySegments, type GridUnitInput } from './gridPitch';
import { hashMask, isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { DEFAULT_LIP_TIP, LIP_TIP_MM, type LipTipStyle } from '@/shared/types/bin';
import { hasOverhang, overhangExpansion, overhangKey, type ResolvedOverhang } from './overhang';
import { buildMaskDrawing, buildMaskDrawingInset, buildMaskHoleDrawings } from './maskPolygon';

export function translateDrawing(d: Drawing, offX: number, offY: number): Drawing {
  return offX !== 0 || offY !== 0 ? d.translate(offX, offY) : d;
}

/**
 * Take the requested finish off the lip's peak edge.
 *
 * The peak is where the vertical outer face meets the 45 degree inner chamfer,
 * so it comes out of the loft (or sweep) as a knife edge — a sliver the slicer
 * has to draw with nothing under it, which is what scars and lifts. Rounding or
 * chamfering it removes {@link LIP_TIP_MM} of that tip and nothing else: the
 * inner chamfer a stacked bin lands on and the vertical band a lid's plug meets
 * both sit well below the treated edge.
 *
 * Selecting by Z band rather than by orientation is deliberate: an O-shaped or
 * polygon footprint has a peak ring per hole, and they all need the same
 * treatment. A kernel that refuses the operation returns the untreated solid —
 * a sharp lip prints, and losing the whole bin over a cosmetic edge does not.
 */
function finishLipPeak(
  scope: DisposalScope,
  solid: Shape3D,
  peakZ: number,
  lipTip: LipTipStyle
): Shape3D {
  if (lipTip === 'sharp') return solid;

  const lipEdges = edgeFinder()
    .when((e) => {
      const bounds = getBounds(e);
      return bounds.zMax >= peakZ - 1 && bounds.zMin <= peakZ;
    })
    .findAll(solid);
  if (lipEdges.length === 0) return solid;

  try {
    const treated =
      lipTip === 'round'
        ? fillet(solid as ValidSolid, lipEdges, LIP_TIP_MM)
        : chamfer(solid as ValidSolid, lipEdges, LIP_TIP_MM);
    const next = unwrap(treated);
    scope.register(solid); // consumed by the operation above
    return next;
  } catch {
    return solid;
  }
}

function buildTopShapeLoft(
  outerW: number,
  outerD: number,
  includeLip: boolean,
  cellMask?: CellMask,
  gridUnitMm: GridUnitInput = SIZE,
  offX: number = 0,
  offY: number = 0,
  lipTip: LipTipStyle = DEFAULT_LIP_TIP
): Shape3D {
  const LIP_EXTENSION = includeLip ? 1.2 : 0;
  const polygon = isPartialMask(cellMask);

  const INNER_BASE = LIP_TAPER_WIDTH; // 2.6mm
  const INNER_MID = LIP_BIG_TAPER; // 1.9mm
  const INNER_TOP = 0;
  // Inset at the bottom of the angled support: matches the sweep profile,
  // where the support's inner edge sits at X = -LIP_EXTENSION (1.2mm).
  const INNER_ANGLE = LIP_EXTENSION;

  // Z_ANGLE_BOTTOM matches the sweep profile's deepest Y (-LIP_TAPER_WIDTH);
  // the angled support spans Z = [Z_ANGLE_BOTTOM, Z_EXT] = [-2.6, -1.2].
  const Z_ANGLE_BOTTOM = includeLip ? -LIP_TAPER_WIDTH : 0;
  const Z_EXT = -LIP_EXTENSION;
  const Z_BASE = 0;
  // Material below the base plane, so the caller can seat that plane ON the
  // wall top and still hand the fuse a volume to work with rather than two
  // touching faces. With a support there is already LIP_TAPER_WIDTH of it; the
  // supportless profile bottoms out at the base plane and needs the skirt.
  // Buried inside the wall either way, so it never reaches the silhouette.
  const Z_SKIRT = includeLip ? Z_ANGLE_BOTTOM : -LIP_OVERLAP;
  const Z_TAPER1 = LIP_SMALL_TAPER; // 0.7
  const Z_VERT = LIP_SMALL_TAPER + LIP_VERTICAL_PART; // 2.5
  const Z_PEAK = LIP_HEIGHT; // 4.4

  const sectionAt = (z: number, inset: number): Sketch => {
    if (polygon) {
      // Polygon path: offset mask drawing inward by `inset`.
      // inset === 0 returns the outer drawing directly.
      const d =
        inset === 0
          ? buildMaskDrawing(cellMask, gridUnitMm)
          : buildMaskDrawingInset(cellMask, gridUnitMm, inset);
      return d.sketchOnPlane('XY', z) as Sketch;
    }
    const { width, depth, radius } = safeSectionRect(
      outerW - 2 * inset,
      outerD - 2 * inset,
      BOX_CORNER_RADIUS - inset
    );
    const rect = drawRoundedRectangle(width, depth, radius);
    return translateDrawing(rect, offX, offY).sketchOnPlane('XY', z) as Sketch;
  };

  // Outer: rectangular tube at bin outer edge (2 sections → no extra edges)
  const zBottom = Z_SKIRT;
  const outerSections: Sketch[] = [sectionAt(zBottom, 0), sectionAt(Z_PEAK, 0)];

  // For O-shape footprints, pre-compute the hole drawings at every inset
  // level the loft sections need. holesCavity matches the cavity boundary
  // (bin's outer face); holesInnerAngle/Base/Mid are the same boundary grown
  // further into the filled material by the corresponding lip offsets.
  // holesInnerAngle is only needed when stacking is included (its only
  // consumer is inside `if (includeLip)`), so skip the offset-and-tessellate
  // work for non-stacking bins.
  const holesCavity = polygon ? buildMaskHoleDrawings(cellMask, gridUnitMm) : [];
  const holesInnerAngle =
    polygon && includeLip
      ? buildMaskHoleDrawings(cellMask, gridUnitMm, CLEARANCE / 2 + INNER_ANGLE)
      : [];
  const holesInnerBase = polygon
    ? buildMaskHoleDrawings(cellMask, gridUnitMm, CLEARANCE / 2 + INNER_BASE)
    : [];
  const holesInnerMid = polygon
    ? buildMaskHoleDrawings(cellMask, gridUnitMm, CLEARANCE / 2 + INNER_MID)
    : [];

  return withScope((scope: DisposalScope) => {
    const [outerFirst, ...outerRest] = outerSections;
    const outerFrustum = scope.register(outerFirst.loftWith(outerRest, { ruled: true }));

    // Inner: tapered frustum tracing the lip profile, including the angled
    // support face below Z_EXT.
    const innerSections: Sketch[] = [];
    if (includeLip) {
      innerSections.push(sectionAt(Z_ANGLE_BOTTOM, INNER_ANGLE));
      innerSections.push(sectionAt(Z_EXT, INNER_BASE));
    } else {
      // The inner loft has to reach the outer tube's bottom, or the cut
      // leaves the skirt solid rather than a ring: a 0.1mm membrane sealing
      // the bin's mouth.
      innerSections.push(sectionAt(Z_SKIRT, INNER_BASE));
    }
    innerSections.push(sectionAt(Z_BASE, INNER_BASE));
    innerSections.push(sectionAt(Z_TAPER1, INNER_MID));
    innerSections.push(sectionAt(Z_VERT, INNER_MID));
    innerSections.push(sectionAt(Z_PEAK, INNER_TOP));

    const [innerFirst, ...innerRest] = innerSections;
    const innerFrustum = scope.register(innerFirst.loftWith(innerRest, { ruled: true }));

    // Boolean subtract inner from outer to create hollow ring
    let result = unwrap(cut(outerFrustum, innerFrustum));

    // Add a lip ring around each interior hole. Mirrors the outer lip's
    // profile, including the angled support: the lip's "outer" face (facing
    // the filled material) grows from INNER_ANGLE at Z_ANGLE_BOTTOM, through
    // INNER_BASE at Z_EXT/Z_BASE, to 0 at Z_PEAK; its "inner" face (facing
    // the cavity) stays at the cavity boundary. cut(outerFrustum,
    // innerFrustum) is then fused onto the outer lip so a bin stacked on
    // top sits flush over both the outer perimeter and the hole.
    for (let h = 0; h < holesCavity.length; h++) {
      const cavity = holesCavity[h];
      const atAngle = holesInnerAngle[h];
      const atBase = holesInnerBase[h];
      const atMid = holesInnerMid[h];

      const bigSections: Sketch[] = [];
      if (includeLip) {
        bigSections.push(atAngle.sketchOnPlane('XY', Z_ANGLE_BOTTOM) as Sketch);
        bigSections.push(atBase.sketchOnPlane('XY', Z_EXT) as Sketch);
      } else {
        bigSections.push(atBase.sketchOnPlane('XY', Z_SKIRT) as Sketch);
      }
      bigSections.push(atBase.sketchOnPlane('XY', Z_BASE) as Sketch);
      bigSections.push(atMid.sketchOnPlane('XY', Z_TAPER1) as Sketch);
      bigSections.push(atMid.sketchOnPlane('XY', Z_VERT) as Sketch);
      bigSections.push(cavity.sketchOnPlane('XY', Z_PEAK) as Sketch);

      const smallSections: Sketch[] = [
        cavity.sketchOnPlane('XY', zBottom) as Sketch,
        cavity.sketchOnPlane('XY', Z_PEAK) as Sketch,
      ];

      const [bigFirst, ...bigRest] = bigSections;
      const big = scope.register(bigFirst.loftWith(bigRest, { ruled: true }));
      const [smallFirst, ...smallRest] = smallSections;
      const small = scope.register(smallFirst.loftWith(smallRest, { ruled: true }));
      const holeRing = scope.register(unwrap(cut(big, small)));
      scope.register(result); // consumed by fuse
      result = unwrap(fuse(result, holeRing));
    }

    result = finishLipPeak(scope, result, Z_PEAK, lipTip);

    return result;
  });
}

/**
 * Build the stacking lip using sweep (robust fallback).
 *
 * Sweeps the lip profile around the bin perimeter, then fillets the peak.
 * This creates NURBS surfaces that are slower for brepkit but robust for OCCT.
 */
function buildTopShapeSweep(
  outerW: number,
  outerD: number,
  includeLip: boolean,
  cellMask?: CellMask,
  gridUnitMm: GridUnitInput = SIZE,
  offX: number = 0,
  offY: number = 0,
  lipTip: LipTipStyle = DEFAULT_LIP_TIP
): Shape3D {
  const polygon = isPartialMask(cellMask);
  const topProfile = (plane: Plane, _origin: Vec3): Sketch => {
    let sketcher = draw([-LIP_TAPER_WIDTH, 0])
      .line(LIP_SMALL_TAPER, LIP_SMALL_TAPER)
      .vLine(LIP_VERTICAL_PART)
      .line(LIP_BIG_TAPER, LIP_BIG_TAPER);

    if (includeLip) {
      const LIP_EXTENSION = 1.2;
      sketcher = sketcher
        .vLineTo(-(LIP_TAPER_WIDTH + LIP_EXTENSION))
        .lineTo([-LIP_TAPER_WIDTH, -LIP_EXTENSION]);
    } else {
      // Down past the base plane by LIP_OVERLAP and back, the skirt the loft
      // path builds. Both paths have to hand the caller the same solid, or
      // whether the loft threw would decide how tall the bin comes out.
      sketcher = sketcher.vLineTo(-LIP_OVERLAP).hLineTo(-LIP_TAPER_WIDTH);
    }

    const basicShape = sketcher.close();

    let topProfileShape = basicShape.intersect(
      drawRoundedRectangle(10, 10).translate(-5, includeLip ? 0 : 5 - LIP_OVERLAP)
    );

    if (includeLip) {
      const LIP_EXTENSION = 1.2;
      topProfileShape = topProfileShape.cut(
        drawRectangle(LIP_EXTENSION, 10).translate(-LIP_EXTENSION / 2, -5)
      );
    }

    return topProfileShape.sketchOnPlane(plane) as Sketch;
  };

  // O-shape lip around any interior holes. `buildMaskDrawing` returns the
  // outer perimeter only (no 2D hole cut), so the sweep would otherwise
  // skip the cavity. Sweep the hole boundaries too and fuse onto the
  // outer lip so a bin stacked on top mates across the hole.
  const holeDrawings = polygon ? buildMaskHoleDrawings(cellMask, gridUnitMm) : [];

  return withScope((scope: DisposalScope) => {
    const outerSafe = safeSectionRect(outerW, outerD, BOX_CORNER_RADIUS);
    const outerRect = drawRoundedRectangle(outerSafe.width, outerSafe.depth, outerSafe.radius);
    const boxSketch = polygon
      ? (buildMaskDrawing(cellMask, gridUnitMm).sketchOnPlane() as Sketch)
      : (translateDrawing(outerRect, offX, offY).sketchOnPlane() as Sketch);
    let swept: Shape3D = boxSketch.sweepSketch(topProfile, { withContact: true });

    for (const hole of holeDrawings) {
      const holeSketch = hole.sketchOnPlane() as Sketch;
      const holeLip = scope.register(holeSketch.sweepSketch(topProfile, { withContact: true }));
      scope.register(swept);
      swept = unwrap(fuse(swept, holeLip));
    }

    return finishLipPeak(scope, swept, LIP_HEIGHT, lipTip);
  });
}

/**
 * Build the stacking lip at the top of the bin.
 *
 * Uses loft-cut for all kernels: constructs explicit rounded-rectangle
 * cross-sections at each profile breakpoint, avoiding an OCCT sweep bug
 * that flips the profile on non-square spines. Sweep retained as
 * fallback if loft throws.
 *
 * Profile per Gridfinity spec v5: 0.7mm + 1.8mm + 1.9mm = 4.4mm total height.
 * The base plane is Z=0 locally and the caller translates it to the wall top,
 * so the peak lands exactly `LIP_HEIGHT` above it. Material hangs BELOW Z=0
 * (the angled support, or `LIP_OVERLAP` of skirt without one) to give the fuse
 * a volume; it is buried in the wall and never reaches the silhouette.
 */
export function buildTopShape(
  gridW: number,
  gridD: number,
  includeLip: boolean,
  gridUnitMm: GridUnitInput = SIZE,
  cellMask?: CellMask,
  overhang?: ResolvedOverhang,
  lipTip: LipTipStyle = DEFAULT_LIP_TIP
): Shape3D {
  const polygon = isPartialMask(cellMask);
  // Overhang is suppressed for polygon masks (the mask defines the footprint).
  const ov = polygon ? undefined : overhang;
  const exp = ov && hasOverhang(ov) ? overhangExpansion(ov) : null;
  const pitch = resolvePitch(gridUnitMm);
  const lipKey = buildCacheKey(
    'v5',
    quantize(gridW),
    quantize(gridD),
    quantize(pitch.x),
    ...pitchKeySegments(pitch, quantize),
    includeLip,
    polygon ? hashMask(cellMask) : 'rect',
    ov ? overhangKey(ov) : '0',
    lipTip
  );
  const cached = getLipCache(lipKey);
  if (cached) {
    return cached;
  }

  // Lip grows with the body so a bin stacked on top still mates flush across
  // the full (overhung) perimeter.
  const outerW = gridW * pitch.x - CLEARANCE + (exp?.addW ?? 0);
  const outerD = gridD * pitch.y - CLEARANCE + (exp?.addD ?? 0);
  const offX = exp?.offsetX ?? 0;
  const offY = exp?.offsetY ?? 0;

  // Loft-cut for all kernels: produces analytic surfaces and avoids an OCCT
  // BRepOffsetAPI_MakePipeShell bug where the profile direction flips on
  // certain non-square aspect ratios, causing the lip to overhang.
  let result: Shape3D;
  try {
    result = buildTopShapeLoft(
      outerW,
      outerD,
      includeLip,
      cellMask,
      gridUnitMm,
      offX,
      offY,
      lipTip
    );
  } catch {
    // Loft failed — fall back to sweep path (kernel regression).
    // NOTE: sweep has the OCCT profile-flip bug on non-square spines
    result = buildTopShapeSweep(
      outerW,
      outerD,
      includeLip,
      cellMask,
      gridUnitMm,
      offX,
      offY,
      lipTip
    );
  }

  return setLipCache(lipKey, result);
}
