/**
 * Divider piece geometry builder for slotted bin style.
 *
 * Generates removable divider pieces — flat rectangular walls whose
 * length includes tab engagement depth on each end so they slot into
 * the wall cuts. With both axes enabled, cross dividers engage one of
 * two ways (slotConfig.crossStyle):
 * - 'lap': full-length pieces both directions, interlocking egg-crate
 *   style via cross-lap notches (X pieces notched from the top,
 *   Y pieces from the bottom, each to just past half height)
 * - 'insert': full-length pieces along one axis carry vertical face
 *   receptacles; the other axis becomes short per-compartment pieces
 *   (interior divider-to-divider, edge wall-to-divider)
 */

import { box, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateDividerHeight,
  calculateDividerLength,
  calculateDividerPieceHeight,
  calculateLapPartialSegments,
  calculateLapSnapPositions,
  calculateShortDividerLengths,
  calculateShortDividerSpans,
  calculateSlotPositions,
  dividerGrooveDepth,
  dividerSeatZ,
  getDividerLockPlan,
  getReceptacleDepth,
  getSnapScoreDepth,
  lapNotchWidth,
  resolveCrossDividerMode,
  resolvePartialStyle,
  SNAP_SCORE_WIDTH,
  tabEngagement,
} from '@/shared/utils/slotMath';
import type { DividerLockPlan } from '@/shared/utils/slotMath';
import { authoredExposedSpan, computeAuthoredDividers } from '@/shared/utils/authoredDividerMath';
import { deriveWallSegments } from '@/shared/utils/compartmentGeometry';
import { pieceCorners, resolveDividerFilletSeat } from '@/shared/utils/slottedFillet';
import type { PieceCorners } from '@/shared/utils/slottedFillet';
import { getEffectiveSlotDimensions } from './slotBuilder';
import {
  applyCuts,
  buildDividerPiece,
  cornerColumns,
  cutCrossLapNotches,
  cutFaceGrooves,
  cutLidKeepoutRelief,
  resolveKeepoutRelief,
} from './dividerPieceShape';
import { cutPiecePattern, resolvePiecePatternContext } from './dividerPiecePatternBuilder';
import { pieceWindowCutter } from './dividerPieceWindowCut';
import { cutPieceSeatFit, resolvePieceSeatFit, seatTopZ } from './dividerPieceSeat';
import type { PieceSeatFit } from './dividerPieceSeat';
import type { ExposedSpan } from './dividerPieceWindowCut';
import type { PieceGeometry } from './dividerPiecePatternBuilder';
import type { PieceObstruction } from './dividerPiecePatterns';
import {
  dividerJointClearance,
  partLengthBudget,
  planDividerSeams,
  seamKeepOut,
} from './dividerSeamPlan';
import type { DividerBedFit } from './dividerSeamPlan';
import { COPLANAR_OVERLAP, LIP_TAPER_WIDTH } from './generatorConstants';

// Re-export shared math so existing imports from generation internals still work
export { buildDividerPiece, calculateDividerHeight, calculateDividerLength };

/** A unique divider solid plus its export label. */
export interface LabeledDividerPiece {
  readonly shape: Shape3D;
  readonly label: string;
  /** Where to cut the piece to fit the print bed; empty without a bed. */
  readonly seams?: readonly number[];
}

/**
 * Seams for one piece on the bed, and the pattern geometry that keeps each
 * seam's joint solid. Without a bed, or when the piece fits, both pass through.
 */
function planPieceSeams(
  geometry: PieceGeometry,
  dividerHeight: number,
  fit: DividerBedFit | undefined
): { seams: readonly number[]; geometry: PieceGeometry } {
  const budget = fit ? partLengthBudget(dividerHeight, fit.printBed) : null;
  if (!fit || budget === null) return { seams: [], geometry };
  const cl = dividerJointClearance(fit.nozzleSizeMm);
  // A window needs no place here: on a piece the bed splits, it leaves a
  // tongue band under it (`pieceWindowCutter`).
  const obstructions = [
    ...(geometry.notches ?? []),
    ...(geometry.grooves ?? []),
    ...cornerColumns(geometry.length, geometry.corners),
  ];
  const seams = planDividerSeams(geometry.length, budget, obstructions, cl);
  if (seams.length === 0) return { seams, geometry };
  const grooves = [...(geometry.grooves ?? []), ...seams.map((s) => seamKeepOut(s, cl))];
  return { seams, geometry: { ...geometry, grooves } };
}

