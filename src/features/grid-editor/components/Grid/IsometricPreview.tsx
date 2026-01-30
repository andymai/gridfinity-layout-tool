import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useUIStore } from '@/core/store';
import { STAGING_ID, DEFAULT_CATEGORY_COLOR, calcMaxGridUnits } from '@/core/constants';
import { useResponsive } from '@/shared/hooks';
import { use3DPreviewKeyboard } from '@/hooks/use3DPreviewKeyboard';
import { getLayerZStartResult } from '@/shared/utils/collision';
import { isOk } from '@/core/result';
import { Scene, type SceneHandle } from './IsometricPreview/Scene';
import { BinMesh } from './IsometricPreview/BinMesh';
import { SplitLineOverlay } from './IsometricPreview/SplitLineOverlay';
import { BatchedCornerMarkers } from './IsometricPreview/BatchedCornerMarkers';
import { MergedBinMeshes } from './IsometricPreview/MergedBinMeshes';
import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/core/store/settings';

const PREVIEW_SIZE_SMALL = 280; // Default small preview

interface IsometricPreviewProps {
  inline?: boolean; // When true, fills container instead of using fixed sizing
}

/**
 * Isometric 3D preview of the drawer layout using Three.js.
 * Shows all layers stacked with bins colored by category.
 */
