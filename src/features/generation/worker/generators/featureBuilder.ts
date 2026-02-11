/**
 * Interior feature builders for Gridfinity bins.
 *
 * Generates compartment divider walls, insert cavities, solid-mode cutouts,
 * label tabs with gusset supports, and finger scoop ramps.
 *
 * All features are built at Z=0 (bin floor level) and extend upward to
 * wallHeight. The caller (binGenerator orchestrator) positions them within
 * the assembled bin shell via boolean operations.
 */

import {
  draw,
  drawRoundedRectangle,
  drawRectangle,
  drawCircle,
  drawEllipse,
  unwrap,
  fuseAll,
  translate,
  fuse,
  fillet,
  intersect,
  rotate,
  edgeFinder,
  getBounds,
} from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { sketch } from './generatorTypes';
import {
  resolveScoopRadius,
  computeLipOffset,
  computeInteriorHeight,
} from '@/shared/utils/scoopCalculations';

// ─── Lip Constants (needed for scoop calculations) ───────────────────────────

import { LIP_SMALL_TAPER, LIP_TAPER_WIDTH } from './generatorTypes';

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Build a positioned wall segment solid. */
function buildWallSegment(w: number, d: number, height: number, x: number, y: number): Shape3D {
  const wall = sketch(drawRectangle(w, d), 'XY').extrude(height);
  return translate(wall, [x, y, 0]);
}

/**
 * Find consecutive wall segments along a boundary line.
 * Returns array of [start, end) index pairs where walls are needed.
 */
function findWallSegments(
  count: number,
  needsWall: (i: number) => boolean
): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  let segStart: number | null = null;

  for (let i = 0; i < count; i++) {
    if (needsWall(i)) {
      if (segStart === null) segStart = i;
    } else if (segStart !== null) {
      segments.push([segStart, i]);
      segStart = null;
    }
  }
  if (segStart !== null) {
    segments.push([segStart, count]);
  }
  return segments;
}

// ─── Compartment Walls ───────────────────────────────────────────────────────

/**
 * Build compartment divider walls inside the bin.
 *
 * Uses the compartment grid to derive wall segments: walls appear at
 * boundaries between cells with different compartment IDs. This supports
 * non-uniform compartment layouts (merged cells have no wall between them).
 *
 * Positioned from Z=0 (floor) to Z=wallHeight.
 */
export function buildCompartmentWalls(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D | null {
  const { cols, rows, thickness, cells } = params.compartments;

  // Single compartment = no walls needed
  if (cols <= 1 && rows <= 1) return null;
  if (new Set(cells).size <= 1) return null;

  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Effective free space per cell after accounting for internal divider thickness
  const effectiveCellW = (innerW - (cols - 1) * thickness) / cols;
  const effectiveCellD = (innerD - (rows - 1) * thickness) / rows;

  // Safety net: skip wall generation if cells are too small for viable geometry
  if (effectiveCellW < thickness * 2 || effectiveCellD < thickness * 2) return null;

  const wallSegments: Shape3D[] = [];

  // Vertical walls: between column boundaries
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const xPos = -innerW / 2 + colBoundary * cellW;
    const segments = findWallSegments(rows, (row) => {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];
      return leftId !== rightId;
    });

    for (const [start, end] of segments) {
      const segLength = (end - start) * cellD;
      const yCenter = -innerD / 2 + (start + (end - start) / 2) * cellD;
      wallSegments.push(buildWallSegment(thickness, segLength, wallHeight, xPos, yCenter));
    }
  }

  // Horizontal walls: between row boundaries
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const yPos = -innerD / 2 + rowBoundary * cellD;
    const segments = findWallSegments(cols, (col) => {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];
      return topId !== bottomId;
    });

    for (const [start, end] of segments) {
      const segLength = (end - start) * cellW;
      const xCenter = -innerW / 2 + (start + (end - start) / 2) * cellW;
      wallSegments.push(buildWallSegment(segLength, thickness, wallHeight, xCenter, yPos));
    }
  }

  if (wallSegments.length === 0) return null;
  return unwrap(fuseAll(wallSegments));
}

// ─── Insert Cuts ─────────────────────────────────────────────────────────────

/**
 * Build insert cavity cuts.
 */
