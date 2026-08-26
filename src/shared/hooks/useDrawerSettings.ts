import { useState, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { batch } from '@/core/cqrs';
import {
  useLayoutStore,
  useLibraryStore,
  useSettingsStore,
  useToastStore,
  useSelectionStore,
  useHalfGridModeStore,
} from '@/core/store';
import { useMutations } from '@/shared/contexts';
import {
  calcMaxGridUnits,
  CONSTRAINTS,
  STAGING_ID,
  snapToHalf,
  isFractional,
} from '@/core/constants';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { baseplateFloorDepth } from '@/shared/printSettings/baseplateHeight';
import { validateHalfGridModeToggle } from '@/shared/utils/halfGridConstraints';
import type { HalfGridConstraintViolation } from '@/shared/utils/halfGridConstraints';
import { fitAxisUnits, halfUnitUpgrade } from '@/shared/utils/drawerFit';
import { drawerSizeFloors } from '@/shared/utils/drawerOutline';
import {
  trackDrawerHalfFitSuggestion,
  trackDrawerMeasuredCommitted,
  trackDrawerMeasurementCleared,
} from '@/shared/analytics/posthog';
import type { STLSearchSite, UserSettings } from '@/core/store/settings';
import type { Category, GridUnits, HeightUnits, MeasuredDrawerMm } from '@/core/types';
import {
  binId as toBinId,
  effectiveGridUnitMmY,
  gridUnits,
  mm,
  mmToHeightUnits,
} from '@/core/types';
import { isOk, isErr } from '@/core/result';
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

export interface UseDrawerSettingsReturn {
  // Drawer dimensions
  drawer: {
    width: number;
    depth: number;
    height: number;
  };
  fractionalEdges: {
    x: 'start' | 'end';
    y: 'start' | 'end';
  };

  // Measured physical drawer (mm-first entry)
  measuredMm: MeasuredDrawerMm | undefined;
  /**
   * Solid material the baseplate puts under a seated stack (its floor depth).
   * The height budget any ceiling comparison uses is `measured − this`, the
   * same charge `drawerCeilingFit` applies per column.
   */
  plateRiseMm: number;
  drawerFitSuggestion: DrawerFitSuggestion | null;
  handleMeasuredCommit: (widthMm: number, depthMm: number, heightMm?: number) => void;
  acceptDrawerFitSuggestion: () => void;
  dismissDrawerFitSuggestion: () => void;
  clearMeasurement: () => void;

  // Computed values
  widthStep: number;
  depthStep: number;
  /** Size floor set by the custom drawer shape, 0.5 without one. */
  drawerMinWidth: number;
  drawerMinDepth: number;
  hasFractionalWidth: boolean;
  hasFractionalDepth: boolean;
  realWorldDimensions: {
    width: number;
    depth: number;
    height: number;
  };
  maxGridUnits: { width: number; depth: number };

  // Physical units
  gridUnitMm: number;
  /** Resolved depth-axis (Y) pitch — equals gridUnitMm for a square grid. */
  gridUnitMmY: number;
  heightUnitMm: number;
  printBedSize: number;
  printBedDepth: number;

  // Half-bin mode
  halfGridMode: boolean;

  // Settings (for display)
  settings: UserSettings;
  activeLayerHeight: number;

  // Dimension change handlers (for stepper buttons)
  handleDrawerWidthChange: (delta: number) => void;
  handleDrawerDepthChange: (delta: number) => void;
  handleDrawerHeightChange: (delta: number) => void;

  // Direct input handlers (for number inputs)
  handleDrawerHeightInput: (heightMm: number) => void;
  handleDrawerWidthInput: (value: number) => void;
  handleDrawerDepthInput: (value: number) => void;

  // Fractional edge position handler
  handleFractionalEdgeChange: (axis: 'x' | 'y', edge: 'start' | 'end') => void;

  // Half-bin mode handlers
  handleHalfBinToggle: () => void;
  handleRemediate: () => void;

  // Save defaults handler
  handleSaveDefaults: () => void;

  // Physical unit handlers
  /** Set the grid pitch — `y` undefined means a square grid (clears the Y pitch). */
  handleGridUnitChange: (x: number, y?: number) => void;
  setHeightUnitMm: (value: number) => void;
  setPrintBedSize: (value: number, depth?: number) => void;
  resetGridfinityStandard: () => void;

  // STL site toggle
  toggleSTLSite: (siteId: string) => void;

  showSaveDefaultsConfirm: boolean;
  setShowSaveDefaultsConfirm: (show: boolean) => void;
  showHalfBinBlockedModal: boolean;
  setShowHalfBinBlockedModal: (show: boolean) => void;
  halfBinViolation: HalfGridConstraintViolation | null;

  // Category defaults
  currentCategories: Category[];
  hasCustomCategoryDefaults: boolean;
  showSaveCategoriesConfirm: boolean;
  setShowSaveCategoriesConfirm: (show: boolean) => void;
  handleSaveCategoriesAsDefaults: () => void;
}

/**
 * Hook that encapsulates all drawer settings logic.
 *
 * Consolidates duplicated logic between Sidebar and MobileSettingsPanel:
 * - Drawer dimension controls with half-bin mode awareness
 * - Fractional edge position management
 * - Half-bin mode toggle with validation and remediation
 * - Physical unit settings (grid unit, height unit, print bed)
 * - Save as defaults functionality
 * - STL search site toggle
 *
 * @example
 * ```tsx
 * function MySettingsPanel() {
 *   const {
 *     drawer,
 *     handleDrawerWidthChange,
 *     halfGridMode,
 *     handleHalfBinToggle,
 *     ...
 *   } = useDrawerSettings();
 *
 *   return (
 *     <div>
 *       <button onClick={() => handleDrawerWidthChange(1)}>+</button>
 *       <span>{drawer.width}</span>
 *       <button onClick={() => handleDrawerWidthChange(-1)}>-</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDrawerSettings(): UseDrawerSettingsReturn {
  const t = useTranslation();

  const [showSaveDefaultsConfirm, setShowSaveDefaultsConfirm] = useState(false);
  const [showHalfBinBlockedModal, setShowHalfBinBlockedModal] = useState(false);
  const [halfBinViolation, setHalfBinViolation] = useState<HalfGridConstraintViolation | null>(
    null
  );
  const [showSaveCategoriesConfirm, setShowSaveCategoriesConfirm] = useState(false);
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

  // Layout store selectors
  const {
    layout,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    printBedSize,
    printBedDepth,
    drawerWidth,
    drawerDepth,
    drawerHeight,
    fractionalEdgeX,
    fractionalEdgeY,
    measuredMm,
  } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      gridUnitMm: state.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(state.layout),
      heightUnitMm: state.layout.heightUnitMm,
      printBedSize: state.layout.printBedSize,
      printBedDepth: state.layout.printBedDepth ?? state.layout.printBedSize,
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      drawerHeight: state.layout.drawer.height,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
      measuredMm: state.layout.drawer.measuredMm,
    }))
  );

  // Half-bin mode store selectors
  const { halfGridMode, toggleHalfGridMode, setHalfGridMode } = useHalfGridModeStore(
    useShallow((state) => ({
      halfGridMode: state.halfGridMode,
      toggleHalfGridMode: state.toggleHalfGridMode,
      setHalfGridMode: state.setHalfGridMode,
    }))
  );

  // Selection store selectors
  const activeLayerId = useSelectionStore((state) => state.activeLayerId);
  const activeLayoutId = useLibraryStore((state) => state.library.activeLayoutId);

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

  const { settings, saveCurrentAsDefaults, saveCategoriesAsDefaults, updateSetting } =
    useSettingsStore(
      useShallow((state) => ({
        settings: state.settings,
        saveCurrentAsDefaults: state.saveCurrentAsDefaults,
        saveCategoriesAsDefaults: state.saveCategoriesAsDefaults,
        updateSetting: state.updateSetting,
      }))
    );

  const addToast = useToastStore((state) => state.addToast);

  // Mutations (supports collaborative mode)
  const {
    setGridUnitMm,
    setGridUnitMmY,
    setHeightUnitMm,
    setPrintBedSize,
    updateDrawer,
    updateBin,
  } = useMutations();

  // Derive layers/categories from the `layout` already selected in the
  // useShallow above. Prior code opened two additional bare subscriptions
  // to the same store, which signaled "changed" on every layout mutation
  // (each array gets a new reference from Immer) and wasted React work on
  // large layouts.
  const layers = layout.layers;
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId),
    [layers, activeLayerId]
  );
  const activeLayerHeight = activeLayer?.height ?? 3;

  // Current categories from the same selected layout (no separate subscription)
  const currentCategories = layout.categories;
  const hasCustomCategoryDefaults = settings.defaultCategories !== null;

  // Computed values
  const hasFractionalWidth = drawerWidth % 1 !== 0;
  const hasFractionalDepth = drawerDepth % 1 !== 0;
  const widthStep = halfGridMode || hasFractionalWidth ? 0.5 : 1;
  const depthStep = halfGridMode || hasFractionalDepth ? 0.5 : 1;
  const maxGridUnits = calcMaxGridUnits(printBedSize, gridUnitMm, printBedDepth, gridUnitMmY);

  // A custom drawer shape floors the size (the command clamps rather
  // than crop the shape); exposing the floor lets the steppers bound their
  // range so the "−" button disables instead of silently doing nothing.
  // A recorded measurement that already holds the shape releases the floor —
  // the grid is then free to shrink inside the perimeter.
  const drawerOutline = layout.drawer.outline;
  const drawerMeasuredMm = layout.drawer.measuredMm;
  const { width: drawerMinWidth, depth: drawerMinDepth } = useMemo(
    () =>
      drawerSizeFloors(
        { outline: drawerOutline, measuredMm: drawerMeasuredMm },
        gridUnitMm,
        gridUnitMmY
      ),
    [drawerOutline, drawerMeasuredMm, gridUnitMm, gridUnitMmY]
  );

  const realWorldDimensions = useMemo(
    () => ({
      width: drawerWidth * gridUnitMm,
      depth: drawerDepth * gridUnitMmY,
      height: drawerHeight * heightUnitMm,
    }),
    [drawerWidth, drawerDepth, drawerHeight, gridUnitMm, gridUnitMmY, heightUnitMm]
  );
  // Stepper handlers (delta-based, respects step size)
  const handleDrawerWidthChange = useCallback(
    (delta: number) => {
      const newWidth = Math.max(
        drawerMinWidth,
        Math.min(CONSTRAINTS.GRID_MAX, drawerWidth + delta * widthStep)
      ) as GridUnits;
      batch(() => updateDrawer({ width: newWidth }));
    },
    [widthStep, drawerWidth, drawerMinWidth, updateDrawer]
  );

  const handleDrawerDepthChange = useCallback(
    (delta: number) => {
      const newDepth = Math.max(
        drawerMinDepth,
        Math.min(CONSTRAINTS.GRID_MAX, drawerDepth + delta * depthStep)
      ) as GridUnits;
      batch(() => updateDrawer({ depth: newDepth }));
    },
    [depthStep, drawerDepth, drawerMinDepth, updateDrawer]
  );

  const handleDrawerHeightChange = useCallback(
    (delta: number) => {
      const newHeight = Math.max(
        1,
        Math.min(CONSTRAINTS.GRID_MAX, drawerHeight + delta)
      ) as HeightUnits;
      batch(() => updateDrawer({ height: newHeight }));
    },
    [drawerHeight, updateDrawer]
  );

  // Direct input handlers (for number inputs)
  const handleDrawerHeightInput = useCallback(
    (heightMm: number) => {
      const units = mmToHeightUnits(mm(heightMm), heightUnitMm);
      const clamped = Math.max(1, Math.min(CONSTRAINTS.GRID_MAX, units)) as HeightUnits;
      batch(() => updateDrawer({ height: clamped }));
    },
    [heightUnitMm, updateDrawer]
  );

  const handleDrawerWidthInput = useCallback(
    (width: number) => {
      const snapped = gridUnits(
        snapToHalf(Math.max(drawerMinWidth, Math.min(CONSTRAINTS.GRID_MAX, width)))
      );
      batch(() => updateDrawer({ width: snapped }));
      if (isFractional(snapped) && !halfGridMode) {
        setHalfGridMode(true);
        addToast(t('toast.halfBinModeAutoEnabled'), 'info');
      }
    },
    [updateDrawer, drawerMinWidth, halfGridMode, setHalfGridMode, addToast, t]
  );

  const handleDrawerDepthInput = useCallback(
    (depth: number) => {
      const snapped = gridUnits(
        snapToHalf(Math.max(drawerMinDepth, Math.min(CONSTRAINTS.GRID_MAX, depth)))
      );
      batch(() => updateDrawer({ depth: snapped }));
      if (isFractional(snapped) && !halfGridMode) {
        setHalfGridMode(true);
        addToast(t('toast.halfBinModeAutoEnabled'), 'info');
      }
    },
    [updateDrawer, drawerMinDepth, halfGridMode, setHalfGridMode, addToast, t]
  );

  // Fractional edge position handler
  const handleFractionalEdgeChange = useCallback(
    (axis: 'x' | 'y', edge: 'start' | 'end') => {
      if (axis === 'x') {
        batch(() => updateDrawer({ fractionalEdgeX: edge }));
      } else {
        batch(() => updateDrawer({ fractionalEdgeY: edge }));
      }
    },
    [updateDrawer]
  );

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

  // Half-bin mode toggle with validation
  const handleHalfBinToggle = useCallback(() => {
    const result = toggleHalfGridMode();

    if (!isOk(result)) {
      // Validation failed - show blocking modal
      const validationResult = validateHalfGridModeToggle(layout, false);
      if (validationResult.violation) {
        setHalfBinViolation(validationResult.violation);
        setShowHalfBinBlockedModal(true);
      }
    }
  }, [toggleHalfGridMode, layout]);

  // Remediate fractional bins by moving them to staging
  const handleRemediate = useCallback(() => {
    if (!halfBinViolation) return;

    let movedCount = 0;
    batch(() => {
      // Move all fractional bins to staging (skip already-deleted bins)
      for (const id of halfBinViolation.binIds) {
        const result = updateBin(toBinId(id), { layerId: STAGING_ID });
        if (isErr(result)) continue;
        movedCount++;
      }
    });

    // Now disable half-bin mode (forced, bypassing validation)
    setHalfGridMode(false);

    // Close modal and show success message
    setShowHalfBinBlockedModal(false);
    addToast(t('halfBinMode.toast.movedToStaging', { count: movedCount }), 'success');
  }, [halfBinViolation, updateBin, setHalfGridMode, addToast, t]);

  // Save current settings as defaults
  const handleSaveDefaults = useCallback(() => {
    saveCurrentAsDefaults(
      { width: drawerWidth, depth: drawerDepth, height: drawerHeight },
      printBedSize,
      gridUnitMm,
      heightUnitMm,
      activeLayerHeight,
      printBedDepth !== printBedSize ? printBedDepth : undefined
    );
    setShowSaveDefaultsConfirm(false);
  }, [
    saveCurrentAsDefaults,
    drawerWidth,
    drawerDepth,
    drawerHeight,
    printBedSize,
    printBedDepth,
    gridUnitMm,
    heightUnitMm,
    activeLayerHeight,
  ]);

  const resetGridfinityStandard = useCallback(() => {
    batch(() => {
      setGridUnitMm(CONSTRAINTS.GRID_UNIT_MM_DEFAULT);
      // Standard Gridfinity is square — a lingering Y pitch must reset too.
      setGridUnitMmY(null);
      setHeightUnitMm(CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT);
    });
  }, [setGridUnitMm, setGridUnitMmY, setHeightUnitMm]);

  // Linked grid-pitch control: y === undefined means a square grid (clears the
  // stored Y pitch). Each write is guarded so a no-op edit (e.g. re-committing
  // the linked X input) emits no undo/analytics events; batched so an X+Y edit
  // is one undo step.
  const handleGridUnitChange = useCallback(
    (x: number, y?: number) => {
      const current = useLayoutStore.getState().layout;
      const xChanged = x !== (current.gridUnitMm as number);
      const yChanged = y !== (current.gridUnitMmY as number | undefined);
      if (!xChanged && !yChanged) return;
      batch(() => {
        if (xChanged) setGridUnitMm(x);
        if (yChanged) setGridUnitMmY(y ?? null);
      });
    },
    [setGridUnitMm, setGridUnitMmY]
  );

  const handleSaveCategoriesAsDefaults = useCallback(() => {
    saveCategoriesAsDefaults(currentCategories);
    setShowSaveCategoriesConfirm(false);
    addToast(t('toast.categoriesSavedAsDefaults'), 'success');
  }, [saveCategoriesAsDefaults, currentCategories, addToast, t]);

  // STL search site toggle
  const toggleSTLSite = useCallback(
    (siteId: string) => {
      const updatedSites = settings.stlSearchSites.map((site: STLSearchSite) =>
        site.id === siteId ? { ...site, enabled: !site.enabled } : site
      );
      updateSetting('stlSearchSites', updatedSites);
    },
    [settings.stlSearchSites, updateSetting]
  );

  return {
    // Drawer dimensions
    drawer: {
      width: drawerWidth,
      depth: drawerDepth,
      height: drawerHeight,
    },
    fractionalEdges: {
      x: fractionalEdgeX,
      y: fractionalEdgeY,
    },

    // Measured physical drawer
    measuredMm,
    plateRiseMm: baseplateFloorDepth(layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS),
    drawerFitSuggestion,
    handleMeasuredCommit,
    acceptDrawerFitSuggestion,
    dismissDrawerFitSuggestion,
    clearMeasurement,

    // Computed values
    widthStep,
    depthStep,
    drawerMinWidth,
    drawerMinDepth,
    hasFractionalWidth,
    hasFractionalDepth,
    realWorldDimensions,
    maxGridUnits,

    // Physical units
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    printBedSize,
    printBedDepth,

    // Half-bin mode
    halfGridMode,

    settings,
    activeLayerHeight,

    // Handlers
    handleDrawerWidthChange,
    handleDrawerDepthChange,
    handleDrawerHeightChange,
    handleDrawerHeightInput,
    handleDrawerWidthInput,
    handleDrawerDepthInput,
    handleFractionalEdgeChange,
    handleHalfBinToggle,
    handleRemediate,
    handleSaveDefaults,
    handleGridUnitChange,
    setHeightUnitMm,
    setPrintBedSize,
    resetGridfinityStandard,
    toggleSTLSite,

    showSaveDefaultsConfirm,
    setShowSaveDefaultsConfirm,
    showHalfBinBlockedModal,
    setShowHalfBinBlockedModal,
    halfBinViolation,

    // Category defaults
    currentCategories,
    hasCustomCategoryDefaults,
    showSaveCategoriesConfirm,
    setShowSaveCategoriesConfirm,
    handleSaveCategoriesAsDefaults,
  };
}