/**
 * Relieve the divider tab across the slot's throat band so retention works.
 *
 * The wall slot narrows to a throat a short way above the floor (getDividerLockPlan):
 * the full-thickness head seats in the pocket below it and the throat is meant to
 * re-close over the tab and trap the head. A uniform tab defeats that: its full
 * thickness plows the throat open on the way down and nothing holds it. Cutting the
 * tab back to the neck width across the throat band leaves the throat free to close
 * over the neck, with the head's shoulder captured beneath it (a geometric stop, not
 * friction).
 *
 * In flat orientation the piece is centered in X (length) and Y (installed height,
 * −Y = installed bottom, resting on the floor); the tab spans Z [0, tabTop] with the
 * build plate at Z=0 (`tabTop` is the thickness less any piece fit), so the two faces
 * recessed here sit at Z=0 and Z=tabTop. Both faces are relieved at both ends; a
 * relief near a free end seats in empty space and is inert, so pieces need not track
 * which ends land in a wall slot. Skips a piece whose top stays below the throat: the
 * bin builds its throat from its own wall height, so a short piece whose top reaches
 * into the band still needs the relief.
 */
function cutDividerNeckRelief(
  piece: Shape3D,
  length: number,
  height: number,
  tabDepth: number,
  lock: DividerLockPlan,
  tabTop: number,
  lift = 0
): Shape3D {
  const depthPerFace = (tabTop - lock.neckWidth) / 2;
  const lockHeight = lock.headHeight + lock.throatHeight;
  // A tab the piece fit already thinned to the neck needs no relief, and one a
  // hair wider would leave a sliver face.
  if (depthPerFace < COPLANAR_OVERLAP || height <= lift + lock.headHeight) return piece;

  // Relieve a hair beyond the throat band (headHeight..headHeight+throatHeight
  // above the floor-resting bottom edge, or above `lift` over a fillet) so a
  // piece seated slightly high or low still lands the throat on relieved
  // material.
  const bandSlack = 0.2;
  const bandLow = -height / 2 + lift + lock.headHeight - bandSlack;
  const bandHigh = -height / 2 + lift + lockHeight + bandSlack;
  const bandCenterY = (bandLow + bandHigh) / 2;
  const bandHeight = bandHigh - bandLow;

  // Relief spans the engaged tab depth (plus a margin so it always underlies the
  // throat) and overruns the tip so the cutter leaves no coplanar faces.
  const margin = 0.6;
  const cutZ = depthPerFace + COPLANAR_OVERLAP;
  const faceZ = (depthPerFace - COPLANAR_OVERLAP) / 2;
  const cutters: Shape3D[] = [];
  for (const sign of [-1, 1] as const) {
    const outer = sign * (length / 2 + COPLANAR_OVERLAP);
    const inner = sign * (length / 2 - tabDepth - margin);
    const cx = (outer + inner) / 2;
    const clen = Math.abs(outer - inner);
    cutters.push(
      box(clen, bandHeight, cutZ, { at: [cx, bandCenterY, faceZ] }),
      box(clen, bandHeight, cutZ, { at: [cx, bandCenterY, tabTop - faceZ] })
    );
  }
  return applyCuts(piece, cutters);
}

/**
 * Fit a piece's seats, its rounded `corners` included, then relieve each tab's
 * neck against the thinned tab, `lift` above the bottom edge over a fillet.
 * Consumes `piece`.
 */
export function relieveTabSeats(
  piece: Shape3D,
  length: number,
  height: number,
  thickness: number,
  tabDepth: number,
  lock: DividerLockPlan,
  seat: PieceSeatFit,
  lift = 0,
  corners: PieceCorners | null = null
): Shape3D {
  const seated = cutPieceSeatFit(piece, length, height, thickness, tabDepth, seat, corners);
  return cutDividerNeckRelief(
    seated,
    length,
    height,
    tabDepth,
    lock,
    seatTopZ(thickness, seat),
    lift
  );
}

