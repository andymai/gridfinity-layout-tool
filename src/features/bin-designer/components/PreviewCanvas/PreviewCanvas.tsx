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
import { binSplitChunkUnits } from '@/shared/utils/binSplitFit';
import { PanelErrorBoundary } from '@/shell/PanelErrorBoundary';
import {
  BinMesh,
  LidMesh,
  StackPlateMesh,
  SlideTrayMesh,
  DetachableFeetMesh,
  KnifeRestMesh,
  LabelPlateMeshes,
  LidGuideLine,
  LidExplodeSlider,
  FeetDetachSlider,
  LID_OFFSET_DEFAULT,
  EXPLODE_SLIDER_SLOTS,
  BinAxisLabels,
  AssembledBinDimensions,
  CompartmentDimensions,
  MeasureTool,
  BinNameLabel,
  PreviewControls,
  PreviewSkeleton,
  GhostDividers,
  GhostWireframe,
  GhostCompartmentPreview,
  GhostLabelTabs,
  GhostScoops,
  GhostSlotLines,
  GhostAuthoredDividers,
  GhostDividerPieces,
  GhostCutouts,
  GhostLidCutouts,
  GhostWallCutouts,
  GhostHandles,
  GhostSurfaceText,
  GhostKnives,
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
import { stackPitchMm } from '@/shared/utils/heightUnits';
import { useTranslation } from '@/i18n';
import { hasDetachableFeet } from '@/features/bin-designer/types/base';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import {
  CameraController,
  usePresetTransition,
  SceneLighting,
  calculateIdealDistance,
  CAMERA_FOV,
} from './previewCanvasCamera';
import { CameraRig } from '@/shared/components/preview/CameraRig';
import { TouchHint, GeneratingIndicator } from './previewCanvasOverlays';
import { detectWebGL, WebGLFallback, WebGLErrorBoundary } from '@/shared/webgl';
import { WorkshopCanvas } from '../Workshop/WorkshopCanvas';
import { ColorToolOverlay } from './ColorToolOverlay';
import { MeasureOverlay } from './MeasureOverlay';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import { PipetteIcon } from '@/design-system/Icon';
import { IconButton } from '@/design-system';
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

/** Body height (stack pitch) rounded like the height dimension label. */
function formatStackPitch(pitchMm: number): string {
  return Number.isInteger(pitchMm) ? String(pitchMm) : pitchMm.toFixed(1);
}

export function PreviewCanvas(props: PreviewCanvasProps = {}) {
  const itemKind = useDesignerStore((s) => s.itemKind);
  if (itemKind === 'assembly') return <WorkshopCanvas />;
  return <BinPreviewCanvas {...props} />;
}

function BinPreviewCanvas({ hideChrome = false }: PreviewCanvasProps = {}) {
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
  // Feet get their own offset, starting attached: a lid opens so you can see
  // inside, but feet are what the bin stands on. Sharing the lid's value also
  // stranded them 30mm down on a bin with no lid, where the slider that set it
  // is never rendered.
  const [feetOffsetMm, setFeetOffsetMm] = useState<number>(0);
  // The knife rest starts mated at its planned gap: that gap IS the design
  // decision the preview is showing, so opening it by default would show a
  // spacing nobody chose.
  const [restOffsetMm, setRestOffsetMm] = useState<number>(0);

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
    isDraft,
    hasMesh,
    meshError,
    params,
    envelope,
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
      isDraft: s.generation.isDraft,
      hasMesh: s.generation.mesh !== null && s.generation.mesh.vertices !== null,
      meshError: s.generation.mesh?.error ?? null,
      params: s.params,
      envelope: s.envelope,
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

  // A bin can carry several sliders, and they share one anchor on the right
  // edge — so each takes the next free slot down the list.
  const showLidSlider = params.lid.enabled && params.base.stackingLip;
  const showFeetSlider = hasDetachableFeet(params.base);
  // Companion only: an integrated rest is part of the block, so there is
  // nothing to separate from it.
  const showRestSlider = useMemo(() => planKnifeRest(params)?.style === 'companion', [params]);
  // The angle a hinged lid comes to rest at, or null when this lid is not
  // hinged. Read from the PLAN, so the slider cannot offer an angle the
  // geometry was not trimmed for.
  const hingeStopDeg = useMemo(() => planHingeLid(params).geometry?.stopAngleDeg ?? null, [params]);
  const restSliderSlot = EXPLODE_SLIDER_SLOTS[(showLidSlider ? 1 : 0) + (showFeetSlider ? 1 : 0)];

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

  // Same stale-value problem the lid has: the rest's slider unmounts with the
  // rest, but the offset it set is parent-owned and outlives it.
  const wasRestEnabledRef = useRef(showRestSlider);
  useEffect(() => {
    if (showRestSlider && !wasRestEnabledRef.current) setRestOffsetMm(0);
    wasRestEnabledRef.current = showRestSlider;
  }, [showRestSlider]);

  const { defaultPrintBedSize: bedSize, defaultPrintBedDepth: bedDepth } = useSettingsStore(
    useShallow((s) => ({
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      defaultPrintBedDepth: s.settings.defaultPrintBedDepth,
    }))
  );
  const maxGrid = useMemo(
    () => binSplitChunkUnits(params, bedSize, bedDepth),
    [bedSize, bedDepth, params]
  );
  const needsSplit = params.width > maxGrid.width || params.depth > maxGrid.depth;

  // Drive split piece mesh generation when bin exceeds print bed
  useSplitPreview();

  // Show split piece meshes when pieces are generated and bin needs splitting
  const showSplitPieces = splitPieceMeshes.length > 0 && needsSplit;

  // Screen reader description
  const binDescription = describeBin(params);
  const statusAnnouncement = getStatusAnnouncement(wasmStatus, generationStatus, hasMesh, t);

  const measureActive = useDesignerStore((s) => s.ui.measure.active);
  const setMeasureActive = useDesignerStore((s) => s.setMeasureActive);
  const toggleMeasure = useCallback(
    () => setMeasureActive(!measureActive),
    [measureActive, setMeasureActive]
  );

  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  // Ghost overlays read bin sub-configs (compartments, scoop, dividers, …);
  // gate them off for non-bin item kinds.
  const isBinKind = useDesignerStore((s) => s.itemKind === 'bin');
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
    params.heightUnitMm,
    params.gridUnitMmY
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
    if (wasmStatus === 'unsupported') return;
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
  const width = envelope?.width ?? params.width;
  const depth = envelope?.depth ?? params.depth;
  const height = params.height;
  const totalH = height * params.heightUnitMm;

  // A Manifold pre-draft can land while the exact worker's WASM is still
  // loading (cold start) — show it rather than the skeleton; the overlay below
  // keeps signalling that the exact geometry is still on its way.
  const showSkeleton =
    !hasMesh ||
    wasmStatus === 'error' ||
    wasmStatus === 'unsupported' ||
    (wasmStatus !== 'ready' && !isDraft);
  // Keep the loading indicator up while a fast draft is shown and the exact
  // geometry is still computing (manifold_preview), not just during 'generating'.
  const showOverlay = (generationStatus === 'generating' || isDraft) && hasMesh;

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
        <WebGLFallback />
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
          <WebGLErrorBoundary>
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
                // The default 2000mm far plane sits INSIDE the framing
                // distance for the largest bins (a 16x16x50 frames at
                // ~2040mm), clipping the rear half and the target itself.
                // 1.6x the ideal distance clears the far side of the bounding
                // sphere (ideal ≈ 2.4x the radius at this fov).
                far={Math.max(
                  2000,
                  1.6 *
                    calculateIdealDistance(
                      width,
                      depth,
                      height,
                      CAMERA_FOV,
                      params.gridUnitMm,
                      params.heightUnitMm,
                      params.gridUnitMmY ?? params.gridUnitMm
                    )
                )}
              />
              <PreviewContextSync />

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
                gridUnitMmY={params.gridUnitMmY}
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
              {/* Separate stack-grid baseplate (renders only when
                params.lid.separateStackPlate produced a mesh) — floats above
                the lid to show the glue-on split. */}
              <StackPlateMesh
                color={previewColor}
                lidOffsetMm={lidOffsetMm}
                wireframe={wireframe}
                xray={xray}
              />
              {/* Sliding tray, seated on its rail (renders only when
                params.slide produced a mesh). Shown in place because the
                mechanism is the point, and how far it stands proud of the rim
                is only obvious when you can see it sitting there. */}
              <SlideTrayMesh
                color={previewColor}
                lidOffsetMm={lidOffsetMm}
                wireframe={wireframe}
                xray={xray}
              />
              <DetachableFeetMesh
                color={previewColor}
                offsetMm={feetOffsetMm}
                wireframe={wireframe}
                xray={xray}
              />
              {/* Knife-block handle rest, standing beside the block on the same
                ground plane (renders only when the design's rest is a
                companion and the worker produced it). */}
              <KnifeRestMesh
                color={previewColor}
                offsetMm={restOffsetMm}
                wireframe={wireframe}
                xray={xray}
              />
              {/* Swappable label plates (socket mode): seated in their sockets
                and again in a reference row beside the bin. Shares the explode
                slider — it withdraws the seated ones, the row stays put. */}
              <LabelPlateMeshes
                color={previewColor}
                lidOffsetMm={lidOffsetMm}
                wireframe={wireframe}
              />
              {/* Dashed guide line between bin's lip top and lid's mating opening,
                visible only when the lid is meaningfully exploded. */}
              {params.lid.enabled && params.base.stackingLip && (
                <LidGuideLine lidOffsetMm={lidOffsetMm} />
              )}

              {/* Through-cuts in the lid's plate. Outside the bin-overlay block
                below because it rides the lid, not the bin, and needs the same
                explode offset the lid mesh does. */}
              <GhostLidCutouts lidOffsetMm={lidOffsetMm} />

              {/* Ghost outlines during generation (bin-only feature overlays) */}
              {isBinKind && (
                <>
                  <GhostWireframe />
                  <GhostDividers />
                  <GhostCompartmentPreview />
                  <GhostLabelTabs />
                  <GhostScoops />
                  <GhostSlotLines />
                  <GhostAuthoredDividers />
                  <GhostDividerPieces />
                  <GhostCutouts />
                  <GhostWallCutouts />
                  <GhostHandles />
                  <GhostSurfaceText />
                  <GhostKnives />
                </>
              )}

              {/* Overhang-section hover highlight — lights up the affected wall */}
              <OverhangHighlight />

              {/* Split lines for oversized bins — hidden when pieces are shown */}
              {!showSplitPieces && <BinSplitLines />}

              {/* Footprint grid */}
              {!hideChrome && (
                <FootprintGrid
                  width={width}
                  depth={depth}
                  gridUnitMm={params.gridUnitMm}
                  gridUnitMmY={params.gridUnitMmY}
                />
              )}

              {/* Dimension markers and labels — hidden for split pieces */}
              {!hideChrome && !showSplitPieces && (
                <>
                  <BinAxisLabels
                    width={width}
                    depth={depth}
                    gridUnitMm={params.gridUnitMm}
                    gridUnitMmY={params.gridUnitMmY}
                  />
                  {isBinKind && (
                    <>
                      <AssembledBinDimensions
                        width={width}
                        depth={depth}
                        gridUnitMm={params.gridUnitMm}
                        gridUnitMmY={params.gridUnitMmY}
                        stackPitchLabel={
                          params.base.stackingLip
                            ? t('stackSolver.overlayPitch', {
                                pitch: formatStackPitch(stackPitchMm(height, params.heightUnitMm)),
                              })
                            : undefined
                        }
                      />
                      {/* Active-compartment cavity dimensions (hover/select driven) */}
                      <CompartmentDimensions />
                    </>
                  )}
                  <BinNameLabel
                    width={width}
                    depth={depth}
                    gridUnitMm={params.gridUnitMm}
                    gridUnitMmY={params.gridUnitMmY}
                    name={designName}
                  />
                </>
              )}

              {/* Measuring tool. Last in the scene so its overlay draws over the
                  model; it raycasts the mesh arrays itself rather than joining
                  the scene, so nothing here reaches the published GLB. */}
              <MeasureTool />

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
          </WebGLErrorBoundary>

          {/* Nostalgic loading indicator (bottom center) */}
          {showOverlay && <GeneratingIndicator />}

          {/* Lid explode slider — only when the bin has a lid configured AND
              its stacking lip is on (lid won't render/export without lip). */}
          {/* A hinged lid swings, so its slider carries DEGREES and stops where
              the lid does. Same control, different units — see the slider's own
              note on why this is a prop and not a second component. */}
          {showLidSlider && (
            <LidExplodeSlider
              value={lidOffsetMm}
              onChange={setLidOffsetMm}
              {...(hingeStopDeg !== null
                ? {
                    max: hingeStopDeg,
                    unit: t('binDesigner.preview.degreeUnit'),
                    labels: {
                      open: t('binDesigner.preview.lidOpen'),
                      closed: t('binDesigner.preview.lidClosed'),
                      aria: t('binDesigner.preview.lidHingeSlider'),
                    },
                  }
                : {})}
            />
          )}

          {showFeetSlider && (
            <FeetDetachSlider
              value={feetOffsetMm}
              onChange={setFeetOffsetMm}
              showsBesideLid={showLidSlider}
            />
          )}

          {/* Slides the handle rest further from the block along the exit axis.
              Not inverted: the rest travels sideways, so neither end of the
              track is the way the part moves, and "up = further apart" is the
              reading the lid's slider already established. */}
          {showRestSlider && (
            <LidExplodeSlider
              value={restOffsetMm}
              onChange={setRestOffsetMm}
              slot={restSliderSlot}
              labels={{
                open: t('binDesigner.preview.knifeRestApart'),
                closed: t('binDesigner.preview.knifeRestMated'),
                aria: t('binDesigner.preview.knifeRestSlider'),
              }}
            />
          )}

          {/* Control buttons */}
          {!hideChrome && (
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
              measureActive={measureActive}
              onMeasureToggle={toggleMeasure}
            />
          )}

          {/* Eyedropper toolbar button — only when multi-color is on. The
              button is paired with one in the Colors panel header; both
              enter eyedropper mode. */}
          {!hideChrome && showColors && (
            <IconButton
              type="button"
              touchTarget={false}
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
            </IconButton>
          )}

          {/* Banner + click-anchored picker — rendered above canvas. The
              overlay reads `pickerOverlay` from the store, so any tool exit
              clears it without prop drilling. */}
          {showColors && <ColorToolOverlay onClosePicker={handleClosePicker} />}

          {/* Measuring tool chrome. Renders its own null when inactive, and is
              not gated on `showColors` because the two tools are exclusive. */}
          <MeasureOverlay />

          {/* Touch gesture hint (mobile/tablet first visit) */}
          <TouchHint />
        </PanelErrorBoundary>
      )}
    </div>
  );
}
