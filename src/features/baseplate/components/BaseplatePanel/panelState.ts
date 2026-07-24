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
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import type { StoredBaseplateParams, DrawerOutline, FractionalEdge } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { cornerCutsMatchVertices } from '@/shared/utils/cornerCutOutline';
import { trackToolActivated } from '@/shared/analytics/posthog/conversionEvents';
import { dismissBaseplateQuickstartOnEdit } from '../../hooks/useBaseplateFirstRun';

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
  gridUnitMm: number;
  gridUnitMmY: number;
  synced: boolean;
  effectiveWidth: number;
  effectiveDepth: number;
  gridWidthMm: number;
  gridDepthMm: number;
  totalWidthMm: number;
  totalDepthMm: number;
  hasPadding: boolean;
  /** Export-format-aware: STEP never stacks (mirrors BaseplatePage). */
  stackEnabled: boolean;
  outlineActive: boolean;
  cornerShaped: boolean;
  freeformShaped: boolean;
}

export function useBaseplatePanelDerived(): BaseplatePanelDerived {
  const {
    drawerWidth,
    drawerDepth,
    drawerOutline,
    drawerFractionalEdgeX,
    drawerFractionalEdgeY,
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
  // those controls hide behind the notice. Stacking wins over the shape
  // (uniform rectangular tiles), so the stack section stays functional — but
  // via the export-format-aware `stackEnabled`: STEP clears stackPrint before
  // buildFullParams, so a STEP export of a stacked shaped drawer IS shaped and
  // the panel must say so.
  const outlineActive = drawerOutline !== undefined && synced && !stackEnabled;
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

  return {
    baseplateParams,
    drawerOutline,
    drawerFractionalEdgeX,
    drawerFractionalEdgeY,
    gridUnitMm,
    gridUnitMmY,
    synced,
    effectiveWidth,
    effectiveDepth,
    gridWidthMm,
    gridDepthMm,
    totalWidthMm,
    totalDepthMm,
    hasPadding,
    stackEnabled,
    outlineActive,
    cornerShaped,
    freeformShaped,
  };
}