export function buildInsertCuts(params: BinParams): Shape3D | null {
  if (params.inserts.length === 0) return null;

  const insertShapes: Shape3D[] = [];

  for (const insert of params.inserts) {
    let solid: Shape3D;

    switch (insert.shape) {
      case 'circle': {
        solid = sketch(drawCircle(insert.width / 2), 'XY').extrude(insert.cutDepth);
        break;
      }
      case 'rounded-rect': {
        const maxR = Math.min(insert.width, insert.depth) / 2 - 0.01;
        solid = sketch(
          drawRoundedRectangle(insert.width, insert.depth, Math.min(insert.cornerRadius, maxR)),
          'XY'
        ).extrude(insert.cutDepth);
        break;
      }
      case 'hexagon': {
        // Approximate hexagon with circle (polygon support TBD)
        solid = sketch(drawCircle(insert.width / 2), 'XY').extrude(insert.cutDepth);
        break;
      }
      case 'slot': {
        solid = sketch(
          drawRoundedRectangle(
            insert.width,
            insert.depth,
            Math.min(insert.width, insert.depth) / 2
          ),
          'XY'
        ).extrude(insert.cutDepth);
        break;
      }
      case 'rectangle':
      default: {
        solid = sketch(drawRectangle(insert.width, insert.depth), 'XY').extrude(insert.cutDepth);
        break;
      }
    }

    insertShapes.push(translate(solid, [insert.x, insert.y, 0]));
  }

  return unwrap(fuseAll(insertShapes));
}

// ─── Cutout Builder (Solid Mode Only) ────────────────────────────────────────

/** Create an extruded + rotated cutout shape centered at origin (no translation). */
function buildCutoutShape(cutout: {
  readonly shape: string;
  readonly width: number;
  readonly depth: number;
  readonly cutDepth: number;
  readonly rotation: number;
  readonly cornerRadius: number;
}): Shape3D {
  let shape: Shape3D;

  switch (cutout.shape) {
    case 'circle': {
      const rx = cutout.width / 2;
      const ry = cutout.depth / 2;
      if (Math.abs(rx - ry) < 0.01) {
        shape = sketch(drawCircle(rx), 'XY').extrude(cutout.cutDepth);
      } else {
        shape = sketch(drawEllipse(rx, ry), 'XY').extrude(cutout.cutDepth);
      }
      break;
    }
    case 'rectangle':
    default: {
      if (cutout.cornerRadius > 0) {
        const maxCR = Math.min(cutout.width, cutout.depth) / 2 - 0.01;
        shape = sketch(
          drawRoundedRectangle(cutout.width, cutout.depth, Math.min(cutout.cornerRadius, maxCR)),
          'XY'
        ).extrude(cutout.cutDepth);
      } else {
        shape = sketch(drawRectangle(cutout.width, cutout.depth), 'XY').extrude(cutout.cutDepth);
      }
      break;
    }
  }

  // Apply rotation around Z axis (at origin, before translation)
  if (cutout.rotation !== 0) {
    shape = rotate(shape, -cutout.rotation, { axis: [0, 0, 1] });
  }

  return shape;
}

/**
 * Build cutout cavity cuts for solid bins.
 * Cutouts cut down from the solid fill surface with configurable depth.
 * All cutout shapes are unioned into a single solid, then boolean-cut from the bin.
 *
 * @param params - Bin configuration (reads cutouts array and cutoutConfig.topOffset)
 * @param innerW - Interior width in mm (outer - 2*wall)
 * @param innerD - Interior depth in mm (outer - 2*wall)
 * @param wallHeight - Wall height in mm (Z extent from floor to wall top)
 */
