import { Canvas } from '@react-three/fiber';
// Side-effect: must run before any <Text> mounts under this Canvas.
import '@/shared/webgl/configureTroikaText';
import { Scene } from './Scene';
import { BatchedCornerMarkers } from './BatchedCornerMarkers';
import { BinOverhangExtensions } from './BinOverhangExtensions';
import { MergedBinMeshes } from './MergedBinMeshes';
import { ExplodedLayerGroup } from './ExplodedLayerGroup';
import { LinkedBinMesh, SelectedBin } from './LinkedBinMeshes';
import { SpaceMouseController } from '@/shared/spacemouse/components/SpaceMouseController';
import { IsometricPreviewControls } from './IsometricPreviewControls';
import { BinOverlayGroup } from './BinOverlayGroup';
import { AnimatedBinMesh } from './AnimatedBinMesh';
import { BinTransitionTicker } from './BinTransitionTicker';
import { CeilingPlane } from './CeilingPlane';
import { useIsometricPreview } from './useIsometricPreview';
import type { IsometricPreviewProps } from './useIsometricPreview';

/**
 * Isometric 3D preview of the drawer layout using Three.js.
 * Shows all layers stacked with bins colored by category.
 */
export function IsometricPreview(props: IsometricPreviewProps) {
  const { inline = false } = props;
  const {
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
  } = useIsometricPreview(props);

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
      {/* Label the canvas region itself (react-three-fiber spreads these onto its
          container element) so a screen reader that lands on the otherwise
          content-less canvas hears the layout description. role="img" keeps it a
          single labeled node rather than exposing an empty canvas. Not aria-live
          — read on demand, not announced on every edit. */}
      <Canvas
        role="img"
        aria-label={previewSummaryText}
        orthographic
        camera={{
          position: [10, 10, 10],
          zoom: 30,
          near: 0.1,
          far: 1000,
        }}
        style={{ background: threeColors.canvasBg }}
      >
        <SpaceMouseController />
        <Scene
          ref={sceneRef}
          drawerWidth={drawer.width}
          drawerDepth={drawer.depth}
          drawerHeight={drawer.height}
          gridUnitMm={gridUnitMm}
          gridUnitMmY={gridUnitMmY}
          heightUnitMm={heightUnitMm}
          layoutName={layoutName}
          isExpanded={isPreviewExpanded}
          fractionalEdgeX={drawer.fractionalEdgeX}
          fractionalEdgeY={drawer.fractionalEdgeY}
        >
          {ceiling !== null && (
            <CeilingPlane
              ceilingMm={ceiling.ceilingMm}
              drawerWidth={drawer.width}
              drawerDepth={drawer.depth}
              depthScale={gridUnitMmY / gridUnitMm}
              gridUnitMm={gridUnitMm}
              fits={ceiling.fits}
            />
          )}
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
                designGeometries={designGeometries}
                gridUnitMm={gridUnitMm}
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
              <MergedBinMeshes bins={plainBins} />

              {/* Linked bins with a resolved design mesh: real geometry */}
              {designMeshBins.map(({ binData, entry }) => (
                <LinkedBinMesh
                  key={`design-${binData.bin.id}`}
                  binData={binData}
                  entry={entry}
                  gridUnitMm={gridUnitMm}
                />
              ))}

              {/* Selected bins: individual meshes for glow animation */}
              {selectedBins.map((binData) => (
                <SelectedBin
                  key={binData.bin.id}
                  binData={binData}
                  designGeometries={designGeometries}
                  gridUnitMm={gridUnitMm}
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
              {/* Drawer-margin extensions (Labs) — solid strips filling the margin
                  around extended edge bins. */}
              <BinOverhangExtensions
                bins={binsToRender}
                drawerWidth={drawer.width}
                drawerDepth={drawer.depth}
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
