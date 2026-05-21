/**
 * Label tab builder for Gridfinity bins.
 *
 * Generates label tabs with shelf plates and gusset/solid support structures
 * at the back edge of each compartment.
 */

import { draw, unwrap, fuseAll, fuse, cut, translate, withScope, clone } from 'brepjs';
import type { Shape3D, ValidSolid, Drawing, DisposalScope } from 'brepjs';
import type { BinParams, TextStyleDefaults, TextStyleOverride } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { buildFilletProfile } from './filletProfile';
import { buildTextSolid } from './textBuilder';
/**
 * Build a right-triangle profile for label tab gusset supports.
 * The triangle has its right angle at (0, height), with the depth leg
 * running horizontally to (-depth, height) and the height leg running
 * vertically down to (0, 0).
 */
function buildGussetProfile(depth: number, height: number): Drawing {
  return draw([0, height]).lineTo([-depth, height]).lineTo([0, 0]).close();
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

  return withScope((scope: DisposalScope): Shape3D | null => {
    const fused = buildLabelTabsInScope(scope, params, innerW, innerD, wallHeight, wallThickness);
    return fused ? unwrap(clone(fused)) : null;
  });
}

function buildLabelTabsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): Shape3D | null {
  const { cols, rows, thickness, cells } = params.compartments;
  const tabDepth = params.label.depth;
  const widthPercent = params.label.width; // 1-100%
  const alignment = params.label.alignment;
  const wt = wallThickness;
  const gt = thickness; // gusset thickness = compartment divider thickness

  // Tab envelope height equals depth (design invariant).
  // Gusset height is tabHeight - wt (shelf occupies the top wt).
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
      const shelf = scope.register(sketch(pen.close(), 'XY', tabHeight - wt).extrude(wt));

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

        const gussetProfile = buildGussetProfile(tabDepth, gussetLeg);

        if (params.label.support === 'solid') {
          // Solid style: single continuous right-triangle prism under the shelf.
          // Depth leg = tabDepth so support reaches the shelf front edge.
          const solidSupport = scope.register(sketch(gussetProfile, 'YZ', 0).extrude(tabWidth));
          tabSolid = scope.register(unwrap(fuse(tabSolid, solidSupport)));
        } else if (params.label.support === 'fillet') {
          // Fillet style: continuous concave prism under the shelf.
          // The fillet profile spans from Z=0 downward, so we translate it up
          // by gussetLeg to align the top edge with the shelf underside.
          const filletR = Math.min(gussetLeg, tabDepth * 0.8);
          const filletProfile = buildFilletProfile(filletR, gussetLeg, tabDepth);
          const filletExtrude = scope.register(sketch(filletProfile, 'YZ', 0).extrude(tabWidth));
          const filletSupport = scope.register(translate(filletExtrude, [0, 0, gussetLeg]));
          tabSolid = scope.register(
            unwrap(fuse(tabSolid as ValidSolid, filletSupport as ValidSolid))
          );
        } else if (gussetPositions.length > 0) {
          // Bracket style: discrete triangular gussets at edges + every <=10mm.
          // Uses same profile with depth = tabDepth so gussets reach the shelf edge.
          const gussetShapes: Shape3D[] = gussetPositions.map((gx) => {
            const gusset = scope.register(sketch(gussetProfile, 'YZ', 0).extrude(gt));
            return scope.register(translate(gusset, [gx, 0, 0]));
          });

          const fusedGussets = scope.register(unwrap(fuseAll(gussetShapes as ValidSolid[])));
          tabSolid = scope.register(unwrap(fuse(tabSolid as ValidSolid, fusedGussets)));
        }
      }

      // Engraved per-compartment text on the shelf top, in local frame so it
      // travels with the tab through the world translation below.
      tabSolid = applyTabText(scope, tabSolid, {
        text: params.compartments.compartmentTexts?.[cellId] ?? '',
        textDefaults: params.textDefaults,
        labelTextStyle: params.label.textStyle,
        tabWidth,
        tabDepth,
        tabHeight,
        shelfThickness: wt,
      });

      // Position: X at alignment offset, Y at compartment back edge, Z at tab base
      tabSolid = scope.register(
        translate(tabSolid, [tabXStart, backEdgeY, wallHeight - tabHeight])
      );

      allTabs.push(tabSolid);

      col = groupEnd;
    }
  }

  if (allTabs.length === 0) return null;
  if (allTabs.length === 1) return allTabs[0]; // already scope-registered
  return scope.register(unwrap(fuseAll(allTabs as ValidSolid[])));
}

/**
 * Apply per-compartment engraved/embossed/through-cut text on the shelf top
 * in the tab's local frame (shelf occupies X:[0,tabWidth], Y:[-tabDepth,0],
 * top face at Z=tabHeight). Through-cut uses the shelf thickness `wt` as
 * the host depth; `allerta-stencil` is auto-substituted (handled inside
 * `buildTextSolid`).
 *
 * Falls back to unchanged geometry when text is empty, the font isn't
 * loaded, the auto-fit can't satisfy `minFontSize`, OR the boolean throws —
 * a single glyph edge case must not tank the whole label-tab build.
 */
function applyTabText(
  scope: DisposalScope,
  tabSolid: Shape3D,
  ctx: {
    text: string;
    textDefaults: TextStyleDefaults;
    labelTextStyle: TextStyleOverride | undefined;
    tabWidth: number;
    tabDepth: number;
    tabHeight: number;
    shelfThickness: number;
  }
): Shape3D {
  const style = { ...ctx.textDefaults, ...ctx.labelTextStyle };
  const result = buildTextSolid(scope, {
    text: ctx.text,
    fontFamily: style.font,
    mode: style.mode,
    availW: ctx.tabWidth,
    availD: ctx.tabDepth,
    centerX: ctx.tabWidth / 2,
    centerY: -ctx.tabDepth / 2,
    topZ: ctx.tabHeight,
    depth: style.depth,
    hostThickness: ctx.shelfThickness,
    margin: style.margin,
    minFontSize: style.minFontSize,
    maxFontSize: style.maxFontSize,
  });
  if (!result) return tabSolid;

  try {
    const op = result.op === 'cut' ? cut : fuse;
    return scope.register(unwrap(op(tabSolid as ValidSolid, result.solid as ValidSolid)));
  } catch {
    return tabSolid;
  }
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const labelTabsFeature: FeatureBuilder = {
  name: 'labelTabs',
  tag: FeatureTag.LABEL_TAB,
  target: 'fuse',
  shouldBuild: (ctx) => !ctx.dimensions.isSlotted,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v2',
        dim.shellKey,
        stableSerialize(params.label),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.interiorHeight),
        quantize(params.wallThickness),
        params.compartments.cols,
        params.compartments.rows,
        params.compartments.cells.join(','),
        // `stableSerialize` (not `.join(sep)`) avoids the collision where
        // e.g. `['ab','c']` and `['a','bc']` produce the same key.
        stableSerialize(params.compartments.compartmentTexts ?? []),
        stableSerialize(params.textDefaults)
      )
    );
  },
  build: (ctx) => {
    const result = buildLabelTabs(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.interiorHeight,
      ctx.params.wallThickness
    );
    return result ? [result] : null;
  },
};