export function buildCutoutCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D | null {
  if (params.cutouts.length === 0) return null;

  // Cutout x,y are relative to interior bottom-left corner (0,0).
  // The bin body is centered at model origin, so interior left/front is at -innerW/2, -innerD/2.
  const originX = -innerW / 2;
  const originY = -innerD / 2;

  // Global top offset: the solid fill surface is at wallHeight - topOffset
  const topOffset = params.cutoutConfig.topOffset;
  const solidSurfaceZ = wallHeight - topOffset;

  const cutoutShapes: Shape3D[] = [];

  // Partition cutouts by groupId: null -> ungrouped, same groupId -> collected
  const ungrouped: typeof params.cutouts = [];
  const groups = new Map<string, typeof params.cutouts>();
  for (const cutout of params.cutouts) {
    if (cutout.groupId === null) {
      ungrouped.push(cutout);
    } else {
      const list = groups.get(cutout.groupId);
      if (list) {
        list.push(cutout);
      } else {
        groups.set(cutout.groupId, [cutout]);
      }
    }
  }

  // --- Process ungrouped cutouts (individual scoop, same as before) ---
  for (const cutout of ungrouped) {
    let shape = buildCutoutShape(cutout);

    // Apply scoop radius fillet to bottom edges (before translation, at Z ~ 0)
    const maxScoop = Math.min(cutout.cutDepth, Math.min(cutout.width, cutout.depth) / 2) - 0.01;
    const scoopR = Math.min(cutout.scoopRadius ?? 0, Math.max(0, maxScoop));
    if (scoopR > 0) {
      const halfW = cutout.width / 2 + 1;
      const halfD = cutout.depth / 2 + 1;
      // Find edges near the bottom (Z~0) within the cutout bounds
      // Use overlap checks instead of containment for better edge matching
      const scoopEdges = edgeFinder()
        .when((e) => {
          const bounds = getBounds(e);
          const zOverlaps = bounds.zMin <= 0.1 && bounds.zMax >= -0.1;
          const xOverlaps = bounds.xMax >= -halfW && bounds.xMin <= halfW;
          const yOverlaps = bounds.yMax >= -halfD && bounds.yMin <= halfD;
          return zOverlaps && xOverlaps && yOverlaps;
        })
        .findAll(shape);
      if (scoopEdges.length > 0) {
        try {
          shape = unwrap(fillet(shape, scoopEdges, scoopR));
        } catch {
          // Fillet can fail on complex geometries; skip if it does
        }
      }
    }

    cutoutShapes.push(
      translate(shape, [
        originX + cutout.x + cutout.width / 2,
        originY + cutout.y + cutout.depth / 2,
        solidSurfaceZ - cutout.cutDepth,
      ])
    );
  }

  // --- Process grouped cutouts (fuse first, then single scoop fillet) ---
  for (const [, groupMembers] of groups) {
    // Create and translate each member shape (no individual scoop)
    const memberShapes: Shape3D[] = [];
    for (const cutout of groupMembers) {
      const shape = buildCutoutShape(cutout);
      memberShapes.push(
        translate(shape, [
          originX + cutout.x + cutout.width / 2,
          originY + cutout.y + cutout.depth / 2,
          solidSurfaceZ - cutout.cutDepth,
        ])
      );
    }

    let fused = memberShapes.length === 1 ? memberShapes[0] : unwrap(fuseAll(memberShapes));

    // Determine group scoop radius and cut depth
    const groupScoopRadius = Math.max(...groupMembers.map((c) => c.scoopRadius ?? 0));
    const groupCutDepth = Math.min(...groupMembers.map((c) => c.cutDepth));
    const minDim = Math.min(...groupMembers.map((c) => Math.min(c.width, c.depth)));
    const maxScoop = Math.min(groupCutDepth, minDim / 2) - 0.01;
    const scoopR = Math.min(groupScoopRadius, Math.max(0, maxScoop));

    if (scoopR > 0) {
      // Compute XY bounding box of the fused group for edge selection
      const groupBounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };
      for (const cutout of groupMembers) {
        const cx = originX + cutout.x + cutout.width / 2;
        const cy = originY + cutout.y + cutout.depth / 2;
        // Account for rotation: use diagonal as safe half-extent
        const diag = Math.sqrt(cutout.width ** 2 + cutout.depth ** 2) / 2;
        groupBounds.minX = Math.min(groupBounds.minX, cx - diag);
        groupBounds.minY = Math.min(groupBounds.minY, cy - diag);
        groupBounds.maxX = Math.max(groupBounds.maxX, cx + diag);
        groupBounds.maxY = Math.max(groupBounds.maxY, cy + diag);
      }

      const zBottom = solidSurfaceZ - groupCutDepth;
      // Find horizontal edges near the bottom of the cutout group
      // Use relaxed tolerance for Z-height matching since edges may span multiple Z values
      const groupScoopEdges = edgeFinder()
        .when((e) => {
          const bounds = getBounds(e);
          // Check if edge overlaps the target Z region (not strictly contained)
          const zOverlaps = bounds.zMin <= zBottom + 0.1 && bounds.zMax >= zBottom - 0.1;
          // Check if edge is within or near the XY bounds of the group
          const xOverlaps =
            bounds.xMax >= groupBounds.minX - 1 && bounds.xMin <= groupBounds.maxX + 1;
          const yOverlaps =
            bounds.yMax >= groupBounds.minY - 1 && bounds.yMin <= groupBounds.maxY + 1;
          return zOverlaps && xOverlaps && yOverlaps;
        })
        .findAll(fused);
      // Only apply fillet if we found edges (avoid empty edge list error)
      if (groupScoopEdges.length > 0) {
        try {
          fused = unwrap(fillet(fused, groupScoopEdges, scoopR));
        } catch {
          // Fillet can fail on complex geometries; skip if it does
        }
      }
    }

    cutoutShapes.push(fused);
  }

  const fusedResult = unwrap(fuseAll(cutoutShapes));

  // Clip cutout union to bin interior so cutouts extending past walls don't
  // cut through them. The clip boundary covers from floor to the solid surface.
  const clipBoundary = sketch(drawRectangle(innerW, innerD), 'XY', 0).extrude(solidSurfaceZ);
  return unwrap(intersect(fusedResult, clipBoundary));
}

