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

import { box, cut, fuseAll, translate, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
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
  resolveCrossDividerMode,
  resolvePartialStyle,
  SNAP_SCORE_WIDTH,
  tabEngagement,
} from '@/shared/utils/slotMath';
import type { DividerLockPlan } from '@/shared/utils/slotMath';
import { computeAuthoredDividers } from '@/shared/utils/authoredDividerMath';
import { deriveWallSegments } from '@/shared/utils/compartmentGeometry';
import { getEffectiveSlotDimensions } from './slotBuilder';
import { cutPiecePattern, resolvePiecePatternContext } from './dividerPiecePatternBuilder';
import type { PieceGeometry } from './dividerPiecePatternBuilder';
import type { PieceObstruction } from './dividerPiecePatterns';
import { COPLANAR_OVERLAP, LIP_TAPER_WIDTH } from './generatorConstants';

// Re-export shared math so existing imports from generation internals still work
export { calculateDividerHeight, calculateDividerLength };

/** A unique divider solid plus its export label. */
export interface LabeledDividerPiece {
  readonly shape: Shape3D;
  readonly label: string;
}

/**
 * Build a single divider piece laid flat for FDM printing.
 *
 * The divider is oriented with its largest face (length × height) on the
 * XY build plate and extruded upward by wall thickness. This gives the
 * strongest layer orientation — lines run along the wall rather than
 * across the thin dimension.
 *
 * @param length Total divider length in mm (including tab engagement)
 * @param thickness Divider wall thickness in mm
 * @param height Divider height in mm (becomes Y in flat orientation)
 */
export function buildDividerPiece(length: number, thickness: number, height: number): Shape3D {
  return box(length, height, thickness, { at: [0, 0, thickness / 2] });
}

/** Cut fused cutters from a piece. Consumes piece and cutters; passthrough when cutters is empty. */
function applyCuts(piece: Shape3D, cutters: Shape3D[]): Shape3D {
  if (cutters.length === 0) return piece;
  const compound = cutters.length === 1 ? cutters[0] : unwrap(fuseAll(cutters as ValidSolid[]));
  const result = unwrap(cut(piece, compound));
  piece.delete();
  compound.delete();
  if (cutters.length > 1) {
    for (const c of cutters) c.delete();
  }
  return result;
}

/**
 * Cut cross-lap notches into a flat divider piece.
 *
 * In flat orientation the piece is centered at the origin: length along X,
 * installed height along Y (+Y = installed top), thickness along Z. Cross
 * positions are relative to the interior center, which coincides with the
 * piece center, so they map directly to X coordinates.
 *
 * @param piece Flat divider piece (consumed — disposed after the cut)
 * @param positions Crossing centers along the length, relative to center
 * @param notchWidth Notch opening along the length (matches wall slot width)
 * @param notchDepth How far the notch reaches from the edge toward mid-height
 * @param height Divider height in mm
 * @param thickness Divider thickness in mm
 * @param fromTop true → notch from the installed top edge, false → bottom
 */
function cutCrossLapNotches(
  piece: Shape3D,
  positions: number[],
  notchWidth: number,
  notchDepth: number,
  height: number,
  thickness: number,
  fromTop: boolean
): Shape3D {
  // Extend past the edge (Y) and through the thickness (Z) so the cutter
  // never leaves coplanar faces with the piece.
  const cutterDepth = notchDepth + COPLANAR_OVERLAP;
  const cutterHeight = thickness + 2 * COPLANAR_OVERLAP;
  const edgeY = fromTop
    ? height / 2 - notchDepth / 2 + COPLANAR_OVERLAP / 2
    : -(height / 2 - notchDepth / 2 + COPLANAR_OVERLAP / 2);

  const cutters: Shape3D[] = positions.map((x) =>
    box(notchWidth, cutterDepth, cutterHeight, { at: [x, edgeY, thickness / 2] })
  );
  return applyCuts(piece, cutters);
}

