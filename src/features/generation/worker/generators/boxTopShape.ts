/** The bin's top shape: the lip peak finish and the loft or sweep that carries the wall profile up to it. */

import {
  draw,
  drawRoundedRectangle,
  drawRectangle,
  unwrap,
  fuse,
  cut,
  cutAll,
  fillet,
  chamfer,
  curvePointAt,
  edgeFinder,
  getBounds,
  translate,
  withScope,
} from 'brepjs';
import type {
  Shape3D,
  ValidSolid,
  Plane,
  Sketch,
  Vec3,
  DisposalScope,
  Drawing,
  Edge,
} from 'brepjs';
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
  LIP_SUPPORT_DROP,
  PLATE_PROFILE_HEIGHT,
  POCKET_INSET_BOT,
  pocketProfileFor,
  pocketCornerRadius,
  safeSectionRect,
} from './generatorTypes';
import { forEachCell, type CellInfo } from './cellDecomposition';
import { isAbortError } from './utils/abort';
import { resolveLipNotches } from '@/shared/utils/lipNotchPlan';
import type { BinParams } from '@/shared/types/bin';
import { getLipCache, setLipCache } from './shapeCache';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { resolvePitch, pitchKeySegments, type GridUnitInput } from './gridPitch';
import { hashMask, isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { DEFAULT_LIP_TIP, LIP_TIP_MM, LIP_TIP_FLAT_MM, type LipTipStyle } from '@/shared/types/bin';
import { hasOverhang, overhangExpansion, overhangKey, type ResolvedOverhang } from './overhang';
import { buildMaskDrawing, buildMaskDrawingInset, buildMaskHoleDrawings } from './maskPolygon';

export function translateDrawing(d: Drawing, offX: number, offY: number): Drawing {
  return offX !== 0 || offY !== 0 ? d.translate(offX, offY) : d;
}

/**
 * Plane the top {@link LIP_TIP_FLAT_MM} off the lip, leaving a flat band.
 *
 * The cutter spans the solid's own footprint with a margin, so it reaches every
 * peak ring whatever the footprint is, and starts at the cut plane rather than
 * below it so nothing under the band is touched. Because the inner chamfer runs
 * at 45 degrees, the height taken off and the width of the band left behind are
 * the same number.
 */
function planeLipPeak(scope: DisposalScope, solid: Shape3D, peakZ: number): Shape3D {
  const zCut = peakZ - LIP_TIP_FLAT_MM;
  const bounds = getBounds(solid);
  if (bounds.zMax <= zCut) return solid;

  const MARGIN = 1;
  const width = bounds.xMax - bounds.xMin + 2 * MARGIN;
  const depth = bounds.yMax - bounds.yMin + 2 * MARGIN;
  const height = bounds.zMax - zCut + MARGIN;

  try {
    const cutter = scope.register(
      (
        drawRectangle(width, depth)
          .translate((bounds.xMin + bounds.xMax) / 2, (bounds.yMin + bounds.yMax) / 2)
          .sketchOnPlane('XY', zCut) as Sketch
      ).extrude(height)
    );
    const next = unwrap(cut(solid, cutter));
    scope.register(solid); // consumed by the cut above
    return next;
  } catch {
    return solid;
  }
}

/**
 * Take the requested finish off the lip's peak edge.
 *
 * The peak is where the vertical outer face meets the 45 degree inner chamfer,
 * so it comes out of the loft (or sweep) as a knife edge — a sliver the slicer
 * has to draw with nothing under it, which is what scars and lifts. Rounding or
 * chamfering it removes {@link LIP_TIP_MM} of that tip and nothing else; `flat`
 * planes {@link LIP_TIP_FLAT_MM} off it instead. Either way the inner chamfer a
 * stacked bin lands on and the vertical band a lid's plug meets both sit well
 * below the treated edge.
 *
 * Selecting by Z band rather than by orientation is deliberate: an O-shaped or
 * polygon footprint has a peak ring per hole, and they all need the same
 * treatment. A kernel that refuses the operation returns the untreated solid —
 * a sharp lip prints, and losing the whole bin over a cosmetic edge does not.
 *
 * `flat` is a half-space cut rather than an edge operation for the same reason:
 * one plane takes every peak ring at once, including the ones a hole
 * contributes, and it cannot fail on an edge the finder picked up by accident.
 */
function finishLipPeak(
  scope: DisposalScope,
  solid: Shape3D,
  peakZ: number,
  lipTip: LipTipStyle,
  isPeakEdge: (edge: Edge) => boolean = (e) => {
    const bounds = getBounds(e);
    return bounds.zMax >= peakZ - 1 && bounds.zMin <= peakZ;
  }
): Shape3D {
  if (lipTip === 'sharp') return solid;

  if (lipTip === 'flat') return planeLipPeak(scope, solid, peakZ);

  const lipEdges = edgeFinder().when(isPeakEdge).findAll(solid);
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
  const LIP_EXTENSION = includeLip ? LIP_SUPPORT_DROP : 0;
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
 * How far in from the outer face a lip notch reaches, in mm.
 *
 * A foot's rounded corner ends `BOX_CORNER_RADIUS` in from the face, so the
 * notch has to reach at least that far to hold the whole corner. Stopping
 * exactly there would cut the pockets along their arc-to-flat seam, so it
 * carries on by half a clearance into the straight ridge.
 */
export const LIP_NOTCH_REACH_MM = BOX_CORNER_RADIUS + CLEARANCE / 2;

/**
 * How far below the lip's peak each notch stops, in mm.
 *
 * Carried up to the peak, a notch's top meets the knife edge at a cusp (the
 * pocket corners are tangent to the rim there), so the edge breaks into
 * segments no fillet or chamfer can roll across. Stopping short leaves the
 * knife edge one unbroken loop that `lipTip` finishes exactly as on a plain
 * lip. Deeper than `LIP_TIP_FLAT_MM` so a flat tip never lands on a notch top.
 */
export const LIP_NOTCH_TOP_DROP_MM = 1;

/**
 * The 45 degree chamfer on each notch's inner top edge, in mm: the lip's own
 * lower chamfer, so the notch's nose reads as part of the lip rather than a
 * block cut off square.
 */
export const LIP_NOTCH_NOSE_MM = LIP_SMALL_TAPER;

/**
 * How far in from the outer face the lip stands: its taper, or the notch reach
 * when notches are built. A tool cut through the lip has to clear this, or a
 * thin wall leaves a sliver of notch inside the opening.
 */
export function lipInnerReachMm(params: BinParams): number {
  return resolveLipNotches(params) ? LIP_NOTCH_REACH_MM : LIP_TAPER_WIDTH;
}

export interface LipNotchGrid {
  readonly fractionalEdgeX: 'start' | 'end';
  readonly fractionalEdgeY: 'start' | 'end';
}

/**
 * The lip with a notch at every internal grid line, so a smaller bin stacked
 * on it registers to a cell instead of sliding along the rim.
 *
 * Our lip IS the baseplate pocket on the nominal footprint, trimmed by half a
 * clearance at the top (the same relationship `lidStackGrid` relies on). So
 * rather than one footprint-wide inner cut, each perimeter cell cuts its own
 * pocket. Where two pockets meet they leave the baseplate's ridge between
 * them, and a stacked bin's neighbouring feet nest on it exactly as they
 * would in a plate. Everywhere else the cell pockets coincide with the
 * footprint-wide profile, so the lip is unchanged.
 *
 * `interiorClear` keeps only the ridge's first {@link LIP_NOTCH_REACH_MM} and
 * removes the rest of the interior. Its lower face is the lip's own 45 degree
 * support carried on, so the notch's underside prints without support, and its
 * upper face is the notch's nose chamfer. `topTrim` is the plain lip's inner
 * face above {@link LIP_NOTCH_TOP_DROP_MM}, which stops each notch short of the
 * peak.
 *
 * Pockets extend past the outer prism at both ends so every cut is transversal;
 * only perimeter cells are cut, since an interior cell's pocket lies wholly
 * inside `interiorClear`.
 */
function buildNotchedTopShapeLoft(
  gridW: number,
  gridD: number,
  outerW: number,
  outerD: number,
  includeLip: boolean,
  gridUnitMm: GridUnitInput,
  notches: LipNotchGrid,
  lipTip: LipTipStyle
): Shape3D {
  const pitch = resolvePitch(gridUnitMm);
  const INNER_ANGLE = includeLip ? LIP_SUPPORT_DROP : 0;
  const Z_ANGLE_BOTTOM = includeLip ? -LIP_TAPER_WIDTH : 0;
  const Z_SKIRT = includeLip ? Z_ANGLE_BOTTOM : -LIP_OVERLAP;
  const Z_PEAK = LIP_HEIGHT;
  const MARGIN = 0.5;
  const reach = LIP_NOTCH_REACH_MM;

  const roundedSection = (w: number, d: number, r: number, z: number): Sketch => {
    const safe = safeSectionRect(w, d, r);
    return drawRoundedRectangle(safe.width, safe.depth, safe.radius).sketchOnPlane(
      'XY',
      z
    ) as Sketch;
  };
  const outlineSection = (inset: number, z: number): Sketch =>
    roundedSection(outerW - 2 * inset, outerD - 2 * inset, BOX_CORNER_RADIUS - inset, z);

  // The nose chamfer runs at 45 degrees from the notch top's inner edge,
  // parallel to the lip's inner face and inboard of it, so the two never meet.
  const zTop = Z_PEAK - LIP_NOTCH_TOP_DROP_MM;
  const zNose = zTop - LIP_NOTCH_NOSE_MM;
  const noseAbovePeak = Z_PEAK + MARGIN - zNose;
  const clearSections: Sketch[] = [
    ...(includeLip
      ? [
          outlineSection(INNER_ANGLE, Z_ANGLE_BOTTOM),
          outlineSection(reach, Z_ANGLE_BOTTOM + (reach - INNER_ANGLE)),
        ]
      : [outlineSection(reach, Z_SKIRT)]),
    outlineSection(reach, zNose),
    outlineSection(reach - noseAbovePeak, Z_PEAK + MARGIN),
  ];

  const pocketSections: readonly (readonly [z: number, inset: number])[] = [
    [PLATE_PROFILE_HEIGHT + MARGIN, 0],
    ...pocketProfileFor(PLATE_PROFILE_HEIGHT).map(([depth, inset]): readonly [number, number] => [
      PLATE_PROFILE_HEIGHT - depth,
      inset,
    ]),
    [Z_SKIRT - MARGIN, POCKET_INSET_BOT],
  ];

  const halfW = (gridW * pitch.x) / 2;
  const halfD = (gridD * pitch.y) / 2;
  const EDGE_EPS = 1e-6;
  const onPerimeter = (cell: CellInfo): boolean =>
    cell.centerX - (cell.widthUnits * pitch.x) / 2 <= -halfW + EDGE_EPS ||
    cell.centerX + (cell.widthUnits * pitch.x) / 2 >= halfW - EDGE_EPS ||
    cell.centerY - (cell.depthUnits * pitch.y) / 2 <= -halfD + EDGE_EPS ||
    cell.centerY + (cell.depthUnits * pitch.y) / 2 >= halfD - EDGE_EPS;

  return withScope((scope: DisposalScope) => {
    const outer = scope.register(
      outlineSection(0, Z_SKIRT).loftWith([outlineSection(0, Z_PEAK)], { ruled: true })
    );
    const [clearFirst, ...clearRest] = clearSections;
    const topDrop = LIP_NOTCH_TOP_DROP_MM;
    const topTrim = outlineSection(topDrop, Z_PEAK - topDrop).loftWith(
      [outlineSection(-MARGIN, Z_PEAK + MARGIN)],
      { ruled: true }
    );
    const tools: Shape3D[] = [
      scope.register(clearFirst.loftWith(clearRest, { ruled: true })),
      scope.register(topTrim),
    ];

    forEachCell(
      gridW,
      gridD,
      (cell) => {
        if (!onPerimeter(cell)) return;
        const cellW = cell.widthUnits * pitch.x;
        const cellD = cell.depthUnits * pitch.y;
        const cornerR = pocketCornerRadius(cellW, cellD);
        const [first, ...rest] = pocketSections.map(([z, inset]) =>
          roundedSection(cellW - 2 * inset, cellD - 2 * inset, cornerR - inset, z)
        );
        const pocket = scope.register(first.loftWith(rest, { ruled: true }));
        tools.push(scope.register(translate(pocket, [cell.centerX, cell.centerY, 0])));
      },
      {
        gridUnitMm: pitch,
        fractionalEdgeX: notches.fractionalEdgeX,
        fractionalEdgeY: notches.fractionalEdgeY,
      }
    );

    const notched = unwrap(cutAll(outer as ValidSolid, tools as ValidSolid[]));
    // Each notch's top meets the knife edge at a cusp, where a fillet across
    // the notch's flanks cannot roll. Finishing only what runs along the rim at
    // peak height (the knife edge and each notch's outer top edge, which are
    // collinear) keeps the treatment the plain lip gets.
    const rim = safeSectionRect(outerW, outerD, BOX_CORNER_RADIUS);
    const RIM_TOL = 0.01;
    const onRimAtPeak = (e: Edge): boolean => {
      if (getBounds(e).zMin < Z_PEAK - RIM_TOL) return false;
      const [x, y] = curvePointAt(e, 0.5);
      const qx = Math.abs(x) - (rim.width / 2 - rim.radius);
      const qy = Math.abs(y) - (rim.depth / 2 - rim.radius);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const distance = outside + Math.min(Math.max(qx, qy), 0) - rim.radius;
      return Math.abs(distance) < RIM_TOL;
    };
    return finishLipPeak(scope, notched, Z_PEAK, lipTip, onRimAtPeak);
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
      const LIP_EXTENSION = LIP_SUPPORT_DROP;
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
      const LIP_EXTENSION = LIP_SUPPORT_DROP;
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
  lipTip: LipTipStyle = DEFAULT_LIP_TIP,
  notches?: LipNotchGrid
): Shape3D {
  const polygon = isPartialMask(cellMask);
  // Overhang is suppressed for polygon masks (the mask defines the footprint).
  const ov = polygon ? undefined : overhang;
  const exp = ov && hasOverhang(ov) ? overhangExpansion(ov) : null;
  const pitch = resolvePitch(gridUnitMm);
  // The notch grid is the nominal cell lattice, which neither a mask outline
  // nor an overhung rim follows; `resolveLipNotches` keeps both off it.
  const notchGrid = notches && !polygon && !exp ? notches : undefined;
  const lipKey = buildCacheKey(
    'v5',
    quantize(gridW),
    quantize(gridD),
    quantize(pitch.x),
    ...pitchKeySegments(pitch, quantize),
    includeLip,
    polygon ? hashMask(cellMask) : 'rect',
    ov ? overhangKey(ov) : '0',
    lipTip,
    ...(notchGrid ? [`notch:${notchGrid.fractionalEdgeX}:${notchGrid.fractionalEdgeY}`] : [])
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
  if (notchGrid) {
    try {
      return setLipCache(
        lipKey,
        buildNotchedTopShapeLoft(
          gridW,
          gridD,
          outerW,
          outerD,
          includeLip,
          gridUnitMm,
          notchGrid,
          lipTip
        )
      );
    } catch (e: unknown) {
      if (isAbortError(e)) throw e;
      // A plain lip still stacks; the caller would otherwise drop the lip whole.
    }
  }

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