// ─── Label Tab Builder ───────────────────────────────────────────────────────

/**
 * Build label tabs for every compartment.
 *
 * Each tab is a flat shelf with support structure. Bracket style uses thin 45deg
 * triangular gussets (less filament, still strong). Solid style uses a
 * continuous 45deg triangle prism (maximum strength, still FDM-printable).
 *
 * Structure per compartment:
 *   - Flat shelf plate: tabWidth x tabDepth x wallThickness at the top
 *   - N interior gussets: 45deg right-triangle supports, each divider-thickness
 *     wide, placed evenly between the walls that already support the shelf ends.
 *     Gusset count keeps unsupported span <=10mm (conservative FDM bridge limit).
 *
 * Tabs are placed on the back edge of each compartment -- the outer back wall
 * for the rearmost row, or a row divider wall for interior rows. Merged cells
 * get a single tab at the back of the merged group.
 *
 * Tab width is auto-capped to compartment column width when the configured
 * width exceeds available space.
 *
 * @param params - Bin parameters (label config, compartments)
 * @param innerW - Interior width in mm (outer - 2 x wallThickness)
 * @param innerD - Interior depth in mm
 * @param wallHeight - Wall height in mm (Z extent from floor to wall top)
 * @param wallThickness - Bin wall thickness in mm (used for shelf thickness)
 */
