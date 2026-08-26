/**
 * Store wiring shared by the BaseplatePanel sections.
 *
 * `updateBaseplateParams`/`updateBaseplateParam` are plain functions (getState
 * writes, no subscriptions) so any section can mutate params without prop
 * threading. `useBaseplatePanelDerived` centralizes the read slice plus the
 * derived shape/stack flags that several sections gate on, so the sections
 * can't drift apart on how "shaped" or "stacked" is decided.
 */

import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useBaseplatePageStore } from '../../store/baseplatePageStore';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import type { StoredBaseplateParams, DrawerOutline, FractionalEdge } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { cornerCutsMatchVertices } from '@/shared/utils/cornerCutOutline';
import { drawerFrameExtent } from '@/shared/utils/outlineFrame';
import { hasEffectivePerimeter } from '../../utils/buildFullParams';
import { trackToolActivated } from '@/shared/analytics/posthog/conversionEvents';
import { dismissBaseplateQuickstartOnEdit } from '../../hooks/useBaseplateFirstRun';

/** Below this a shape is treated as filling the padded extent exactly, so a
 * shape drawn to its grid keeps the plain "grid + padding" reading. */
const EXTENT_EPS_MM = 0.01;

export function updateBaseplateParams(patch: Partial<StoredBaseplateParams>): void {
  const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
  useLayoutStore.getState().setBaseplateParams({ ...current, ...patch });
  trackToolActivated('baseplate', 'params_changed');
  dismissBaseplateQuickstartOnEdit();
}

export function updateBaseplateParam<K extends keyof StoredBaseplateParams>(
  key: K,
  value: StoredBaseplateParams[K]
): void {
  updateBaseplateParams({ [key]: value });
}

export interface BaseplatePanelDerived {
  baseplateParams: StoredBaseplateParams;
  drawerOutline: DrawerOutline | undefined;
  drawerFractionalEdgeX: FractionalEdge;
  drawerFractionalEdgeY: FractionalEdge;
  /**
   * Which edge actually carries the half unit, resolved the way
   * `buildFullParams` does it (drawer when synced, stored otherwise). The split
   * editor needs this to know where cuts may land — deriving it here keeps the
   * panel from drifting from the resolver.
   */
  effectiveFractionalEdgeX: FractionalEdge;
  effectiveFractionalEdgeY: FractionalEdge;
  gridUnitMm: number;
  gridUnitMmY: number;
  synced: boolean;
  effectiveWidth: number;
  effectiveDepth: number;
  gridWidthMm: number;
  gridDepthMm: number;
  totalWidthMm: number;
  totalDepthMm: number;
  /** The plate's real footprint: the padded extent, or the drawer shape's own
   * span when a synced shape overruns or undercuts it. */
  outerWidthMm: number;
  outerDepthMm: number;
  hasPadding: boolean;
  /** The drawer shape moves the footprint off the padded grid extent. */
  shapeSetsExtent: boolean;
  /** Export-format-aware: STEP never stacks (mirrors BaseplatePage). */
  stackEnabled: boolean;
  outlineActive: boolean;
  cornerShaped: boolean;
  freeformShaped: boolean;
  /** Plate has a curved/angled perimeter, from a drawer shape or a large radius. */
  perimeterShaped: boolean;
}

