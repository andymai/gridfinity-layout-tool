/**
 * Label tab builder for Gridfinity bins.
 *
 * Generates label tabs with shelf plates and gusset/solid support structures
 * at the back edge of each compartment.
 */

import {
  draw,
  drawRoundedRectangle,
  unwrap,
  fuseAll,
  fuse,
  cut,
  intersect,
  translate,
  withScope,
  clone,
} from 'brepjs';
import type { Shape3D, ValidSolid, Drawing, DisposalScope } from 'brepjs';
import { BOX_CORNER_RADIUS, COPLANAR_OVERLAP } from './generatorConstants';
import type { BinParams, TextStyleDefaults, TextStyleOverride } from '@/shared/types/bin';
import {
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  getCompartmentBounds,
} from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { buildFilletProfile } from './filletProfile';
import { buildTextSolid } from './textBuilder';

type TabAnchor = 'back' | 'front';

interface TabBuildDimensions {
  readonly innerW: number;
  readonly innerD: number;
  readonly cellW: number;
  readonly cellD: number;
  readonly tabHeight: number;
  readonly tabDepth: number;
  readonly shelfTopZ: number;
  readonly wallThickness: number;
}

/**
 * Build a right-triangle profile for label tab gusset supports.
 * The triangle has its right angle at (0, height); the depth leg runs
 * horizontally to (depthSign·depth, height); the height leg runs down
 * to (0, 0).
 *
 * `depthSign = -1` (default) places the depth leg in -X, matching the
 * original back-tab convention. `+1` mirrors the profile into +X for
 * front-anchored label tabs (#1898).
 */
function buildGussetProfile(depth: number, height: number, depthSign: 1 | -1 = -1): Drawing {
  return draw([0, height])
    .lineTo([depthSign * depth, height])
    .lineTo([0, 0])
    .close();
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
  const { cols, rows } = params.compartments;
  const tabDepth = params.label.depth;

  // Tab envelope height equals depth (design invariant — the gusset is a
  // 45° right triangle, so its vertical leg matches its horizontal leg).
  // Gusset height is tabHeight - wt (shelf occupies the top wt).
  const tabHeight = tabDepth;

  // `shelfTopZ` is the Z of the shelf TOP above the cavity floor (mm).
  // When `params.label.height` is undefined, anchor to the wall top — the
  // original behavior. When explicitly set, place the shelf at that Z so
  // the user can drop it down to leave a tuck-under pocket above (#1898).
  // The geometry is built in a local frame (shelf top at Z=tabHeight) and
  // then translated up by `shelfTopZ - tabHeight`, so the entire
  // shelf+gusset assembly slides down as a unit.
  const shelfTopZ = params.label.height ?? wallHeight;

  // Safety: tab must fit within wall height AND between floor and shelfTopZ.
  // `shelfTopZ - tabHeight` is the Z of the gusset bottom; if it's <= 0 the
  // gusset would clip the floor.
  if (tabHeight > wallHeight || tabHeight <= 0) return null;
  if (shelfTopZ > wallHeight || shelfTopZ - tabHeight <= 0) return null;

  // Defense in depth: the UI clamps depth ≤ innerD-1, but a cloud-share
  // payload could carry a config where the tab body would extend past the
  // opposite wall and fuse into it as a bridge. Silent null-fallback here.
  if (tabDepth >= innerD) return null;

  const dims: TabBuildDimensions = {
    innerW,
    innerD,
    cellW: innerW / cols,
    cellD: innerD / rows,
    tabHeight,
    tabDepth,
    shelfTopZ,
    wallThickness,
  };

  const edges = params.label.edges ?? 'back';
  const includeBack = edges === 'back' || edges === 'both';
  const includeFront = edges === 'front' || edges === 'both';
  const collidingFrontIds =
    edges === 'both' ? findCollidingFrontCompartments(params, dims) : new Set<number>();

  const allTabs: Shape3D[] = [];

  for (let row = 0; row < rows; row++) {
    if (includeBack) {
      allTabs.push(...buildTabsAtRow(scope, params, row, 'back', dims, collidingFrontIds));
    }
    if (includeFront) {
      allTabs.push(...buildTabsAtRow(scope, params, row, 'front', dims, collidingFrontIds));
    }
  }

  if (allTabs.length === 0) return null;
  const assembled =
    allTabs.length === 1
      ? allTabs[0] // already scope-registered
      : scope.register(unwrap(fuseAll(allTabs as ValidSolid[])));

  return clipToOuterFootprint(scope, assembled, dims);
}