export function buildLabelTabs(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): Shape3D | null {
  if (!params.label.enabled) return null;

  const { cols, rows, thickness, cells } = params.compartments;
  const tabDepth = params.label.depth;
  const widthPercent = params.label.width; // 1-100%
  const alignment = params.label.alignment;
  const wt = wallThickness;
  const gt = thickness; // gusset thickness = compartment divider thickness

  // 45deg triangle envelope: height = depth
  const tabHeight = tabDepth;

  // Safety: tab must fit within wall height
  if (tabHeight > wallHeight || tabHeight <= 0) return null;

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const allTabs: Shape3D[] = [];

  // Iterate per-row, grouping consecutive same-compartment columns that share
  // a back edge at this row. This produces one tab spanning merged columns
  // instead of separate per-column tabs with incorrect divider deductions.
  for (let row = 0; row < rows; row++) {
    const isLastRow = row === rows - 1;
    let col = 0;

    while (col < cols) {
      const cellId = cells[row * cols + col];
      const nextRowCellId = isLastRow ? undefined : cells[(row + 1) * cols + col];

      // Check if this cell has a back edge (last row, or different compId behind)
      const hasBackEdge = isLastRow || cellId !== nextRowCellId;
      if (!hasBackEdge) {
        col++;
        continue;
      }

      // Find extent of consecutive same-compId columns with back edges at this row
      let groupEnd = col + 1;
      while (groupEnd < cols) {
        const gCellId = cells[row * cols + groupEnd];
        const gNextRowCellId = isLastRow ? undefined : cells[(row + 1) * cols + groupEnd];
        if (gCellId !== cellId || !(isLastRow || gCellId !== gNextRowCellId)) break;
        groupEnd++;
      }

      const groupCols = groupEnd - col;
      const groupMinCol = col;
      const groupMaxCol = groupEnd - 1;

      // Compute available width for the column group.
      // Deduct thickness only at boundaries with actual divider walls --
      // merged columns share no divider, so no deduction between them.
      const groupLeft = -innerW / 2 + groupMinCol * cellW;
      const groupRight = groupLeft + groupCols * cellW;

      const hasLeftWall = groupMinCol === 0 || cells[row * cols + (groupMinCol - 1)] !== cellId;
      const hasRightWall =
        groupMaxCol === cols - 1 || cells[row * cols + (groupMaxCol + 1)] !== cellId;

      const leftDeduction =
        groupMinCol > 0 && cells[row * cols + (groupMinCol - 1)] !== cellId ? thickness / 2 : 0;
      const rightDeduction =
        groupMaxCol < cols - 1 && cells[row * cols + (groupMaxCol + 1)] !== cellId
          ? thickness / 2
          : 0;

      const availableLeft = groupLeft + leftDeduction;
      const availableRight = groupRight - rightDeduction;
      const availableWidth = availableRight - availableLeft;

      // Compute tab width from percentage of available group width
      const tabWidth = (availableWidth * widthPercent) / 100;
      if (tabWidth <= 0) {
        col = groupEnd;
        continue;
      }

      // Compute X offset based on alignment within the group
      let tabXStart: number;
      if (alignment === 'left') {
        tabXStart = availableLeft;
      } else if (alignment === 'right') {
        tabXStart = availableRight - tabWidth;
      } else {
        const availableCenter = (availableLeft + availableRight) / 2;
        tabXStart = availableCenter - tabWidth / 2;
      }

      // Y position: back edge of this row
      const backEdgeY = -innerD / 2 + (row + 1) * cellD;

      // -- Determine which ends touch a wall --
      const fullWidth = tabWidth >= availableWidth - 0.01;
      const touchesLeft = (fullWidth || alignment === 'left') && hasLeftWall;
      const touchesRight = (fullWidth || alignment === 'right') && hasRightWall;

      // -- Shelf: flat plate with rounded front corners on free ends --
      // XY footprint extruded along Z for wallThickness.
      // Only front corners (away from back wall) are rounded on free ends.
      const cornerR = 1; // mm
      let pen = draw([0, 0]).lineTo([tabWidth, 0]).lineTo([tabWidth, -tabDepth]);
      if (!touchesRight) pen = pen.customCorner(cornerR);
      pen = pen.lineTo([0, -tabDepth]);
      if (!touchesLeft) pen = pen.customCorner(cornerR);
      const shelf = sketch(pen.close(), 'XY', tabHeight - wt).extrude(wt);

      // -- Gussets: 45deg triangular supports under the shelf --
      // Free ends get edge gussets for structural support.
      // Interior gussets keep unsupported span <=10mm (FDM bridge limit).
      const gussetLeg = tabHeight - wt;
      const maxSpan = 10; // mm

      // Collect all gusset X positions (left edge of each gusset)
      const gussetPositions: number[] = [];

      // Edge gussets at free ends
      if (!touchesLeft) gussetPositions.push(0);
      if (!touchesRight) gussetPositions.push(tabWidth - gt);

      // Interior gussets between the outermost supports
      const leftSupport = touchesLeft ? 0 : gt;
      const rightSupport = touchesRight ? tabWidth : tabWidth - gt;
      const interiorSpan = rightSupport - leftSupport;
      const numInterior = Math.max(0, Math.ceil(interiorSpan / maxSpan) - 1);
      for (let g = 0; g < numInterior; g++) {
        const center = leftSupport + (interiorSpan * (g + 1)) / (numInterior + 1);
        gussetPositions.push(center - gt / 2);
      }

      let tabSolid: Shape3D = shelf;

      const labelSupport = params.label.support;

      if (labelSupport === 'solid') {
        // Solid style: single continuous 45deg right-triangle prism under the shelf
        const gussetLegSolid = tabHeight - wt;
        if (gussetLegSolid > 0) {
          const solidProfile = draw([0, gussetLegSolid])
            .lineTo([-gussetLegSolid, gussetLegSolid])
            .lineTo([0, 0])
            .close();
          const solidSupport = sketch(solidProfile, 'YZ', 0).extrude(tabWidth);
          tabSolid = unwrap(fuse(tabSolid, solidSupport));
        }
      } else {
        // Bracket style: discrete triangular gussets at edges + every <=10mm
        if (gussetPositions.length > 0) {
          const gussetProfile = draw([0, gussetLeg])
            .lineTo([-gussetLeg, gussetLeg])
            .lineTo([0, 0])
            .close();

          const gussetShapes: Shape3D[] = [];
          for (const gx of gussetPositions) {
            const gusset = sketch(gussetProfile, 'YZ', 0).extrude(gt);
            gussetShapes.push(translate(gusset, [gx, 0, 0]));
          }

          tabSolid = unwrap(fuse(tabSolid, unwrap(fuseAll(gussetShapes))));
        }
      }

      // Position: X at alignment offset, Y at compartment back edge, Z at tab base
      tabSolid = translate(tabSolid, [tabXStart, backEdgeY, wallHeight - tabHeight]);

      allTabs.push(tabSolid);

      col = groupEnd;
    }
  }

  if (allTabs.length === 0) return null;
  return unwrap(fuseAll(allTabs));
}

