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
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import type { Projection } from '../preview';
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
  OverhangHighlight,
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
import { CameraRig } from '@/shared/components/preview/CameraRig';
import { TouchHint, GeneratingIndicator } from './previewCanvasOverlays';
import { detectWebGL, WebGLFallback } from '@/shared/webgl';
import { ColorToolOverlay } from './ColorToolOverlay';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import { PipetteIcon } from '@/design-system/Icon';
import { useSwapZoneWithToast } from '../../hooks/useSwapZoneWithToast';

const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';
const DEFAULT_COLOR = '#d4d8dc';

/**
 * Canvas `onCreated` fires against R3F's transient default camera, which
 * CameraRig immediately replaces via `makeDefault`. Capturing the camera
 * there leaves the thumbnail pipeline holding a dangling reference, so we
 * resync via `useThree().camera` (which also re-fires on projection swap).
 *
 * Only republish when the active camera is perspective: the thumbnail
 * pipeline reads `camera.fov` for its preset-framing math, which is
 * `undefined` on `OrthographicCamera` and would silently yield NaN-positioned
 * captures (blank PNGs). Drei's `<PerspectiveCamera>` stays mounted across
 * projection toggles, so the last-published reference remains valid while
 * the user is in ortho mode.
 */
function PreviewContextSync() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      setPreviewContext(gl, scene, camera);
    }
  }, [gl, scene, camera]);
  return null;
}

interface PreviewCanvasProps {
  /**
   * Hide non-mesh chrome (footprint grid, dimension lines/labels, name label)
   * so only the bin on its gradient background is captured. Used by the
   * dev-only thumbnail route; the normal designer leaves it false.
   */
  readonly hideChrome?: boolean;
}

