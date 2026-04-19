import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useViewStore } from '@/core/store/view';
import { calcMaxGridUnits } from '@/core/constants';
import { useResponsive } from '@/shared/hooks';
import { use3DPreviewKeyboard } from '@/shared/hooks/use3DPreviewKeyboard';
import { useThreeColors } from '@/shared/hooks/useThemeEffect';
import { Scene, type SceneHandle } from './Scene';
import { BinMesh } from './BinMesh';
import { BatchedCornerMarkers } from './BatchedCornerMarkers';
import { MergedBinMeshes } from './MergedBinMeshes';
import { ExplodedLayerGroup } from './ExplodedLayerGroup';
import { useExplodedLayerView } from '@/shared/hooks/useExplodedLayerView';
import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/core/store/settings';
import { useBinsToRender } from './useBinsToRender';
import { usePreviewSize } from './usePreviewSize';
import { IsometricPreviewControls } from './IsometricPreviewControls';
import { BinOverlayGroup } from './BinOverlayGroup';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useBinTransitions } from './useBinTransitions';
import { AnimatedBinMesh } from './AnimatedBinMesh';
import { BinTransitionTicker } from './BinTransitionTicker';

interface IsometricPreviewProps {
  inline?: boolean; // When true, fills container instead of using fixed sizing
}

/**
 * Isometric 3D preview of the drawer layout using Three.js.
 * Shows all layers stacked with bins colored by category.
 */