/**
 * Cut vertical grooves into both faces of a flat divider piece.
 *
 * Grooves run the full installed height (local Y) at each position (local X),
 * recessed into the piece's two thickness faces (local Z). Insert mode uses
 * slot-wide grooves as receptacles a short divider's tab slides into;
 * snappable mode uses narrow, shallow grooves as a symmetric score line so
 * the piece breaks cleanly along the retained web.
 *
 * @param piece Flat divider piece (consumed — disposed after the cut)
 * @param positions Groove centers along the length, relative to center
 * @param grooveWidth Groove opening along the length
 * @param grooveDepth Recess depth per face
 * @param height Divider height in mm
 * @param thickness Divider thickness in mm
 */
function cutFaceGrooves(
  piece: Shape3D,
  positions: number[],
  grooveWidth: number,
  grooveDepth: number,
  height: number,
  thickness: number
): Shape3D {
  const cutterDepth = grooveDepth + COPLANAR_OVERLAP;
  const cutterHeight = height + 2 * COPLANAR_OVERLAP;

  const cutters: Shape3D[] = positions.flatMap((x) => [
    // Bottom face (Z=0): recess reaches up to grooveDepth
    box(grooveWidth, cutterHeight, cutterDepth, {
      at: [x, 0, (grooveDepth - COPLANAR_OVERLAP) / 2],
    }),
    // Top face (Z=thickness): recess reaches down to thickness − grooveDepth
    box(grooveWidth, cutterHeight, cutterDepth, {
      at: [x, 0, thickness - (grooveDepth - COPLANAR_OVERLAP) / 2],
    }),
  ]);
  return applyCuts(piece, cutters);
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
 * −Y = installed bottom, resting on the floor); Z (thickness) spans [0, thickness]
 * with the build plate at Z=0, so the two faces recessed here sit at Z=0 and
 * Z=thickness. Both faces are relieved at both ends; a relief near a free end seats
 * in empty space and is inert, so pieces need not track which ends land in a wall
 * slot. Skips pieces shorter than the lock stack, matching the slot builder's own
 * fall-back to a plain slot.
 */
function cutDividerNeckRelief(
  piece: Shape3D,
  length: number,
  height: number,
  thickness: number,
  tabDepth: number,
  lock: DividerLockPlan
): Shape3D {
  const depthPerFace = (thickness - lock.neckWidth) / 2;
  const lockHeight = lock.headHeight + lock.throatHeight;
  if (depthPerFace <= 0 || height <= lockHeight) return piece;

  // Relieve a hair beyond the throat band (headHeight..headHeight+throatHeight
  // above the floor-resting bottom edge) so a piece seated slightly high or low
  // still lands the throat on relieved material.
  const bandSlack = 0.2;
  const bandLow = -height / 2 + lock.headHeight - bandSlack;
  const bandHigh = -height / 2 + lockHeight + bandSlack;
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
      box(clen, bandHeight, cutZ, { at: [cx, bandCenterY, thickness - faceZ] })
    );
  }
  return applyCuts(piece, cutters);
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
 */
