/**
 * Click-lock lid geometry builder.
 *
 * Produces a standalone lid solid that mates with a Gridfinity bin's
 * stacking lip. The lid is built in lid-local coordinates so it can be
 * positioned and exported independently of the bin.
 *
 * Reference: AnyLid OpenSCAD by rngcntr (gridfinity-bin-lids.scad). Each
 * piece below is a faithful translation of one SCAD module:
 *   - `BaseSurface` → `buildLidFloor`
 *   - `BottomCorners` + `BottomStraights` → `buildMatingShell` (loft path)
 *   - `ClickStraights` → `buildClickRails`
 *   - `TopWithClearance` → `buildStackGrid`
 *   - `MagnetHoles` → `cutMagnetHoles`
 *
 * Coordinate convention:
 *   Z = 0          : top of lid floor
 *   Z = -topThickness : bottom of lid floor (top of mating cavity)
 *   Z negative     : mating shell + click rails (extend down over bin lip)
 *   Z positive     : optional Gridfinity stack grid
 */

import {
  draw,
  drawRoundedRectangle,
  drawCircle,
  unwrap,
  fuse,
  cut,
  translate,
  rotate,
  withScope,
} from 'brepjs';
import type { Shape3D, DisposalScope, Plane, Vec3, Sketch, ValidSolid, Drawing } from 'brepjs';
import {
  SIZE,
  HEIGHT_UNIT,
  BOX_CORNER_RADIUS,
  LIP_SMALL_TAPER,
  LIP_VERTICAL_PART,
  LIP_BIG_TAPER,
  LIP_TAPER_WIDTH,
} from './generatorConstants';
import {
  LID_CLICK_RAIL_BUMP,
  LID_CLICK_RAIL_ENTRY_CHAMFER,
  LID_CLICK_RAIL_EXIT_CHAMFER,
  LID_CLICK_RAIL_DROP,
  LID_CLICK_RAIL_TAIL,
  LID_CLICK_RAIL_OUT,
  LID_CLICK_RAIL_INSET,
  LID_CLICK_RAIL_INNER,
  LID_CLICK_RAIL_TOP_CHAMFER,
  LID_MAGNET_OFFSETS,
  LID_COPLANAR_MARGIN,
  LID_MIN_CORNER_RADIUS,
  lidAnchorZ,
  lidWallBottomZ,
} from './lidConstants';
import type { BinParams } from '@/shared/types/bin';
import { LID_FIT_CLEARANCE } from '@/shared/types/bin';

/** Geometric inputs derived from BinParams. */
interface LidInputs {
  readonly lidOuterW: number;
  readonly lidOuterD: number;
  readonly lidCornerR: number;
  readonly fitClearance: number;
  readonly topThickness: number;
  readonly wallThickness: number;
  readonly stackableTop: boolean;
  readonly magnetHoles: boolean;
  readonly magnetDiameter: number;
  readonly magnetDepth: number;
  readonly cellsX: number;
  readonly cellsY: number;
  readonly gridUnitMm: number;
  readonly heightUnitMm: number;
  /** Bin has a label on its back wall — disable click rails on the front/back walls. */
  readonly omitFrontBackRails: boolean;
  /** Z of the bin's lip top in lid-local coords when snapped (the "anchor" line). */
  readonly anchorZ: number;
  /** Z of the bottom of the mating wall (where the wall ends and rails begin). */
  readonly wallBottomZ: number;
}

