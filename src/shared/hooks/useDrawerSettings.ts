import { useState, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { batch } from '@/core/cqrs';
import {
  useLayoutStore,
  useSettingsStore,
  useToastStore,
  useSelectionStore,
  useHalfBinModeStore,
} from '@/core/store';
import { useMutations } from '@/shared/contexts';
import {
  calcMaxGridUnits,
  CONSTRAINTS,
  STAGING_ID,
  snapToHalf,
  isFractional,
} from '@/core/constants';
import { validateHalfBinModeToggle } from '@/shared/utils/halfBinConstraints';
import type { HalfBinConstraintViolation } from '@/shared/utils/halfBinConstraints';
import type { STLSearchSite, UserSettings } from '@/core/store/settings';
import type { Category, GridUnits, HeightUnits } from '@/core/types';
import { binId as toBinId, gridUnits } from '@/core/types';
import { isOk, isErr } from '@/core/result';
import { useTranslation } from '@/i18n';

/**
 * Return type for useDrawerSettings hook.
 * Provides all drawer-related state and handlers needed by settings panels.
 */
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
  maxGridUnits: number;

  // Physical units
  gridUnitMm: number;
  heightUnitMm: number;
  printBedSize: number;

  // Half-bin mode
  halfBinMode: boolean;

  // Settings (for display)
  settings: UserSettings;
  activeLayerHeight: number;

  // Dimension change handlers (for stepper buttons)
  handleDrawerWidthChange: (delta: number) => void;
  handleDrawerDepthChange: (delta: number) => void;
  handleDrawerHeightChange: (delta: number) => void;

  // Direct input handlers (for number inputs)
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
  setPrintBedSize: (value: number) => void;

  // STL site toggle
  toggleSTLSite: (siteId: string) => void;

  showSaveDefaultsConfirm: boolean;
  setShowSaveDefaultsConfirm: (show: boolean) => void;
  showHalfBinBlockedModal: boolean;
  setShowHalfBinBlockedModal: (show: boolean) => void;
  halfBinViolation: HalfBinConstraintViolation | null;

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
 *     halfBinMode,
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
  const [halfBinViolation, setHalfBinViolation] = useState<HalfBinConstraintViolation | null>(null);
  const [showSaveCategoriesConfirm, setShowSaveCategoriesConfirm] = useState(false);

  // Layout store selectors
  const {
    layout,
    gridUnitMm,
    heightUnitMm,
    printBedSize,
    drawerWidth,
    drawerDepth,
    drawerHeight,
    fractionalEdgeX,
    fractionalEdgeY,
  } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      gridUnitMm: state.layout.gridUnitMm,
      heightUnitMm: state.layout.heightUnitMm,
      printBedSize: state.layout.printBedSize,
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      drawerHeight: state.layout.drawer.height,
      fractionalEdgeX: state.layout.drawer.fractionalEdgeX ?? 'end',
      fractionalEdgeY: state.layout.drawer.fractionalEdgeY ?? 'end',
    }))
  );

  // Half-bin mode store selectors
  const { halfBinMode, toggleHalfBinMode, setHalfBinMode } = useHalfBinModeStore(
    useShallow((state) => ({
      halfBinMode: state.halfBinMode,
      toggleHalfBinMode: state.toggleHalfBinMode,
      setHalfBinMode: state.setHalfBinMode,
    }))
  );

  // Selection store selectors
  const activeLayerId = useSelectionStore((state) => state.activeLayerId);

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

  // Get active layer's height (for save as defaults)
  const layers = useLayoutStore((state) => state.layout.layers);
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId),
    [layers, activeLayerId]
  );
  const activeLayerHeight = activeLayer?.height ?? 3;

  // Get current categories from layout (for save as defaults)
  const currentCategories = useLayoutStore((state) => state.layout.categories);
  const hasCustomCategoryDefaults = settings.defaultCategories !== null;

  // Computed values
  const hasFractionalWidth = drawerWidth % 1 !== 0;
  const hasFractionalDepth = drawerDepth % 1 !== 0;
  const widthStep = halfBinMode || hasFractionalWidth ? 0.5 : 1;
  const depthStep = halfBinMode || hasFractionalDepth ? 0.5 : 1;
  const maxGridUnits = calcMaxGridUnits(printBedSize, gridUnitMm);

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
      const newHeight = Math.max(1, drawerHeight + delta) as HeightUnits;
      batch(() => updateDrawer({ height: newHeight }));
    },
    [drawerHeight, updateDrawer]
  );

  // Direct input handlers (for number inputs)
  const handleDrawerWidthInput = useCallback(
    (width: number) => {
      const snapped = gridUnits(snapToHalf(Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, width))));
      batch(() => updateDrawer({ width: snapped }));
      if (isFractional(snapped) && !halfBinMode) {
        setHalfBinMode(true);
        addToast(t('toast.halfBinModeAutoEnabled'), 'info');
      }
    },
    [updateDrawer, halfBinMode, setHalfBinMode, addToast, t]
  );

  const handleDrawerDepthInput = useCallback(
    (depth: number) => {
      const snapped = gridUnits(snapToHalf(Math.max(0.5, Math.min(CONSTRAINTS.GRID_MAX, depth))));
      batch(() => updateDrawer({ depth: snapped }));
      if (isFractional(snapped) && !halfBinMode) {
        setHalfBinMode(true);
        addToast(t('toast.halfBinModeAutoEnabled'), 'info');
      }
    },
    [updateDrawer, halfBinMode, setHalfBinMode, addToast, t]
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

  // Half-bin mode toggle with validation
  const handleHalfBinToggle = useCallback(() => {
    const result = toggleHalfBinMode();

    if (!isOk(result)) {
      // Validation failed - show blocking modal
      const validationResult = validateHalfBinModeToggle(layout, false);
      if (validationResult.violation) {
        setHalfBinViolation(validationResult.violation);
        setShowHalfBinBlockedModal(true);
      }
    }
  }, [toggleHalfBinMode, layout]);

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
    setHalfBinMode(false);

    // Close modal and show success message
    setShowHalfBinBlockedModal(false);
    addToast(`Moved ${movedCount} bin${movedCount !== 1 ? 's' : ''} to staging`, 'success');
  }, [halfBinViolation, updateBin, setHalfBinMode, addToast]);

  // Save current settings as defaults
  const handleSaveDefaults = useCallback(() => {
    saveCurrentAsDefaults(
      { width: drawerWidth, depth: drawerDepth, height: drawerHeight },
      printBedSize,
      gridUnitMm,
      heightUnitMm,
      activeLayerHeight
    );
    setShowSaveDefaultsConfirm(false);
  }, [
    saveCurrentAsDefaults,
    drawerWidth,
    drawerDepth,
    drawerHeight,
    printBedSize,
    gridUnitMm,
    heightUnitMm,
    activeLayerHeight,
  ]);

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

    // Half-bin mode
    halfBinMode,

    settings,
    activeLayerHeight,

    // Handlers
    handleDrawerWidthChange,
    handleDrawerDepthChange,
    handleDrawerHeightChange,
    handleDrawerWidthInput,
    handleDrawerDepthInput,
    handleFractionalEdgeChange,
    handleHalfBinToggle,
    handleRemediate,
    handleSaveDefaults,
    setGridUnitMm,
    setHeightUnitMm,
    setPrintBedSize,
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