// ─── Finger Scoop Builder ────────────────────────────────────────────────────

/**
 * Build finger scoop ramps that curve from the bin floor up to the front wall.
 *
 * Each scoop is a solid ramp with a concave quarter-cylinder inner surface,
 * fused into the bin interior at the front edge of each compartment. The
 * ramp fills the wall-floor junction and the concave curve helps slide
 * items out of the bin.
 *
 * Scoops are placed at the front edge of every compartment row.
 * For merged compartments spanning multiple columns, a single scoop spans
 * the full merged width.
 *
 * When the bin has a stacking lip and the scoop is at the outer front wall
 * (row 0), the scoop is offset inward by the lip overhang so its top edge
 * meets the lip's protruding inner face, providing a smooth exit path.
 *
 * @param params - Bin parameters (scoop config, compartments)
 * @param innerW - Interior width in mm (outer - 2 x wallThickness)
 * @param innerD - Interior depth in mm
 * @param wallHeight - Full wall height in mm (box body Z extent)
 * @param wallThickness - Outer wall thickness in mm
 * @returns Fused ramp shape, or null if no scoops were built
 */
export function buildScoopRamps(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): Shape3D | null {
  if (!params.scoop.enabled) return null;
  if (params.style !== 'standard') return null;

  const hasLip = params.base.stackingLip;
  const interiorHeight = computeInteriorHeight(wallHeight, hasLip, LIP_SMALL_TAPER);

  const { cols, rows, cells } = params.compartments;

  const cellW = innerW / cols;
  const cellD = innerD / rows;

  const processedCompartments = new Set<number>();
  const scoopShapes: Shape3D[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const compId = cells[row * cols + col];
      if (processedCompartments.has(compId)) continue;
      processedCompartments.add(compId);

      // Find compartment bounds
      let minCol = cols;
      let maxCol = -1;
      let minRow = rows;
      let maxRow = -1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cells[r * cols + c] === compId) {
            minCol = Math.min(minCol, c);
            maxCol = Math.max(maxCol, c);
            minRow = Math.min(minRow, r);
            maxRow = Math.max(maxRow, r);
          }
        }
      }
      if (maxCol === -1) continue;
      const compCols = maxCol - minCol + 1;
      const compRows = maxRow - minRow + 1;
      const compW = compCols * cellW;
      const compD = compRows * cellD;

      const isMinRow = minRow === 0;
      const lipOffset = computeLipOffset(hasLip, isMinRow, LIP_TAPER_WIDTH, wallThickness);
      const radius = resolveScoopRadius(
        params.scoop.radius,
        compW,
        compD,
        isMinRow,
        hasLip,
        wallHeight,
        interiorHeight,
        lipOffset
      );
      if (radius === 0) continue;

      // Build scoop ramp solid.
      // Profile in YZ plane: draw([u, v]) where u->Y (depth), v->Z (height).
      //
      // Without lip offset (lipOffset = 0):
      //   (0, 0) -> (0, R) -> arc -> (R, 0) -> close
      //
      // With lip offset (lo), extends to wallHeight so scoop meets lip:
      //   (0, 0) -> (0, wH) -> (lo, wH) -> (lo, R) -> arc -> (lo+R, 0) -> close
      //   Goes up the wall to wallHeight, across to the lip's inner face,
      //   down to arc start at R, then curves to floor. Fills solid.
      const segments = 24;
      const points: [number, number][] = [];
      // Start at wall/floor corner
      points.push([0, 0]);
      if (lipOffset > 0) {
        // Up the wall to wallHeight (lip base), across to lip inner face
        points.push([0, wallHeight]);
        points.push([lipOffset, wallHeight]);
        // Down to arc start (only needed when radius < wallHeight)
        if (radius < wallHeight) {
          points.push([lipOffset, radius]);
        }
      } else {
        // Standard: up the wall to scoop height
        points.push([0, radius]);
      }
      // Concave arc from (lipOffset, radius) to (lipOffset + radius, 0)
      for (let i = 1; i < segments; i++) {
        const angle = (Math.PI / 2) * (i / segments);
        const arcY = lipOffset + radius * (1 - Math.cos(angle));
        const arcZ = radius * (1 - Math.sin(angle));
        points.push([arcY, arcZ]);
      }
      // Floor, lipOffset + radius away from wall
      points.push([lipOffset + radius, 0]);

      // Draw the profile (will be sketched on YZ and extruded along X)
      let pen = draw(points[0]);
      for (let i = 1; i < points.length; i++) {
        pen = pen.lineTo(points[i]);
      }
      const profile = pen.close();

      // Sketch on YZ plane and extrude along X for the compartment width
      let scoopSolid = sketch(profile, 'YZ', -compW / 2).extrude(compW);

      // Fillet the two longitudinal edges where the ramp meets the wall and floor.
      // Before translation, the scoop solid spans X=[-compW/2, +compW/2] with
      // Y=[lipOffset, lipOffset+radius], Z=[0, radius]. The sharp edges are:
      //   - Top-of-ramp: (Y~lipOffset, Z~radius) -- ramp meets wall/lip
      //   - Floor-of-ramp: (Y~lipOffset+radius, Z~0) -- ramp meets bin floor
      const filletR = Math.min(2, radius / 4);
      if (filletR >= 0.5) {
        const smoothEdges = edgeFinder()
          .when((e) => {
            const b = getBounds(e);
            // Edge must run along X (span most of the compartment width)
            if (b.xMax - b.xMin < compW * 0.5) return false;
            // Top-of-ramp edge: Y~lipOffset, Z~radius
            const isTop =
              Math.abs(b.yMin - lipOffset) < 0.5 &&
              Math.abs(b.yMax - lipOffset) < 0.5 &&
              Math.abs(b.zMin - radius) < 0.5 &&
              Math.abs(b.zMax - radius) < 0.5;
            // Floor-of-ramp edge: Y~lipOffset+radius, Z~0
            const floorY = lipOffset + radius;
            const isFloor =
              Math.abs(b.yMin - floorY) < 0.5 &&
              Math.abs(b.yMax - floorY) < 0.5 &&
              Math.abs(b.zMin) < 0.5 &&
              Math.abs(b.zMax) < 0.5;
            return isTop || isFloor;
          })
          .findAll(scoopSolid);
        if (smoothEdges.length > 0) {
          try {
            scoopSolid = unwrap(fillet(scoopSolid, smoothEdges, filletR));
          } catch {
            // Fillet can fail on complex geometries; skip if it does
          }
        }
      }

      // Position: center X at compartment center, Y at front edge of compartment
      const compCenterX = -innerW / 2 + (minCol + compCols / 2) * cellW;
      const frontEdgeY = -innerD / 2 + minRow * cellD;

      scoopShapes.push(translate(scoopSolid, [compCenterX, frontEdgeY, 0]));
    }
  }

  if (scoopShapes.length === 0) return null;
  return scoopShapes.length === 1 ? scoopShapes[0] : unwrap(fuseAll(scoopShapes));
}