export function useBaseplatePanelDerived(): BaseplatePanelDerived {
  const {
    drawerWidth,
    drawerDepth,
    drawerOutline,
    drawerFractionalEdgeX,
    drawerFractionalEdgeY,
    drawerGridShiftX,
    drawerGridShiftY,
    gridUnitMm,
    gridUnitMmY,
    baseplateParams,
  } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      drawerOutline: state.layout.drawer.outline,
      drawerFractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      drawerFractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      drawerGridShiftX: state.layout.drawer.gridShiftX,
      drawerGridShiftY: state.layout.drawer.gridShiftY,
      gridUnitMm: state.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(state.layout),
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );
  const exportFormat = useBaseplatePageStore((s) => s.exportFileNameConfig.format);

  const synced = baseplateParams.syncWithLayout !== false;
  const effectiveWidth = synced ? drawerWidth : (baseplateParams.baseplateWidth ?? drawerWidth);
  const effectiveDepth = synced ? drawerDepth : (baseplateParams.baseplateDepth ?? drawerDepth);

  const gridWidthMm = effectiveWidth * gridUnitMm;
  // Depth uses the non-square Y pitch, so the panel's dimension readout and the
  // corner-shape detection match the actual plate (equal to X for a square grid).
  const gridDepthMm = effectiveDepth * gridUnitMmY;

  const totalWidthMm = gridWidthMm + baseplateParams.paddingLeft + baseplateParams.paddingRight;
  const totalDepthMm = gridDepthMm + baseplateParams.paddingFront + baseplateParams.paddingBack;
  // A synced drawer shape, not the lattice, decides how much material the plate
  // ends up with — the generator intersects its slab with the framed perimeter.
  // Asking the frame module rather than adding up cells keeps the readout on the
  // plate the user gets, whichever way the two spans sit.
  const plateExtent = drawerFrameExtent(
    {
      width: drawerWidth,
      depth: drawerDepth,
      outline: drawerOutline,
      fractionalEdgeX: drawerFractionalEdgeX,
      fractionalEdgeY: drawerFractionalEdgeY,
      gridShiftX: drawerGridShiftX,
      gridShiftY: drawerGridShiftY,
    },
    baseplateParams,
    gridUnitMm,
    gridUnitMmY
  );
  const outerWidthMm = plateExtent?.widthMm ?? totalWidthMm;
  const outerDepthMm = plateExtent?.depthMm ?? totalDepthMm;
  const shapeSetsExtent =
    Math.abs(outerWidthMm - totalWidthMm) > EXTENT_EPS_MM ||
    Math.abs(outerDepthMm - totalDepthMm) > EXTENT_EPS_MM;
  const hasPadding =
    baseplateParams.paddingLeft > 0 ||
    baseplateParams.paddingRight > 0 ||
    baseplateParams.paddingFront > 0 ||
    baseplateParams.paddingBack > 0;

  // STEP never stacks, so the controls stacking would strip (magnets, corner
  // rounding) stay live for STEP exports — mirror BaseplatePage's stackEnabled.
  const stackEnabled =
    baseplateParams.stackPrint?.enabled === true && (exportFormat ?? 'stl') !== 'step';

  // Mirrors buildFullParams's outline gate. Corner-cut shapes compose with
  // padding (the cuts are re-inscribed on the padded rectangle), so padding
  // stays live and only corner rounding + detached margins hide. Painted/pen/
  // trace shapes have no parametric resize: they subsume padding too, so all
  // those controls hide behind the notice. Stacking keeps the shape now:
  // the shaped tiles dedupe and stack, so a stacked shaped drawer IS shaped and
  // the panel must say so — for every export format, not just STEP.
  const outlineActive = drawerOutline !== undefined && synced;
  const cornerShaped =
    outlineActive &&
    drawerOutline.authoring?.kind === 'corners' &&
    drawerOutline.authoring.corners !== undefined &&
    cornerCutsMatchVertices(
      drawerOutline.vertices,
      gridWidthMm,
      gridDepthMm,
      drawerOutline.authoring.corners
    );
  // Every freeform shape (painted cells, traced footprint, pen shape) composes
  // with padding edge-by-edge in buildFullParams, so its padding controls stay
  // live — only corner rounding and detached margins (both outline-unaware) hide.
  const freeformShaped = outlineActive && !cornerShaped;

  // A corner radius past the plain-rounding limit is converted to a radius-cut
  // outline in buildFullParams, so the plate really does get a curved perimeter
  // slicing sockets. Asking the resolver's own predicate rather than repeating
  // its threshold keeps the panel, the trigger and the resolver from drifting.
  // Stacking-independent: a large radius shapes the plate whether or
  // not stacking is on (the rounded tiles stack), so the whole-cell control this
  // gates surfaces for a stacked large-radius plate too — no format override.
  /** The plate has a curved or angled perimeter that can slice sockets. */
  const perimeterShaped = hasEffectivePerimeter(
    baseplateParams,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    drawerOutline,
    gridUnitMmY
  );

  return {
    baseplateParams,
    drawerOutline,
    drawerFractionalEdgeX,
    drawerFractionalEdgeY,
    effectiveFractionalEdgeX: synced
      ? drawerFractionalEdgeX
      : (baseplateParams.fractionalEdgeX ?? 'end'),
    effectiveFractionalEdgeY: synced
      ? drawerFractionalEdgeY
      : (baseplateParams.fractionalEdgeY ?? 'end'),
    gridUnitMm,
    gridUnitMmY,
    synced,
    effectiveWidth,
    effectiveDepth,
    gridWidthMm,
    gridDepthMm,
    totalWidthMm,
    totalDepthMm,
    outerWidthMm,
    outerDepthMm,
    hasPadding,
    shapeSetsExtent,
    stackEnabled,
    outlineActive,
    cornerShaped,
    freeformShaped,
    perimeterShaped,
  };
}
