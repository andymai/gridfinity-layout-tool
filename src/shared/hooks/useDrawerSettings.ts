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
import { validateHalfGridModeToggle } from '@/shared/utils/halfGridConstraints';
import type { HalfGridConstraintViolation } from '@/shared/utils/halfGridConstraints';
import { fitAxisUnits, halfUnitUpgrade } from '@/shared/utils/drawerFit';
import {
  trackDrawerHalfFitSuggestion,
  trackDrawerMeasuredCommitted,
  trackDrawerMeasurementCleared,
} from '@/shared/analytics/posthog';
import type { STLSearchSite, UserSettings } from '@/core/store/settings';
import type { Category, GridUnits, HeightUnits, MeasuredDrawerMm } from '@/core/types';
import { binId as toBinId, gridUnits, mm, mmToHeightUnits } from '@/core/types';
import { isOk, isErr } from '@/core/result';
import { useTranslation } from '@/i18n';

/**
 * Return type for useDrawerSettings hook.
 * Provides all drawer-related state and handlers needed by settings panels.
 */
/** A tighter half-unit fit offered after a measured-mm commit. */
export interface HalfFitSuggestion {
  width: GridUnits;
  depth: GridUnits;
  slackWidthMm: number;
  slackDepthMm: number;
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
  halfFitSuggestion: HalfFitSuggestion | null;
  handleMeasuredCommit: (widthMm: number, depthMm: number, heightMm?: number) => void;
  acceptHalfFitSuggestion: () => void;
  dismissHalfFitSuggestion: () => void;
  clearMeasurement: () => void;

  // Computed values
  widthStep: number;
  depthStep: number;
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
  setGridUnitMm: (value: number) => void;
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
  // The suggestion is anchored to the layout and drawer dims it was computed
  // against; the effect below discards it the moment either drifts (layout
  // switch, undo, stepper edit, canvas drag-resize), so accepting can never
  // apply units derived from a different measurement.
  const [halfFit, setHalfFit] = useState<{
    suggestion: HalfFitSuggestion;
    layoutId: string;
    baseWidth: number;
    baseDepth: number;
  } | null>(null);

