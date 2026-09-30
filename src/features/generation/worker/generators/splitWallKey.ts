/**
 * Wall connectors for split bin pieces: press-together alignment keys plus
 * reinforcing pilasters on the exterior perimeter walls a cut crosses. A
 * thicker wall hosts the key in its own material, so the inward pilaster
 * shrinks, and is dropped entirely once the wall encloses the groove.
 *
 * Placement is off each wall's outer face at every height, which on a tapered
 * overhang stands inboard of the rim edge the cut faces report.
 */

import { drawRectangle, draw, translate, getBounds } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { SplitConnectorConfig, WallConnectorStyle } from '@/shared/types/bin';
import {
  NOZZLE_BASELINE,
  scaleFeature,
  scaleClearance,
} from '@/shared/printSettings/connectorScaling';
import { sketch } from './meshUtils';
import { taperInsetAt } from './overhang';
import { taperBandLevels } from './taperedOuter';
import { EPSILON, MIN_FEATURE_HEIGHT, MIN_FEATURE_WIDTH, OVERLAP } from './splitConnectorFrame';
import type { BinGeometryContext, CutFace } from './splitConnectorFrame';

/** Key vertical extent as a fraction of interior wall height (lead-in tapers above it). */
const DEFAULT_WALL_KEY_HEIGHT_FRACTION = 0.85;

/**
 * Half-width of the wall key (mm). Doubled (1.6mm), this is the key's footprint
 * along the cut line — which, on a perimeter wall, is also its inward reach. Sized stocky
 * enough that the tongue meaningfully resists splaying rather than just aligning; the
 * reinforcing pilaster now adds material on every selectable wall (its inward reach,
 * `pilasterPerpDepth` ≈ 3.3mm, exceeds the thickest `WALL_THICKNESS_OPTIONS` = 2.6mm).
 * The tongue is ~4 perimeters at a 0.4mm nozzle. See `wallKeyGeometry`.
 */
const WALL_KEY_HALF_WIDTH = 0.8;

/**
 * Intact outer wall skin kept in front of the groove (mm). The key is anchored this far
 * behind the exterior face regardless of wall thickness, so a thicker wall envelops the
 * key rather than pushing it deeper. ~2 perimeters at a 0.4mm nozzle — printable, and the
 * seam is glued anyway.
 */
const WALL_KEY_OUTER_SKIN = 0.8;

/**
 * How far the key protrudes across the cut into the mating piece (mm). This is the
 * tongue's engagement depth — deeper means more glue surface and far more resistance
 * to the halves pulling/splaying apart. Clamped down on short bins by `buildKey` so the
 * self-supporting tip ramp always finishes below the lead-in notch.
 */
const WALL_KEY_PROTRUSION = 2.4;

/**
 * Lead-in drop at the top of the key (mm). The whole protruding span slopes down by this
 * over its length, turning the tongue into a self-guiding wedge instead of a blunt block;
 * the female groove inherits the same slope as a wider insertion mouth.
 */
const WALL_KEY_LEADIN = 1.2;

/** Snug margin (mm, per side) between the key footprint and the pilaster edge. */
const WALL_PILASTER_MARGIN = 0.6;

/** Inward draft of the pilaster's cavity-facing face: fractional pull-back at the top. */
const WALL_PILASTER_DRAFT = 0.12;

/** Height of the region at the pilaster top where its inner face ramps back to the wall (mm). */
const WALL_PILASTER_TOP_TAPER = 3;

/** Residual inner depth where the pilaster melts into the wall just below the lip (mm). */
const WALL_PILASTER_TOP_MIN = 0.4;

/** 45° chamfer at the pilaster's floor junction (mm). */
const WALL_PILASTER_FLOOR_CHAMFER = 0.6;

