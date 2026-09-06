/**
 * Label-tab layout planning — pure, kernel-free, and shared.
 *
 * Lifted out of `labelTabBuilder` (which needs brepjs, so the main thread
 * cannot import it) because three things now have to agree on where a tab
 * ends up: the builder that cuts it, the lid's click rails that must not run
 * into it, and the panel warnings that explain why a rail went missing.
 * Re-deriving the placement in each of those is exactly the drift CLAUDE.md
 * gotcha #9 warns about, so they all read this plan instead.
 */

import type {
  BinParams,
  LabelTabAlignment,
  LabelTabFit,
  LidCompatibilitySide,
  TabAnchorSide,
} from '@/shared/types/bin';
import {
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  compartmentTabEligible,
  compartmentTabXSpan,
  rowHasFullWidthWall,
  spanRegionDepth,
} from '@/shared/types/bin';
import {
  LABEL_SOCKET_SHELF_THICKNESS_MM,
  LABEL_SOCKET_SLIDE_SHELF_THICKNESS_MM,
  effectiveLabelSocketClearance,
  labelLipReservationMm,
  resolveLabelShelfTopMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU, LabelSocketStyle } from '@/shared/constants/labelPlates';
import { planLabelSockets } from '@/shared/utils/labelSocketPlan';
import { labelShelfKeepoutMm } from '@/shared/utils/lidInteriorRelief';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { resolveOverhang, overhangExpansion, hasOverhang } from '@/shared/utils/overhang';
import { isPartialMask } from '@/shared/utils/cellMask';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import {
  LID_CLICK_RAIL_DROP_BELOW_WALL,
  LID_CLICK_RAIL_TOP_CHAMFER,
  LID_CLICK_RAIL_OUT,
  LID_CLICK_RAIL_INNER,
} from '@/features/bin-designer/types/lid';

/** Socket-mode build inputs resolved once per bin from the shared plan. */
export interface SocketBuildInfo {
  /** Effective TOTAL pocket clearance (spec + user fit offset). */
  readonly clearanceMm: number;
  /** Plate width per compartment ID; absent = that tab gets a plain shelf. */
  readonly plateByCompartment: ReadonlyMap<number, LabelPlateWidthU>;
  /** Pocket profile: click-in ribs (default) or slide-in channel. */
  readonly style: LabelSocketStyle;
}

export interface TabBuildDimensions {
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
  /** Non-null in swappable-label socket mode. */
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
export interface TabSlot {
  readonly cellId: number;
  readonly text: string;
  readonly tabWidth: number;
  readonly tabXStart: number;
  readonly positionY: number;
  readonly touchesLeft: boolean;
  readonly touchesRight: boolean;
}

/** One row/anchor's planned slots plus the inputs its geometry needs. */
export interface PlannedTabRow {
  readonly params: BinParams;
  readonly anchor: TabAnchorSide;
  readonly dims: TabBuildDimensions;
  readonly slots: readonly TabSlot[];
}

/** Everything the tab build needs, resolved without touching BREP. */
export interface TabLayout {
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
export function planLabelTabLayout(
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
  // to leave a tuck-under pocket above.
  // The geometry is built in a local frame (shelf top at Z=tabHeight) and
  // then translated up by `shelfTopZ - tabHeight`, so the entire
  // shelf+gusset assembly slides down as a unit.
  const shelfTopZ = resolveLabelShelfTopMm(
    wallHeight,
    params.base.stackingLip,
    params.label,
    labelShelfKeepoutMm(params)
  );

  // Safety: tab must fit within wall height AND between floor and shelfTopZ.
  // `shelfTopZ - tabHeight` is the Z of the gusset bottom; if it's <= 0 the
  // gusset would clip the floor.
  if (tabHeight > wallHeight || tabHeight <= 0) return null;
  if (shelfTopZ > wallHeight || shelfTopZ - tabHeight <= 0) return null;

  // Defense in depth: the UI clamps depth ≤ innerD-1, but a cloud-share
  // payload could carry a config where the tab body would extend past the
  // opposite wall and fuse into it as a bridge. Silent null-fallback here.
  if (tabDepth >= innerD) return null;

  // Swappable-label socket mode: resolve which standard plate each
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
    const plan = planLabelSockets(params.compartments, innerW, clearanceMm, params.label.width);
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
          clearanceMm,
          params.label.width
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
  const anchors: TabAnchorSide[] = [];
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

  // Full-width mode plans one shelf per row against the real config —
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
  anchor: TabAnchorSide,
  dims: TabBuildDimensions,
  bothEdges: boolean
): TabSlot[] {
  const { cols, rows, cells } = params.compartments;
  const widthPercent = params.label.width;
  const alignment = params.label.alignment;
  const inset = params.label.inset ?? 0;
  const { innerW, innerD, cellD, tabDepth } = dims;

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
    // gate on the same one so none of the three can drift. Compartment
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

    const groupMinCol = col;
    const groupMaxCol = groupEnd - 1;

    const hasLeftWall = groupMinCol === 0 || cells[row * cols + (groupMinCol - 1)] !== cellId;
    const hasRightWall =
      groupMaxCol === cols - 1 || cells[row * cols + (groupMaxCol + 1)] !== cellId;

    // Deducts half a divider at each boundary that has one (merged columns
    // share no divider) and follows any `dividerOverrides` shifting those
    // dividers off their grid lines.
    const span = compartmentTabXSpan(params.compartments, cellId, innerW);
    if (!span) {
      col = groupEnd;
      continue;
    }
    const { left: availableLeft, right: availableRight } = span;

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
    });
    if (slot) slots.push(slot);
    col = groupEnd;
  }

  return slots;
}

