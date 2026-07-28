/**
 * Label tab builder for Gridfinity bins.
 *
 * Generates label tabs with shelf plates and gusset/solid support structures
 * at the back edge of each compartment.
 */

import {
  box,
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
import { BOX_CORNER_RADIUS, COPLANAR_MARGIN, COPLANAR_OVERLAP } from './generatorConstants';
import type {
  BinParams,
  LabelTabAlignment,
  LabelTabFit,
  TextStyleDefaults,
  TextStyleOverride,
} from '@/shared/types/bin';
import {
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  compartmentTabEligible,
  rowHasFullWidthWall,
  spanRegionDepth,
} from '@/shared/types/bin';
import {
  LABEL_PLATE_CORNER_RADIUS_MM,
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_DETENT_DEPTH_MM,
  LABEL_SOCKET_DETENT_HEIGHT_MM,
  LABEL_SOCKET_LIP_OVERHANG_MM,
  LABEL_SOCKET_LIP_THICKNESS_MM,
  LABEL_SOCKET_POCKET_DEPTH_MM,
  LABEL_SOCKET_RIB_HEIGHT_MM,
  LABEL_SOCKET_RIB_PROTRUSION_MM,
  LABEL_SOCKET_RIB_START_MM,
  LABEL_SOCKET_SHELF_THICKNESS_MM,
  LABEL_SOCKET_SLIDE_SHELF_THICKNESS_MM,
  LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM,
  LABEL_SOCKET_WALL_MM,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
  resolveLabelShelfTopMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU, LabelSocketStyle } from '@/shared/constants/labelPlates';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';
import { planLabelSockets } from '@/shared/utils/labelSocketPlan';
import { isLabelPlateIconId } from '@/shared/constants/labelPlates';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import { sketch } from './meshUtils';
import { buildFilletProfile } from './filletProfile';
import { buildTextSolid, fitTextToHost } from './textBuilder';
import type { VerticalFit } from './textBuilder';

/** Tab text fills its shelf band rather than the font's line box. Shared by the
 *  group size pass and the per-tab build — measuring different boxes would
 *  silently stop the uniform cap from applying. */
const TAB_TEXT_VERTICAL_FIT: VerticalFit = 'inkBox';

type TabAnchor = 'back' | 'front';

/** Socket-mode build inputs resolved once per bin from the shared plan. */
interface SocketBuildInfo {
  /** Effective TOTAL pocket clearance (spec + user fit offset). */
  readonly clearanceMm: number;
  /** Plate width per compartment ID; absent = that tab gets a plain shelf. */
  readonly plateByCompartment: ReadonlyMap<number, LabelPlateWidthU>;
  /** Pocket profile: click-in ribs (default) or slide-in channel. */
  readonly style: LabelSocketStyle;
}

interface TabBuildDimensions {
  readonly innerW: number;
  readonly innerD: number;
  readonly cellW: number;
  readonly cellD: number;
  readonly tabHeight: number;
  readonly tabDepth: number;
  readonly shelfTopZ: number;
  readonly wallThickness: number;
  /**
   * Shelf plate thickness: `wallThickness` in text mode; thickened to host
   * the pocket + solid floor in socket mode.
   */
  readonly shelfT: number;
  /** Non-null in swappable-label socket mode (#2666). */
  readonly socket: SocketBuildInfo | null;
}

/**
 * One tab's placement, with no geometry built yet — which is what lets the
 * group's text fit see every tab's real `tabWidth`.
 *
 * `text` is resolved here rather than at build time so it always comes from the
 * same compartment set the slot was planned against: the bin-spanning fallback
 * plans against a synthetic 1x1 grid whose `cellId` does not index the real
 * `compartmentTexts`.
 */
interface TabSlot {
  readonly cellId: number;
  readonly text: string;
  readonly tabWidth: number;
  readonly tabXStart: number;
  readonly positionY: number;
  readonly touchesLeft: boolean;
  readonly touchesRight: boolean;
}

/** One row/anchor's planned slots plus the inputs its geometry needs. */
interface PlannedTabRow {
  readonly params: BinParams;
  readonly anchor: TabAnchor;
  readonly dims: TabBuildDimensions;
  readonly slots: readonly TabSlot[];
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

/**
 * A footprint a wall-to-wall shelf passes over, in the bin-interior frame.
 * `zMin` is the shelf underside: divider material from there up is what the
 * shelf would otherwise collide with.
 */
export interface SpanningDividerClip {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin: number;
}

/**
 * Where a full-width shelf crosses the column dividers (#2897).
 *
 * `planSpanningTabAtRow` already assumes those dividers "pass beneath" the
 * span — but nothing ever shortened them, so they ran to the interior ceiling
 * and stood proud of any shelf sunk below it (a click-in socket's stacking
 * relief, or an explicit `label.height`), splitting the one continuous label
 * surface the feature exists to provide.
 *
 * Derived from the same layout plan the shelves themselves are built from, so
 * the clip and the shelf cannot drift apart. Both spanning shapes qualify: the
 * `label.span` feature and the socket plan's bin-spanning fallback.
 */
export function planSpanningDividerClips(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): SpanningDividerClip[] {
  if (!params.label.enabled) return [];
  const layout = planLabelTabLayout(params, innerW, innerD, wallHeight, wallThickness);
  if (!layout) return [];
  // Per-compartment tabs are bounded by the dividers rather than crossing
  // them, so there is nothing to clip.
  if (!layout.spanningFallback && params.label.span !== true) return [];

  const { dims } = layout;
  const zMin = dims.shelfTopZ - dims.shelfT;
  const clips: SpanningDividerClip[] = [];
  for (const row of layout.plannedRows) {
    const depthSign = row.anchor === 'back' ? -1 : 1;
    for (const slot of row.slots) {
      const yEnd = slot.positionY + depthSign * dims.tabDepth;
      clips.push({
        xMin: slot.tabXStart,
        xMax: slot.tabXStart + slot.tabWidth,
        yMin: Math.min(slot.positionY, yEnd),
        yMax: Math.max(slot.positionY, yEnd),
        zMin,
      });
    }
  }
  return clips;
}

/**
 * Cut tools for a clip set, each running from the shelf underside to `topZ`.
 *
 * `topZ` must clear whatever the caller is cutting (the interior ceiling, or a
 * collared rim) — the box only has to swallow the divider top, and overshooting
 * upward hits empty space.
 */
export function buildSpanningDividerClipTools(
  clips: readonly SpanningDividerClip[],
  topZ: number,
  offsetX = 0,
  offsetY = 0
): Shape3D[] {
  const tools: Shape3D[] = [];
  for (const c of clips) {
    const height = topZ - c.zMin;
    if (height <= 0) continue;
    const w = c.xMax - c.xMin;
    const d = c.yMax - c.yMin;
    if (w <= 0 || d <= 0) continue;
    tools.push(
      box(w, d, height, {
        at: [(c.xMin + c.xMax) / 2 + offsetX, (c.yMin + c.yMax) / 2 + offsetY, c.zMin + height / 2],
      })
    );
  }
  return tools;
}

/** Cache-key segment for a clip set. Empty string when nothing is clipped. */
export function spanningDividerClipsKey(clips: readonly SpanningDividerClip[]): string {
  if (clips.length === 0) return '';
  return clips
    .map((c) => [c.xMin, c.xMax, c.yMin, c.yMax, c.zMin].map((n) => n.toFixed(3)).join(','))
    .join(';');
}

/** Everything the tab build needs, resolved without touching BREP. */
interface TabLayout {
  readonly dims: TabBuildDimensions;
  readonly plannedRows: readonly PlannedTabRow[];
  /**
   * True when the socket plan degraded to one bin-spanning tab, which is
   * planned against a SYNTHETIC 1x1 grid. Slot `cellId`s then index that
   * grid, not the real compartments — see the note on {@link TabSlot}.
   */
  readonly spanningFallback: boolean;
}

/**
 * Resolve tab dimensions and slot placement.
 *
 * Pure, and separate from the build because label tabs are a CACHED pipeline
 * feature: on a cache hit no geometry is rebuilt, so anything that needs to
 * know where the tabs ended up (the label-plate preview seats) has to be able
 * to ask independently rather than observe the build.
 */
function planLabelTabLayout(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): TabLayout | null {
  const { cols, rows } = params.compartments;
  const tabDepth = params.label.depth;

  // Tab envelope height equals depth (design invariant — the gusset is a
  // 45° right triangle, so its vertical leg matches its horizontal leg).
  // Gusset height is tabHeight - wt (shelf occupies the top wt).
  const tabHeight = tabDepth;

  // `shelfTopZ` is the Z of the shelf TOP above the cavity floor (mm).
  // When `params.label.height` is undefined, anchor to the interior ceiling
  // (`wallHeight` here is the pipeline's interiorHeight) — sunk by the
  // stacking relief for click-in sockets on lipped bins, so a seated plate
  // (plus emboss/print proudness) can't lift a stacked bin's foot. When
  // explicitly set, place the shelf at that Z so the user can drop it down
  // to leave a tuck-under pocket above (#1898).
  // The geometry is built in a local frame (shelf top at Z=tabHeight) and
  // then translated up by `shelfTopZ - tabHeight`, so the entire
  // shelf+gusset assembly slides down as a unit.
  const shelfTopZ = resolveLabelShelfTopMm(wallHeight, params.base.stackingLip, params.label);

  // Safety: tab must fit within wall height AND between floor and shelfTopZ.
  // `shelfTopZ - tabHeight` is the Z of the gusset bottom; if it's <= 0 the
  // gusset would clip the floor.
  if (tabHeight > wallHeight || tabHeight <= 0) return null;
  if (shelfTopZ > wallHeight || shelfTopZ - tabHeight <= 0) return null;

  // Defense in depth: the UI clamps depth ≤ innerD-1, but a cloud-share
  // payload could carry a config where the tab body would extend past the
  // opposite wall and fuse into it as a bridge. Silent null-fallback here.
  if (tabDepth >= innerD) return null;

  // Swappable-label socket mode (#2666): resolve which standard plate each
  // compartment's tab hosts from the shared plan (same math the UI uses for
  // warnings/pickers). When no compartment fits, the plan degrades to one
  // socket on a single bin-spanning tab at the outer wall(s).
  const mode = params.label.mode ?? 'text';
  let socket: SocketBuildInfo | null = null;
  let spanningWidthU: LabelPlateWidthU | null = null;
  if (mode === 'socket') {
    // `nozzleSizeMm` is merged onto these params transiently at each generation
    // boundary (`withSocketNozzle`) from the live print setting — it is never
    // persisted into the synced design. Undefined here = the 0.4mm baseline
    // (geometry unchanged). The user's `plateFitOffset` still stacks on top for
    // per-printer calibration beyond the nozzle scaling.
    const clearanceMm = effectiveLabelSocketClearance(
      params.nozzleSizeMm,
      params.label.plateFitOffset
    );
    const plan = planLabelSockets(params.compartments, innerW, clearanceMm);
    spanningWidthU = plan.spanningWidthU;
    const plateByCompartment = new Map<number, LabelPlateWidthU>();
    if (spanningWidthU !== null) {
      plateByCompartment.set(0, spanningWidthU);
    } else if (params.label.span === true) {
      // Spanning slots are keyed by row and all share the bin-wide pocket, so
      // the per-compartment plan doesn't apply — reuse the full-width plate.
      const widthU =
        planLabelSockets(
          { cols: 1, rows: 1, thickness: params.compartments.thickness, cells: [0] },
          innerW,
          clearanceMm
        ).compartments[0]?.plateWidthU ?? null;
      if (widthU !== null) {
        for (let row = 0; row < params.compartments.rows; row++) {
          plateByCompartment.set(row, widthU);
        }
      }
    } else {
      for (const p of plan.compartments) {
        if (p.plateWidthU !== null) plateByCompartment.set(p.compartmentId, p.plateWidthU);
      }
    }
    socket = { clearanceMm, plateByCompartment, style: params.label.socketStyle ?? 'clickIn' };
  }
  const shelfT = socket
    ? Math.max(
        wallThickness,
        socket.style === 'slideChannel'
          ? LABEL_SOCKET_SLIDE_SHELF_THICKNESS_MM
          : LABEL_SOCKET_SHELF_THICKNESS_MM
      )
    : wallThickness;
  if (shelfT >= tabHeight) return null;

  const dims: TabBuildDimensions = {
    innerW,
    innerD,
    cellW: innerW / cols,
    cellD: innerD / rows,
    tabHeight,
    tabDepth,
    shelfTopZ,
    wallThickness,
    shelfT,
    socket,
  };

  const edges = params.label.edges ?? 'back';
  const anchors: TabAnchor[] = [];
  if (edges === 'back' || edges === 'both') anchors.push('back');
  if (edges === 'front' || edges === 'both') anchors.push('front');

  // Bin-spanning fallback: model the whole interior as one synthetic 1×1
  // compartment and reuse the regular tab assembly. The spanning tab anchors to
  // the outer wall(s) only — interior divider rows can't host it — and spans
  // wall to wall (compartment 0 covers every column).
  const isSpanning = spanningWidthU !== null;
  const rowParams: BinParams = isSpanning
    ? {
        ...params,
        compartments: { cols: 1, rows: 1, thickness: params.compartments.thickness, cells: [0] },
      }
    : params;
  const rowDims: TabBuildDimensions = isSpanning ? { ...dims, cellW: innerW, cellD: innerD } : dims;
  const rowCount = isSpanning ? 1 : rows;

  // Full-width mode (#2897) plans one shelf per row against the real config —
  // never the socket fallback's synthetic grid, whose missing divider overrides
  // would defeat the tilt guard. The two are mutually exclusive: a bin-spanning
  // socket fallback is already one full-width tab.
  const spanMode = params.label.span === true && !isSpanning;

  const plannedRows: PlannedTabRow[] = [];
  for (let row = 0; row < rowCount; row++) {
    for (const anchor of anchors) {
      plannedRows.push({
        params: rowParams,
        anchor,
        dims: rowDims,
        slots: spanMode
          ? planSpanningTabAtRow(params, row, anchor, dims)
          : planTabsAtRow(rowParams, row, anchor, rowDims, edges === 'both'),
      });
    }
  }

  return { dims, plannedRows, spanningFallback: isSpanning };
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
}

/**
 * Resolve where every swappable label plate seats, so the preview can render
 * the real parts clicked into their sockets (#2666 plates, preview per user
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
      });
    }
  }
  return seats;
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
 * Resolve which compartments host a tab anchored to one row's edge (back or
 * front) and where each one sits. Pure — no geometry, no scope — so the whole
 * bin's tabs can be planned before any are built (see
 * `resolveUniformTabTextSize`).
 *
 * Groups consecutive same-compartment cells that share an edge at this row and
 * emits one slot per group, so merged columns get a single spanning tab rather
 * than per-column tabs with incorrect divider deductions.
 */
function planTabsAtRow(
  params: BinParams,
  row: number,
  anchor: TabAnchor,
  dims: TabBuildDimensions,
  bothEdges: boolean
): TabSlot[] {
  const { cols, rows, thickness, cells } = params.compartments;
  const widthPercent = params.label.width;
  const alignment = params.label.alignment;
  const inset = params.label.inset ?? 0;
  const { innerW, innerD, cellW, cellD, tabDepth, socket } = dims;

  const depthSign: 1 | -1 = anchor === 'back' ? -1 : 1;

  // Row-edge detection differs by anchor:
  //   back  → has-edge when row is last OR cell behind (+row) differs
  //   front → has-edge when row is first OR cell in front (-row) differs
  const isOuterEdgeRow = anchor === 'back' ? row === rows - 1 : row === 0;
  const neighborRowOffset = anchor === 'back' ? 1 : -1;
  const fit: LabelTabFit = { tabDepth, inset, cellD, bothEdges };

  const slots: TabSlot[] = [];
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

    // Tilted anchor wall, a body deeper than the compartment, or a front tab
    // colliding with its back partner under `edges='both'` — the shared
    // predicate answers all three, and the plate planner and ghost overlay
    // gate on the same one so none of the three can drift (#2910). Compartment
    // text still persists in storage; only the geometry is suppressed.
    if (!compartmentTabEligible(params.compartments, cellId, anchor, fit)) {
      col++;
      continue;
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

    // Y position of the anchor wall (front face of back wall, or back face
    // of front wall — i.e., the interior surface). Inset slides the tab
    // inward along the body direction (depthSign).
    const anchorY = anchor === 'back' ? -innerD / 2 + (row + 1) * cellD : -innerD / 2 + row * cellD;

    const slot = fitTabInSpan({
      cellId,
      text: params.compartments.compartmentTexts?.[cellId] ?? '',
      availableLeft,
      availableRight,
      hasLeftWall,
      hasRightWall,
      positionY: anchorY + depthSign * inset,
      widthPercent,
      alignment,
      socket: socket !== null,
    });
    if (slot) slots.push(slot);
    col = groupEnd;
  }

  return slots;
}

/**
 * Plan the single full-width tab at one row's anchor wall (#2897).
 *
 * Deliberately runs against the REAL compartment config rather than a synthetic
 * one-column grid: the tilt and depth guards below read `dividerOverrides` and
 * real bounds, and would silently pass on a fabricated config.
 */
function planSpanningTabAtRow(
  params: BinParams,
  row: number,
  anchor: TabAnchor,
  dims: TabBuildDimensions
): TabSlot[] {
  const { cols, cells } = params.compartments;
  const { innerW, innerD, cellD, tabDepth } = dims;
  const inset = params.label.inset ?? 0;

  if (!rowHasFullWidthWall(params.compartments, row, anchor)) return [];

  // A tilted divider anywhere along this boundary breaks the axis-aligned
  // anchor-wall assumption the shelf and gusset geometry depends on.
  const hasTilt = anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;
  for (let col = 0; col < cols; col++) {
    if (hasTilt(params.compartments, cells[row * cols + col])) return [];
  }

  // The body would otherwise punch through the wall bounding the far side.
  if (tabDepth + inset > spanRegionDepth(params.compartments, row, anchor, cellD)) return [];

  const depthSign = anchor === 'back' ? -1 : 1;
  const anchorY = anchor === 'back' ? -innerD / 2 + (row + 1) * cellD : -innerD / 2 + row * cellD;

  // Spanning tabs run outer wall to outer wall. Column dividers pass beneath
  // rather than bounding the span, so they take no thickness deduction.
  const slot = fitTabInSpan({
    cellId: row,
    text: params.label.rowTexts?.[row] ?? '',
    availableLeft: -innerW / 2,
    availableRight: innerW / 2,
    hasLeftWall: true,
    hasRightWall: true,
    positionY: anchorY + depthSign * inset,
    widthPercent: params.label.width,
    alignment: params.label.alignment,
    socket: dims.socket !== null,
  });
  return slot ? [slot] : [];
}

/**
 * Resolve a tab's width and X placement inside an available span.
 *
 * Shared by the per-compartment planner and the full-width spanning planner so
 * the two can never drift on width percentage, socket override, alignment or
 * wall-contact rules. Returns null when the span leaves no room for a tab.
 */
function fitTabInSpan(args: {
  readonly cellId: number;
  readonly text: string;
  readonly availableLeft: number;
  readonly availableRight: number;
  readonly hasLeftWall: boolean;
  readonly hasRightWall: boolean;
  readonly positionY: number;
  readonly widthPercent: number;
  readonly alignment: LabelTabAlignment;
  readonly socket: boolean;
}): TabSlot | null {
  const { availableLeft, availableRight, alignment, socket } = args;
  const availableWidth = availableRight - availableLeft;

  // Socket mode ignores the width percentage and always spans the full
  // available width — the pocket needs the room, and `alignment` instead
  // positions the socket within the tab.
  const tabWidth = socket ? availableWidth : (availableWidth * args.widthPercent) / 100;
  if (tabWidth <= 0) return null;

  let tabXStart: number;
  if (socket || alignment === 'left') {
    tabXStart = availableLeft;
  } else if (alignment === 'right') {
    tabXStart = availableRight - tabWidth;
  } else {
    tabXStart = (availableLeft + availableRight) / 2 - tabWidth / 2;
  }

  const fullWidth = tabWidth >= availableWidth - 0.01;
  return {
    cellId: args.cellId,
    text: args.text,
    tabWidth,
    tabXStart,
    positionY: args.positionY,
    touchesLeft: (fullWidth || alignment === 'left') && args.hasLeftWall,
    touchesRight: (fullWidth || alignment === 'right') && args.hasRightWall,
  };
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
  const style = { ...params.textDefaults, ...params.label.textStyle };

  let smallest = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    const fit = fitTextToHost({
      text: slot.text,
      fontFamily: style.font,
      mode: style.mode,
      availW: slot.tabWidth,
      availD: tabDepth,
      margin: style.margin,
      minFontSize: style.minFontSize,
      maxFontSize: style.maxFontSize,
      verticalFit: TAB_TEXT_VERTICAL_FIT,
    });
    if (fit.fits) smallest = Math.min(smallest, fit.fontSize);
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

    if (socket) {
      // Swappable-label socket on the shelf top (#2666). Compartments whose
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

    // Position: X at alignment offset, Y at anchor wall + inset offset,
    // Z at gusset base (= shelfTopZ - tabHeight).
    tabSolid = scope.register(translate(tabSolid, [tabXStart, positionY, shelfTopZ - tabHeight]));

    result.push(tabSolid);
  }

  return result;
}

/**
 * Cut a swappable-label socket into the shelf top and fuse the retention
 * ribs (#2666). Local tab frame: shelf spans X:[0,tabWidth],
 * Y:[depthSign·tabDepth, 0] with the shelf top at Z=tabHeight.
 *
 * Pocket = plate footprint + total clearance, one pocket-wall margin in
 * from the anchor wall, placed along X by `alignment`. Ribs sit on the two
 * long (X-parallel) pocket walls: 0.2mm proud, 0.4mm tall, starting 0.2mm
 * above the pocket floor — the band the plate's perimeter latch clicks
 * behind.
 *
 * Best-effort like `applyTabText`: geometry that doesn't fit or a boolean
 * that throws leaves the plain shelf rather than tanking the tab build.
 */
function applySocket(
  scope: DisposalScope,
  tabSolid: Shape3D,
  ctx: {
    plateWidthU: LabelPlateWidthU;
    clearanceMm: number;
    style: LabelSocketStyle;
    tabWidth: number;
    tabDepth: number;
    tabHeight: number;
    alignment: 'left' | 'center' | 'right';
    depthSign: 1 | -1;
  }
): Shape3D {
  const wall = LABEL_SOCKET_WALL_MM;
  const pocketW = labelPlateWidthMm(ctx.plateWidthU) + ctx.clearanceMm;
  const pocketD = LABEL_PLATE_HEIGHT_MM + ctx.clearanceMm;

  // Defense in depth: the plan already sized the plate to the tab width, but
  // a crafted payload (short depth, huge fit offset) could still overflow.
  if (pocketW + 2 * wall > ctx.tabWidth + 0.01) return tabSolid;
  if (pocketD + 2 * wall > ctx.tabDepth + 0.01) return tabSolid;

  let pocketX0: number;
  if (ctx.alignment === 'left') {
    pocketX0 = wall;
  } else if (ctx.alignment === 'right') {
    pocketX0 = ctx.tabWidth - wall - pocketW;
  } else {
    pocketX0 = (ctx.tabWidth - pocketW) / 2;
  }
  const centerX = pocketX0 + pocketW / 2;
  const centerY = ctx.depthSign * (wall + pocketD / 2);

  try {
    return cutLabelSocket(scope, tabSolid, {
      centerX,
      centerY,
      topZ: ctx.tabHeight,
      plateWidthU: ctx.plateWidthU,
      clearanceMm: ctx.clearanceMm,
      style: ctx.style,
      // The slide mouth opens through the tab's compartment-facing edge —
      // extend the cut from the pocket's far edge past the tab boundary.
      mouth: {
        sign: ctx.depthSign,
        extendMm: ctx.tabDepth - wall - pocketD + 1,
      },
    });
  } catch {
    return tabSolid;
  }
}

/**
 * Cut a swappable-label socket into `solid`'s top face, pocket centered at
 * (centerX, centerY). Shared by the label-tab shelf and the fit-calibration
 * coupon so the printed socket can never drift between the two. Throws on
 * boolean failure — callers needing best-effort semantics wrap it.
 *
 * Styles (#2666 follow-up):
 * - `clickIn` (default): pocket + retention ribs, floor at topZ − pocket
 *   depth. The Cullenect-compatible profile.
 * - `slideChannel`: pocket sunk one lip band + z-clearance deeper, with
 *   overhanging lips left/right/anchor-side, a mouth corridor opening
 *   `mouth.sign`-ward through the host's edge (`mouth.extendMm` past the
 *   pocket), and a park detent on the corridor floor at the pocket edge.
 */
export function cutLabelSocket(
  scope: DisposalScope,
  solid: Shape3D,
  ctx: {
    centerX: number;
    centerY: number;
    topZ: number;
    plateWidthU: LabelPlateWidthU;
    clearanceMm: number;
    style?: LabelSocketStyle;
    mouth?: { sign: 1 | -1; extendMm: number };
  }
): Shape3D {
  const pocketW = labelPlateWidthMm(ctx.plateWidthU) + ctx.clearanceMm;
  const pocketD = LABEL_PLATE_HEIGHT_MM + ctx.clearanceMm;

  if ((ctx.style ?? 'clickIn') === 'slideChannel') {
    if (!ctx.mouth) {
      // Throwing (not falling back to click-in) keeps a future call site from
      // silently shipping the wrong retention profile; best-effort callers
      // already wrap this function.
      throw new Error('slideChannel socket requires a mouth direction');
    }
    return cutSlideChannel(
      scope,
      solid,
      { centerX: ctx.centerX, centerY: ctx.centerY, topZ: ctx.topZ, mouth: ctx.mouth },
      pocketW,
      pocketD
    );
  }

  const floorZ = ctx.topZ - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;

  const pocketCutter = scope.register(
    translate(
      scope.register(
        sketch(
          drawRoundedRectangle(pocketW, pocketD, LABEL_PLATE_CORNER_RADIUS_MM),
          'XY',
          floorZ
        ).extrude(LABEL_SOCKET_CLICK_POCKET_DEPTH_MM + COPLANAR_MARGIN)
      ),
      [ctx.centerX, ctx.centerY, 0]
    )
  );
  let result = scope.register(unwrap(cut(solid as ValidSolid, pocketCutter as ValidSolid)));

  // Ribs: full pocket-X span (square ends fuse into the rounded corners,
  // matching the standard), embedded slightly into the wall so the fuse
  // never leaves a coplanar seam.
  const ribEmbed = 0.1;
  const ribT = LABEL_SOCKET_RIB_PROTRUSION_MM + ribEmbed;
  const ribZ0 = floorZ + LABEL_SOCKET_RIB_START_MM;
  const ribProfile = draw([-pocketW / 2, -ribT / 2])
    .lineTo([pocketW / 2, -ribT / 2])
    .lineTo([pocketW / 2, ribT / 2])
    .lineTo([-pocketW / 2, ribT / 2])
    .close();
  for (const side of [-1, 1] as const) {
    const wallY = ctx.centerY + (side * pocketD) / 2;
    const ribCenterY = wallY - side * (ribT / 2 - ribEmbed);
    const rib = scope.register(
      translate(
        scope.register(sketch(ribProfile, 'XY', ribZ0).extrude(LABEL_SOCKET_RIB_HEIGHT_MM)),
        [ctx.centerX, ribCenterY, 0]
      )
    );
    result = scope.register(unwrap(fuse(result, rib as ValidSolid)));
  }
  return result;
}

/**
 * Slide-channel variant of `cutLabelSocket`: a two-layer cut (cavity below,
 * lip window above, stacked exactly like the v1 plate channels — no
 * epsilon seams) plus a fused park detent at the pocket's mouth edge.
 */
function cutSlideChannel(
  scope: DisposalScope,
  solid: Shape3D,
  ctx: {
    centerX: number;
    centerY: number;
    topZ: number;
    mouth: { sign: 1 | -1; extendMm: number };
  },
  pocketW: number,
  pocketD: number
): Shape3D {
  const r = LABEL_PLATE_CORNER_RADIUS_MM;
  const lipT = LABEL_SOCKET_LIP_THICKNESS_MM;
  const overhang = LABEL_SOCKET_LIP_OVERHANG_MM;
  const cavityTop = ctx.topZ - lipT;
  const floorZ = cavityTop - LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM - LABEL_SOCKET_POCKET_DEPTH_MM;
  const { sign, extendMm } = ctx.mouth;

  // Cavity: pocket + mouth corridor at full plate width, up to the lip
  // underside.
  const cavityD = pocketD + extendMm;
  const cavity = scope.register(
    translate(
      scope.register(
        sketch(drawRoundedRectangle(pocketW, cavityD, r), 'XY', floorZ).extrude(cavityTop - floorZ)
      ),
      [ctx.centerX, ctx.centerY + (sign * extendMm) / 2, 0]
    )
  );
  let result = scope.register(unwrap(cut(solid as ValidSolid, cavity as ValidSolid)));

  // Lip window: inset by the overhang on the two side walls and the
  // anchor-side wall; open through the mouth. Cut from the cavity top up
  // past the shelf top.
  const windowW = pocketW - 2 * overhang;
  const windowD = pocketD - overhang + extendMm;
  const window = scope.register(
    translate(
      scope.register(
        sketch(drawRoundedRectangle(windowW, windowD, r), 'XY', cavityTop).extrude(lipT + 1)
      ),
      [ctx.centerX, ctx.centerY + (sign * (overhang + extendMm)) / 2, 0]
    )
  );
  result = scope.register(unwrap(cut(result, window as ValidSolid)));

  // Park detent: a low bar across the corridor floor just past the pocket
  // edge — the plate rides over it on the way in and rests behind it.
  const detentW = windowW;
  const detentCenterY = ctx.centerY + sign * (pocketD / 2 + LABEL_SOCKET_DETENT_DEPTH_MM / 2);
  const detent = scope.register(
    translate(
      scope.register(
        sketch(
          drawRoundedRectangle(detentW, LABEL_SOCKET_DETENT_DEPTH_MM, 0.2),
          'XY',
          floorZ
        ).extrude(LABEL_SOCKET_DETENT_HEIGHT_MM)
      ),
      [ctx.centerX, detentCenterY, 0]
    )
  );
  result = scope.register(unwrap(fuse(result, detent as ValidSolid)));
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
  const style = { ...ctx.textDefaults, ...ctx.labelTextStyle };
  // Both caps ride through `fontSizeOverride`, applied as
  // min(auto-fit, max(minFontSize, override)) — so neither cap can grow the text
  // past what this tab holds, and both stay above the legibility floor.
  const caps = [ctx.uniformTextSize, ctx.labelTextStyle?.fontSizeOverride].filter(
    (cap) => cap !== undefined
  );
  const fontSizeOverride = caps.length > 0 ? Math.min(...caps) : undefined;
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
    verticalFit: TAB_TEXT_VERTICAL_FIT,
    fontSizeOverride,
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
    // Socket mode (#2666): geometry additionally depends on the
    // per-compartment width overrides (mode + plateFitOffset already ride in
    // `stableSerialize(params.label)` below) AND the print nozzle (#2690 — the
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
        // `v10`: tab text sizes against glyph ink and shares one size per
        // row/anchor group, so the same params now cut larger, uniform glyphs.
        // `v8`: click-in pockets deepened by LABEL_SOCKET_CLICK_POCKET_RELIEF_MM
        // and the stacking relief grew — same params, lower geometry again.
        // `v7`: click-in sockets on lipped bins sink the default shelf by
        // LABEL_SOCKET_STACK_RELIEF_MM — same params now cut lower geometry,
        // so older IndexedDB entries must be invalidated.
        // `v6`: #2666 added swappable-label socket mode.
        // `v5`: #1654 extrudes the shelf COPLANAR_OVERLAP proud (geometry +
        // face tags changed), so older IndexedDB entries must be invalidated.
        // `v4`: #1898 added `edges` + `inset` to LabelTabConfig.
        'v10',
        socketKeyPart,
        dim.shellKey,
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