/**
 * Build one divider piece per unique shape for a slotted bin.
 *
 * Single-axis bins get one piece. Both-axes bins get either two
 * interlocking full-length pieces ('lap') or a receptacle-grooved long
 * piece plus short per-compartment pieces ('insert'). Users duplicate
 * instances in their slicer as needed.
 *
 * Pieces are stacked side-by-side on the plate (5mm gaps) in return order.
 * With `fit`, a piece longer than the bed carries the seams to split it at.
 */
export function buildUniqueDividerPieces(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean,
  fit?: DividerBedFit
): LabeledDividerPiece[] {
  if (params.style !== 'slotted') return [];

  // Custom (authored-layout) removable dividers take a separate path: pieces
  // come from the drawn grid, not from parametric pitch. Require customGrid so
  // this stays consistent with slotBuilder (which only cuts authored slots when
  // the grid is present, else falls back to parametric).
  if (params.slotConfig.layout === 'custom' && params.slotConfig.customGrid) {
    return buildAuthoredDividerPieces(params, innerW, innerD, wallHeight, hasLip, fit);
  }

  const { slotConfig, dividerPieces } = params;
  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);
  const { thickness, clearance } = dividerPieces;

  const seatZ = dividerSeatZ(params.wallThickness, params.base.style, dividerGrooveDepth(params));
  const dividerHeight = calculateDividerPieceHeight(dividerPieces, wallHeight, hasLip, seatZ);

  const bothAxes = slotConfig.x.enabled && slotConfig.y.enabled;
  const { style: crossStyle, longAxis } = resolveCrossDividerMode(slotConfig, thickness);
  // Cross positions must match the wall slot positions, which the pipeline
  // computes with the lip overhang as edge inset (see buildSlotCutsInScope).
  const edgeInset = hasLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
  // Half height per side leaves the crossing flush; add the fit clearance so
  // over-extrusion can't hold the upper divider proud of the rim.
  const notchDepth = dividerHeight / 2 + clearance;
  const notchWidth = lapNotchWidth(dividerPieces);

  // Positions of the perpendicular dividers along each piece's length.
  // An X-spanning piece is crossed by Y-axis dividers (positions along
  // innerW) and vice versa.
  const crossingsForX = calculateSlotPositions(innerW, slotConfig.y.pitch, edgeInset);
  const crossingsForY = calculateSlotPositions(innerD, slotConfig.x.pitch, edgeInset);

  const axisLabel = (axis: 'x' | 'y'): string =>
    axis === 'x' ? 'divider-horizontal' : 'divider-vertical';

  const pieces: LabeledDividerPiece[] = [];
  // Every piece goes through `pattern` exactly once before its `addPiece`, so
  // the seams planned there belong to the next piece added.
  let pendingSeams: readonly number[] = [];
  const addPiece = (shape: Shape3D, label: string): void => {
    const seams = pendingSeams;
    pendingSeams = [];
    const yOffset = pieces.length * (dividerHeight + 5);
    if (yOffset === 0) {
      pieces.push({ shape, label, seams });
      return;
    }
    // translate() creates a new shape — dispose the pre-translation piece
    // to prevent leaking its intermediate handle across regenerations.
    const translated = translate(shape, [0, yOffset, 0]);
    shape.delete();
    pieces.push({ shape: translated, label, seams });
  };

  // A piece end seating in a wall slot rounds its bottom corner over the
  // interior fillet; an end in a receptacle or against another piece stays square.
  const seat = resolveDividerFilletSeat(params, { innerW, innerD, wallHeight, hasLip });
  const bothEnds = pieceCorners(seat, true, true);
  const buildFullPiece = (axis: 'x' | 'y'): Shape3D => {
    const innerDim = axis === 'x' ? innerW : innerD;
    const length = calculateDividerLength(innerDim, slotDepth, clearance);
    return buildDividerPiece(length, thickness, dividerHeight, bothEnds);
  };
  const fullLength = (axis: 'x' | 'y'): number =>
    calculateDividerLength(axis === 'x' ? innerW : innerD, slotDepth, clearance);

  // Wall pattern on removable pieces. Null when the option is off, so
  // every `pattern(...)` below is a pass-through in the default case.
  const patternCtx = resolvePiecePatternContext(params, innerW, innerD, dividerHeight, thickness);
  const tabDepth = tabEngagement(slotDepth, clearance);
  const columns = (positions: readonly number[], width: number): PieceObstruction[] =>
    positions.map((offset) => ({ offset, width }));
  const windowed = pieceWindowCutter(params, dividerHeight, thickness, notchDepth, fit);
  const pattern = (piece: Shape3D, geometry: PieceGeometry, exposed?: ExposedSpan): Shape3D => {
    const { cutPiece, geometry: withWindow } = windowed(piece, geometry, exposed);
    const planned = planPieceSeams(withWindow, dividerHeight, fit);
    pendingSeams = planned.seams;
    return patternCtx ? cutPiecePattern(cutPiece, patternCtx, planned.geometry) : cutPiece;
  };
  // Every wall tab seats past a retention throat, so relieve every piece's tab
  // neck (inert at receptacle/free ends). Length varies per piece. The lid
  // keep-out notch rides on the same call, inert at an end that seats mid-cavity.
  const lock = getDividerLockPlan(thickness, clearance);
  const seatFit = resolvePieceSeatFit(params, hasLip);
  const keepout = resolveKeepoutRelief(
    params,
    innerW,
    innerD,
    wallHeight,
    hasLip,
    seatZ,
    dividerHeight,
    tabDepth
  );
  const relief = (
    piece: Shape3D,
    length: number,
    corners: PieceCorners | null = bothEnds
  ): Shape3D => {
    const necked = relieveTabSeats(
      piece,
      length,
      dividerHeight,
      thickness,
      tabDepth,
      lock,
      seatFit,
      seat?.lockLift ?? 0,
      corners
    );
    return cutLidKeepoutRelief(necked, length, dividerHeight, thickness, keepout);
  };

  if (!bothAxes) {
    if (slotConfig.x.enabled)
      addPiece(
        relief(
          pattern(buildFullPiece('x'), {
            length: fullLength('x'),
            tabEngagement: tabDepth,
            corners: bothEnds,
          }),
          fullLength('x')
        ),
        axisLabel('x')
      );
    if (slotConfig.y.enabled)
      addPiece(
        relief(
          pattern(buildFullPiece('y'), {
            length: fullLength('y'),
            tabEngagement: tabDepth,
            corners: bothEnds,
          }),
          fullLength('y')
        ),
        axisLabel('y')
      );
    return pieces;
  }

  const longPositions = longAxis === 'y' ? crossingsForX : crossingsForY;
  // Insert mode needs at least one long divider to carry receptacles for
  // the short pieces. With none, fall through to the lap path: the piece
  // crossed by the (absent) long dividers comes out plain; the other
  // keeps its lap notches.
  if (crossStyle === 'insert' && longPositions.length > 0) {
    const shortAxis = longAxis === 'y' ? 'x' : 'y';
    const shortSpanDim = shortAxis === 'x' ? innerW : innerD;
    const grooveDepth = getReceptacleDepth(thickness);
    const groovePositions = longAxis === 'y' ? crossingsForY : crossingsForX;

    let longPiece = buildFullPiece(longAxis);
    longPiece = cutFaceGrooves(
      longPiece,
      groovePositions,
      slotWidth,
      grooveDepth,
      dividerHeight,
      thickness
    );
    longPiece = pattern(longPiece, {
      length: fullLength(longAxis),
      tabEngagement: tabDepth,
      grooves: columns(groovePositions, slotWidth),
      corners: bothEnds,
    });
    addPiece(relief(longPiece, fullLength(longAxis)), axisLabel(longAxis));

    // Short pieces only exist where there are rows to seat them —
    // groovePositions are also the short direction's wall slot rows.
    if (groovePositions.length > 0) {
      const spans = calculateShortDividerSpans(longPositions, shortSpanDim, thickness);
      const lengths = calculateShortDividerLengths(spans, slotDepth, grooveDepth, clearance);
      if (lengths.interior !== null && lengths.interior > 0) {
        const tab = tabEngagement(grooveDepth, clearance);
        const piece = pattern(buildDividerPiece(lengths.interior, thickness, dividerHeight), {
          length: lengths.interior,
          // Both ends slide into a face receptacle rather than a wall slot.
          // Must be the ENGAGEMENT, not the groove depth — `lengths.interior`
          // is `span + 2 * tabEngagement(grooveDepth, ...)`, so using the raw
          // depth would hold more clear than the tab actually occupies.
          tabEngagement: tab,
        });
        const seated = cutPieceSeatFit(
          piece,
          lengths.interior,
          dividerHeight,
          thickness,
          tab,
          seatFit
        );
        addPiece(seated, `${axisLabel(shortAxis)}-compartment`);
      }
      if (lengths.edge !== null && lengths.edge > 0) {
        // One end seats in a wall slot (relieve so its throat catches); the
        // piece is symmetric/reversible, so relieving both ends keeps the wall
        // end covered whichever way it goes in. Over a fillet only the low end
        // is rounded, and that end goes to the wall: turned end for end, the
        // same piece serves the far wall.
        const wallEnd = pieceCorners(seat, true, false);
        addPiece(
          relief(
            pattern(buildDividerPiece(lengths.edge, thickness, dividerHeight, wallEnd), {
              length: lengths.edge,
              // One end seats in a wall slot, the other in a receptacle, and
              // `calculateShortDividerLengths` builds this piece with the SHALLOWER
              // of the two at both ends — so mirror that rather than the deeper one.
              tabEngagement: Math.min(tabDepth, tabEngagement(grooveDepth, clearance)),
              corners: wallEnd,
            }),
            lengths.edge,
            wallEnd
          ),
          `${axisLabel(shortAxis)}-compartment-edge`
        );
      }
    }
    return pieces;
  }

  // Lap mode (or insert fallback): full-length pieces both directions,
  // notched at every crossing so they interlock. X pieces are notched from
  // the top so bottom-notched Y pieces drop over them.
  const lapPieces: { axis: 'x' | 'y'; crossings: number[]; fromTop: boolean }[] = [
    { axis: 'x', crossings: crossingsForX, fromTop: true },
    { axis: 'y', crossings: crossingsForY, fromTop: false },
  ];
  // Partial-length pieces are only offered in genuine lap topology (a spanning
  // piece rides over crossing dividers via notches). The insert fallback above
  // never reaches here with a partial style — resolvePartialStyle returns
  // 'full' unless the effective cross mode is lap.
  const partialStyle = resolvePartialStyle(slotConfig, thickness);

  for (const { axis, crossings, fromTop } of lapPieces) {
    const notch = (piece: Shape3D, positions: number[]): Shape3D =>
      cutCrossLapNotches(
        piece,
        positions,
        notchWidth,
        notchDepth,
        dividerHeight,
        thickness,
        fromTop
      );

    if (partialStyle === 'lengthSet') {
      const innerDim = axis === 'x' ? innerW : innerD;
      const { segments } = calculateLapPartialSegments(
        crossings,
        innerDim,
        thickness,
        slotDepth,
        clearance
      );
      for (const seg of segments) {
        // A wall end carries a tab, so its exposed span starts in from the end.
        const corners = pieceCorners(
          seat,
          seg.exposed.from > -seg.length / 2,
          seg.exposed.to < seg.length / 2
        );
        const piece = relief(
          pattern(
            notch(
              buildDividerPiece(seg.length, thickness, dividerHeight, corners),
              seg.notchOffsets
            ),
            {
              length: seg.length,
              tabEngagement: tabDepth,
              notches: columns(seg.notchOffsets, notchWidth),
              corners,
            },
            seg.exposed
          ),
          seg.length,
          corners
        );
        const label = seg.labelSuffix ? `${axisLabel(axis)}-${seg.labelSuffix}` : axisLabel(axis);
        addPiece(piece, label);
      }
      continue;
    }

    let piece = notch(buildFullPiece(axis), crossings);
    const snapPositions =
      partialStyle === 'snappable' ? calculateLapSnapPositions(crossings, notchWidth) : [];
    if (partialStyle === 'snappable') {
      piece = cutFaceGrooves(
        piece,
        snapPositions,
        SNAP_SCORE_WIDTH,
        getSnapScoreDepth(thickness),
        dividerHeight,
        thickness
      );
    }
    piece = pattern(piece, {
      length: fullLength(axis),
      tabEngagement: tabDepth,
      notches: columns(crossings, notchWidth),
      grooves: columns(snapPositions, SNAP_SCORE_WIDTH),
      corners: bothEnds,
    });
    addPiece(relief(piece, fullLength(axis)), axisLabel(axis));
  }

  return pieces;
}