export function IsometricPreview({ inline = false }: IsometricPreviewProps) {
  const t = useTranslation();
  const sceneRef = useRef<SceneHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTablet } = useResponsive();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const {
    showIsometricPreview,
    layerViewMode,
    isPreviewExpanded,
    selectedBinIds,
    setLayerViewMode,
    togglePreviewExpanded,
    setPreviewExpanded,
    toggleIsometricPreview,
  } = useUIStore(
    useShallow((state) => ({
      showIsometricPreview: state.showIsometricPreview,
      layerViewMode: state.layerViewMode,
      isPreviewExpanded: state.isPreviewExpanded,
      selectedBinIds: state.selectedBinIds,
      setLayerViewMode: state.setLayerViewMode,
      togglePreviewExpanded: state.togglePreviewExpanded,
      setPreviewExpanded: state.setPreviewExpanded,
      toggleIsometricPreview: state.toggleIsometricPreview,
    }))
  );

  const showBananaScale = useSettingsStore((state) => state.settings.showBananaScale);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  // Track container dimensions in inline mode
  useEffect(() => {
    if (!inline || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [inline]);

  // Calculate preview size based on mode, expanded state, and device
  const previewSize = useMemo(() => {
    // In inline mode, use container dimensions (square aspect ratio)
    if (inline && containerSize.width > 0 && containerSize.height > 0) {
      return Math.min(containerSize.width, containerSize.height);
    }

    if (!isPreviewExpanded) return PREVIEW_SIZE_SMALL;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;

    if (isMobile) {
      // Mobile: nearly fullscreen (98% of viewport)
      return Math.min(vw * 0.98, vh * 0.98);
    } else if (isTablet) {
      // Tablet: large but with some margin (95%)
      return Math.min(vw * 0.95, vh * 0.95);
    } else {
      // Desktop: fill most of viewport (90%)
      return Math.min(vw * 0.9, vh * 0.9);
    }
  }, [inline, containerSize, isPreviewExpanded, isMobile, isTablet]);

  // Keyboard shortcuts for 3D preview navigation
  use3DPreviewKeyboard({
    sceneRef,
    isPreviewVisible: showIsometricPreview,
    isPreviewExpanded,
    togglePreviewVisibility: toggleIsometricPreview,
    togglePreviewExpanded,
    setPreviewExpanded,
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
  const { bins, layers, categories, drawer, printBedSize, gridUnitMm, heightUnitMm, layoutName } =
    useLayoutStore(
      useShallow((state) => ({
        bins: state.layout.bins,
        layers: state.layout.layers,
        categories: state.layout.categories,
        drawer: state.layout.drawer,
        printBedSize: state.layout.printBedSize,
        gridUnitMm: state.layout.gridUnitMm,
        heightUnitMm: state.layout.heightUnitMm,
        layoutName: state.layout.name,
      }))
    );

  // Calculate height-to-grid scale from user settings
  const heightToGridScale = heightUnitMm / gridUnitMm;
  const activeLayerId = useUIStore((state) => state.activeLayerId);

  // Memoize active layer index calculation
  const activeLayerIndex = useMemo(
    () => layers.findIndex((l) => l.id === activeLayerId),
    [layers, activeLayerId]
  );

  // Calculate max print size for split line visualization
  const maxGridUnits = useMemo(
    () => calcMaxGridUnits(printBedSize, gridUnitMm),
    [printBedSize, gridUnitMm]
  );

  // Performance: Create O(1) lookup maps to avoid O(n²) .findIndex()/.find() calls in render loop
  const layerIndexMap = useMemo(() => new Map(layers.map((l, idx) => [l.id, idx])), [layers]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Convert layout bins to renderable format with layer filtering
  // Dependencies are specific properties (bins, layers, categories) not entire layout object
  const binsToRender = useMemo(() => {
    const result: Array<{
      bin: (typeof bins)[0];
      x: number;
      y: number;
      z: number;
      height: number;
      clearanceHeight: number;
      color: string;
      opacity: number;
    }> = [];

    for (const bin of bins) {
      if (bin.layerId === STAGING_ID) continue;

      // Filter bins based on layer view mode (O(1) lookup instead of O(n) findIndex)
      if (activeLayerIndex >= 0) {
        const binLayerIndex = layerIndexMap.get(bin.layerId) ?? -1;

        switch (layerViewMode) {
          case 'focus':
            // Show only the active layer
            if (binLayerIndex !== activeLayerIndex) continue;
            break;
          case 'stack':
            // Show active layer and layers below (slice view)
            if (binLayerIndex > activeLayerIndex) continue;
            break;
          case 'all':
            // Show all layers
            break;
        }
      }

      const zStartResult = getLayerZStartResult(bin.layerId, layers);
      if (!isOk(zStartResult)) continue;
      const zStart = zStartResult.value * heightToGridScale;
      const category = categoryMap.get(bin.category);
      const color = category?.color || DEFAULT_CATEGORY_COLOR;

      result.push({
        bin,
        x: bin.x,
        y: bin.y,
        z: zStart,
        height: bin.height * heightToGridScale,
        clearanceHeight: (bin.clearanceHeight || 0) * heightToGridScale,
        color,
        opacity: 1,
      });
    }

    // Sort bins for correct depth ordering with camera at front-right viewing toward center
    // Camera is at: (centerX + dist, centerY - dist, centerZ + dist) = (X+, Y-, Z+)
    // Distance from camera increases as X decreases and Y increases
    // So depth = (x - y): low value = far, high value = close
    result.sort((a, b) => {
      // Layer depth (z) is primary
      if (a.z !== b.z) {
        return a.z - b.z;
      }

      // Within same layer, sort by distance from camera
      // Camera at (X+, Y-) means close bins have high (x-y), far bins have low (x-y)
      // Sort ascending (x-y) to render far bins first (with low z-offsets)
      const depthA = a.x - a.y;
      const depthB = b.x - b.y;

      return depthA - depthB;
    });

    // Add tiny z-offsets to prevent z-fighting on coplanar surfaces
    // 0.0002 units = 0.2mm per bin - imperceptible but prevents flickering
    result.forEach((binData, index) => {
      binData.z += index * 0.0002;
    });

    return result;
  }, [
    bins,
    layers,
    categoryMap,
    layerIndexMap,
    activeLayerIndex,
    layerViewMode,
    heightToGridScale,
  ]);

  // Memoize filtered bin arrays to prevent recalculation on every render
  const { selectedBins, nonSelectedBins, binsWithOverlays } = useMemo(() => {
    const selected: typeof binsToRender = [];
    const nonSelected: typeof binsToRender = [];
    const withOverlays: typeof binsToRender = [];

    for (const binData of binsToRender) {
      if (selectedBinIds.includes(binData.bin.id)) {
        selected.push(binData);
      } else {
        nonSelected.push(binData);
      }

      // Only include bins that need overlays (clearance or split lines)
      const needsClearance = binData.clearanceHeight > 0;
      const needsSplitLines = binData.bin.width > maxGridUnits || binData.bin.depth > maxGridUnits;
      if (needsClearance || needsSplitLines) {
        withOverlays.push(binData);
      }
    }

    return {
      selectedBins: selected,
      nonSelectedBins: nonSelected,
      binsWithOverlays: withOverlays,
    };
  }, [binsToRender, selectedBinIds, maxGridUnits]);

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
        style={{ background: '#0a0a0f' }}
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

          {/* Per-bin overlays (clearance zones, split lines) - only for bins that need them */}
          {binsWithOverlays.map((binData) => (
            <group key={`overlay-${binData.bin.id}`}>
              {/* Clearance zone visualization - translucent box above bin */}
              {binData.clearanceHeight > 0 && (
                <mesh
                  position={[
                    binData.x + binData.bin.width / 2,
                    binData.y + binData.bin.depth / 2,
                    binData.z + binData.height + binData.clearanceHeight / 2,
                  ]}
                >
                  <boxGeometry
                    args={[
                      binData.bin.width - 0.05,
                      binData.bin.depth - 0.05,
                      binData.clearanceHeight,
                    ]}
                  />
                  <meshStandardMaterial
                    color="#ff6b6b"
                    transparent
                    opacity={0.25 * binData.opacity}
                    depthWrite={false}
                  />
                </mesh>
              )}
              {/* Split lines for oversized bins */}
              {(binData.bin.width > maxGridUnits || binData.bin.depth > maxGridUnits) && (
                <SplitLineOverlay
                  x={binData.x}
                  y={binData.y}
                  z={binData.z}
                  width={binData.bin.width}
                  depth={binData.bin.depth}
                  height={binData.height}
                  maxGridUnits={maxGridUnits}
                  opacity={binData.opacity}
                />
              )}
            </group>
          ))}
          {/* Batched corner markers - single geometry for all bins */}
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
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              maxWidth: isPreviewExpanded ? '400px' : '240px',
            }}
          >
            {/* SVG Icon - Box/Cube */}
            <svg
              className={isPreviewExpanded ? 'w-12 h-12' : 'w-10 h-10'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ color: 'rgba(255, 255, 255, 0.6)' }}
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
              style={{ color: 'rgba(255, 255, 255, 0.9)' }}
            >
              {t('grid.noBinsYet')}
            </h3>
            {/* Message */}
            <p
              className={isPreviewExpanded ? 'text-sm' : 'text-xs'}
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              {t('grid.placeBinsOnTheGridToSeeYour3dLayout')}
            </p>
          </div>
        </div>
      )}
      {/* Camera preset buttons */}
      <div
        className={`absolute top-1 left-1/2 transform -translate-x-1/2 flex ${
          isPreviewExpanded && !isMobile ? 'gap-1 p-1 rounded-lg bg-surface/50' : 'gap-0.5'
        }`}
      >
        {/* Isometric view - 3D cube */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sceneRef.current?.setPreset('isometric');
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={t('grid.isometricView')}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? 'w-4 h-4' : 'w-4 h-4'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          {isPreviewExpanded && !isMobile && <span className="text-xs font-medium">3D</span>}
        </button>
        {/* Front view - rectangle wider than tall */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sceneRef.current?.setPreset('front');
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={t('grid.frontView')}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? 'w-4 h-4' : 'w-4 h-4'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {/* Wide rectangle - front elevation */}
            <rect x="3" y="8" width="18" height="10" strokeWidth={2} rx="1" />
            <line x1="3" y1="13" x2="21" y2="13" strokeWidth={1.5} />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">{t('grid.front')}</span>
          )}
        </button>
        {/* Side view - rectangle taller than wide */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sceneRef.current?.setPreset('side');
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={t('grid.sideView')}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? 'w-4 h-4' : 'w-4 h-4'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {/* Tall rectangle - side elevation */}
            <rect x="7" y="3" width="10" height="18" strokeWidth={2} rx="1" />
            <line x1="7" y1="12" x2="17" y2="12" strokeWidth={1.5} />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">{t('grid.side')}</span>
          )}
        </button>
        {/* Banana for scale toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateSetting('showBananaScale', !showBananaScale);
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          } ${showBananaScale ? 'text-yellow-400' : ''}`}
          title={t('grid.bananaForScale')}
        >
          {/* eslint-disable-next-line i18next/no-literal-string -- emoji icon */}
          <span className={isPreviewExpanded && !isMobile ? 'text-base' : 'text-sm'}>🍌</span>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">{t('grid.bananaForScale')}</span>
          )}
        </button>
      </div>
      {/* Layer view mode selector - segmented control, only show when multiple layers */}
      {layers.length > 1 && (
        <div
          className={`absolute bottom-1 right-1 flex rounded-lg overflow-hidden ${
            isPreviewExpanded && !isMobile
              ? 'gap-0.5 p-1 bg-surface/50'
              : 'bg-surface-secondary/80 border border-stroke-subtle'
          }`}
        >
          {/* Focus - show only active layer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerViewMode('focus');
            }}
            className={`flex items-center justify-center transition-colors ${
              isPreviewExpanded && !isMobile
                ? `btn ${layerViewMode === 'focus' ? 'btn-primary' : 'btn-ghost'} gap-2 px-3 py-2 rounded-md`
                : `w-7 h-7 ${layerViewMode === 'focus' ? 'bg-accent text-on-dark' : 'hover:bg-surface-elevated'}`
            }`}
            title={t('grid.focusShowOnlyActiveLayer')}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Single layer icon */}
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
            </svg>
            {isPreviewExpanded && !isMobile && <span className="text-xs">{t('grid.focus')}</span>}
          </button>
          {/* Stack - show active layer and below */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerViewMode('stack');
            }}
            className={`flex items-center justify-center transition-colors ${
              isPreviewExpanded && !isMobile
                ? `btn ${layerViewMode === 'stack' ? 'btn-primary' : 'btn-ghost'} gap-2 px-3 py-2 rounded-md`
                : `w-7 h-7 ${layerViewMode === 'stack' ? 'bg-accent text-on-dark' : 'hover:bg-surface-elevated'}`
            }`}
            title={t('grid.stackShowActiveLayerAndBelow')}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Two layers stacked */}
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {isPreviewExpanded && !isMobile && <span className="text-xs">{t('grid.stack')}</span>}
          </button>
          {/* All - show all layers */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerViewMode('all');
            }}
            className={`flex items-center justify-center transition-colors ${
              isPreviewExpanded && !isMobile
                ? `btn ${layerViewMode === 'all' ? 'btn-primary' : 'btn-ghost'} gap-2 px-3 py-2 rounded-md`
                : `w-7 h-7 ${layerViewMode === 'all' ? 'bg-accent text-on-dark' : 'hover:bg-surface-elevated'}`
            }`}
            title={t('grid.allShowAllLayers')}
          >
            <svg
              className={isPreviewExpanded && !isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Three layers stacked */}
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {isPreviewExpanded && !isMobile && <span className="text-xs">{t('grid.all')}</span>}
          </button>
        </div>
      )}
      {/* Top button row */}
      <div
        className={`absolute top-1 right-1 flex ${
          isPreviewExpanded && !isMobile ? 'gap-1 p-1 rounded-lg bg-surface/50' : 'gap-0.5'
        }`}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePreviewExpanded();
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={isPreviewExpanded ? t('grid.preview.collapse') : t('grid.preview.expand')}
        >
          {isPreviewExpanded ? (
            <>
              <svg
                className={isMobile ? 'w-4 h-4' : 'w-5 h-5'}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0v-4m0 4h4m6-6l5-5m0 0v4m0-4h-4"
                />
              </svg>
              {!isMobile && <span className="text-xs font-medium">{t('grid.collapse')}</span>}
            </>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
              />
            </svg>
          )}
        </button>
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isPreviewExpanded) {
              setPreviewExpanded(false);
            } else {
              useUIStore.getState().toggleIsometricPreview();
            }
          }}
          className={`btn btn-ghost ${
            isPreviewExpanded && !isMobile ? 'gap-2 px-3 py-2' : 'w-8 h-8 p-0'
          }`}
          title={isPreviewExpanded ? t('grid.preview.collapse') : t('grid.preview.close')}
        >
          <svg
            className={isPreviewExpanded && !isMobile ? 'w-5 h-5' : 'w-4 h-4'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {isPreviewExpanded && !isMobile && (
            <span className="text-xs font-medium">{t('common.close')}</span>
          )}
        </button>
      </div>

      {/* Keyboard shortcuts indicator - only shown in expanded mode on desktop */}
      {isPreviewExpanded && !isMobile && !isTablet && (
        <div
          className="absolute bottom-16 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            pointerEvents: 'none',
          }}
        >
          <div className="flex items-center gap-4 text-content-secondary">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                V
              </kbd>{' '}
              {t('grid.toggle')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                Space
              </kbd>{' '}
              {t('grid.expand')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                R
              </kbd>{' '}
              {t('common.reset')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated text-content leading-none">
                Esc
              </kbd>{' '}
              {t('common.close')}
            </span>
          </div>
        </div>
      )}
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
      >
        {previewContent}
      </div>
    </>
  );
}
