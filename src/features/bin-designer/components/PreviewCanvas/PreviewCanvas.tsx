/**
 * Three.js 3D preview canvas for the bin designer.
 * Renders the generated mesh with enhanced lighting, gradient background,
 * smooth camera transitions, auto-framing, dimension lines, and a footprint grid.
 *
 * Camera math, the auto-framing controller, the preset-transition hook, and
 * the SceneLighting component live in `previewCanvasCamera.tsx`. The
 * overlay components (TouchHint, GeneratingIndicator) live in
 * `previewCanvasOverlays.tsx`.
 */

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { calcMaxGridUnits } from '@/core/constants';
import { PanelErrorBoundary } from '@/shell/PanelErrorBoundary';
import {
  BinMesh,
  LidMesh,
  LidGuideLine,
  LidExplodeSlider,
  LID_OFFSET_DEFAULT,
  BinAxisLabels,
  BinDimensions,
  BinNameLabel,
  PreviewControls,
  PreviewSkeleton,
  GhostDividers,
  GhostWireframe,
  GhostCompartmentPreview,
  GhostLabelTabs,
  GhostScoops,
  GhostSlotLines,
  GhostDividerPieces,
  GhostCutouts,
  GhostWallCutouts,
  GhostHandles,
  BinSplitLines,
  SplitBinMeshes,
  type CameraPreset,
} from '../preview';
import { GradientBackground } from '../preview/GradientBackground';
import { FootprintGrid } from '../preview/FootprintGrid';
import { useDesignerKeyboard } from '../../hooks/useDesignerKeyboard';
import { useDoubleTapReset } from '../../hooks/useDoubleTapReset';
import { useSplitPreview } from '../../hooks/useSplitPreview';
import { setPreviewCanvas, setPreviewContext, clearPreviewCanvas } from '../../utils/thumbnail';
import { describeBin, getStatusAnnouncement } from '../../utils/a11y';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { CameraController, usePresetTransition, SceneLighting } from './previewCanvasCamera';
import { TouchHint, GeneratingIndicator } from './previewCanvasOverlays';

/** localStorage key for persisting the user's preview color preference */
const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';
const DEFAULT_COLOR = '#d4d8dc';

/**
 * Render the 3D preview canvas for the bin designer.
 *
 * Features:
 * - 3-point lighting (hemisphere + key + fill)
 * - Gradient background for studio photography feel
 * - Normal-based vertex coloring with user-selectable base color
 * - Smooth camera preset transitions (spherical interpolation)
 * - Auto-framing that adjusts when bin dimensions change
 * - Dimension lines showing W×D×H + interior height in mm
 * - Footprint grid matching the bin's unit dimensions
 */