/**
 * Clip the assembled tabs to the bin's outer rounded-corner footprint.
 *
 * Tabs are axis-aligned rectangles anchored to the nominal flat inner-wall
 * planes, so a wall-touching corner can poke past the bin's rounded outer
 * corner. This happens when `wt < BOX_CORNER_RADIUS·(1 − 1/√2) ≈ 1.10mm`:
 * the square corner sits outside the rounded wall and juts into open air.
 * It's most visible on small bins, where a full-width tab reaches both
 * corners and the fixed-size poke is a large fraction of the short wall.
 *
 * Intersecting with a prism of the outer footprint trims those slivers flush
 * with the wall. It's a no-op for thicker walls and for interior-divider tabs
 * that never reach the perimeter. Best-effort: keep the un-clipped tabs if the
 * boolean throws (mirrors the per-tab support/text fallbacks above).
 */
function clipToOuterFootprint(
  scope: DisposalScope,
  tabs: Shape3D,
  dims: TabBuildDimensions
): Shape3D {
  const { innerW, innerD, wallThickness, shelfTopZ, tabHeight } = dims;

  // A tab corner can only poke past the rounded outer corner when
  // wt < R·(1 − 1/√2); at or above that the intersect is a guaranteed no-op,
  // so skip the boolean for the common (default 1.2mm) wall.
  if (wallThickness >= BOX_CORNER_RADIUS * (1 - Math.SQRT1_2)) return tabs;

  const outerW = innerW + 2 * wallThickness;
  const outerD = innerD + 2 * wallThickness;
  try {
    const footprint = scope.register(
      sketch(
        drawRoundedRectangle(outerW, outerD, BOX_CORNER_RADIUS),
        'XY',
        shelfTopZ - tabHeight - 0.1
      ).extrude(tabHeight + 0.2)
    );
    return scope.register(unwrap(intersect(tabs as ValidSolid, footprint as ValidSolid)));
  } catch {
    return tabs;
  }
}

/**
 * For `edges='both'`: identify compartment IDs where the back + front tabs
 * would collide (2·depth + 2·inset > compartmentDepth) so we can silently
 * drop the front tab. The UI surfaces the same condition as an inline
 * warning so the user isn't confused by missing geometry (#1898).
 */
function findCollidingFrontCompartments(params: BinParams, dims: TabBuildDimensions): Set<number> {
  const { cols, rows, cells } = params.compartments;
  const tabDepth = params.label.depth;
  const inset = params.label.inset ?? 0;
  const colliding = new Set<number>();
  const visited = new Set<number>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellId = cells[row * cols + col];
      if (visited.has(cellId)) continue;
      visited.add(cellId);

      const bounds = getCompartmentBounds(params.compartments, cellId);
      if (!bounds) continue;

      // Rectangular constraint: any cell at (minRow-1, minCol..maxCol)
      // differing from cellId means the compartment has a front edge there.
      // Same logic, mirrored, for the back edge.
      const hasFrontAnchor =
        bounds.minRow === 0 || cells[(bounds.minRow - 1) * cols + bounds.minCol] !== cellId;
      const hasBackAnchor =
        bounds.maxRow === rows - 1 || cells[(bounds.maxRow + 1) * cols + bounds.minCol] !== cellId;

      if (!hasBackAnchor || !hasFrontAnchor) continue;

      const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * dims.cellD;
      if (2 * tabDepth + 2 * inset > compartmentDepth) {
        colliding.add(cellId);
      }
    }
  }

  return colliding;
}

/**
 * Build all label tabs anchored to one row's edge (back or front).
 *
 * Iterates the row's columns, groups consecutive same-compartment cells that
 * share an edge at this row, and emits one tab per group. This produces a
 * single tab spanning merged columns rather than separate per-column tabs
 * with incorrect divider deductions.
 *
 * The output is a list of scope-registered tab solids (not fused). The caller
 * fuses across rows + anchors.
 */