export function resolveLidInputs(params: BinParams): LidInputs {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for legacy params
  const gridUnitMm = params.gridUnitMm ?? SIZE;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for legacy params
  const heightUnitMm = params.heightUnitMm ?? HEIGHT_UNIT;
  const fitClearance = LID_FIT_CLEARANCE[params.lid.fit];

  // Lid outer footprint matches bin outer footprint (flush exterior on
  // straight walls; lid corners are slightly inside bin corners by the
  // fitClearance amount per the AnyLid reference).
  const lidOuterW = params.width * gridUnitMm - 2 * fitClearance;
  const lidOuterD = params.depth * gridUnitMm - 2 * fitClearance;
  const lidCornerR = BOX_CORNER_RADIUS - fitClearance;

  return {
    lidOuterW,
    lidOuterD,
    lidCornerR,
    fitClearance,
    topThickness: params.lid.topThickness,
    wallThickness: params.lid.wallThickness,
    stackableTop: params.lid.stackableTop,
    magnetHoles: params.lid.magnetHoles,
    magnetDiameter: params.base.magnetDiameter,
    magnetDepth: params.base.magnetDepth,
    cellsX: params.width,
    cellsY: params.depth,
    gridUnitMm,
    heightUnitMm,
    // Label tabs always sit on the back wall (per labelTabBuilder convention).
    // Disable click rails along the bin's depth axis (front/back) so they
    // don't collide with the printed label tab.
    omitFrontBackRails: params.label.enabled,
    anchorZ: lidAnchorZ(heightUnitMm, fitClearance),
    wallBottomZ: lidWallBottomZ(heightUnitMm, fitClearance),
  };
}

/* ──────────────────────────────────────────────────────────────────────
 * Mating shell — translates SCAD's BottomCorners + BottomStraights.
 *
 * The SCAD's BottomShape polygon, in cross-section:
 *   - Y ∈ [anchor, 0]: wall thickness = lidCornerR (full corner-radius)
 *   - Y ∈ [anchor - LIP_BIG_TAPER, anchor]: outer face chamfers inward by
 *     LIP_BIG_TAPER (matches the lip's top chamfer)
 *   - Y ∈ [wallBottom, anchor - LIP_BIG_TAPER]: wall thickness = lidCornerR -
 *     LIP_BIG_TAPER (1.85mm in standard fit), matching the lip's vertical part
 *
 * Inner cavity boundary is constant at lidCornerR inset from outer (so the
 * lid corners are solid pillars that don't engage the bin's lip — engagement
 * happens on the straights via the click rails).
 *
 * Built as two lofts (outer + inner) and subtracted, mirroring the
 * `buildTopShapeLoft` strategy from boxBuilder.ts so we stay on the same
 * code path that's been validated against OCCT non-square sweep bugs.
 * ──────────────────────────────────────────────────────────────────────── */