  // Layout store selectors
  const {
    layout,
    gridUnitMm,
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
  const halfFitSuggestion =
    halfFit !== null &&
    halfFit.layoutId === activeLayoutId &&
    halfFit.baseWidth === (drawerWidth as number) &&
    halfFit.baseDepth === (drawerDepth as number)
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
  const { setGridUnitMm, setHeightUnitMm, setPrintBedSize, updateDrawer, updateBin } =
    useMutations();

  // Undo support

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
  const maxGridUnits = calcMaxGridUnits(printBedSize, gridUnitMm, printBedDepth);

  const realWorldDimensions = useMemo(
    () => ({
      width: drawerWidth * gridUnitMm,
      depth: drawerDepth * gridUnitMm,
      height: drawerHeight * heightUnitMm,
    }),
    [drawerWidth, drawerDepth, drawerHeight, gridUnitMm, heightUnitMm]
  );
  // Stepper handlers (delta-based, respects step size)
  const handleDrawerWidthChange = useCallback(
    (delta: number) => {
      const newWidth = Math.max(
        0.5,
        Math.min(CONSTRAINTS.GRID_MAX, drawerWidth + delta * widthStep)
      ) as GridUnits;
      batch(() => updateDrawer({ width: newWidth }));
    },
    [widthStep, drawerWidth, updateDrawer]
  );

  const handleDrawerDepthChange = useCallback(
    (delta: number) => {
      const newDepth = Math.max(
        0.5,
        Math.min(CONSTRAINTS.GRID_MAX, drawerDepth + delta * depthStep)
      ) as GridUnits;
      batch(() => updateDrawer({ depth: newDepth }));
    },
    [depthStep, drawerDepth, updateDrawer]
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
      const snapped = gridUnits(snapToHalf(Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, width))));
      batch(() => updateDrawer({ width: snapped }));
      if (isFractional(snapped) && !halfGridMode) {
        setHalfGridMode(true);
        addToast(t('toast.halfBinModeAutoEnabled'), 'info');
      }
    },
    [updateDrawer, halfGridMode, setHalfGridMode, addToast, t]
  );

  const handleDrawerDepthInput = useCallback(
    (depth: number) => {
      const snapped = gridUnits(snapToHalf(Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, depth))));
      batch(() => updateDrawer({ depth: snapped }));
      if (isFractional(snapped) && !halfGridMode) {
        setHalfGridMode(true);
        addToast(t('toast.halfBinModeAutoEnabled'), 'info');
      }
    },
    [updateDrawer, halfGridMode, setHalfGridMode, addToast, t]
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

  // Measured-mm commit: fit the largest grid that physically fits (floor,
  // never round up), persist the measurement, and offer a tighter half-unit
  // fit instead of silently flipping half-grid mode on.
  const handleMeasuredCommit = useCallback(
    (widthMm: number, depthMm: number, heightMm?: number) => {
      const widthFit = fitAxisUnits(widthMm, gridUnitMm, halfGridMode);
      const depthFit = fitAxisUnits(depthMm, gridUnitMm, halfGridMode);
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
          width: gridUnits(widthFit.units),
          depth: gridUnits(depthFit.units),
          ...(heightUnitsValue !== undefined ? { height: heightUnitsValue } : {}),
          measuredMm: measured,
        })
      );

      let suggestion: HalfFitSuggestion | null = null;
      if (!halfGridMode) {
        const widthUpgrade = halfUnitUpgrade(widthMm, gridUnitMm, widthFit.units);
        const depthUpgrade = halfUnitUpgrade(depthMm, gridUnitMm, depthFit.units);
        if (widthUpgrade !== null || depthUpgrade !== null) {
          suggestion = {
            width: gridUnits((widthUpgrade ?? widthFit).units),
            depth: gridUnits((depthUpgrade ?? depthFit).units),
            slackWidthMm: (widthUpgrade ?? widthFit).slackMm,
            slackDepthMm: (depthUpgrade ?? depthFit).slackMm,
          };
        }
      }
      setHalfFit(
        suggestion === null
          ? null
          : {
              suggestion,
              layoutId: activeLayoutId,
              baseWidth: widthFit.units,
              baseDepth: depthFit.units,
            }
      );

      trackDrawerMeasuredCommitted({
        slack_width_mm: widthFit.slackMm,
        slack_depth_mm: depthFit.slackMm,
        half_fit_offered: suggestion !== null,
        has_height: heightMm !== undefined,
      });
    },
    [gridUnitMm, halfGridMode, heightUnitMm, updateDrawer, activeLayoutId]
  );

  const acceptHalfFitSuggestion = useCallback(() => {
    if (halfFitSuggestion === null) return;
    setHalfGridMode(true);
    batch(() => updateDrawer({ width: halfFitSuggestion.width, depth: halfFitSuggestion.depth }));
    setHalfFit(null);
    trackDrawerHalfFitSuggestion('accepted');
  }, [halfFitSuggestion, setHalfGridMode, updateDrawer]);

  const dismissHalfFitSuggestion = useCallback(() => {
    setHalfFit(null);
    trackDrawerHalfFitSuggestion('dismissed');
  }, []);

  const clearMeasurement = useCallback(() => {
    batch(() => updateDrawer({ measuredMm: null }));
    setHalfFit(null);
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
      setHeightUnitMm(CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT);
    });
  }, [setGridUnitMm, setHeightUnitMm]);

  // Save current categories as defaults
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
    halfFitSuggestion,
    handleMeasuredCommit,
    acceptHalfFitSuggestion,
    dismissHalfFitSuggestion,
    clearMeasurement,

    // Computed values
    widthStep,
    depthStep,
    hasFractionalWidth,
    hasFractionalDepth,
    realWorldDimensions,
    maxGridUnits,

    // Physical units
    gridUnitMm,
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
    setGridUnitMm,
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
