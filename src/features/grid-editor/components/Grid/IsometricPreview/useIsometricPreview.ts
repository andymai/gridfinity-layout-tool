/** Store selections, camera and interaction state behind the isometric preview; the component keeps the markup. */
import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
// Side-effect: must run before any <Text> mounts under this Canvas.
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { effectiveGridUnitMmY } from '@/core/types';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { calcMaxGridUnits } from '@/core/constants';
import { useResponsive } from '@/shared/hooks';
import { use3DPreviewKeyboard } from '@/shared/hooks/use3DPreviewKeyboard';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { type SceneHandle } from './Scene';
import { useExplodedLayerView } from '@/shared/hooks/useExplodedLayerView';
import { useLinkedDesignDividers } from '@/shared/hooks/useLinkedDesignDividers';
import { useLinkedDesignMeshes } from '@/shared/hooks/useLinkedDesignMeshes';
import { useDesignGeometries, partitionByDesignMesh } from './LinkedBinMeshes';
import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/core/store/settings';
import { useBinsToRender } from './useBinsToRender';
import { getPreviewSummary } from './previewSummary';
import { usePreviewSize } from './usePreviewSize';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useBinTransitions } from './useBinTransitions';
import { useDrawerCeiling } from '@/shared/hooks/useDrawerCeiling';

export interface IsometricPreviewProps {
  inline?: boolean; // When true, fills container instead of using fixed sizing
}