function buildMatingShell(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { lidOuterW, lidOuterD, lidCornerR, anchorZ, wallBottomZ } = inputs;
  const Z_TOP = 0;
  const Z_ANCHOR = anchorZ;
  const Z_VERT_TOP = anchorZ - LIP_BIG_TAPER;
  const Z_BOTTOM = wallBottomZ;

  // Returns a sketch at the given Z with the rounded-rectangle outline
  // inset from the lid's outer perimeter by `outerInset`. Corner radius
  // shrinks with inset so the outer profile remains rounded all the way down.
  const sectionAt = (z: number, outerInset: number): Sketch => {
    const w = lidOuterW - 2 * outerInset;
    const d = lidOuterD - 2 * outerInset;
    const r = Math.max(lidCornerR - outerInset, LID_MIN_CORNER_RADIUS);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  // OUTER profile — 4 sections in ASCENDING Z (loftWith expects this).
  // Translates SCAD BottomShape's right edge:
  //  Z=wallBottom and Z=Z_VERT_TOP : chamfered inward by LIP_BIG_TAPER
  //  Z=anchor and Z=0              : full outer (no chamfer)
  const outerSections: readonly Sketch[] = [
    sectionAt(Z_BOTTOM, LIP_BIG_TAPER),
    sectionAt(Z_VERT_TOP, LIP_BIG_TAPER),
    sectionAt(Z_ANCHOR, 0),
    sectionAt(Z_TOP, 0),
  ];

  // INNER profile — constant inset at lidCornerR (the SCAD polygon's left
  // edge stays at X = -lidCornerR throughout). Two sections in ASCENDING Z
  // with COPLANAR margin so the cut bites cleanly through the outer.
  const innerSections: readonly Sketch[] = [
    sectionAt(Z_BOTTOM - LID_COPLANAR_MARGIN, lidCornerR),
    sectionAt(Z_TOP + LID_COPLANAR_MARGIN, lidCornerR),
  ];

  const [oFirst, ...oRest] = outerSections;
  const outerLoft = scope.register(oFirst.loftWith([...oRest], { ruled: true }));
  const [iFirst, ...iRest] = innerSections;
  const innerLoft = scope.register(iFirst.loftWith([...iRest], { ruled: true }));

  return unwrap(cut(outerLoft, innerLoft));
}

/* ──────────────────────────────────────────────────────────────────────
 * Floor plate — translates SCAD's BaseSurface.
 *
 * Flat plate at Z ∈ [-topThickness, 0] in the full lid-outer outline. Fuses
 * with the mating shell to seal the cavity at the top.
 * ──────────────────────────────────────────────────────────────────────── */

function buildLidFloor(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { lidOuterW, lidOuterD, lidCornerR, topThickness } = inputs;
  return scope.register(
    drawRoundedRectangle(lidOuterW, lidOuterD, lidCornerR)
      .sketchOnPlane('XY', -topThickness)
      .extrude(topThickness) as Shape3D
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Click rails — translates SCAD's ClickStraights.
 *
 * SCAD ClickShape (X = outward from corner-radius line, Y = vertical):
 *   The polygon has its top at Z=wallBottom (just below the mating wall),
 *   protrudes OUTWARD by LID_CLICK_RAIL_OUT to form the rail bump that
 *   catches the lip's bottom chamfer, drops down, then has an inner shelf
 *   that gives the rail body structural depth.
 *
 * Each rail is built in a canonical orientation (extrusion along X axis,
 * profile in YZ plane), then translated/rotated to each straight wall.
 * Rails are inset from corners by `lidCornerR` on both ends.
 * ──────────────────────────────────────────────────────────────────────── */

function clickShape2D(wallBottomZ: number): Drawing {
  // Top of polygon = top of rail = bottom of mating wall.
  const yTop = wallBottomZ;
  // Heights derived directly from SCAD's polygon Y math.
  const y1 = yTop - LID_CLICK_RAIL_ENTRY_CHAMFER; // -0.8
  const y2 = y1 - LID_CLICK_RAIL_BUMP - 0.1; // rail body bottom
  const y3 = y2 - LID_CLICK_RAIL_EXIT_CHAMFER; // exit chamfer
  const y4 = y3 - LID_CLICK_RAIL_DROP; // post-bump drop
  const y5 = y4 - LID_CLICK_RAIL_TAIL; // bottom apex

  return draw([0, yTop])
    .lineTo([LID_CLICK_RAIL_OUT, yTop])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET, y1])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET, y2])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET + LID_CLICK_RAIL_EXIT_CHAMFER, y3])
    .lineTo([LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INSET + LID_CLICK_RAIL_EXIT_CHAMFER, y4])
    .lineTo([0, y5])
    .lineTo([LID_CLICK_RAIL_INNER, y5])
    .lineTo([LID_CLICK_RAIL_INNER, yTop])
    .lineTo([0, yTop + LID_CLICK_RAIL_TOP_CHAMFER])
    .close();
}

/**
 * Build a single click rail bar in a canonical orientation: extruded along
 * the X axis (length = wallLength), profile in YZ plane at X=0. The rail's
 * outward direction is +Y (so the bump protrudes in +Y), and its top sits
 * at Z=wallBottomZ.
 */
function buildClickRailBar(scope: DisposalScope, wallBottomZ: number, length: number): Shape3D {
  // Build polygon in a 2D plane where local X = outward, local Y = vertical.
  // Sketch on YZ plane (perpendicular to wall direction = X axis).
  // sketchOnPlane('YZ') puts the 2D X axis along world Y, 2D Y axis along world Z.
  const profile = clickShape2D(wallBottomZ);
  const sketch = profile.sketchOnPlane('YZ', -length / 2);
  return scope.register(sketch.extrude(length) as Shape3D);
}