export function buildUniqueDividerPieces(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  hasLip: boolean
): LabeledDividerPiece[] {
  if (params.style !== 'slotted') return [];

  // Custom (authored-layout) removable dividers take a separate path: pieces
  // come from the drawn grid, not from parametric pitch. Require customGrid so
  // this stays consistent with slotBuilder (which only cuts authored slots when
  // the grid is present, else falls back to parametric).
  if (params.slotConfig.layout === 'custom' && params.slotConfig.customGrid) {
    return buildAuthoredDividerPieces(params, innerW, innerD, wallHeight, hasLip);
  }

  const { slotConfig, dividerPieces } = params;
  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);
  const { thickness, clearance } = dividerPieces;

  const dividerHeight = calculateDividerPieceHeight(
    dividerPieces,
    wallHeight,
    hasLip,
    dividerSeatZ(params.wallThickness, dividerGrooveDepth(params))
  );

  const bothAxes = slotConfig.x.enabled && slotConfig.y.enabled;
  const { style: crossStyle, longAxis } = resolveCrossDividerMode(slotConfig, thickness);
  // Cross positions must match the wall slot positions, which the pipeline
  // computes with the lip overhang as edge inset (see buildSlotCutsInScope).
  const edgeInset = hasLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
  // Half height per side leaves the crossing flush; add the fit clearance so
  // over-extrusion can't hold the upper divider proud of the rim.
  const notchDepth = dividerHeight / 2 + clearance;

  // Positions of the perpendicular dividers along each piece's length.
  // An X-spanning piece is crossed by Y-axis dividers (positions along
  // innerW) and vice versa.
  const crossingsForX = calculateSlotPositions(innerW, slotConfig.y.pitch, edgeInset);
  const crossingsForY = calculateSlotPositions(innerD, slotConfig.x.pitch, edgeInset);

  const axisLabel = (axis: 'x' | 'y'): string =>
    axis === 'x' ? 'divider-horizontal' : 'divider-vertical';

  const pieces: LabeledDividerPiece[] = [];
  const addPiece = (shape: Shape3D, label: string): void => {
    const yOffset = pieces.length * (dividerHeight + 5);
    if (yOffset === 0) {
      pieces.push({ shape, label });
      return;
    }
    // translate() creates a new shape — dispose the pre-translation piece
    // to prevent leaking its intermediate handle across regenerations.
    const translated = translate(shape, [0, yOffset, 0]);
    shape.delete();
    pieces.push({ shape: translated, label });
  };

  const buildFullPiece = (axis: 'x' | 'y'): Shape3D => {
    const innerDim = axis === 'x' ? innerW : innerD;
    const length = calculateDividerLength(innerDim, slotDepth, clearance);
    return buildDividerPiece(length, thickness, dividerHeight);
  };
  const fullLength = (axis: 'x' | 'y'): number =>
    calculateDividerLength(axis === 'x' ? innerW : innerD, slotDepth, clearance);

  // Wall pattern on removable pieces. Null when the option is off, so
  // every `pattern(...)` below is a pass-through in the default case.
  const patternCtx = resolvePiecePatternContext(params, innerW, innerD, dividerHeight, thickness);
  const tabDepth = tabEngagement(slotDepth, clearance);
  const columns = (positions: readonly number[], width: number): PieceObstruction[] =>
    positions.map((offset) => ({ offset, width }));
  const pattern = (piece: Shape3D, geometry: PieceGeometry): Shape3D =>
    patternCtx ? cutPiecePattern(piece, patternCtx, geometry) : piece;
  // Every wall tab seats past a retention throat, so relieve every piece's tab
  // neck (inert at receptacle/free ends). Length varies per piece.
  const lock = getDividerLockPlan(thickness, clearance);
  const relief = (piece: Shape3D, length: number): Shape3D =>
    cutDividerNeckRelief(piece, length, dividerHeight, thickness, tabDepth, lock);

  if (!bothAxes) {
    if (slotConfig.x.enabled)
      addPiece(
        relief(
          pattern(buildFullPiece('x'), { length: fullLength('x'), tabEngagement: tabDepth }),
          fullLength('x')
        ),
        axisLabel('x')
      );
    if (slotConfig.y.enabled)
      addPiece(
        relief(
          pattern(buildFullPiece('y'), { length: fullLength('y'), tabEngagement: tabDepth }),
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
    });
    addPiece(relief(longPiece, fullLength(longAxis)), axisLabel(longAxis));

    // Short pieces only exist where there are rows to seat them —
    // groovePositions are also the short direction's wall slot rows.
    if (groovePositions.length > 0) {
      const spans = calculateShortDividerSpans(longPositions, shortSpanDim, thickness);
      const lengths = calculateShortDividerLengths(spans, slotDepth, grooveDepth, clearance);
      if (lengths.interior !== null && lengths.interior > 0) {
        addPiece(
          pattern(buildDividerPiece(lengths.interior, thickness, dividerHeight), {
            length: lengths.interior,
            // Both ends slide into a face receptacle rather than a wall slot.
            // Must be the ENGAGEMENT, not the groove depth — `lengths.interior`
            // is `span + 2 * tabEngagement(grooveDepth, ...)`, so using the raw
            // depth would hold more clear than the tab actually occupies.
            tabEngagement: tabEngagement(grooveDepth, clearance),
          }),
          `${axisLabel(shortAxis)}-compartment`
        );
      }
      if (lengths.edge !== null && lengths.edge > 0) {
        // One end seats in a wall slot (relieve so its throat catches); the
        // piece is symmetric/reversible, so relieving both ends keeps the wall
        // end covered whichever way it goes in.
        addPiece(
          relief(
            pattern(buildDividerPiece(lengths.edge, thickness, dividerHeight), {
              length: lengths.edge,
              // One end seats in a wall slot, the other in a receptacle, and
              // `calculateShortDividerLengths` builds this piece with the SHALLOWER
              // of the two at both ends — so mirror that rather than the deeper one.
              tabEngagement: Math.min(tabDepth, tabEngagement(grooveDepth, clearance)),
            }),
            lengths.edge
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
        slotWidth,
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
        const piece = relief(
          pattern(
            notch(buildDividerPiece(seg.length, thickness, dividerHeight), seg.notchOffsets),
            {
              length: seg.length,
              tabEngagement: tabDepth,
              notches: columns(seg.notchOffsets, slotWidth),
            }
          ),
          seg.length
        );
        const label = seg.labelSuffix ? `${axisLabel(axis)}-${seg.labelSuffix}` : axisLabel(axis);
        addPiece(piece, label);
      }
      continue;
    }

    let piece = notch(buildFullPiece(axis), crossings);
    const snapPositions =
      partialStyle === 'snappable' ? calculateLapSnapPositions(crossings, slotWidth) : [];
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
      notches: columns(crossings, slotWidth),
      grooves: columns(snapPositions, SNAP_SCORE_WIDTH),
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
  hasLip: boolean
): LabeledDividerPiece[] {
  const { slotConfig, dividerPieces } = params;
  const grid = slotConfig.customGrid;
  if (!grid) return [];

  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);
  const { thickness, clearance } = dividerPieces;
  const dividerHeight = calculateDividerPieceHeight(
    dividerPieces,
    wallHeight,
    hasLip,
    dividerSeatZ(params.wallThickness, dividerGrooveDepth(params))
  );
  const notchDepth = dividerHeight / 2 + clearance;

  const segments = deriveWallSegments(grid, innerW, innerD);
  const specs = computeAuthoredDividers(segments, innerW, innerD, thickness, slotDepth, clearance);

  const patternCtx = resolvePiecePatternContext(params, innerW, innerD, dividerHeight, thickness);
  // Authored pieces shorten their length at abutting ends rather than carrying
  // a tab there, so holding the full tab depth at both ends is conservative —
  // a little extra solid margin, never a perforated tab.
  const tabDepth = tabEngagement(slotDepth, clearance);
  const lock = getDividerLockPlan(thickness, clearance);

  const pieces: LabeledDividerPiece[] = [];
  let yOffset = 0;
  for (const spec of specs) {
    let shape = cutCrossLapNotches(
      buildDividerPiece(spec.length, thickness, dividerHeight),
      spec.notchOffsets,
      slotWidth,
      notchDepth,
      dividerHeight,
      thickness,
      spec.fromTop
    );
    if (patternCtx) {
      shape = cutPiecePattern(shape, patternCtx, {
        length: spec.length,
        tabEngagement: tabDepth,
        notches: spec.notchOffsets.map((offset) => ({ offset, width: slotWidth })),
      });
    }
    // Relieve the tab neck so a wall-anchored end's throat catches; inert at
    // abutting/T-junction ends that carry no tab.
    shape = cutDividerNeckRelief(shape, spec.length, dividerHeight, thickness, tabDepth, lock);
    if (yOffset > 0) {
      const translated = translate(shape, [0, yOffset, 0]);
      shape.delete();
      shape = translated;
    }
    pieces.push({ shape, label: spec.label });
    yOffset += dividerHeight + 5;
  }
  return pieces;
}