export interface WallKeyGeometry {
  /** Inward distance from the outer wall face to the key's perpendicular center (mm). */
  readonly perpInset: number;
  /** Inward perpendicular footprint of the pilaster from the outer wall face (mm). */
  readonly pilasterPerpDepth: number;
  /** Pilaster depth along the cut-normal into the piece body (mm). */
  readonly pilasterProtDepth: number;
  /** Remaining intact outer wall skin after the groove is cut (mm). Must stay > 0. */
  readonly outerSkin: number;
  /** Nozzle-scaled half-width of the key tongue along the cut line (mm). */
  readonly keyHalfWidth: number;
  /** Nozzle-scaled protrusion of the key across the cut into the mating piece (mm). */
  readonly protrusion: number;
}

/**
 * Placement of a wall key + its reinforcing pilaster. The key is a straight
 * (non-undercut) tongue/groove so the two halves assemble by pressing together
 * horizontally — an undercut would force a vertical drop-in, impossible past the
 * partial-height groove and the stacking lip.
 *
 * The key is anchored a fixed skin (`WALL_KEY_OUTER_SKIN`) behind the exterior face
 * rather than behind the full wall thickness, so the groove cut never breaches the
 * outside no matter how thick the wall is. Because the inset no longer grows with
 * `wallThickness`, a thicker wall envelops the key in its own material instead of
 * pushing it deeper — and `pilasterPerpDepth` then exceeds the wall by less and less,
 * until `addKeyConnectors` drops the pilaster entirely (no extra inward material).
 */
export function wallKeyGeometry(
  wallThickness: number,
  clearance: number,
  nozzleSizeMm: number = NOZZLE_BASELINE
): WallKeyGeometry {
  // Scale the 0.4mm-tuned footprint up on a wider nozzle: the tongue stays ≥2
  // perimeters wide, the intact outer skin in front of the groove stays ≥2
  // perimeters, and the protrusion stays ≥2 perimeters of engagement. All three
  // are exactly the legacy value at ≤0.4mm (no regression).
  const keyHalfWidth = scaleFeature(WALL_KEY_HALF_WIDTH * 2, nozzleSizeMm) / 2;
  const outerSkinNom = scaleFeature(WALL_KEY_OUTER_SKIN, nozzleSizeMm);
  const protrusion = scaleFeature(WALL_KEY_PROTRUSION, nozzleSizeMm);

  const grooveHalf = keyHalfWidth + clearance;
  const perpInset = outerSkinNom + grooveHalf;
  const grooveInnerEdge = perpInset + grooveHalf;
  const pilasterPerpDepth = grooveInnerEdge + WALL_PILASTER_MARGIN;
  const pilasterProtDepth = protrusion + clearance + WALL_PILASTER_MARGIN;
  // Intact outer skin in front of the groove. Capped at the wall thickness for thin
  // walls, where the groove sits fully inward of the wall (hosted by the pilaster).
  const outerSkin = Math.min(outerSkinNom, wallThickness);
  return { perpInset, pilasterPerpDepth, pilasterProtDepth, outerSkin, keyHalfWidth, protrusion };
}

export interface WallKeyHeightFit {
  /** False when the wall is too short to host a non-degenerate key — skip wall keys. */
  readonly fits: boolean;
  /** Protrusion clamped so the 45° tip ramp finishes below the lead-in notch (mm). */
  readonly protrusion: number;
}

/**
 * Decide whether a wall key fits the available interior height and clamp its protrusion
 * so the self-supporting 45° tip ramp always finishes below the lead-in notch.
 *
 * The minimum required protrusion scales with the nozzle (≥2 perimeters via
 * `scaleFeature`), so a wide nozzle skips a key it could only print as a sub-bead tongue
 * rather than emitting a weak one. `keyHeight` is shared by the male tongue and female
 * groove, so both clamp identically and stay dimensionally matched.
 */
export function fitWallKeyToHeight(
  keyHeight: number,
  nominalProtrusion: number,
  nozzleSizeMm: number = NOZZLE_BASELINE
): WallKeyHeightFit {
  // The tongue needs vertical room for its lead-in notch, a self-supporting 45° tip ramp
  // (≥ a ≥2-perimeter protrusion), and a minimum flat above the ramp.
  const minProtrusion = scaleFeature(MIN_FEATURE_WIDTH, nozzleSizeMm);
  if (keyHeight < WALL_KEY_LEADIN + minProtrusion + MIN_FEATURE_HEIGHT) {
    return { fits: false, protrusion: 0 };
  }
  const protrusion = Math.min(nominalProtrusion, keyHeight - WALL_KEY_LEADIN - MIN_FEATURE_HEIGHT);
  return { fits: true, protrusion };
}