function addClickRails(scope: DisposalScope, body: Shape3D, inputs: LidInputs): Shape3D {
  const { lidOuterW, lidOuterD, lidCornerR, wallBottomZ, omitFrontBackRails } = inputs;

  // Rail length = wall length minus 2× corner radius (rails don't enter corners).
  // Wall along X direction has length lidOuterW; along Y direction has length lidOuterD.
  const railLengthX = lidOuterW - 2 * lidCornerR;
  const railLengthY = lidOuterD - 2 * lidCornerR;

  const corneredOuterX = lidOuterW / 2 - lidCornerR;
  const corneredOuterY = lidOuterD / 2 - lidCornerR;

  let result = body;

  /**
   * Add one rail at the given world position, with an optional 180° rotation
   * around the wall-axis to flip the bump direction.
   *
   * Reusing buildClickRailBar's canonical form (extrude along X, bump in +Y).
   * A rail on the +Y wall (back wall) needs the bump in -Y direction — so we
   * rotate 180° around X axis. A rail on the +X wall needs the bar's extrude
   * direction to be Y instead of X — so we rotate 90° around Z.
   */
  const fuseRail = (rail: Shape3D, place: (s: Shape3D) => Shape3D) => {
    const positioned = scope.register(place(rail));
    scope.register(result);
    result = unwrap(fuse(result, positioned));
  };

  // Bump direction convention: each rail's bump points AWAY from lid center
  // (toward the lid's outer edge), so it can catch the lip's bottom chamfer.
  // The canonical bar (built by buildClickRailBar) extrudes along X with the
  // bump pointing +Y. Rotation rule: +90° around Z maps +Y → -X (right-hand
  // rule). So:
  //   - Back wall  (at +Y): bump +Y    → no rotation
  //   - Front wall (at -Y): bump -Y    → 180° around Z
  //   - Right wall (at +X): bump +X    → -90° around Z (maps +Y → +X)
  //   - Left wall  (at -X): bump -X    →  90° around Z (maps +Y → -X)

  if (!omitFrontBackRails) {
    // Back wall: bump +Y, no rotation
    const railBack = buildClickRailBar(scope, wallBottomZ, railLengthX);
    fuseRail(railBack, (r) => translate(r, [0, corneredOuterY, 0]));

    // Front wall: bump -Y via 180° Z rotation
    const railFront = buildClickRailBar(scope, wallBottomZ, railLengthX);
    fuseRail(railFront, (r) =>
      translate(rotate(r, 180, { axis: [0, 0, 1] }), [0, -corneredOuterY, 0])
    );
  }

  // Right wall: bump +X via -90° Z rotation
  const railRight = buildClickRailBar(scope, wallBottomZ, railLengthY);
  fuseRail(railRight, (r) =>
    translate(rotate(r, -90, { axis: [0, 0, 1] }), [corneredOuterX, 0, 0])
  );

  // Left wall: bump -X via +90° Z rotation
  const railLeft = buildClickRailBar(scope, wallBottomZ, railLengthY);
  fuseRail(railLeft, (r) => translate(rotate(r, 90, { axis: [0, 0, 1] }), [-corneredOuterX, 0, 0]));

  return result;
}

/* ──────────────────────────────────────────────────────────────────────
 * Stack grid — translates SCAD's TopWithClearance.
 *
 * Uses the same Gridfinity stacking-lip profile as a bin (so other bins can
 * stack on top of the lid identically to bin-on-bin). Built via sweepSketch
 * along the lid's outer perimeter, mirroring the bin's `buildTopShapeSweep`.
 * ──────────────────────────────────────────────────────────────────────── */