function buildTabsAtRow(
  scope: DisposalScope,
  params: BinParams,
  row: number,
  anchor: TabAnchor,
  dims: TabBuildDimensions,
  collidingFrontIds: Set<number>
): Shape3D[] {
  const { cols, rows, thickness, cells } = params.compartments;
  const widthPercent = params.label.width;
  const alignment = params.label.alignment;
  const inset = params.label.inset ?? 0;
  const { innerW, innerD, cellW, cellD, tabHeight, tabDepth, shelfTopZ, wallThickness } = dims;
  const wt = wallThickness;
  const gt = thickness;

  // depthSign tracks which direction the tab body extends from the anchor:
  //   back  → -Y (tab body extends toward the front of the bin)
  //   front → +Y (tab body extends toward the back of the bin)
  // Used to mirror shelf, gusset, fillet, text, and inset geometry.
  const depthSign: 1 | -1 = anchor === 'back' ? -1 : 1;

  // Row-edge detection differs by anchor:
  //   back  → has-edge when row is last OR cell behind (+row) differs
  //   front → has-edge when row is first OR cell in front (-row) differs
  const isOuterEdgeRow = anchor === 'back' ? row === rows - 1 : row === 0;
  const neighborRowOffset = anchor === 'back' ? 1 : -1;
  const hasTiltedAnchorWall =
    anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;

  const result: Shape3D[] = [];
  let col = 0;

  while (col < cols) {
    const cellId = cells[row * cols + col];
    const neighborCellId = isOuterEdgeRow
      ? undefined
      : cells[(row + neighborRowOffset) * cols + col];

    const hasEdge = isOuterEdgeRow || cellId !== neighborCellId;
    if (!hasEdge) {
      col++;
      continue;
    }

    // Skip tabs whose anchor wall is a tilted divider — the shelf and gusset
    // geometry assumes an axis-aligned anchor wall. The compartment text
    // input still persists in storage; only the rendering is suppressed.
    if (hasTiltedAnchorWall(params.compartments, cellId)) {
      col++;
      continue;
    }

    // For `edges='both'`, drop the front tab in compartments where the
    // back+front pair would collide (#1898 collision rule). The back tab
    // is unaffected.
    if (anchor === 'front' && collidingFrontIds.has(cellId)) {
      col++;
      continue;
    }

    // Per-compartment depth+inset guard. The tab body uses `tabDepth + inset`
    // mm of compartment depth; if that exceeds the compartment's available
    // depth the body would extend past the opposite wall (and fuse into it).
    // The UI clamps the stepper, but a cloud-share payload can still smuggle
    // in an invalid combo — silently drop to match the existing bridge guard.
    // (Copilot review on #1904.)
    const cellBounds = getCompartmentBounds(params.compartments, cellId);
    if (cellBounds) {
      const compartmentDepth = (cellBounds.maxRow - cellBounds.minRow + 1) * cellD;
      if (tabDepth + inset > compartmentDepth) {
        col++;
        continue;
      }
    }

    // Find extent of consecutive same-compId columns with edges at this row
    let groupEnd = col + 1;
    while (groupEnd < cols) {
      const gCellId = cells[row * cols + groupEnd];
      const gNeighborCellId = isOuterEdgeRow
        ? undefined
        : cells[(row + neighborRowOffset) * cols + groupEnd];
      if (gCellId !== cellId || !(isOuterEdgeRow || gCellId !== gNeighborCellId)) break;
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

    // Y position of the anchor wall (front face of back wall, or back face
    // of front wall — i.e., the interior surface). Inset slides the tab
    // inward along the body direction (depthSign).
    const anchorY = anchor === 'back' ? -innerD / 2 + (row + 1) * cellD : -innerD / 2 + row * cellD;
    const positionY = anchorY + depthSign * inset;

    // -- Determine which ends touch a wall --
    const fullWidth = tabWidth >= availableWidth - 0.01;
    const touchesLeft = (fullWidth || alignment === 'left') && hasLeftWall;
    const touchesRight = (fullWidth || alignment === 'right') && hasRightWall;

    // -- Shelf: flat plate with rounded corners on the body-front end of
    // free sides. The shelf body extends along depthSign (negative Y for
    // back-anchor, positive Y for front-anchor).
    const cornerR = 1; // mm
    const depthExtent = depthSign * tabDepth;
    // Shelf/footprint outline: rounded front corners on free (non-wall) ends.
    // Built fresh each call so it can be sketched independently for the shelf
    // plate and (below) the full-height support clip.
    const buildOutline = (): Drawing => {
      let p = draw([0, 0]).lineTo([tabWidth, 0]).lineTo([tabWidth, depthExtent]);
      if (!touchesRight) p = p.customCorner(cornerR);
      p = p.lineTo([0, depthExtent]);
      if (!touchesLeft) p = p.customCorner(cornerR);
      return p.close();
    };
    // Extrude the shelf COPLANAR_OVERLAP proud of its nominal top. When
    // `shelfTopZ === wallHeight` (the default) the shelf top would otherwise be
    // coplanar with the bin wall top; OCCT's fuse merges coplanar faces into one
    // and the merged face loses the LABEL_TAB origin, so the shelf rendered in
    // body color in multi-color mode (GH #1654). The 0.01mm proud lip is below
    // slicer resolution but keeps the shelf-top face distinct so its tag survives.
    const shelf = scope.register(
      sketch(buildOutline(), 'XY', tabHeight - wt).extrude(wt + COPLANAR_OVERLAP)
    );

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

      const gussetProfile = buildGussetProfile(tabDepth, gussetLeg, depthSign);

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
        const filletProfile = buildFilletProfile(filletR, gussetLeg, tabDepth, depthSign);
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

      // The shelf plate rounds its free-end front corners, but the support
      // (solid prism / fillet / edge gussets) runs to the full square corner —
      // poking "points" past the rounded shelf on partial-width and centered
      // tabs. Clip the support to the shelf footprint (full tab height) so it
      // can never exceed the plate outline. Only free ends are rounded, so
      // skip the boolean when both ends sit flush against a wall.
      if (!touchesLeft || !touchesRight) {
        try {
          const footprint = scope.register(
            sketch(buildOutline(), 'XY', -0.1).extrude(tabHeight + 0.2)
          );
          tabSolid = scope.register(
            unwrap(intersect(tabSolid as ValidSolid, footprint as ValidSolid))
          );
        } catch {
          // Best-effort cosmetic clip (mirrors the text-boolean fallback
          // below): keep the un-clipped support rather than fail the tab build.
        }
      }
    }

    // Engraved per-compartment text on the shelf top, in local frame so it
    // travels with the tab through the world translation below. centerY is
    // half-way along the shelf body (depthSign-aware).
    tabSolid = applyTabText(scope, tabSolid, {
      text: params.compartments.compartmentTexts?.[cellId] ?? '',
      textDefaults: params.textDefaults,
      labelTextStyle: params.label.textStyle,
      tabWidth,
      tabDepth,
      tabHeight,
      shelfThickness: wt,
      centerYSign: depthSign,
    });

    // Position: X at alignment offset, Y at anchor wall + inset offset,
    // Z at gusset base (= shelfTopZ - tabHeight).
    tabSolid = scope.register(translate(tabSolid, [tabXStart, positionY, shelfTopZ - tabHeight]));

    result.push(tabSolid);

    col = groupEnd;
  }

  return result;
}

/**
 * Apply per-compartment engraved/embossed/through-cut text on the shelf top.
 * The shelf occupies X:[0,tabWidth] and Y:[centerYSign·tabDepth, 0] (back
 * anchor sweeps to -Y, front anchor to +Y). Through-cut uses the shelf
 * thickness `wt` as the host depth; `allerta-stencil` is auto-substituted
 * (handled inside `buildTextSolid`).
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
    centerYSign: 1 | -1;
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
    centerY: (ctx.centerYSign * ctx.tabDepth) / 2,
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
        // `v5`: #1654 extrudes the shelf COPLANAR_OVERLAP proud (geometry +
        // face tags changed), so older IndexedDB entries must be invalidated.
        // `v4`: #1898 added `edges` + `inset` to LabelTabConfig.
        'v5',
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
        stableSerialize(params.compartments.dividerOverrides ?? []),
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