/**
 * Plan the single full-width tab at one row's anchor wall.
 *
 * Deliberately runs against the REAL compartment config rather than a synthetic
 * one-column grid: the tilt and depth guards below read `dividerOverrides` and
 * real bounds, and would silently pass on a fabricated config.
 */
function planSpanningTabAtRow(
  params: BinParams,
  row: number,
  anchor: TabAnchorSide,
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
}): TabSlot | null {
  const { availableLeft, availableRight, alignment } = args;
  const availableWidth = availableRight - availableLeft;

  // The socket plan is fed this same percentage, so a narrower shelf picks a
  // narrower plate rather than keeping one that no longer fits.
  const tabWidth = (availableWidth * args.widthPercent) / 100;
  if (tabWidth <= 0) return null;

  let tabXStart: number;
  if (alignment === 'left') {
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
 * One tab's occupied volume in the bin-interior frame.
 *
 * X/Y are the real placed span — width percentage, alignment and divider
 * deductions already applied — because a consumer that widens every tab to its
 * whole compartment (as the divider-pattern keep-outs deliberately do) can
 * never see the gaps a narrow tab leaves.
 *
 * Z is measured above the cavity floor, matching `resolveLabelShelfTopMm`.
 * `zMax` is the shelf top plus any free-edge lip; `zMin` is the support's
 * lowest reach, which for the 45° gusset equals the shelf top less the tab
 * depth. The box is the support's bounding envelope, not its exact profile —
 * a bracket's gussets are discrete and a fillet curves inside the hypotenuse,
 * so the envelope over-reports for those two and is exact for `solid`. That
 * direction is the safe one for clearance: it never lets a rail closer than a
 * solid support would allow.
 */
export interface LabelTabFootprint {
  readonly anchor: TabAnchorSide;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin: number;
  readonly zMax: number;
}

/**
 * Every label tab this design actually builds, as boxes.
 *
 * Runs the same `planLabelTabLayout` the builder does, so a footprint exists
 * if and only if a tab does — including the socket mode's bin-spanning
 * fallback and every eligibility rule that silently drops a tab.
 *
 * `wallHeight` is the pipeline's `interiorHeight`, NOT the raw wall height;
 * passing the latter puts every shelf a stacking lip's worth too high.
 */
export function labelTabFootprints(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  wallThickness: number
): readonly LabelTabFootprint[] {
  if (!params.label.enabled) return [];
  const layout = planLabelTabLayout(params, innerW, innerD, wallHeight, wallThickness);
  if (!layout) return [];

  const { dims } = layout;
  const zMax = dims.shelfTopZ + labelLipReservationMm(params.label);
  const zMin = dims.shelfTopZ - dims.tabDepth;

  const out: LabelTabFootprint[] = [];
  for (const row of layout.plannedRows) {
    const depthSign = row.anchor === 'back' ? -1 : 1;
    for (const slot of row.slots) {
      const anchorY = slot.positionY;
      const far = anchorY + depthSign * dims.tabDepth;
      out.push({
        anchor: row.anchor,
        xMin: slot.tabXStart,
        xMax: slot.tabXStart + slot.tabWidth,
        yMin: Math.min(anchorY, far),
        yMax: Math.max(anchorY, far),
        zMin,
        zMax,
      });
    }
  }
  return out;
}

/**
 * The lid's click-rail Z band, measured above the bin's cavity floor.
 *
 * A rail's top face is the bottom of the lid's mating wall, which sits
 * `LIP_BIG_TAPER + LIP_VERTICAL_PART` below the lip top; the profile then
 * hangs `LID_CLICK_RAIL_DROP_BELOW_WALL` under that, and the top chamfer
 * climbs `LID_CLICK_RAIL_TOP_CHAMFER` above it. Derived here rather than in
 * lid-local Z so it can be compared directly against a tab footprint, which
 * only ever knows about the cavity floor.
 */
export function clickRailZBandAboveFloor(
  interiorHeight: number,
  /**
   * Exterior-wall collar. It raises the outer box and the lip with it
   * while deliberately leaving the interior plane alone, so the lid seats that
   * much higher above an unmoved shelf. Omitting it puts the band below where
   * the rail really is and reports a foul on a tab the rail clears.
   */
  collarHeight = 0
): {
  readonly lo: number;
  readonly hi: number;
} {
  const lipTop =
    interiorHeight + collarHeight + GRIDFINITY_SPEC.LIP_SMALL_TAPER + GRIDFINITY_SPEC.LIP_HEIGHT;
  const wallBottom = lipTop - GRIDFINITY_SPEC.LIP_BIG_TAPER - GRIDFINITY_SPEC.LIP_VERTICAL_PART;
  return {
    lo: wallBottom - LID_CLICK_RAIL_DROP_BELOW_WALL,
    hi: wallBottom + LID_CLICK_RAIL_TOP_CHAMFER,
  };
}

/** Does this footprint reach into the band a click rail sweeps through? */
export function footprintFoulsRailBand(
  fp: LabelTabFootprint,
  interiorHeight: number,
  collarHeight = 0
): boolean {
  const band = clickRailZBandAboveFloor(interiorHeight, collarHeight);
  return fp.zMax > band.lo && fp.zMin < band.hi;
}

/**
 * Interior dimensions a label tab is planned against, from params alone.
 *
 * Mirrors `deriveDimensions` (pipeline/context.ts), which is the real source.
 * The lid is generated independently of the bin pipeline, so it has no context
 * to read and must re-derive. `generators/labelTabPlanDims.test.ts` pins the
 * two together for a matrix of params; if that test fails, context.ts moved
 * and this must follow.
 */
export function labelTabInteriorDims(params: BinParams): {
  readonly innerW: number;
  readonly innerD: number;
  /**
   * Full wall height, BEFORE the stacking relief the interior gives up. The
   * wall-cutout builder measures its own cut depth against `wallHeight -
   * wallThickness`, so a consumer mirroring that gate needs the raw number
   * rather than re-adding the taper to `interiorHeight`.
   */
  readonly wallHeight: number;
  readonly interiorHeight: number;
  readonly collarHeight: number;
} | null {
  if (params.base.tile === true) return null;
  const gridUnitY = params.gridUnitMmY ?? params.gridUnitMm;
  const outerW = params.width * params.gridUnitMm - GRIDFINITY_SPEC.TOLERANCE;
  const outerD = params.depth * gridUnitY - GRIDFINITY_SPEC.TOLERANCE;
  // Overhang widens the shell and the cavity together, so a tab's anchor wall
  // moves out with it; omitting it puts every footprint inboard of the real
  // shelf. Suppressed for polygon masks, matching the pipeline.
  const overhang = resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang);
  const expansion = hasOverhang(overhang) ? overhangExpansion(overhang) : null;
  const innerW = outerW + (expansion?.addW ?? 0) - 2 * params.wallThickness;
  const innerD = outerD + (expansion?.addD ?? 0) - 2 * params.wallThickness;

  const totalHeight = params.height * params.heightUnitMm;
  // `flat` and `lid` bases carry no socket, so their whole height is wall.
  const socketless = params.base.style === 'flat' || params.base.style === 'lid';
  const wallHeight = socketless
    ? totalHeight
    : Math.max(totalHeight - GRIDFINITY_SPEC.SOCKET_HEIGHT, DESIGNER_CONSTRAINTS.MIN_BODY_WALL_MM);
  const interiorHeight = Math.max(
    0,
    params.base.stackingLip ? wallHeight - GRIDFINITY_SPEC.LIP_SMALL_TAPER : wallHeight
  );
  // Kept out of `interiorHeight` exactly as the pipeline keeps it out, so
  // interior features stay on their plane; the lip and the lid ride on it.
  const rawCollar = params.extraWallHeightMm ?? 0;
  const collarHeight = Number.isFinite(rawCollar) ? Math.max(0, rawCollar) : 0;

  if (innerW <= 0 || innerD <= 0 || interiorHeight <= 0) return null;
  return { innerW, innerD, wallHeight, interiorHeight, collarHeight };
}

/**
 * Label tabs a lid's click rails could actually run into.
 *
 * Filtered on Z alone: a shelf tucked under the rim, or dropped by an
 * inset, passes beneath the band and fouls nothing. Everything the
 * rail-clipping and the panel warnings need comes from here, so the two can
 * never disagree about which wall is fouled.
 *
 * NOT filtered on `onOuterWall`, which it was until. A tab hanging from
 * an interior row divider is indeed out of reach of the rail on the wall it
 * FACES — but it spans its compartment wall to wall in X, so on a multi-row
 * grid it runs straight into the left and right rails, at 1.25mm of overlap on
 * a 2x2. Which walls a footprint really takes is the cross-axis test's
 * question, and `railSegmentsClearOfLabelTabs` already asks it per wall: the
 * back and front rails skip an interior tab on their own, because its span
 * misses their line by a row.
 */
export function railFoulingLabelFootprints(params: BinParams): readonly LabelTabFootprint[] {
  // A polygon bin's tabs are gated off by the builder, so it has none to foul
  // anything. Decided here so both callers cannot disagree about it.
  if (!params.label.enabled || isPartialMask(params.cellMask)) return [];
  const dims = labelTabInteriorDims(params);
  if (!dims) return [];
  return labelTabFootprints(
    params,
    dims.innerW,
    dims.innerD,
    dims.interiorHeight,
    params.wallThickness
  ).filter((fp) => footprintFoulsRailBand(fp, dims.interiorHeight, dims.collarHeight));
}

/**
 * Air (mm) kept between a rail's end and a label tab's footprint.
 *
 * A real clearance, unlike the grip relief's quiet zone: rail and shelf occupy
 * the same Z band, so without it the two interpenetrate by up to the shelf's
 * overlap with the rail profile (measured at 1.25mm on a stock lid) and the
 * lid simply will not seat. Sized to survive a print's worth of tolerance
 * rather than to be geometrically minimal.
 */
const LABEL_RAIL_MARGIN = 2;

/**
 * Slack (mm) allowed either side of a rail's spine when deciding whether a
 * footprint sits in its path.
 *
 * A deliberate symmetric over-estimate: the real profile is asymmetric,
 * reaching 0.8mm inboard and 1.85mm outboard, and this uses their mean in both
 * directions. Every resulting error over-blocks except one, which needs a tab
 * under ~1.2mm wide on a side wall — narrower than `MIN_LABEL_TAB_WIDTH` can
 * produce.
 */
const RAIL_HALF_WIDTH = (LID_CLICK_RAIL_OUT - LID_CLICK_RAIL_INNER) / 2;

/** One run of wall a rail may occupy, in along-axis coordinates. */
export interface RailSegment {
  readonly lo: number;
  readonly hi: number;
}

/**
 * One stretch of one wall denied to a click rail, whatever denies it.
 *
 * Two unrelated reasons produce the same shape, and the rail pass cannot tell
 * them apart because it does not need to: a compartment divider or a label tab
 * is IN THE WAY, while a wall cutout or an intruding handle has taken away the
 * lip there is nothing left to grip. Both come out as "no rail along here".
 *
 * The distinction survives in how each is VERIFIED, not in how it is applied:
 * mating the pair and sweeping for overlap finds an obstruction, and is blind to
 * an absence — a rail hanging over a window collides with nothing at all.
 *
 * Along-axis extent, in the bin's centred interior frame.
 */
export interface WallSpanBlock {
  readonly side: LidCompatibilitySide;
  readonly lo: number;
  readonly hi: number;
}

/**
 * Cut a wall's surviving rail stretches down further, around its blocks.
 *
 * Takes segments rather than a bare `lo`/`hi` so passes compose — a wall can
 * carry dividers, cutouts and handles at once, and the label-tab pass has
 * already split the run by the time this one sees it.
 */
export function railSegmentsClearOfBlocks(
  segments: readonly RailSegment[],
  side: LidCompatibilitySide,
  blocks: readonly WallSpanBlock[]
): RailSegment[] {
  let out = [...segments];
  for (const b of blocks) {
    if (b.side !== side) continue;
    out = subtractSpan(out, b.lo, b.hi);
    if (out.length === 0) break;
  }
  return out;
}

/**
 * Remove `[blockLo, blockHi]` from a set of disjoint, ascending spans.
 *
 * Shared by the label-tab and grip-relief passes: both are "this stretch of
 * wall is unavailable, keep what is left", and a rail landing in the middle of
 * an obstruction has to yield two pieces, not one shortened one.
 */
export function subtractSpan(
  spans: readonly RailSegment[],
  blockLo: number,
  blockHi: number
): RailSegment[] {
  const out: RailSegment[] = [];
  for (const seg of spans) {
    if (blockHi <= seg.lo || blockLo >= seg.hi) {
      out.push(seg);
      continue;
    }
    if (blockLo > seg.lo) out.push({ lo: seg.lo, hi: blockLo });
    if (blockHi < seg.hi) out.push({ lo: blockHi, hi: seg.hi });
  }
  return out;
}

/**
 * Split a wall's rail run into the stretches no label tab occupies.
 *
 * A tab on a PERPENDICULAR wall eats one end, leaving a single shorter
 * stretch. A tab on the wall the rail runs ALONG eats the middle: full-width
 * leaves nothing (that wall goes friction-fit), narrow leaves a stretch either
 * side. The caller applies coverage to each surviving stretch, so a wall with
 * two gaps gets two rails rather than one sized for a run it cannot use.
 *
 * `lo`/`hi` are the wall's along-axis extent, already inset by the corner
 * radius. Footprints whose cross-axis span misses the rail's line are ignored.
 */
export function railSegmentsClearOfLabelTabs(
  lo: number,
  hi: number,
  alongX: boolean,
  railCross: number,
  footprints: readonly LabelTabFootprint[]
): RailSegment[] {
  let segments: RailSegment[] = [{ lo, hi }];

  for (const fp of footprints) {
    const [crossMin, crossMax] = alongX ? [fp.yMin, fp.yMax] : [fp.xMin, fp.xMax];
    if (railCross < crossMin - RAIL_HALF_WIDTH || railCross > crossMax + RAIL_HALF_WIDTH) continue;

    const [alongMin, alongMax] = alongX ? [fp.xMin, fp.xMax] : [fp.yMin, fp.yMax];
    const blockLo = alongMin - LABEL_RAIL_MARGIN;
    const blockHi = alongMax + LABEL_RAIL_MARGIN;

    segments = subtractSpan(segments, blockLo, blockHi);
    if (segments.length === 0) break;
  }

  return segments;
}
