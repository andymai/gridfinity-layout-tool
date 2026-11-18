/**
 * The opt-in grid fit offered after a measured-mm drawer commit or a drawer
 * link. Owns the suggestion and its dismissal memory; the grid itself never
 * resizes here.
 */
import { useState, useCallback } from 'react';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { batch } from '@/core/cqrs';
import { useLayoutStore, useToastStore } from '@/core/store';
import { useDrawerFitOfferStore } from '@/core/store/drawerFitOffer';
import type { Mutations } from '@/shared/contexts';
import { fitAxisUnits, halfUnitUpgrade, measuredHeightUnits } from '@/shared/utils/drawerFit';
import type { AxisFit } from '@/shared/utils/drawerFit';
import { fitPaddingToDrawer, plateDrawerOverflow } from '@/shared/utils/fitPaddingToDrawer';
import {
  trackDrawerHalfFitSuggestion,
  trackDrawerMeasuredCommitted,
  trackDrawerMeasurementCleared,
} from '@/shared/analytics/posthog';
import type {
  GridUnits,
  HeightUnits,
  Layout,
  MeasuredDrawerMm,
  StoredBaseplateParams,
} from '@/core/types';
import { effectiveGridUnitMmY, gridUnits } from '@/core/types';
import { useTranslation } from '@/i18n';

/**
 * A grid fit offered (never auto-applied) after a measured-mm commit. The user
 * opts in via the suggestion card; the grid never resizes on its own.
 * `isHalf` fits use a half-unit grid, so accepting also turns half-grid on.
 */
export interface DrawerFitSuggestion {
  width: GridUnits;
  depth: GridUnits;
  slackWidthMm: number;
  slackDepthMm: number;
  isHalf: boolean;
}

export interface DrawerFitInputs {
  updateDrawer: Mutations['updateDrawer'];
  setBaseplateParams: Mutations['setBaseplateParams'];
  halfGridMode: boolean;
  setHalfGridMode: (enabled: boolean) => unknown;
  gridUnitMm: number;
  gridUnitMmY: number;
  heightUnitMm: number;
  drawerWidth: GridUnits;
  drawerDepth: GridUnits;
  measuredMm: MeasuredDrawerMm | undefined;
  activeLayoutId: string;
}

interface TightestFit {
  readonly width: AxisFit;
  readonly depth: AxisFit;
  /** The whole-unit fit, or the half-unit one when half-grid is already on. */
  readonly plainWidth: AxisFit;
  readonly plainDepth: AxisFit;
  readonly isHalf: boolean;
}

/**
 * Tightest fit for a measured drawer, preferring a tighter half-unit grid when
 * half-grid is off. Accepting an `isHalf` fit also turns half-grid on.
 */
function tightestFit(
  measured: Pick<MeasuredDrawerMm, 'width' | 'depth'>,
  pitchX: number,
  pitchY: number,
  halfGridMode: boolean
): TightestFit {
  const plainWidth = fitAxisUnits(measured.width, pitchX, halfGridMode);
  const plainDepth = fitAxisUnits(measured.depth, pitchY, halfGridMode);
  const widthUpgrade = halfGridMode
    ? null
    : halfUnitUpgrade(measured.width, pitchX, plainWidth.units);
  const depthUpgrade = halfGridMode
    ? null
    : halfUnitUpgrade(measured.depth, pitchY, plainDepth.units);
  return {
    width: widthUpgrade ?? plainWidth,
    depth: depthUpgrade ?? plainDepth,
    plainWidth,
    plainDepth,
    isHalf: widthUpgrade !== null || depthUpgrade !== null,
  };
}

function suggestionFor(
  fit: TightestFit,
  drawerWidth: number,
  drawerDepth: number
): DrawerFitSuggestion | null {
  if (fit.width.units === drawerWidth && fit.depth.units === drawerDepth) return null;
  return {
    width: gridUnits(fit.width.units),
    depth: gridUnits(fit.depth.units),
    slackWidthMm: fit.width.slackMm,
    slackDepthMm: fit.depth.slackMm,
    isHalf: fit.isHalf,
  };
}