export function PreviewCanvas() {
  const t = useTranslation();
  const controlsRef = useRef<OrbitControlsType>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset | null>('isometric');
  // Lid explode slider (mm above the snapped position). Default = mid-explode
  // so both the lid and the bin's interior are visible when a lid is enabled.
  const [lidOffsetMm, setLidOffsetMm] = useState<number>(LID_OFFSET_DEFAULT);

  // Preview color persisted in localStorage
  const [previewColor, setPreviewColor] = useState(() => {
    return localStorage.getItem(PREVIEW_COLOR_KEY) ?? DEFAULT_COLOR;
  });

  const handleColorChange = useCallback((color: string) => {
    setPreviewColor(color);
    localStorage.setItem(PREVIEW_COLOR_KEY, color);
    // Dispatch custom event for same-window listeners (CompartmentEditor)
    window.dispatchEvent(new CustomEvent('preview-color-change', { detail: color }));
  }, []);

  // Clean up canvas ref on unmount
  useEffect(() => {
    return () => clearPreviewCanvas();
  }, []);

  const {
    wasmStatus,
    generationStatus,
    hasMesh,
    meshError,
    params,
    designName,
    canRevert,
    splitViewMode,
    setSplitViewMode,
    splitPieceMeshes,
  } = useDesignerStore(
    useShallow((s) => ({
      wasmStatus: s.wasmStatus,
      generationStatus: s.generation.status,
      hasMesh: s.generation.mesh !== null && s.generation.mesh.vertices !== null,
      meshError: s.generation.mesh?.error ?? null,
      params: s.params,
      designName: s.designName,
      canRevert: s.history.past.length > 0,
      splitViewMode: s.ui.splitViewMode,
      setSplitViewMode: s.setSplitViewMode,
      splitPieceMeshes: s.ui.splitPieceMeshes,
    }))
  );

  // Reset the explode slider to its default whenever the lid transitions
  // off → on. Without this, a stale value (e.g. 80mm from a previous session)
  // persists across the slider's unmount/remount cycle — disabling the lid
  // hides the slider but doesn't clear the parent-owned `lidOffsetMm`.
  const wasLidEnabledRef = useRef(params.lid.enabled);
  useEffect(() => {
    if (params.lid.enabled && !wasLidEnabledRef.current) {
      setLidOffsetMm(LID_OFFSET_DEFAULT);
    }
    wasLidEnabledRef.current = params.lid.enabled;
  }, [params.lid.enabled]);

  const { defaultPrintBedSize: bedSize, defaultPrintBedDepth: bedDepth } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultPrintBedDepth: s.settings.defaultPrintBedDepth,
    }))
  );
  const maxGrid = useMemo(
    () => calcMaxGridUnits(bedSize, params.gridUnitMm, bedDepth),
    [bedSize, bedDepth, params.gridUnitMm]
  );
  const needsSplit = params.width > maxGrid.width || params.depth > maxGrid.depth;

  // Drive split piece mesh generation when bin exceeds print bed
  useSplitPreview();

  // Show split piece meshes when pieces are generated and bin needs splitting
  const showSplitPieces = splitPieceMeshes.length > 0 && needsSplit;

  // Screen reader description
  const binDescription = describeBin(params);
  const statusAnnouncement = getStatusAnnouncement(wasmStatus, generationStatus, hasMesh);

  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const addToast = useToastStore((s) => s.addToast);
  const { navigateToPlanner } = useDesignerRouting();

  // Revert to last working configuration on generation error
  const handleRevert = useCallback(() => {
    undo();
    addToast({ message: t('binDesigner.revertedToWorking'), type: 'info', duration: 3000 });
  }, [undo, addToast, t]);

  // Smooth camera preset transitions
  const setCameraPresetRaw = usePresetTransition(
    controlsRef,
    invalidateRef,
    params.width,
    params.depth,
    params.height,
    params.gridUnitMm,
    params.heightUnitMm
  );

  const setCameraPreset = useCallback(
    (preset: CameraPreset) => {
      setCameraPresetRaw(preset);
      setActivePreset(preset);
    },
    [setCameraPresetRaw]
  );

  const resetView = useCallback(() => {
    setCameraPreset('isometric');
  }, [setCameraPreset]);

  // Clear active preset when user manually orbits
  const handleOrbitStart = useCallback(() => {
    setActivePreset(null);
  }, []);

  const toggleWireframe = useCallback(() => {
    setWireframe((w) => !w);
  }, []);

  // Keyboard shortcuts
  useDesignerKeyboard({
    onCameraPreset: setCameraPreset,
    onResetView: resetView,
    onToggleWireframe: toggleWireframe,
    onUndo: undo,
    onRedo: redo,
    onToolSwitch: navigateToPlanner,
  });

  const handleRetry = useCallback(() => {
    if (wasmStatus === 'error') {
      window.location.reload();
    } else {
      const currentParams = useDesignerStore.getState().params;
      useDesignerStore.getState().setParams({ ...currentParams });
    }
  }, [wasmStatus]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureColors is typed required but legacy persisted configs may omit it; preserve runtime fallback
  const showColors = params.featureColors?.enabled ?? false;

  // Responsive state for touch optimizations
  const { isDesktop, isTouchDevice } = useResponsive();

  // Double-tap to reset view (touch only). The hook ignores multi-touch
  // gestures so pinch-to-zoom never misfires as a double-tap.
  const {
    onPointerDown: onDoubleTapPointerDown,
    onPointerUp: onDoubleTapPointerUp,
    onPointerCancel: onDoubleTapPointerCancel,
  } = useDoubleTapReset({ onDoubleTap: resetView, disabled: isDesktop });

  // Scene dimensions
  const width = params.width;
  const depth = params.depth;
  const height = params.height;
  const totalH = height * params.heightUnitMm;

  const showSkeleton = !hasMesh || wasmStatus !== 'ready';
  const showOverlay = generationStatus === 'generating' && hasMesh;

  return (
    <div
      className="relative h-full w-full touch-manipulation"
      role="img"
      aria-label={binDescription}
      onPointerDown={onDoubleTapPointerDown}
      onPointerUp={onDoubleTapPointerUp}
      onPointerCancel={onDoubleTapPointerCancel}
    >
      {/* ARIA live region for status announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>

      {showSkeleton ? (
        <PreviewSkeleton
          wasmStatus={wasmStatus}
          generationStatus={generationStatus}
          errorMessage={meshError}
          onRetry={handleRetry}
          onRevert={handleRevert}
          canRevert={canRevert}
        />
      ) : (
        <PanelErrorBoundary panelName="3D Preview">
          <Canvas
            frameloop="demand"
            camera={{
              position: new Vector3(100, -100, 80),
              fov: 45,
              near: 0.1,
              far: 2000,
            }}
            onCreated={({ camera, gl, scene }) => {
              camera.up.set(0, 0, 1);
              camera.lookAt(0, 0, totalH / 2);
              setPreviewCanvas(gl.domElement);
              setPreviewContext(gl, scene, camera as PerspectiveCamera);
            }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
          >
            {/* Gradient background */}
            <GradientBackground />

            {/* 3-point lighting (theme-aware ground bounce) */}
            <SceneLighting />

            {/* Camera controller for auto-framing */}
            <CameraController
              controlsRef={controlsRef}
              invalidateRef={invalidateRef}
              width={width}
              depth={depth}
              height={height}
              gridUnitMm={params.gridUnitMm}
              heightUnitMm={params.heightUnitMm}
            />

            {/* Bin mesh — swap for per-piece meshes when split */}
            {showSplitPieces ? (
              <SplitBinMeshes color={previewColor} wireframe={wireframe} />
            ) : (
              <BinMesh wireframe={wireframe} color={previewColor} />
            )}

            {/* Click-lock lid (renders only when params.lid.enabled produced
                a mesh). `lidOffsetMm` controls position + opacity in lockstep. */}
            <LidMesh color={previewColor} lidOffsetMm={lidOffsetMm} wireframe={wireframe} />
            {/* Dashed guide line between bin's lip top and lid's mating opening,
                visible only when the lid is meaningfully exploded. */}
            {params.lid.enabled && params.base.stackingLip && (
              <LidGuideLine lidOffsetMm={lidOffsetMm} />
            )}

            {/* Ghost outlines during generation */}
            <GhostWireframe />
            <GhostDividers />
            <GhostCompartmentPreview />
            <GhostLabelTabs />
            <GhostScoops />
            <GhostSlotLines />
            <GhostDividerPieces />
            <GhostCutouts />
            <GhostWallCutouts />
            <GhostHandles />

            {/* Split lines for oversized bins — hidden when pieces are shown */}
            {!showSplitPieces && <BinSplitLines />}

            {/* Footprint grid */}
            <FootprintGrid width={width} depth={depth} />

            {/* Dimension markers and labels — hidden for split pieces */}
            {!showSplitPieces && (
              <>
                <BinAxisLabels width={width} depth={depth} />
                <BinDimensions
                  width={width}
                  depth={depth}
                  height={height}
                  gridUnitMm={params.gridUnitMm}
                  heightUnitMm={params.heightUnitMm}
                  stackingLip={params.base.stackingLip}
                />
                <BinNameLabel width={width} depth={depth} name={designName} />
              </>
            )}

            {/* Orbit controls - Z-up with polar limits, pan disabled on mobile */}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              target={[0, 0, totalH / 2]}
              enableDamping
              dampingFactor={0.12}
              rotateSpeed={isTouchDevice ? 1.0 : 0.8}
              zoomSpeed={isTouchDevice ? 1.2 : 1.0}
              minDistance={20}
              maxDistance={800}
              maxPolarAngle={Math.PI * 0.85}
              minPolarAngle={Math.PI * 0.05}
              enablePan={isDesktop}
              onStart={handleOrbitStart}
            />
          </Canvas>

          {/* Nostalgic loading indicator (bottom center) */}
          {showOverlay && <GeneratingIndicator />}

          {/* Lid explode slider — only when the bin has a lid configured AND
              its stacking lip is on (lid won't render/export without lip). */}
          {params.lid.enabled && params.base.stackingLip && (
            <LidExplodeSlider value={lidOffsetMm} onChange={setLidOffsetMm} />
          )}

          {/* Control buttons */}
          <PreviewControls
            wireframe={wireframe}
            previewColor={previewColor}
            activePreset={activePreset}
            onWireframeToggle={toggleWireframe}
            onColorChange={handleColorChange}
            onCameraPreset={setCameraPreset}
            onResetView={resetView}
            needsSplit={needsSplit}
            splitViewMode={splitViewMode}
            onSplitViewModeChange={setSplitViewMode}
            hideColorPicker={showColors}
          />

          {/* Touch gesture hint (mobile/tablet first visit) */}
          <TouchHint />
        </PanelErrorBoundary>
      )}
    </div>
  );
}