export function IsometricPreview({ inline = false }: IsometricPreviewProps) {
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

  // Handle backdrop click
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
      heightUnitMm: state.layout.heightUnitMm,
      layoutName: state.layout.name,
    }))
  );

  // Calculate height-to-grid scale from user settings
  const heightToGridScale = heightUnitMm / gridUnitMm;
  const activeLayerId = useSelectionStore((state) => state.activeLayerId);

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

  const binsToRender = useBinsToRender({
    bins,
    layers,
    categories,
    activeLayerIndex,
    layerViewMode,
    heightToGridScale,
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

  // Banana scale update callback
  const handleBananaScaleUpdate = useCallback(
    (show: boolean) => updateSetting('showBananaScale', show),
    [updateSetting]
  );

  if (!showIsometricPreview) {
    return null;
  }

  // Preview container content (shared between small and expanded modes)
  const previewContent = (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${
        inline
          ? 'w-full h-full flex items-center justify-center'
          : isPreviewExpanded
            ? 'rounded-lg shadow-lg border border-stroke-subtle'
            : 'absolute top-14 right-4 rounded-lg shadow-lg border border-stroke-subtle'
      }`}
      style={{
        width: inline ? undefined : previewSize,
        height: inline ? undefined : previewSize,
        zIndex: isPreviewExpanded ? undefined : inline ? undefined : 20,
      }}
    >
      <Canvas
        orthographic
        camera={{
          position: [10, 10, 10],
          zoom: 30,
          near: 0.1,
          far: 1000,
        }}
        style={{ background: threeColors.canvasBg }}
      >
        <Scene
          ref={sceneRef}
          drawerWidth={drawer.width}
          drawerDepth={drawer.depth}
          drawerHeight={drawer.height}
          gridUnitMm={gridUnitMm}
          heightUnitMm={heightUnitMm}
          layoutName={layoutName}
          isExpanded={isPreviewExpanded}
          fractionalEdgeX={drawer.fractionalEdgeX}
          fractionalEdgeY={drawer.fractionalEdgeY}
        >
          {/* Bins: exploded per-layer groups or normal flat rendering */}
          {explodedGroupsWithSelection ? (
            explodedGroupsWithSelection.map((group) => (
              <ExplodedLayerGroup
                key={group.layer.id}
                layerId={group.layer.id}
                layerName={group.layer.name}
                layerHeightMm={group.labelHeightMm}
                nonSelectedBins={group.nonSelectedBins}
                selectedBins={group.selectedBins}
                explodedZOffset={group.explodedZOffset}
                isActive={group.isActive}
                drawerWidth={drawer.width}
                drawerDepth={drawer.depth}
                layerCenterZ={group.baseZ + (group.layer.height * heightToGridScale) / 2}
                showChrome={isExplodedView}
                onLayerClick={setActiveLayer}
              />
            ))
          ) : (
            <>
              {/* Non-selected bins: merged geometry for performance */}
              <MergedBinMeshes bins={nonSelectedBins} />

              {/* Selected bins: individual meshes for glow animation */}
              {selectedBins.map((binData) => (
                <BinMesh
                  key={binData.bin.id}
                  bin={binData.bin}
                  x={binData.x}
                  y={binData.y}
                  z={binData.z}
                  height={binData.height}
                  color={binData.color}
                  opacity={binData.opacity}
                  isSelected={true}
                />
              ))}

              {/* Entering bins: spring drop animation */}
              {enteringBins.map(({ binData, transition }) => (
                <AnimatedBinMesh
                  key={`enter-${binData.bin.id}`}
                  binData={binData}
                  transition={transition}
                />
              ))}

              {/* Exiting ghosts: shrink + fade animation */}
              {exitingGhosts.map(({ binData, transition }) => (
                <AnimatedBinMesh
                  key={`exit-${binData.bin.id}`}
                  binData={binData}
                  transition={transition}
                />
              ))}

              {/* Drives transition animations each frame */}
              <BinTransitionTicker tick={tick} />
            </>
          )}

          {/* Per-bin overlays and corner markers — hidden in exploded mode (positions would desync) */}
          {!isExplodedView && (
            <>
              {binsWithOverlays.map((binData) => (
                <BinOverlayGroup
                  key={`overlay-${binData.bin.id}`}
                  binData={binData}
                  maxGridUnits={maxGridUnits}
                />
              ))}
              <BatchedCornerMarkers
                bins={binsToRender.map((binData) => ({
                  x: binData.x,
                  y: binData.y,
                  z: binData.z,
                  width: binData.bin.width,
                  depth: binData.bin.depth,
                  height: binData.height,
                  opacity: binData.opacity,
                }))}
              />
            </>
          )}
        </Scene>
      </Canvas>
      {/* Empty state - shown when no bins are placed */}
      {binsToRender.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div
            className="flex flex-col items-center gap-3 px-6 py-8 rounded-lg text-center"
            style={{
              background: 'var(--overlay-light)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border-subtle)',
              maxWidth: isPreviewExpanded ? '400px' : '240px',
            }}
          >
            {/* SVG Icon - Box/Cube */}
            <svg
              className={isPreviewExpanded ? 'w-12 h-12' : 'w-10 h-10'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            {/* Heading */}
            <h3
              className={`font-semibold ${isPreviewExpanded ? 'text-lg' : 'text-base'}`}
              style={{ color: 'var(--text-primary)' }}
            >
              {t('grid.noBinsYet')}
            </h3>
            {/* Message */}
            <p
              className={isPreviewExpanded ? 'text-sm' : 'text-xs'}
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('grid.placeBinsOnTheGridToSeeYour3dLayout')}
            </p>
          </div>
        </div>
      )}
      <IsometricPreviewControls
        sceneRef={sceneRef}
        isPreviewExpanded={isPreviewExpanded}
        isMobile={isMobile}
        isTablet={isTablet}
        layers={layers}
        layerViewMode={layerViewMode}
        isExplodedView={isExplodedView}
        showBananaScale={showBananaScale}
        setLayerViewMode={setLayerViewMode}
        togglePreviewExpanded={togglePreviewExpanded}
        setPreviewExpanded={setPreviewExpanded}
        toggleIsometricPreview={toggleIsometricPreview}
        toggleExplodedView={toggleExplodedView}
        updateBananaScale={handleBananaScaleUpdate}
      />
    </div>
  );

  // Always render in same DOM location to preserve Canvas state (camera angle, etc.)
  // Use CSS to switch between corner mode and expanded modal mode
  return (
    <>
      {/* Backdrop for expanded mode */}
      {isPreviewExpanded && (
        <div
          className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
          onClick={handleBackdropClick}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPreviewExpanded(false);
          }}
          role="presentation"
        />
      )}
      {/* Preview wrapper - changes positioning based on expanded state */}
      <div
        data-3d-expanded={isPreviewExpanded || undefined}
        className={
          isPreviewExpanded ? 'fixed inset-0 z-50 flex items-center justify-center' : 'contents'
        }
        style={
          isPreviewExpanded
            ? {
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }
            : undefined
        }
        onClick={isPreviewExpanded ? handleBackdropClick : undefined}
        onKeyDown={
          isPreviewExpanded
            ? (e) => {
                if (e.key === 'Escape') setPreviewExpanded(false);
              }
            : undefined
        }
        role={isPreviewExpanded ? 'presentation' : undefined}
      >
        {previewContent}
      </div>
    </>
  );
}
