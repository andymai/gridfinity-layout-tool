/**
 * Label tab builder for Gridfinity bins.
 *
 * Generates label tabs with shelf plates and gusset/solid support structures
 * at the back edge of each compartment.
 */

import { labelShelfKeepoutMm } from '@/shared/utils/lidInteriorRelief';
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
import { resolveTextStyle } from '@/shared/types/bin';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_POCKET_DEPTH_MM,
  LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM,
  LABEL_SOCKET_WALL_MM,
  labelLipReservationMm,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';
import { planLabelTabLayout } from '@/shared/utils/labelTabPlan';
import type { TabSlot, PlannedTabRow, TabBuildDimensions } from '@/shared/utils/labelTabPlan';
import { isLabelPlateIconId } from '@/shared/constants/labelPlates';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import { sketch } from './meshUtils';
import { buildFilletProfile } from './filletProfile';
import { buildTextSolid, fitTextSize } from './textBuilder';
import type { LabelTextOverflow } from '../../bridge/types';
export {
  planSpanningDividerClips,
  buildSpanningDividerClipTools,
  spanningDividerClipsKey,
} from './spanningDividerClips';
export type { SpanningDividerClip } from './spanningDividerClips';
import { applySocket } from './labelSocketCutter';
export { cutLabelSocket } from './labelSocketCutter';

/** Tab text fills its shelf band rather than the font's line box. Shared by the
 *  group size pass and the per-tab build — measuring different boxes would
 *  silently stop the uniform cap from applying. */

/**
 * Build a right-triangle profile for label tab gusset supports.
 * The triangle has its right angle at (0, height); the depth leg runs
 * horizontally to (depthSign·depth, height); the height leg runs down
 * to (0, 0).
 *
 * `depthSign = -1` (default) places the depth leg in -X, matching the
 * original back-tab convention. `+1` mirrors the profile into +X for
 * front-anchored label tabs.
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

/**
 * Where one swappable label plate seats, in bin-interior world coordinates.
 *
 * `z` is the plate's BOTTOM face (plates are modelled bottom-on-Z=0), and
 * `slideY` is the direction it withdraws from its socket — the same sign the
 * shelf body protrudes in, since the mouth opens through the compartment-facing
 * edge.
 */
export interface LabelPlateSeat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly slideY: 1 | -1;
  readonly plateWidthU: LabelPlateWidthU;
  readonly text: string;
  readonly icon?: LabelPlateIconId;
  /** What `index` counts — see {@link LabelTextOverflow}. */
  readonly scope: LabelTextOverflow['scope'];
  /** Compartment id, row, or 0 for the bin-spanning fallback, per `scope`. */
  readonly index: number;
}

/**
 * Resolve where every swappable label plate seats, so the preview can render
 * the real parts clicked into their sockets (plates, preview per user
 * request).
 *
 * Planned rather than observed: label tabs are a cached pipeline feature, so a
 * cache hit rebuilds no geometry and there is nothing to watch. This shares
 * `planLabelTabLayout` with the builder, so a seat can only exist where a
 * socket was actually cut.
 *
 * Returns an empty array outside socket mode.
 */