/**
 * Build removable divider pieces from an authored (custom-layout) grid.
 *
 * Each wall segment becomes one flat piece: wall-tab ends where it meets a bin
 * wall, abutting ends at T-junctions, and cross-lap notches where perpendicular
 * segments cross it (vertical pieces notched from the top, horizontal from the
 * bottom, so they interlock). Pieces stack side-by-side on the plate, labeled
 * in reading order to match the assembly map.
 */
export function buildAuthoredDividerPieces(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean,
  fit?: DividerBedFit
): LabeledDividerPiece[] {
  const { slotConfig, dividerPieces } = params;
  const grid = slotConfig.customGrid;
  if (!grid) return [];

  const { slotDepth } = getEffectiveSlotDimensions(params);
  const { thickness, clearance } = dividerPieces;
  const seatZ = dividerSeatZ(params.wallThickness, params.base.style, dividerGrooveDepth(params));
  const dividerHeight = calculateDividerPieceHeight(dividerPieces, wallHeight, hasLip, seatZ);
  const notchDepth = dividerHeight / 2 + clearance;
  const notchWidth = lapNotchWidth(dividerPieces);

  const segments = deriveWallSegments(grid, innerW, innerD);
  const specs = computeAuthoredDividers(segments, innerW, innerD, thickness, slotDepth, clearance);

  const patternCtx = resolvePiecePatternContext(params, innerW, innerD, dividerHeight, thickness);
  const windowed = pieceWindowCutter(params, dividerHeight, thickness, notchDepth, fit);
  // Authored pieces shorten their length at abutting ends rather than carrying
  // a tab there, so holding the full tab depth at both ends is conservative —
  // a little extra solid margin, never a perforated tab.
  const tabDepth = tabEngagement(slotDepth, clearance);
  const lock = getDividerLockPlan(thickness, clearance);
  const seatFit = resolvePieceSeatFit(params, hasLip);
  const keepout = resolveKeepoutRelief(
    params,
    innerW,
    innerD,
    wallHeight,
    hasLip,
    seatZ,
    dividerHeight,
    tabDepth
  );
  const seat = resolveDividerFilletSeat(params, { innerW, innerD, wallHeight, hasLip });

  const pieces: LabeledDividerPiece[] = [];
  let yOffset = 0;
  for (const spec of specs) {
    // A wall end reaches past the interior into its slot; an abutting end stops short.
    const runMax = spec.orientation === 'vertical' ? innerD : innerW;
    const corners = pieceCorners(seat, spec.start < 0, spec.end > runMax);
    let shape = cutCrossLapNotches(
      buildDividerPiece(spec.length, thickness, dividerHeight, corners),
      spec.notchOffsets,
      notchWidth,
      notchDepth,
      dividerHeight,
      thickness,
      spec.fromTop
    );
    const { cutPiece, geometry } = windowed(
      shape,
      {
        length: spec.length,
        tabEngagement: tabDepth,
        notches: spec.notchOffsets.map((offset) => ({ offset, width: notchWidth })),
        corners,
      },
      authoredExposedSpan(spec, innerW, innerD)
    );
    shape = cutPiece;
    const planned = planPieceSeams(geometry, dividerHeight, fit);
    if (patternCtx) shape = cutPiecePattern(shape, patternCtx, planned.geometry);
    // Relieve the tab neck so a wall-anchored end's throat catches; inert at
    // abutting/T-junction ends that carry no tab.
    shape = relieveTabSeats(
      shape,
      spec.length,
      dividerHeight,
      thickness,
      tabDepth,
      lock,
      seatFit,
      seat?.lockLift ?? 0,
      corners
    );
    // Give up the lid's seating band (end-only under a capping lid, full-span
    // under a sliding plate).
    shape = cutLidKeepoutRelief(shape, spec.length, dividerHeight, thickness, keepout);
    if (yOffset > 0) {
      const translated = translate(shape, [0, yOffset, 0]);
      shape.delete();
      shape = translated;
    }
    pieces.push({ shape, label: spec.label, seams: planned.seams });
    yOffset += dividerHeight + 5;
  }
  return pieces;
}
