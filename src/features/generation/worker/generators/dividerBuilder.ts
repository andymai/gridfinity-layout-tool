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
  calculateLapPartialSegments,
  calculateLapSnapPositions,
  calculateShortDividerLengths,
  calculateShortDividerSpans,
  calculateSlotPositions,
  getReceptacleDepth,
  getSnapScoreDepth,
  resolveCrossDividerMode,
  resolvePartialStyle,
  SNAP_SCORE_WIDTH,
} from '@/shared/utils/slotMath';
import { computeAuthoredDividers } from '@/shared/utils/authoredDividerMath';
import { deriveWallSegments } from '@/shared/utils/compartmentGeometry';
import { getEffectiveSlotDimensions } from './slotBuilder';
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

  const dividerHeight = calculateDividerHeight(dividerPieces, wallHeight, hasLip);

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

  if (!bothAxes) {
    if (slotConfig.x.enabled) addPiece(buildFullPiece('x'), axisLabel('x'));
    if (slotConfig.y.enabled) addPiece(buildFullPiece('y'), axisLabel('y'));
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
    addPiece(longPiece, axisLabel(longAxis));

    // Short pieces only exist where there are rows to seat them —
    // groovePositions are also the short direction's wall slot rows.
    if (groovePositions.length > 0) {
      const spans = calculateShortDividerSpans(longPositions, shortSpanDim, thickness);
      const lengths = calculateShortDividerLengths(spans, slotDepth, grooveDepth, clearance);
      if (lengths.interior !== null && lengths.interior > 0) {
        addPiece(
          buildDividerPiece(lengths.interior, thickness, dividerHeight),
          `${axisLabel(shortAxis)}-compartment`
        );
      }
      if (lengths.edge !== null && lengths.edge > 0) {
        addPiece(
          buildDividerPiece(lengths.edge, thickness, dividerHeight),
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
        const piece = notch(
          buildDividerPiece(seg.length, thickness, dividerHeight),
          seg.notchOffsets
        );
        const label = seg.labelSuffix ? `${axisLabel(axis)}-${seg.labelSuffix}` : axisLabel(axis);
        addPiece(piece, label);
      }
      continue;
    }

    let piece = notch(buildFullPiece(axis), crossings);
    if (partialStyle === 'snappable') {
      piece = cutFaceGrooves(
        piece,
        calculateLapSnapPositions(crossings, slotWidth),
        SNAP_SCORE_WIDTH,
        getSnapScoreDepth(thickness),
        dividerHeight,
        thickness
      );
    }
    addPiece(piece, axisLabel(axis));
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
  const dividerHeight = calculateDividerHeight(dividerPieces, wallHeight, hasLip);
  const notchDepth = dividerHeight / 2 + clearance;

  const segments = deriveWallSegments(grid, innerW, innerD);
  const specs = computeAuthoredDividers(segments, innerW, innerD, thickness, slotDepth, clearance);

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