export function planLabelPlateSeats(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): LabelPlateSeat[] {
  if (!params.label.enabled) return [];
  if ((params.label.mode ?? 'text') !== 'socket') return [];

  const layout = planLabelTabLayout(params, innerW, innerD, wallHeight, wallThickness);
  if (!layout) return [];
  const { dims, plannedRows, spanningFallback } = layout;
  const { socket, tabDepth, shelfTopZ } = dims;
  if (!socket) return [];

  // Mirrors the pocket floor in `cutLabelSocket` for each retention profile.
  const pocketDepth =
    socket.style === 'slideChannel'
      ? LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM + LABEL_SOCKET_POCKET_DEPTH_MM
      : LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;

  // The bin-spanning fallback plans against a synthetic 1x1 grid, so its slot
  // `cellId` indexes that grid rather than the real compartments — reading
  // per-compartment metadata by it would engrave compartment 0's caption and
  // icon onto a plate that represents the whole bin.
  const spanning = params.label.span === true;
  const texts = spanningFallback
    ? []
    : spanning
      ? (params.label.rowTexts ?? [])
      : (params.compartments.compartmentTexts ?? []);
  const icons = spanningFallback ? [] : (params.compartments.labelIcons ?? []);
  const alignment = params.label.alignment;
  const wall = LABEL_SOCKET_WALL_MM;

  const seats: LabelPlateSeat[] = [];
  for (const planned of plannedRows) {
    const depthSign: 1 | -1 = planned.anchor === 'back' ? -1 : 1;
    for (const slot of planned.slots) {
      const plateWidthU = socket.plateByCompartment.get(slot.cellId);
      if (plateWidthU === undefined) continue;

      // Same guards `applySocket` applies before cutting: no pocket, no seat.
      const pocketW = labelPlateWidthMm(plateWidthU) + socket.clearanceMm;
      const pocketD = LABEL_PLATE_HEIGHT_MM + socket.clearanceMm;
      if (pocketW + 2 * wall > slot.tabWidth + 0.01) continue;
      if (pocketD + 2 * wall > tabDepth + 0.01) continue;

      const pocketX0 =
        alignment === 'left'
          ? wall
          : alignment === 'right'
            ? slot.tabWidth - wall - pocketW
            : (slot.tabWidth - pocketW) / 2;

      const icon = icons[slot.cellId];
      seats.push({
        // Local pocket centre plus the tab's world translation
        // (`[tabXStart, positionY, shelfTopZ - tabHeight]`).
        x: slot.tabXStart + pocketX0 + pocketW / 2,
        y: slot.positionY + depthSign * (wall + pocketD / 2),
        z: shelfTopZ - pocketDepth,
        slideY: depthSign,
        plateWidthU,
        text: (texts[slot.cellId] ?? '').trim(),
        ...(isLabelPlateIconId(icon) && !spanning ? { icon } : {}),
        scope: spanningFallback ? 'bin' : spanning ? 'row' : 'compartment',
        index: slot.cellId,
      });
    }
  }
  return seats;
}

/**
 * Which captions the build will drop for want of room, without building any
 * geometry.
 *
 * `buildTextSolid` returns null when a run overflows even at `minFontSize`, and
 * `resolveUniformTabTextSize` deliberately excludes that run from the group fit
 * rather than shrinking its neighbours — so the tab prints blank with nothing
 * left in the mesh to observe after the fact. Sharing `planLabelTabLayout` and
 * `fitTextToHost` with the build is what keeps this answer the one the build
 * will actually give.
 *
 * Text mode only: in socket mode the caption is engraved on the plate, whose
 * host is the plate face — see `planPlateTextOverflow`.
 */
export function planTabTextOverflow(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): LabelTextOverflow[] {
  if (!params.label.enabled) return [];
  if ((params.label.mode ?? 'text') === 'socket') return [];

  const layout = planLabelTabLayout(params, innerW, innerD, wallHeight, wallThickness);
  if (!layout) return [];
  const { dims, plannedRows, spanningFallback } = layout;

  const scope: LabelTextOverflow['scope'] = spanningFallback
    ? 'bin'
    : params.label.span === true
      ? 'row'
      : 'compartment';
  const style = { ...params.textDefaults, ...params.label.textStyle };

  // `edges: 'both'` plans the same compartment at two anchors with identical
  // widths, so the second visit would report a duplicate overflow.
  const seen = new Set<number>();
  const overflows: LabelTextOverflow[] = [];
  for (const planned of plannedRows) {
    for (const slot of planned.slots) {
      if (!slot.text.trim()) continue;
      if (seen.has(slot.cellId)) continue;
      seen.add(slot.cellId);
      const fitted = fitTextSize({
        text: slot.text,
        style,
        availW: slot.tabWidth,
        availD: dims.tabDepth,
      });
      if (fitted === null) overflows.push({ scope, index: slot.cellId });
    }
  }
  return overflows;
}

function buildLabelTabsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): Shape3D | null {
  const layout = planLabelTabLayout(params, innerW, innerD, wallHeight, wallThickness);
  if (!layout) return null;
  const { dims, plannedRows } = layout;
  const { socket, tabDepth } = dims;

  // Resolved per row/anchor group, not per bin: those tabs are what a viewer
  // sees side by side, and a bin-wide size would let one narrow compartment
  // somewhere else govern every label on the design.
  const allTabs = plannedRows.flatMap((planned) =>
    buildTabsAtRow(
      scope,
      planned,
      socket ? undefined : resolveUniformTabTextSize(params, planned.slots, tabDepth)
    )
  );

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
 * One text size for a group of tabs: the smallest size that still fits any
 * text-bearing slot in it. Callers pass one row/anchor group at a time.
 *
 * Under `inkBox` the fitted size depends on the string — mostly on advance
 * width, and on ink height for runs that reach below the baseline — so fitting
 * each tab independently renders a row of visibly mismatched labels. Sizing the
 * group to its worst case trades absolute size for a consistent row.
 *
 * Only tabs that actually render text count: a blank slot and a run that
 * overflows even at `minFontSize` both fail the fit, and neither may drag down
 * the tabs that do render. `undefined` when that leaves nothing constraining the
 * size — callers then fall back to per-tab auto-fit.
 */
export function resolveUniformTabTextSize(
  params: BinParams,
  slots: readonly Pick<TabSlot, 'text' | 'tabWidth'>[],
  tabDepth: number
): number | undefined {
  const style = resolveTextStyle(params.textDefaults, params.label.textStyle);

  let smallest = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    const fitted = fitTextSize({
      text: slot.text,
      style,
      availW: slot.tabWidth,
      availD: tabDepth,
    });
    if (fitted !== null) smallest = Math.min(smallest, fitted);
  }

  return Number.isFinite(smallest) ? smallest : undefined;
}

