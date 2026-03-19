/**
 * Label tab builder for Gridfinity bins.
 *
 * Generates label tabs with shelf plates and gusset/solid support structures
 * at the back edge of each compartment.
 */

import { draw, unwrap, fuseAll, fuse, translate } from 'brepjs';
import type { Shape3D, Drawing } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './compartmentBuilder';
/**
 * Build a 45deg right-triangle profile for label tab gusset supports.
 * The triangle has its right angle at the origin, with legs extending
 * to (0, leg) and (-leg, leg).
 */
function buildGussetProfile(leg: number): Drawing {
  return draw([0, leg]).lineTo([-leg, leg]).lineTo([0, 0]).close();
}
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

      let tabSolid: Shape3D = shelf;

      // Guard: if gussetLeg <= 0 (tabHeight <= wallThickness), there's no room
      // for support structure. Skip gusset/solid generation to avoid degenerate geometry.
      if (gussetLeg > 0) {
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

        const gussetProfile = buildGussetProfile(gussetLeg);

        if (params.label.support === 'solid') {
          // Solid style: single continuous 45deg right-triangle prism under the shelf
          const solidSupport = sketch(gussetProfile, 'YZ', 0).extrude(tabWidth);
          tabSolid = unwrap(fuse(tabSolid, solidSupport));
        } else if (gussetPositions.length > 0) {
          // Bracket style: discrete triangular gussets at edges + every <=10mm
          const gussetShapes: Shape3D[] = gussetPositions.map((gx) => {
            const gusset = sketch(gussetProfile, 'YZ', 0).extrude(gt);
            return translate(gusset, [gx, 0, 0]);
          });

          tabSolid = unwrap(fuse(tabSolid, unwrap(fuseAll(gussetShapes))));
        }
      }

      // Position: X at alignment offset, Y at compartment back edge, Z at tab base
      tabSolid = translate(tabSolid, [tabXStart, backEdgeY, wallHeight - tabHeight]);

      allTabs.push(tabSolid);

      col = groupEnd;
    }
  }

  return fuseAllOrNull(allTabs);
}
