/**
 * Label-tab layout planning — pure, kernel-free, and shared.
 *
 * Lifted out of `labelTabBuilder` (which needs brepjs, so the main thread
 * cannot import it) because three things now have to agree on where a tab
 * ends up: the builder that cuts it, the lid's click rails that must not run
 * into it, and the panel warnings that explain why a rail went missing.
 * Re-deriving the placement in each of those is exactly the drift CLAUDE.md
 * gotcha #9 warns about, so they all read this plan instead.
 *
 * Nothing here touches geometry — `planLabelTabLayout` was already documented
 * as pure and separate from the build, and this file is that separation made
 * physical.
 */

import type { BinParams, LabelTabAlignment, LabelTabFit, TabAnchorSide } from '@/shared/types/bin';
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
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { resolveOverhang, overhangExpansion, hasOverhang } from '@/shared/utils/overhang';
import { isPartialMask } from '@/shared/utils/cellMask';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import {
  LID_CLICK_RAIL_DROP_BELOW_WALL,
  LID_CLICK_RAIL_TOP_CHAMFER,
} from '@/features/bin-designer/types/lid';

export type TabAnchor = 'back' | 'front';

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
  readonly anchor: TabAnchor;
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
 * Resolve which compartments host a tab anchored to one row's edge (back or
 * front) and where each one sits. Pure — no geometry, no scope — so the whole
 * bin's tabs can be planned before any are built (see
 * `resolveUniformTabTextSize`).
 *
 * Groups consecutive same-compartment cells that share an edge at this row and
 * emits one slot per group, so merged columns get a single spanning tab rather
 * than per-column tabs with incorrect divider deductions.
 */
export function planTabsAtRow(
  params: BinParams,
  row: number,
  anchor: TabAnchor,
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

    const groupMinCol = col;
    const groupMaxCol = groupEnd - 1;

    const hasLeftWall = groupMinCol === 0 || cells[row * cols + (groupMinCol - 1)] !== cellId;
    const hasRightWall =
      groupMaxCol === cols - 1 || cells[row * cols + (groupMaxCol + 1)] !== cellId;

    // Deducts half a divider at each boundary that has one (merged columns
    // share no divider) and follows any `dividerOverrides` shifting those
    // dividers off their grid lines (#3225).
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
 * Plan the single full-width tab at one row's anchor wall (#2897).
 *
 * Deliberately runs against the REAL compartment config rather than a synthetic
 * one-column grid: the tilt and depth guards below read `dividerOverrides` and
 * real bounds, and would silently pass on a fabricated config.
 */
export function planSpanningTabAtRow(
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
export function fitTabInSpan(args: {
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

  // Socket mode used to force the full available width, which meant a user
  // fitting a centred 1u plate still got a shelf spanning the whole
  // compartment (#3402). The width now applies in both modes; the socket plan
  // is fed the same percentage, so a narrower shelf simply picks a narrower
  // plate rather than keeping one that no longer fits.
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
  /**
   * True when the tab hangs from the bin's own outer wall rather than an
   * interior row divider. Only these can foul a lid, which never reaches
   * deeper than the perimeter.
   */
  readonly onOuterWall: boolean;
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
    // A tab sits on the outer wall when its anchor face IS that wall. `inset`
    // slides the body inward but leaves the anchor where it was, so it is the
    // un-inset anchor that decides this.
    const outerY = row.anchor === 'back' ? innerD / 2 : -innerD / 2;
    const inset = params.label.inset ?? 0;
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
        onOuterWall: Math.abs(anchorY - (outerY + depthSign * inset)) < 1e-6,
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
export function clickRailZBandAboveFloor(interiorHeight: number): {
  readonly lo: number;
  readonly hi: number;
} {
  const lipTop =
    interiorHeight +
    GRIDFINITY_SPEC.LIP_SMALL_TAPER +
    GRIDFINITY_SPEC.LIP_HEIGHT -
    GRIDFINITY_SPEC.LIP_OVERLAP;
  const wallBottom = lipTop - GRIDFINITY_SPEC.LIP_BIG_TAPER - GRIDFINITY_SPEC.LIP_VERTICAL_PART;
  return {
    lo: wallBottom - LID_CLICK_RAIL_DROP_BELOW_WALL,
    hi: wallBottom + LID_CLICK_RAIL_TOP_CHAMFER,
  };
}

/** Does this footprint reach into the band a click rail sweeps through? */
export function footprintFoulsRailBand(fp: LabelTabFootprint, interiorHeight: number): boolean {
  const band = clickRailZBandAboveFloor(interiorHeight);
  return fp.zMax > band.lo && fp.zMin < band.hi;
}

/**
 * Interior dimensions a label tab is planned against, from params alone.
 *
 * Mirrors `createPipelineContext` (pipeline/context.ts), which is the real
 * source — the lid is generated independently of the bin pipeline, so it has
 * no context to read and must re-derive. `labelTabPlan.dims.test.ts` pins the
 * two together against the real context for a matrix of params; if that test
 * fails, context.ts moved and this must follow.
 */
export function labelTabInteriorDims(params: BinParams): {
  readonly innerW: number;
  readonly innerD: number;
  readonly interiorHeight: number;
} | null {
  if (params.base.tile === true) return null;
  const gridUnitY = params.gridUnitMmY ?? params.gridUnitMm;
  const outerW = params.width * params.gridUnitMm - GRIDFINITY_SPEC.TOLERANCE;
  const outerD = params.depth * gridUnitY - GRIDFINITY_SPEC.TOLERANCE;
  // Overhang widens the shell and the cavity together, so a tab's anchor wall
  // moves out with it. Omitting this put every footprint on an overhang bin
  // several mm inboard of the real shelf, which is exactly where the rail
  // clipping then fails to bite. Suppressed for polygon masks, matching the
  // pipeline (the mask defines its own footprint).
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
  if (innerW <= 0 || innerD <= 0 || interiorHeight <= 0) return null;
  return { innerW, innerD, interiorHeight };
}

/**
 * Label tabs a lid's click rails could actually run into.
 *
 * Filtered to tabs on the bin's own outer wall that reach into the rails' Z
 * band: an interior-row tab sits too far inboard for a rail to reach, and a
 * shelf tucked under the rim (#1898) passes beneath one. Everything the
 * rail-clipping and the panel warnings need comes from here, so the two can
 * never disagree about which wall is fouled.
 */
export function railFoulingLabelFootprints(params: BinParams): readonly LabelTabFootprint[] {
  if (!params.label.enabled) return [];
  const dims = labelTabInteriorDims(params);
  if (!dims) return [];
  return labelTabFootprints(
    params,
    dims.innerW,
    dims.innerD,
    dims.interiorHeight,
    params.wallThickness
  ).filter((fp) => fp.onOuterWall && footprintFoulsRailBand(fp, dims.interiorHeight));
}