export function useIsometricPreview({ inline = false }: IsometricPreviewProps) {
  const t = useTranslation();
  const threeColors = useThreeColors();
  const sceneRef = useRef<SceneHandle>(null);
  const { isMobile, isTablet } = useResponsive();

  const selectedBinIds = useSelectionStore((state) => state.selectedBinIds);
  const setActiveLayer = useSelectionStore((state) => state.setActiveLayer);

  const {
    showIsometricPreview,
    layerViewMode,
    isPreviewExpanded,
    isExplodedView,
    setLayerViewMode,
    togglePreviewExpanded,
    setPreviewExpanded,
    toggleIsometricPreview,
    toggleExplodedView,
  } = useViewStore(
    useShallow((state) => ({
      showIsometricPreview: state.showIsometricPreview,
      layerViewMode: state.layerViewMode,
      isPreviewExpanded: state.isPreviewExpanded,
      isExplodedView: state.isExplodedView,
      setLayerViewMode: state.setLayerViewMode,
      togglePreviewExpanded: state.togglePreviewExpanded,
      setPreviewExpanded: state.setPreviewExpanded,
      toggleIsometricPreview: state.toggleIsometricPreview,
      toggleExplodedView: state.toggleExplodedView,
    }))
  );

  const showBananaScale = useSettingsStore((state) => state.settings.showBananaScale);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  const { containerRef, previewSize } = usePreviewSize({
    inline,
    isPreviewExpanded,
    isMobile,
    isTablet,
  });

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setPreviewExpanded(false);
      }
    },
    [setPreviewExpanded]
  );

  // Select only needed layout properties to prevent unnecessary re-renders
  const {
    bins,
    layers,
    categories,
    drawer,
    printBedSize,
    printBedDepth,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    layoutName,
  } = useLayoutStore(
    useShallow((state) => ({
      bins: state.layout.bins,
      layers: state.layout.layers,
      categories: state.layout.categories,
      drawer: state.layout.drawer,
      printBedSize: state.layout.printBedSize,
      printBedDepth: state.layout.printBedDepth,
      gridUnitMm: state.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(state.layout),
      heightUnitMm: state.layout.heightUnitMm,
      layoutName: state.layout.name,
    }))
  );

  const ceiling = useDrawerCeiling();

  // Calculate height-to-grid scale from user settings
  const heightToGridScale = heightUnitMm / gridUnitMm;
  const activeLayerId = useSelectionStore((state) => state.activeLayerId);

  // Text alternative for the WebGL canvas, which is opaque to assistive tech.
  const previewSummaryText = useMemo(() => {
    const summary = getPreviewSummary({ bins, layers, drawer });
    return summary.isEmpty
      ? t('grid.preview.summaryEmpty')
      : t('grid.preview.summary', {
          binCount: summary.binCount,
          layerCount: summary.layerCount,
          drawerWidth: summary.drawerWidth,
          drawerDepth: summary.drawerDepth,
        });
  }, [bins, layers, drawer, t]);

  // Keyboard shortcuts for 3D preview navigation (after layout store so `layers` is available)
  use3DPreviewKeyboard({
    isPreviewVisible: showIsometricPreview,
    isPreviewExpanded,
    togglePreviewVisibility: toggleIsometricPreview,
    togglePreviewExpanded,
    setPreviewExpanded,
    toggleExplodedView,
    isExplodedSupported: !isMobile && !isTablet && layers.length > 1,
  });

  // Memoize active layer index calculation
  const activeLayerIndex = useMemo(
    () => layers.findIndex((l) => l.id === activeLayerId),
    [layers, activeLayerId]
  );

  // Calculate max print size for split line visualization
  const maxGridUnits = useMemo(
    () => calcMaxGridUnits(printBedSize, gridUnitMm, printBedDepth),
    [printBedSize, printBedDepth, gridUnitMm]
  );

  // Compartment dividers for bins linked to saved designs (loaded async
  // from designer storage; bins render as plain boxes until specs arrive)
  const designDividers = useLinkedDesignDividers(bins, gridUnitMm);

  // Real generated meshes for linked designs; unresolved bins keep the
  // stylized box, with dividers as the intermediate fallback.
  const designMeshes = useLinkedDesignMeshes(bins);
  const designGeometries = useDesignGeometries(designMeshes);

  const binsToRender = useBinsToRender({
    bins,
    layers,
    categories,
    activeLayerIndex,
    layerViewMode,
    heightToGridScale,
    designDividers,
  });

  // Animated bin transitions (spring drop-in, shrink+fade exit).
  const reducedMotion = usePrefersReducedMotion();
  const { stableBins, enteringBins, exitingGhosts, tick } = useBinTransitions(
    binsToRender,
    reducedMotion
  );

  // Memoize filtered bin arrays to prevent recalculation on every render.
  // Uses stableBins (excludes currently-animating bins) instead of binsToRender.
  const { selectedBins, nonSelectedBins, binsWithOverlays } = useMemo(() => {
    const selected: typeof stableBins = [];
    const nonSelected: typeof stableBins = [];
    const withOverlays: typeof binsToRender = [];

    for (const binData of stableBins) {
      if (selectedBinIds.includes(binData.bin.id)) {
        selected.push(binData);
      } else {
        nonSelected.push(binData);
      }
    }

    // Overlays computed from all binsToRender (including animating) — positions are stable.
    for (const binData of binsToRender) {
      const needsClearance = binData.clearanceHeight > 0;
      const needsSplitLines =
        binData.bin.width > maxGridUnits.width || binData.bin.depth > maxGridUnits.depth;
      if (needsClearance || needsSplitLines) {
        withOverlays.push(binData);
      }
    }

    return {
      selectedBins: selected,
      nonSelectedBins: nonSelected,
      binsWithOverlays: withOverlays,
    };
  }, [stableBins, binsToRender, selectedBinIds, maxGridUnits]);

  // Split non-selected bins: linked bins with a resolved design mesh render
  // the real geometry individually; the rest go through the merged-box path.
  const { designMeshBins, plainBins } = useMemo(
    () => partitionByDesignMesh(nonSelectedBins, designGeometries),
    [nonSelectedBins, designGeometries]
  );

  // Track exit animation — keep groups mounted with offset=0 so useFrame can lerp back.
  // The cleanup function fires when isExplodedView goes from true→false, starting exit animation.
  const [isExplodeExiting, setIsExplodeExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isExplodedView) return;
    return () => {
      setIsExplodeExiting(true);
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
      exitTimerRef.current = window.setTimeout(() => {
        setIsExplodeExiting(false);
        exitTimerRef.current = null;
      }, 600);
    };
  }, [isExplodedView]);
  useEffect(() => {
    // Clear pending exit-animation timer on unmount to avoid setState-after-unmount.
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, []);

  // Exploded layer view: per-layer bin groups with Z offsets and opacity
  const explodedLayerGroups = useExplodedLayerView({
    bins,
    layers,
    categories,
    heightToGridScale,
    heightUnitMm,
    activeLayerId,
    isExplodedView,
    isExitAnimating: isExplodeExiting,
    designDividers,
  });

  // Pre-split exploded groups into selected/non-selected bins (avoids .filter() in JSX)
  const explodedGroupsWithSelection = useMemo(() => {
    if (!explodedLayerGroups) return null;
    const selectedSet = new Set(selectedBinIds);
    return explodedLayerGroups.map((group) => {
      const selectedBins: typeof group.bins = [];
      const nonSelectedBins: typeof group.bins = [];
      for (const bin of group.bins) {
        if (selectedSet.has(bin.bin.id)) {
          selectedBins.push(bin);
        } else {
          nonSelectedBins.push(bin);
        }
      }
      return { ...group, selectedBins, nonSelectedBins };
    });
  }, [explodedLayerGroups, selectedBinIds]);

  const handleBananaScaleUpdate = useCallback(
    (show: boolean) => updateSetting('showBananaScale', show),
    [updateSetting]
  );

  return {
    t,
    threeColors,
    sceneRef,
    isMobile,
    isTablet,
    setActiveLayer,
    showIsometricPreview,
    layerViewMode,
    isPreviewExpanded,
    isExplodedView,
    setLayerViewMode,
    togglePreviewExpanded,
    setPreviewExpanded,
    toggleIsometricPreview,
    toggleExplodedView,
    showBananaScale,
    containerRef,
    previewSize,
    handleBackdropClick,
    layers,
    drawer,
    gridUnitMm,
    gridUnitMmY,
    heightUnitMm,
    layoutName,
    ceiling,
    heightToGridScale,
    previewSummaryText,
    maxGridUnits,
    designGeometries,
    binsToRender,
    enteringBins,
    exitingGhosts,
    tick,
    selectedBins,
    binsWithOverlays,
    designMeshBins,
    plainBins,
    explodedGroupsWithSelection,
    handleBananaScaleUpdate,
  };
}