/**
 * Dispatch to the configured wall-connector builder.
 *
 * This is the extension point for new wall connector types. To add one:
 *   1. Add a member to `WallConnectorStyle` (in shared/types/bin).
 *   2. Add a `case` here that calls your builder — the exhaustive `never` check
 *      below makes the compiler flag this switch until you do.
 *   3. Implement the builder using `perimeterWalls()` for placement and pushing
 *      onto `fuseTargets` / `cutTargets`, mirroring `addKeyConnectors`.
 *   4. Surface it in the SplitOptionsSection UI.
 */
export function addWallConnectors(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[]
): void {
  const style: WallConnectorStyle = config.wallConnector ?? 'none';
  switch (style) {
    case 'none':
      return;
    case 'key':
      addKeyConnectors(face, context, config, fuseTargets, cutTargets);
      return;
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

/** A perimeter wall a cut crosses, with the directions a connector needs to orient itself. */
interface PerimeterWall {
  /** Perpendicular coordinate of the wall's outer face (a bin edge). */
  readonly perimeter: number;
  /** Sign pointing toward the bin center — the only direction a connector may thicken. */
  readonly inward: -1 | 1;
  /** Sign pointing into this piece's body behind the cut (male −axis, female +axis). */
  readonly bodySign: -1 | 1;
  /** Where the wall's outer face stands relative to `perimeter` at each height. */
  readonly face: WallFace;
}

/**
 * How far a perimeter wall's outer face stands inboard of its rim edge at world
 * height `z`. A plain wall is flush at every height; a tapered one follows the
 * body loft's chords, which is where its material actually is.
 */
interface WallFace {
  readonly inset: (z: number) => number;
  /** World heights where the face changes slope, ascending. Empty for a plain wall. */
  readonly breaks: readonly number[];
}

const FLUSH_WALL: WallFace = { inset: () => 0, breaks: [] };

function wallFace(side: number, context: BinGeometryContext): WallFace {
  const { taper, floorZ } = context;
  if (!taper || side <= EPSILON) return FLUSH_WALL;
  const wallHeight = context.wallTopZ - floorZ;
  const levels = taperBandLevels(taper, wallHeight, context.wallThickness).filter(
    (h, i, all) => i === 0 || h - all[i - 1] > EPSILON
  );
  const insets = levels.map((h) => taperInsetAt(taper, side, h, wallHeight));
  const inset = (z: number): number => {
    const h = z - floorZ;
    if (h <= levels[0]) return insets[0];
    for (let i = 1; i < levels.length; i++) {
      if (h <= levels[i]) {
        const t = (h - levels[i - 1]) / (levels[i] - levels[i - 1]);
        return insets[i - 1] + t * (insets[i] - insets[i - 1]);
      }
    }
    return 0;
  };
  return { inset, breaks: levels.map((h) => floorZ + h) };
}

/**
 * Map a closed outline drawn as (distance inward from the outer face, z) onto a
 * wall, splitting each edge at the face's slope breaks so the outline runs
 * parallel to a tapered face instead of cutting across it.
 */
function onWallFace(
  outline: readonly (readonly [number, number])[],
  perimeter: number,
  inward: -1 | 1,
  face: WallFace
): [number, number][] {
  const split: [number, number][] = [];
  outline.forEach(([d0, z0], i) => {
    const [d1, z1] = outline[(i + 1) % outline.length];
    split.push([d0, z0]);
    const lo = Math.min(z0, z1);
    const hi = Math.max(z0, z1);
    const between = face.breaks.filter((b) => b > lo + EPSILON && b < hi - EPSILON);
    if (z1 < z0) between.reverse();
    for (const b of between) split.push([d0 + ((d1 - d0) * (b - z0)) / (z1 - z0), b]);
  });
  return split.map(([d, z]) => [perimeter + inward * (face.inset(z) + d), z]);
}

/**
 * The exterior perimeter walls a cut face crosses. A cut crosses a perimeter
 * wall wherever this piece's perpendicular span reaches a bin edge
 * (`binEdgeMin`/`binEdgeMax` — overhang-inclusive, so an overhung wall still
 * qualifies); interior pieces touch neither. Shared by all wall-connector builders.
 */
export function perimeterWalls(face: CutFace, context: BinGeometryContext): PerimeterWall[] {
  const pieceMin = face.pieceCenterOffset - face.pieceEdgeLength / 2;
  const pieceMax = face.pieceCenterOffset + face.pieceEdgeLength / 2;
  const tol = 1e-3;
  const bodySign = face.isMale ? -1 : 1;
  // An x-axis cut crosses the front and back walls, a y-axis cut the left and right.
  const t = context.taper;
  const [minSide, maxSide] = !t
    ? [0, 0]
    : face.axis === 'x'
      ? [t.front, t.back]
      : [t.left, t.right];

  const walls: PerimeterWall[] = [];
  if (Math.abs(pieceMin - face.binEdgeMin) < tol)
    walls.push({
      perimeter: face.binEdgeMin,
      inward: 1,
      bodySign,
      face: wallFace(minSide, context),
    });
  if (Math.abs(pieceMax - face.binEdgeMax) < tol)
    walls.push({
      perimeter: face.binEdgeMax,
      inward: -1,
      bodySign,
      face: wallFace(maxSide, context),
    });
  return walls;
}

/**
 * 'key' connector: a slim press-together alignment key on each exterior perimeter
 * wall. A thin wall is reinforced by a full-height inward pilaster; a wall thick
 * enough to enclose the key hosts it directly and the pilaster is skipped (no extra
 * material — see `wallKeyGeometry`).
 *
 * The key is a straight (non-undercut) tongue/groove so the two halves press
 * together horizontally — the natural assembly motion, and the only one
 * compatible with a partial-height feature that leaves the stacking lip intact.
 * The protruding tongue has a 45° chamfered underside so it prints
 * self-supporting and self-guides on insertion. When present, the pilaster thickens
 * the wall inward only (preserving the Gridfinity footprint); the key is anchored a
 * fixed skin behind the outer face so the groove can't breach the exterior wall.
 *
 * Convention matches the floor lap: male faces grow a tongue, female faces have a
 * matching groove + clearance.
 */
function addKeyConnectors(
  face: CutFace,
  context: BinGeometryContext,
  config: SplitConnectorConfig,
  fuseTargets: Shape3D[],
  cutTargets: Shape3D[]
): void {
  const wallHeight = context.wallTopZ - context.floorZ;
  const heightFraction = config.ridgeHeightFraction ?? DEFAULT_WALL_KEY_HEIGHT_FRACTION;
  const keyHeight = wallHeight * heightFraction;

  const nozzle = context.nozzleSizeMm ?? NOZZLE_BASELINE;
  const effClearance = scaleClearance(config.clearance, nozzle);
  const geom = wallKeyGeometry(context.wallThickness, effClearance, nozzle);

  // Skip wall keys on bins too short to host a non-degenerate key; otherwise clamp the
  // protrusion so the self-supporting tip ramp finishes below the lead-in notch.
  const fit = fitWallKeyToHeight(keyHeight, geom.protrusion, nozzle);
  if (!fit.fits) return;

  // The pilaster only adds material where it reaches past the existing wall. Once the
  // wall is thick enough to enclose the groove (+margin) it hosts the key on its own,
  // so we skip the pilaster — the "use the thicker wall instead of adding material" path.
  const needsPilaster = geom.pilasterPerpDepth > context.wallThickness + EPSILON;

  // A pilaster intrudes into the cavity; don't let it eat more than ~45% of a narrow
  // piece's span. Without a pilaster the slim key always fits, so the guard only applies
  // when one is actually added.
  if (needsPilaster && geom.pilasterPerpDepth > face.pieceEdgeLength * 0.45) return;

  for (const { perimeter, inward, bodySign, face: wall } of perimeterWalls(face, context)) {
    if (needsPilaster) {
      fuseTargets.push(
        buildPilaster(
          face.axis,
          face.position,
          perimeter,
          inward,
          bodySign,
          context.floorZ,
          context.wallTopZ,
          context.floorZ + keyHeight,
          geom,
          wall
        )
      );
    }

    const key = buildKey(
      face.axis,
      face.position,
      perimeter,
      inward,
      context.floorZ,
      keyHeight,
      face.isMale ? 0 : effClearance,
      fit.protrusion,
      geom,
      wall
    );
    (face.isMale ? fuseTargets : cutTargets).push(key);
  }
}

/** Re-center a freshly extruded prism on `target` along the given world axis (extrude sign is plane-dependent). */
function recenterAxis(solid: Shape3D, worldAxis: 'x' | 'y', target: number): Shape3D {
  const b = getBounds(solid);
  const lo = worldAxis === 'x' ? b.xMin : b.yMin;
  const hi = worldAxis === 'x' ? b.xMax : b.yMax;
  const shift = target - (lo + hi) / 2;
  const moved = translate(solid, worldAxis === 'x' ? [shift, 0, 0] : [0, shift, 0]);
  solid.delete();
  return moved;
}

/**
 * Build the reinforcing pilaster: a full-interior-height buttress that thickens
 * the wall inward only. Its cavity-facing silhouette (a profile in the
 * perpendicular×Z plane, extruded along the cut-normal) gives a 45° chamfer at
 * the floor, a subtle inward draft, and a top that tapers back into the wall
 * just below the lip — so it reads as designed rather than a glued-on block.
 */
function buildPilaster(
  axis: 'x' | 'y',
  cutPos: number,
  perimeter: number,
  inward: -1 | 1,
  bodySign: -1 | 1,
  floorZ: number,
  wallTopZ: number,
  keyTop: number,
  geom: WallKeyGeometry,
  wall: WallFace = FLUSH_WALL
): Shape3D {
  const depth = geom.pilasterPerpDepth;
  const cham = Math.min(WALL_PILASTER_FLOOR_CHAMFER, (wallTopZ - floorZ) * 0.25);
  // Keep the buttress at full depth through the key (the groove needs the material), then
  // melt into the wall over the whole span above it — a longer, more graceful taper than a
  // fixed stub, and it never starts below the groove (which would breach the seal). Falls
  // back to the legacy `wallTopZ − TOP_TAPER` window when the key is short.
  const taperStart = Math.max(keyTop, wallTopZ - WALL_PILASTER_TOP_TAPER);
  const topStart = Math.min(Math.max(floorZ + cham + 0.5, taperStart), wallTopZ - 0.5);

  // Silhouette in (perpendicular, Z), drawn inward from the wall's outer face
  // (no outward growth); extruded along the cut-normal (prot) axis.
  const plane = axis === 'x' ? 'YZ' : 'XZ';
  const [start, ...rest] = onWallFace(
    [
      [0, floorZ],
      [0, wallTopZ],
      [WALL_PILASTER_TOP_MIN, wallTopZ],
      [depth * (1 - WALL_PILASTER_DRAFT), topStart],
      [depth, floorZ + cham],
      [Math.max(0, depth - WALL_PILASTER_FLOOR_CHAMFER), floorZ],
    ],
    perimeter,
    inward,
    wall
  );
  const profile = rest.reduce((pen, point) => pen.lineTo(point), draw(start)).close();
  const raw = sketch(profile, plane, 0).extrude(geom.pilasterProtDepth);
  // The cut-normal is the cut axis itself, so re-center along `axis`.
  const protCenter = cutPos + (bodySign * geom.pilasterProtDepth) / 2;
  return recenterAxis(raw, axis, protCenter);
}

/**
 * Build the slim alignment key. The tongue (male, `inflate` = 0) protrudes from
 * the cut face with a 45° self-supporting underside and a lead-in chamfer at the
 * top/tip; the groove (female, `inflate` = clearance) is the same shape grown by
 * the fit clearance. Extruded along the cut line and centered on the key axis.
 */
export function buildKey(
  axis: 'x' | 'y',
  cutPos: number,
  perimeter: number,
  inward: -1 | 1,
  floorZ: number,
  keyHeight: number,
  inflate: number,
  protrusion: number,
  geom: WallKeyGeometry,
  wall: WallFace = FLUSH_WALL
): Shape3D {
  // `protrusion` is pre-clamped by `fitWallKeyToHeight` so the 45° tip ramp finishes
  // below the lead-in notch; both male tongue and female groove receive the same value.
  const halfW = geom.keyHalfWidth + inflate;
  const protTip = cutPos + protrusion + inflate;
  const keyTop = floorZ + keyHeight + inflate;
  const lead = Math.min(WALL_KEY_LEADIN, protrusion - 0.2, keyHeight / 2);
  if (wall.breaks.length > 0) {
    return buildKeyOnTaper(
      axis,
      cutPos,
      perimeter,
      inward,
      floorZ,
      keyTop,
      halfW,
      protTip,
      lead,
      protrusion,
      geom,
      wall
    );
  }
  const perpC = perimeter + inward * geom.perpInset;
  const perpAxis = axis === 'x' ? 'y' : 'x';

  // Profile in (cut-normal, Z): the protruding span is a wedge — a 45° self-supporting
  // underside ramp and a top that slopes down by `lead` from the seam to the tip, so the
  // tongue reads as a sculpted point and self-guides as the halves press in. The body
  // portion keeps a flat top (it's buried in the wall/pilaster). The key extrudes along
  // the cut line (perpAxis), so its profile lives in the cut plane.
  const plane = axis === 'x' ? 'XZ' : 'YZ';
  const profile = draw([cutPos - OVERLAP, floorZ])
    .lineTo([cutPos - OVERLAP, keyTop])
    .lineTo([cutPos, keyTop])
    .lineTo([protTip, keyTop - lead])
    .lineTo([protTip, floorZ + protrusion])
    .lineTo([cutPos, floorZ])
    .close();
  const raw = sketch(profile, plane, 0).extrude(2 * halfW);
  return recenterAxis(raw, perpAxis, perpC);
}

/**
 * The key on a tapered wall. It can no longer be one extrusion along the cut
 * line, because its position along that line has to follow the wall as it
 * leans; instead it is lofted through horizontal sections, each the flat key's
 * cross-section at that height, carried inward with the wall. Sections sit at
 * the profile's own corners and at the wall's slope breaks, so every face of the
 * loft is planar.
 */
function buildKeyOnTaper(
  axis: 'x' | 'y',
  cutPos: number,
  perimeter: number,
  inward: -1 | 1,
  floorZ: number,
  keyTop: number,
  halfW: number,
  protTip: number,
  lead: number,
  protrusion: number,
  geom: WallKeyGeometry,
  wall: WallFace
): Shape3D {
  const rampTop = floorZ + protrusion;
  const leadStart = keyTop - lead;
  // The flat profile's far edge in the cut-normal direction at height z.
  const tipAt = (z: number): number => {
    if (z <= rampTop) return cutPos + ((protTip - cutPos) * (z - floorZ)) / protrusion;
    if (z <= leadStart) return protTip;
    return protTip + ((cutPos - protTip) * (z - leadStart)) / lead;
  };
  const levels = [floorZ, rampTop, leadStart, keyTop, ...wall.breaks]
    .filter((z) => z >= floorZ - EPSILON && z <= keyTop + EPSILON)
    .sort((a, b) => a - b)
    .filter((z, i, all) => i === 0 || z - all[i - 1] > EPSILON);

  const sections = levels.map((z) => {
    const n0 = cutPos - OVERLAP;
    const n1 = tipAt(z);
    const perpC = perimeter + inward * (wall.inset(z) + geom.perpInset);
    const [cx, cy, w, d] =
      axis === 'x'
        ? [(n0 + n1) / 2, perpC, n1 - n0, 2 * halfW]
        : [perpC, (n0 + n1) / 2, 2 * halfW, n1 - n0];
    return drawRectangle(w, d).translate(cx, cy).sketchOnPlane('XY', z) as Sketch;
  });
  const [first, ...rest] = sections;
  return first.loftWith(rest, { ruled: true });
}