export function PreviewCanvas({ hideChrome = false }: PreviewCanvasProps = {}) {
  const t = useTranslation();
  const controlsRef = useRef<OrbitControlsType>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const webgl = detectWebGL();
  const [wireframe, setWireframe] = useState(false);
  const [xray, setXray] = useState(false);
  const [projection, setProjection] = useState<Projection>('perspective');
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
    colorTool,
    setColorTool,
    setPickerOverlay,
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
      colorTool: s.ui.colorTool,
      setColorTool: s.setColorTool,
      setPickerOverlay: s.setPickerOverlay,
    }))
  );

  const swapZoneWithToast = useSwapZoneWithToast();

  // Clicking a zone with eyedropper opens the picker at the click point.
  // Clicking during the swap flow advances the swap state machine (the
  // store also accepts panel-row picks, so this is one of two entry paths).
  // pickerOverlay lives in the store, so any path that clears `colorTool`
  // (toolbar buttons, multi-color toggle, ESC, banner X) clears the
  // picker atomically — no orphaned floating picker after the tool exits.
  const handleZoneClick = useCallback(
    (zone: ColorZone, screen: { x: number; y: number }) => {
      if (colorTool === 'eyedropper') {
        setPickerOverlay({ zone, x: screen.x, y: screen.y });
        return;
      }
      if (colorTool === 'swap-pick-first' || colorTool === 'swap-pick-second') {
        swapZoneWithToast(zone);
      }
    },
    [colorTool, swapZoneWithToast, setPickerOverlay]
  );

  // Picker closes on user dismissal; eyedropper mode persists so the user
  // can recolor multiple zones in one session.
  const handleClosePicker = useCallback(() => setPickerOverlay(null), [setPickerOverlay]);

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
  const statusAnnouncement = getStatusAnnouncement(wasmStatus, generationStatus, hasMesh, t);

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

  const toggleXray = useCallback(() => {
    setXray((x) => !x);
  }, []);

  const toggleProjection = useCallback(() => {
    setProjection((p) => (p === 'perspective' ? 'orthographic' : 'perspective'));
  }, []);

  // Keyboard shortcuts
  useDesignerKeyboard({
    onCameraPreset: setCameraPreset,
    onResetView: resetView,
    onToggleWireframe: toggleWireframe,
    onToggleXray: toggleXray,
    onToggleProjection: toggleProjection,
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

  // Cursor swap only applies when multi-color is on too — `colorTool` is
  // cleared on disable, but guard defensively in case state ever drifts.
  const toolActive = colorTool !== null && showColors;

  return (
    <div
      className={`relative h-full w-full touch-manipulation ${
        toolActive ? '[&_canvas]:cursor-crosshair' : ''
      }`}
      role="img"
      aria-label={binDescription}
      onPointerDown={onDoubleTapPointerDown}
      onPointerUp={onDoubleTapPointerUp}
      onPointerCancel={onDoubleTapPointerCancel}
      // Page translators rewrap the frequently-updated overlay/status text
      // below, desyncing React's DOM and crashing the reconciler. This is a
      // 3D tool surface (icons + live status), so opting it out of translation
      // costs nothing and keeps the canvas subtree stable.
      translate="no"
    >
      {/* ARIA live region for status announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>

      {!webgl.available && webgl.reason ? (
        <WebGLFallback reason={webgl.reason} component="designer" />
      ) : showSkeleton ? (
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
            onCreated={({ gl }) => {
              setPreviewCanvas(gl.domElement);
            }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
          >
            <CameraRig
              projection={projection}
              initialPosition={[100, -100, 80]}
              target={[0, 0, totalH / 2]}
            />
            <PreviewContextSync />

            {/* Gradient background */}
            <GradientBackground />

            {/* 3-point lighting (theme-aware ground bounce) */}
            <SceneLighting />

            {/* Camera controller for auto-framing */}
            <CameraController
              controlsRef={controlsRef}
              invalidateRef={invalidateRef}
              projection={projection}
              width={width}
              depth={depth}
              height={height}
              gridUnitMm={params.gridUnitMm}
              heightUnitMm={params.heightUnitMm}
            />

            {/* Bin mesh — swap for per-piece meshes when split */}
            {showSplitPieces ? (
              <SplitBinMeshes color={previewColor} wireframe={wireframe} xray={xray} />
            ) : (
              <BinMesh
                wireframe={wireframe}
                xray={xray}
                color={previewColor}
                onZoneClick={handleZoneClick}
              />
            )}

            {/* Click-lock lid (renders only when params.lid.enabled produced
                a mesh). `lidOffsetMm` controls position + opacity in lockstep. */}
            <LidMesh
              color={previewColor}
              lidOffsetMm={lidOffsetMm}
              wireframe={wireframe}
              xray={xray}
            />
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

            {/* Overhang-section hover highlight — lights up the affected wall */}
            <OverhangHighlight />

            {/* Split lines for oversized bins — hidden when pieces are shown */}
            {!showSplitPieces && <BinSplitLines />}

            {/* Footprint grid */}
            {!hideChrome && (
              <FootprintGrid width={width} depth={depth} gridUnitMm={params.gridUnitMm} />
            )}

            {/* Dimension markers and labels — hidden for split pieces */}
            {!hideChrome && !showSplitPieces && (
              <>
                <BinAxisLabels width={width} depth={depth} gridUnitMm={params.gridUnitMm} />
                <BinDimensions
                  width={width}
                  depth={depth}
                  height={height}
                  gridUnitMm={params.gridUnitMm}
                  heightUnitMm={params.heightUnitMm}
                  stackingLip={params.base.stackingLip}
                />
                <BinNameLabel
                  width={width}
                  depth={depth}
                  gridUnitMm={params.gridUnitMm}
                  name={designName}
                />
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
            xray={xray}
            projection={projection}
            previewColor={previewColor}
            activePreset={activePreset}
            onWireframeToggle={toggleWireframe}
            onXrayToggle={toggleXray}
            onProjectionToggle={toggleProjection}
            onColorChange={handleColorChange}
            onCameraPreset={setCameraPreset}
            onResetView={resetView}
            needsSplit={needsSplit}
            splitViewMode={splitViewMode}
            onSplitViewModeChange={setSplitViewMode}
            hideColorPicker={showColors}
          />

          {/* Eyedropper toolbar button — only when multi-color is on. The
              button is paired with one in the Colors panel header; both
              enter eyedropper mode. */}
          {showColors && (
            <button
              type="button"
              onClick={() => setColorTool(colorTool === 'eyedropper' ? null : 'eyedropper')}
              className={`absolute bottom-3 left-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-md backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                colorTool === 'eyedropper'
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-stroke-subtle/60 bg-surface-elevated/90 text-content-secondary hover:text-content'
              }`}
              aria-label={t('binDesigner.colors.eyedropper.enter')}
              aria-pressed={colorTool === 'eyedropper'}
              title={t('binDesigner.colors.eyedropper.enter')}
            >
              <PipetteIcon size="sm" />
            </button>
          )}

          {/* Banner + click-anchored picker — rendered above canvas. The
              overlay reads `pickerOverlay` from the store, so any tool exit
              clears it without prop drilling. */}
          {showColors && <ColorToolOverlay onClosePicker={handleClosePicker} />}

          {/* Touch gesture hint (mobile/tablet first visit) */}
          <TouchHint />
        </PanelErrorBoundary>
      )}
    </div>
  );
}