function buildStackGrid(scope: DisposalScope, inputs: LidInputs): Shape3D {
  const { lidOuterW, lidOuterD, lidCornerR } = inputs;

  // Standard Gridfinity lip profile (no extension — just the stacking ring).
  // Identical to the bin's TopShape so a stacked bin mates perfectly.
  const topProfile = (plane: Plane, _origin: Vec3): Sketch => {
    return draw([-LIP_TAPER_WIDTH, 0])
      .line(LIP_SMALL_TAPER, LIP_SMALL_TAPER)
      .vLine(LIP_VERTICAL_PART)
      .line(LIP_BIG_TAPER, LIP_BIG_TAPER)
      .vLineTo(0)
      .close()
      .sketchOnPlane(plane) as Sketch;
  };

  // Sweep around the lid's outer perimeter — uses the lid's corner radius.
  const lidPerimeter = drawRoundedRectangle(
    lidOuterW,
    lidOuterD,
    lidCornerR
  ).sketchOnPlane() as Sketch;
  return scope.register(lidPerimeter.sweepSketch(topProfile, { withContact: true }));
}

/* ──────────────────────────────────────────────────────────────────────
 * Magnet holes — translates SCAD's MagnetHoles.
 *
 * Standard Gridfinity magnet pattern: 4 holes per cell at ±13mm from the
 * cell center. Holes go upward through the floor from below.
 * ──────────────────────────────────────────────────────────────────────── */

function cutMagnetHoles(scope: DisposalScope, body: Shape3D, inputs: LidInputs): Shape3D {
  const { cellsX, cellsY, gridUnitMm, magnetDiameter, magnetDepth, topThickness } = inputs;
  const radius = magnetDiameter / 2;
  // Cells centered on lid center.
  const cellOriginX = -((cellsX - 1) / 2) * gridUnitMm;
  const cellOriginY = -((cellsY - 1) / 2) * gridUnitMm;

  // Hole spans floor + a bit extra so the cut bites cleanly.
  const holeZ = -topThickness - LID_COPLANAR_MARGIN;
  const holeHeight = magnetDepth + 2 * LID_COPLANAR_MARGIN;

  let result = body;
  for (let cx = 0; cx < cellsX; cx++) {
    for (let cy = 0; cy < cellsY; cy++) {
      const centerX = cellOriginX + cx * gridUnitMm;
      const centerY = cellOriginY + cy * gridUnitMm;
      for (const [ox, oy] of LID_MAGNET_OFFSETS) {
        const cylinder = scope.register(
          drawCircle(radius).sketchOnPlane('XY', holeZ).extrude(holeHeight) as Shape3D
        );
        const positioned = scope.register(translate(cylinder, [centerX + ox, centerY + oy, 0]));
        scope.register(result);
        result = unwrap(cut(result, positioned));
      }
    }
  }
  return result;
}

/**
 * Build the click-lock lid as a single brepjs solid in lid-local coordinates.
 *
 * Caller is responsible for the returned solid's lifetime; this function
 * uses an internal `withScope` so all intermediates are released.
 */
export function buildLid(params: BinParams): Shape3D {
  const inputs = resolveLidInputs(params);

  return withScope((scope: DisposalScope) => {
    // 1. Floor + mating shell — fused into the main body
    const floor = buildLidFloor(scope, inputs);
    const matingShell = scope.register(buildMatingShell(scope, inputs));
    let body: Shape3D = unwrap(fuse(floor, matingShell));

    // 2. Click rails — fuse onto the mating shell from outside
    body = addClickRails(scope, body, inputs);

    // 3. Optional Gridfinity stack grid on top
    if (inputs.stackableTop) {
      const stackGrid = scope.register(buildStackGrid(scope, inputs));
      scope.register(body);
      body = unwrap(fuse(body, stackGrid));
    }

    // 4. Optional magnet holes through the floor
    if (inputs.magnetHoles) {
      body = cutMagnetHoles(scope, body, inputs);
    }

    return body as ValidSolid;
  });
}