/**
 * The padding a drawer link split from whole-unit slack overflows the drawer
 * once a tighter grid lands, so the overflowing axes shrink the way the
 * baseplate panel's Fit padding to drawer does. Null when the plate still fits.
 */
function paddingThatFitsDrawer(layout: Layout): StoredBaseplateParams | null {
  const params = layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
  const measured = layout.drawer.measuredMm;
  if (measured === undefined || params.syncWithLayout === false) return null;
  const gridWidthMm = layout.drawer.width * layout.gridUnitMm;
  const gridDepthMm = layout.drawer.depth * effectiveGridUnitMmY(layout);
  const overflow = plateDrawerOverflow(
    gridWidthMm + params.paddingLeft + params.paddingRight,
    gridDepthMm + params.paddingFront + params.paddingBack,
    measured
  );
  if (overflow === null) return null;
  return { ...params, ...fitPaddingToDrawer(params, gridWidthMm, gridDepthMm, measured) };
}

export function useDrawerFitSuggestion({
  updateDrawer,
  setBaseplateParams,
  halfGridMode,
  setHalfGridMode,
  gridUnitMm,
  gridUnitMmY,
  heightUnitMm,
  drawerWidth,
  drawerDepth,
  measuredMm,
  activeLayoutId,
}: DrawerFitInputs) {
  const t = useTranslation();
  const addToast = useToastStore((state) => state.addToast);

  // The suggestion is anchored to the layout, drawer dims, AND grid pitch it was
  // computed against; the derived value below discards it the moment any drifts
  // (layout switch, undo, stepper edit, canvas drag-resize, or a pitch change),
  // so accepting can never apply unit counts derived at a different pitch — e.g.
  // 9.5 units fitted at 42mm would be the wrong physical size at 40mm.
  const [halfFit, setHalfFit] = useState<{
    suggestion: DrawerFitSuggestion;
    layoutId: string;
    baseWidth: number;
    baseDepth: number;
    basePitchX: number;
    basePitchY: number;
  } | null>(null);
  // Remembers a dismissed fit so re-committing the SAME measured drawer doesn't
  // re-nag. Keyed by layout + measured mm; cleared when the measurement is
  // cleared. A different measurement (or layout) offers the fit again.
  const [dismissedFit, setDismissedFit] = useState<{
    layoutId: string;
    widthMm: number;
    depthMm: number;
  } | null>(null);

  // Derived, not effect-cleared: the suggestion only renders while its
  // anchors still hold, so stale state simply stops showing (and is
  // replaced on the next commit).
  const committedSuggestion =
    halfFit !== null &&
    halfFit.layoutId === activeLayoutId &&
    halfFit.baseWidth === (drawerWidth as number) &&
    halfFit.baseDepth === (drawerDepth as number) &&
    halfFit.basePitchX === gridUnitMm &&
    halfFit.basePitchY === gridUnitMmY
      ? halfFit.suggestion
      : null;

  // A drawer link fits whole units only, so the tighter fit is offered from
  // the measurement it stored, under the same anchors as a commit's offer.
  const linkOffer = useDrawerFitOfferStore((state) => state.offer);
  const clearLinkOffer = useDrawerFitOfferStore((state) => state.clear);
  const linkSuggestion =
    linkOffer !== null &&
    measuredMm !== undefined &&
    linkOffer.layoutId === activeLayoutId &&
    linkOffer.width === (drawerWidth as number) &&
    linkOffer.depth === (drawerDepth as number) &&
    linkOffer.pitchX === gridUnitMm &&
    linkOffer.pitchY === gridUnitMmY
      ? suggestionFor(
          tightestFit(measuredMm, gridUnitMm, gridUnitMmY, halfGridMode),
          drawerWidth,
          drawerDepth
        )
      : null;

  const drawerFitSuggestion = committedSuggestion ?? linkSuggestion;

  // Measured-mm commit: record the measurement (and height) but LEAVE the grid
  // alone — resizing it silently surprised users. Instead, the tightest
  // physical fit (whole-unit, upgraded to half-units when that fits tighter and
  // half-grid is off) is offered as an opt-in suggestion the user applies from
  // the card. Height is a drawer property, not a grid-unit count, so it still
  // commits directly.
  const handleMeasuredCommit = useCallback(
    (widthMm: number, depthMm: number, heightMm?: number) => {
      const measured: MeasuredDrawerMm = {
        width: widthMm,
        depth: depthMm,
        ...(heightMm !== undefined ? { height: heightMm } : {}),
      };
      const heightUnitsValue =
        heightMm !== undefined
          ? (measuredHeightUnits(heightMm, heightUnitMm) as HeightUnits)
          : undefined;

      batch(() =>
        updateDrawer({
          ...(heightUnitsValue !== undefined ? { height: heightUnitsValue } : {}),
          measuredMm: measured,
        })
      );

      const fit = tightestFit(measured, gridUnitMm, gridUnitMmY, halfGridMode);
      const alreadyDismissed =
        dismissedFit !== null &&
        dismissedFit.layoutId === activeLayoutId &&
        dismissedFit.widthMm === widthMm &&
        dismissedFit.depthMm === depthMm;
      const suggestion = alreadyDismissed ? null : suggestionFor(fit, drawerWidth, drawerDepth);
      clearLinkOffer();

      setHalfFit(
        suggestion === null
          ? null
          : {
              suggestion,
              layoutId: activeLayoutId,
              baseWidth: drawerWidth,
              baseDepth: drawerDepth,
              basePitchX: gridUnitMm,
              basePitchY: gridUnitMmY,
            }
      );

      trackDrawerMeasuredCommitted({
        slack_width_mm: fit.plainWidth.slackMm,
        slack_depth_mm: fit.plainDepth.slackMm,
        half_fit_offered: suggestion !== null && fit.isHalf,
        has_height: heightMm !== undefined,
      });
    },
    [
      gridUnitMm,
      gridUnitMmY,
      halfGridMode,
      heightUnitMm,
      updateDrawer,
      activeLayoutId,
      drawerWidth,
      drawerDepth,
      dismissedFit,
      clearLinkOffer,
    ]
  );

  const acceptDrawerFitSuggestion = useCallback(() => {
    if (drawerFitSuggestion === null) return;
    if (drawerFitSuggestion.isHalf) setHalfGridMode(true);
    batch(() => {
      updateDrawer({ width: drawerFitSuggestion.width, depth: drawerFitSuggestion.depth });
      const fitted = paddingThatFitsDrawer(useLayoutStore.getState().layout);
      if (fitted !== null) setBaseplateParams(fitted);
    });
    // A custom shape floors the size, so the fit may land clamped —
    // say so instead of dismissing the card as if the fit applied.
    const landed = useLayoutStore.getState().layout.drawer;
    if (landed.width !== drawerFitSuggestion.width || landed.depth !== drawerFitSuggestion.depth) {
      addToast(t('toast.drawerSizeLimitedByShape'), 'info');
    }
    setHalfFit(null);
    clearLinkOffer();
    trackDrawerHalfFitSuggestion('accepted');
  }, [
    drawerFitSuggestion,
    setHalfGridMode,
    updateDrawer,
    setBaseplateParams,
    addToast,
    t,
    clearLinkOffer,
  ]);

  const dismissDrawerFitSuggestion = useCallback(() => {
    setHalfFit(null);
    clearLinkOffer();
    if (measuredMm !== undefined) {
      setDismissedFit({
        layoutId: activeLayoutId,
        widthMm: measuredMm.width,
        depthMm: measuredMm.depth,
      });
    }
    trackDrawerHalfFitSuggestion('dismissed');
  }, [measuredMm, activeLayoutId, clearLinkOffer]);

  const clearMeasurement = useCallback(() => {
    batch(() => updateDrawer({ measuredMm: null }));
    setHalfFit(null);
    setDismissedFit(null);
    clearLinkOffer();
    trackDrawerMeasurementCleared();
  }, [updateDrawer, clearLinkOffer]);

  return {
    drawerFitSuggestion,
    handleMeasuredCommit,
    acceptDrawerFitSuggestion,
    dismissDrawerFitSuggestion,
    clearMeasurement,
  };
}