function buildTabsAtRow(
  scope: DisposalScope,
  plan: PlannedTabRow,
  uniformTextSize: number | undefined
): Shape3D[] {
  const { params, anchor, dims, slots } = plan;
  const { thickness } = params.compartments;
  const alignment = params.label.alignment;
  const { tabHeight, tabDepth, shelfTopZ, shelfT, socket } = dims;
  const wt = shelfT;
  const gt = thickness;
  // depthSign tracks which direction the tab body extends from the anchor:
  //   back  → -Y (tab body extends toward the front of the bin)
  //   front → +Y (tab body extends toward the back of the bin)
  // Used to mirror shelf, gusset, fillet, text, and inset geometry.
  const depthSign: 1 | -1 = anchor === 'back' ? -1 : 1;

  const result: Shape3D[] = [];

  for (const slot of slots) {
    const { cellId, tabWidth, tabXStart, positionY, touchesLeft, touchesRight } = slot;

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
    // body color in multi-color mode (GH). The 0.01mm proud lip is below
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

    if (socket) {
      // Swappable-label socket on the shelf top. Compartments whose
      // tab can't host a standard plate keep a plain shelf — the UI surfaces
      // the same condition as a warning so missing sockets aren't a mystery.
      const plateWidthU = socket.plateByCompartment.get(cellId);
      if (plateWidthU !== undefined) {
        tabSolid = applySocket(scope, tabSolid, {
          plateWidthU,
          clearanceMm: socket.clearanceMm,
          style: socket.style,
          tabWidth,
          tabDepth,
          tabHeight,
          alignment,
          depthSign,
        });
      }
    } else {
      // Engraved per-compartment text on the shelf top, in local frame so it
      // travels with the tab through the world translation below. centerY is
      // half-way along the shelf body (depthSign-aware).
      tabSolid = applyTabText(scope, tabSolid, {
        text: slot.text,
        textDefaults: params.textDefaults,
        labelTextStyle: params.label.textStyle,
        tabWidth,
        tabDepth,
        tabHeight,
        shelfThickness: wt,
        centerYSign: depthSign,
        uniformTextSize,
      });
    }

    // -- Lip: raised rim along the free edge to retain loose labels.
    // Text-mode only — labelLipReservationMm returns 0 for socket tabs and when
    // disabled. shelfTopZ was already dropped by this amount, so the rim tops
    // out at the interior ceiling. The rim spans the shelf's full thickness
    // (bonding it to the plate) and rises `lipHeight` above the shelf top,
    // occupying `wt` inward from the free edge (at Y = depthExtent).
    const lipHeight = labelLipReservationMm(params.label);
    if (lipHeight > 0) {
      const yFree = depthExtent;
      const yInner = depthExtent - depthSign * wt;
      const yLo = Math.min(yFree, yInner);
      const yHi = Math.max(yFree, yInner);
      const rimZ0 = tabHeight - wt;
      const rimH = wt + lipHeight;
      let rim: Shape3D = scope.register(
        sketch(
          draw([0, yLo]).lineTo([tabWidth, yLo]).lineTo([tabWidth, yHi]).lineTo([0, yHi]).close(),
          'XY',
          rimZ0
        ).extrude(rimH)
      );
      // Clip to the rounded shelf footprint so the rim follows the free-edge
      // corner rounding rather than poking past it (mirrors the gusset clip).
      if (!touchesLeft || !touchesRight) {
        try {
          const footprint = scope.register(
            sketch(buildOutline(), 'XY', rimZ0 - 0.1).extrude(rimH + 0.2)
          );
          rim = scope.register(unwrap(intersect(rim as ValidSolid, footprint as ValidSolid)));
        } catch {
          // Best-effort cosmetic clip; keep the un-clipped rim rather than fail.
        }
      }
      tabSolid = scope.register(unwrap(fuse(tabSolid as ValidSolid, rim as ValidSolid)));
    }

    // Position: X at alignment offset, Y at anchor wall + inset offset,
    // Z at gusset base (= shelfTopZ - tabHeight).
    tabSolid = scope.register(translate(tabSolid, [tabXStart, positionY, shelfTopZ - tabHeight]));

    result.push(tabSolid);
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
    uniformTextSize: number | undefined;
  }
): Shape3D {
  const style = resolveTextStyle(ctx.textDefaults, ctx.labelTextStyle);
  // The row's shared size is the smallest every tab was shown to hold, so it is
  // an instruction rather than a cap: passing it as the shared size renders the
  // whole row at one size instead of letting a roomy tab drift larger. A user's
  // own `fontSizeOverride` still rides on the style and can only shrink.
  const result = buildTextSolid(scope, {
    text: ctx.text,
    style,
    availW: ctx.tabWidth,
    availD: ctx.tabDepth,
    centerX: ctx.tabWidth / 2,
    centerY: (ctx.centerYSign * ctx.tabDepth) / 2,
    topZ: ctx.tabHeight,
    depth: style.depth,
    hostThickness: ctx.shelfThickness,
    ...(ctx.uniformTextSize !== undefined ? { sharedSizeMm: ctx.uniformTextSize } : {}),
    hostKind: 'plaque',
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
    // Socket mode: geometry additionally depends on the
    // per-compartment width overrides (mode + plateFitOffset already ride in
    // `stableSerialize(params.label)` below) AND the print nozzle (— the
    // pocket clearance scales to it, so two nozzles with identical overrides
    // must not share a cache entry). Keyed only in socket mode so text-mode
    // tabs don't churn when overrides/nozzle linger in the config.
    const socketKeyPart =
      (params.label.mode ?? 'text') === 'socket'
        ? `${stableSerialize(params.compartments.labelPlateWidths ?? [])}|n${quantize(
            params.nozzleSizeMm ?? NOZZLE_BASELINE
          )}`
        : 'text';
    return compactKey(
      buildCacheKey(
        // `v12`: the shelf datum follows the lid — `labelShelfKeepoutMm`
        // sinks it under an interior-relieving or sliding lid — so the key
        // carries that keepout. Without it, toggling the lid served a shelf
        // on the old plane and the relief ring cut through its wall weld.
        // `v11`: tab spans follow `dividerOverrides` instead of the nominal
        // grid line, so any shifted-divider design cuts a different shelf.
        // `v10`: tab text sizes against glyph ink and shares one size per
        // row/anchor group, so the same params now cut larger, uniform glyphs.
        // `v8`: click-in pockets deepened by LABEL_SOCKET_CLICK_POCKET_RELIEF_MM
        // and the stacking relief grew — same params, lower geometry again.
        // `v7`: click-in sockets on lipped bins sink the default shelf by
        // LABEL_SOCKET_STACK_RELIEF_MM — same params now cut lower geometry,
        // so older IndexedDB entries must be invalidated.
        // `v6`: added swappable-label socket mode.
        // `v5`: extrudes the shelf COPLANAR_OVERLAP proud (geometry +
        // face tags changed), so older IndexedDB entries must be invalidated.
        // `v4`: added `edges` + `inset` to LabelTabConfig.
        'v12',
        socketKeyPart,
        dim.shellKey,
        // The one lid-derived number the shelf geometry consumes.
        quantize(labelShelfKeepoutMm(params)),
        stableSerialize(params.label),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.interiorHeight),
        quantize(params.wallThickness),
        // Divider thickness drives gusset width and the per-group divider
        // deductions (and thus the discrete socket plate width). shellKey
        // folds it in only on the compartments-baked-into-shell path, so it
        // must be keyed here explicitly or a thickness-only edit serves a
        // stale tab from the feature cache.
        quantize(params.compartments.thickness),
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
