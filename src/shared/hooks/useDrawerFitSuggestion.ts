/**
 * The opt-in grid fit offered after a measured-mm drawer commit. Owns the
 * suggestion and its dismissal memory; the grid itself never resizes here.
 */
import { useState, useCallback } from 'react';
import { batch } from '@/core/cqrs';
import { useLayoutStore, useToastStore } from '@/core/store';
import type { useMutations } from '@/shared/contexts';
import { CONSTRAINTS } from '@/core/constants';
import { fitAxisUnits, halfUnitUpgrade } from '@/shared/utils/drawerFit';
import {
  trackDrawerHalfFitSuggestion,
  trackDrawerMeasuredCommitted,
  trackDrawerMeasurementCleared,
} from '@/shared/analytics/posthog';
import type { GridUnits, HeightUnits, MeasuredDrawerMm } from '@/core/types';
import { gridUnits } from '@/core/types';
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
  updateDrawer: ReturnType<typeof useMutations>['updateDrawer'];
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

export function useDrawerFitSuggestion({
  updateDrawer,
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
  const drawerFitSuggestion =
    halfFit !== null &&
    halfFit.layoutId === activeLayoutId &&
    halfFit.baseWidth === (drawerWidth as number) &&
    halfFit.baseDepth === (drawerDepth as number) &&
    halfFit.basePitchX === gridUnitMm &&
    halfFit.basePitchY === gridUnitMmY
      ? halfFit.suggestion
      : null;

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
      // Floor at the 0.01-unit height resolution (mmToHeightUnits rounds,
      // which could exceed the measured drawer by a hair). The floor clamp
      // must match drawerUpdateSchema's MIN_LAYER_HEIGHT or validation
      // silently rejects the whole command, measurement included.
      const heightUnitsValue =
        heightMm !== undefined
          ? (Math.max(
              CONSTRAINTS.MIN_LAYER_HEIGHT,
              Math.min(
                CONSTRAINTS.GRID_MAX,
                Math.floor((heightMm / heightUnitMm) * 100 + 1e-6) / 100
              )
            ) as HeightUnits)
          : undefined;

      batch(() =>
        updateDrawer({
          ...(heightUnitsValue !== undefined ? { height: heightUnitsValue } : {}),
          measuredMm: measured,
        })
      );

      // Tightest fit for this drawer, preferring a tighter half-unit grid when
      // half-grid is off. Accepting an `isHalf` fit also turns half-grid on.
      const widthFit = fitAxisUnits(widthMm, gridUnitMm, halfGridMode);
      const depthFit = fitAxisUnits(depthMm, gridUnitMmY, halfGridMode);
      const widthUpgrade = halfGridMode
        ? null
        : halfUnitUpgrade(widthMm, gridUnitMm, widthFit.units);
      const depthUpgrade = halfGridMode
        ? null
        : halfUnitUpgrade(depthMm, gridUnitMmY, depthFit.units);
      const isHalf = widthUpgrade !== null || depthUpgrade !== null;
      const fitWidth = widthUpgrade ?? widthFit;
      const fitDepth = depthUpgrade ?? depthFit;

      const differsFromGrid =
        fitWidth.units !== (drawerWidth as number) || fitDepth.units !== (drawerDepth as number);
      const alreadyDismissed =
        dismissedFit !== null &&
        dismissedFit.layoutId === activeLayoutId &&
        dismissedFit.widthMm === widthMm &&
        dismissedFit.depthMm === depthMm;

      const suggestion: DrawerFitSuggestion | null =
        differsFromGrid && !alreadyDismissed
          ? {
              width: gridUnits(fitWidth.units),
              depth: gridUnits(fitDepth.units),
              slackWidthMm: fitWidth.slackMm,
              slackDepthMm: fitDepth.slackMm,
              isHalf,
            }
          : null;

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
        slack_width_mm: widthFit.slackMm,
        slack_depth_mm: depthFit.slackMm,
        half_fit_offered: suggestion !== null && isHalf,
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
    ]
  );

  const acceptDrawerFitSuggestion = useCallback(() => {
    if (drawerFitSuggestion === null) return;
    if (drawerFitSuggestion.isHalf) setHalfGridMode(true);
    batch(() =>
      updateDrawer({ width: drawerFitSuggestion.width, depth: drawerFitSuggestion.depth })
    );
    // A custom shape floors the size, so the fit may land clamped —
    // say so instead of dismissing the card as if the fit applied.
    const landed = useLayoutStore.getState().layout.drawer;
    if (landed.width !== drawerFitSuggestion.width || landed.depth !== drawerFitSuggestion.depth) {
      addToast(t('toast.drawerSizeLimitedByShape'), 'info');
    }
    setHalfFit(null);
    trackDrawerHalfFitSuggestion('accepted');
  }, [drawerFitSuggestion, setHalfGridMode, updateDrawer, addToast, t]);

  const dismissDrawerFitSuggestion = useCallback(() => {
    setHalfFit(null);
    if (measuredMm !== undefined) {
      setDismissedFit({
        layoutId: activeLayoutId,
        widthMm: measuredMm.width,
        depthMm: measuredMm.depth,
      });
    }
    trackDrawerHalfFitSuggestion('dismissed');
  }, [measuredMm, activeLayoutId]);

  const clearMeasurement = useCallback(() => {
    batch(() => updateDrawer({ measuredMm: null }));
    setHalfFit(null);
    setDismissedFit(null);
    trackDrawerMeasurementCleared();
  }, [updateDrawer]);

  return {
    drawerFitSuggestion,
    handleMeasuredCommit,
    acceptDrawerFitSuggestion,
    dismissDrawerFitSuggestion,
    clearMeasurement,
  };
}
