/**
 * Three.js 3D preview canvas for the bin designer.
 * Renders the generated mesh with enhanced lighting, gradient background,
 * smooth camera transitions, auto-framing, dimension lines, and a footprint grid.
 */

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { Vector3, Spherical } from 'three';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useDesignerRouting } from '@/hooks/useDesignerRouting';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  BinMesh,
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
  BinSplitLines,
  type CameraPreset,
} from '../preview';
import { GradientBackground } from '../preview/GradientBackground';
import { FootprintGrid } from '../preview/FootprintGrid';
import { useDesignerKeyboard } from '../../hooks/useDesignerKeyboard';
import { setPreviewCanvas, setPreviewContext, clearPreviewCanvas } from '../../utils/thumbnail';
import { describeBin, getStatusAnnouncement } from '../../utils/a11y';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';

/** localStorage key for persisting the user's preview color preference */
const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';
const DEFAULT_COLOR = '#d4d8dc';

/** Camera positions for each preset (eye position looking toward center) */
const CAMERA_PRESETS: Record<CameraPreset, [number, number, number]> = {
  front: [0, -1, 0.3], // Normalized direction — scaled by distance
  side: [1, 0, 0.3],
  top: [0, -0.01, 1],
  isometric: [0.6, -0.6, 0.5],
};

/** Animation duration for camera transitions (ms) */
const TRANSITION_DURATION = 500;
/** Animation duration for auto-framing (ms) */
const AUTO_FRAME_DURATION = 300;
/** Margin factor: how much of the viewport the bin should fill */
const FRAME_FILL = 0.65;
/** Minimum change in distance to trigger auto-frame animation */
const REFRAME_THRESHOLD = 0.1; // 10% change

/**
 * Calculate ideal camera distance to frame a bin of the given dimensions.
 * Uses perspective camera FOV geometry to ensure the bin fills ~65% of viewport.
 */
function calculateIdealDistance(width: number, depth: number, height: number, fov: number): number {
  const outerW = width * GRIDFINITY.GRID_SIZE;
  const outerD = depth * GRIDFINITY.GRID_SIZE;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;

  // Bounding sphere radius (from center of bin)
  const halfW = outerW / 2;
  const halfD = outerD / 2;
  const halfH = totalH / 2;
  const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);

  // Distance = radius / sin(halfFov) * marginFactor
  const halfFovRad = (fov / 2) * (Math.PI / 180);
  return (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
}

/**
 * Calculate the bin's center point in 3D space (for camera target).
 * Mesh is centered at (0, 0) in XY, base at Z=0 — only height affects the target.
 */
function calculateBinCenter(_width: number, _depth: number, height: number): Vector3 {
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  return new Vector3(0, 0, totalH / 2);
}

/**
 * Inner scene component that handles camera animation via useFrame.
 * Must be inside the Canvas to access Three.js context.
 */
function CameraController({
  controlsRef,
  invalidateRef,
  width,
  depth,
  height,
}: {
  controlsRef: React.RefObject<OrbitControlsType | null>;
  invalidateRef: React.RefObject<(() => void) | null>;
  width: number;
  depth: number;
  height: number;
}) {
  const { camera, invalidate } = useThree();

  // Expose invalidate to hooks outside Canvas context
  useEffect(() => {
    invalidateRef.current = invalidate;
  }, [invalidate, invalidateRef]);
  const animRef = useRef<{
    startPos: Vector3;
    targetPos: Vector3;
    startTime: number;
    duration: number;
  } | null>(null);
  const prevDistanceRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const fov = 45;
  const binCenter = useMemo(() => calculateBinCenter(width, depth, height), [width, depth, height]);
  const idealDistance = useMemo(
    () => calculateIdealDistance(width, depth, height, fov),
    [width, depth, height, fov]
  );

  // Auto-frame: when bin dimensions change, smoothly adjust camera distance
  useEffect(() => {
    if (!initializedRef.current) {
      // First render: set camera immediately
      const direction = new Vector3(...CAMERA_PRESETS.isometric).normalize();
      camera.position.copy(direction.multiplyScalar(idealDistance).add(binCenter));
      camera.up.set(0, 0, 1);
      camera.lookAt(binCenter);
      if (controlsRef.current) {
        controlsRef.current.target.copy(binCenter);
        controlsRef.current.update();
      }
      prevDistanceRef.current = idealDistance;
      initializedRef.current = true;
      return;
    }

    const prevDistance = prevDistanceRef.current ?? idealDistance;
    const distanceChange = Math.abs(idealDistance - prevDistance) / prevDistance;

    if (distanceChange > REFRAME_THRESHOLD) {
      // Significant size change: animate to new framing
      const currentPos = camera.position.clone();
      const currentDir = currentPos.clone().sub(binCenter).normalize();
      const targetPos = currentDir.multiplyScalar(idealDistance).add(binCenter);

      animRef.current = {
        startPos: currentPos,
        targetPos,
        startTime: performance.now(),
        duration: AUTO_FRAME_DURATION,
      };
    }

    prevDistanceRef.current = idealDistance;
  }, [idealDistance, binCenter, camera, controlsRef]);

  // Update target when bin center changes
  useEffect(() => {
    if (controlsRef.current && initializedRef.current) {
      controlsRef.current.target.copy(binCenter);
      controlsRef.current.update();
    }
  }, [binCenter, controlsRef]);

  // Animate camera position each frame
  useFrame(() => {
    const anim = animRef.current;
    if (!anim) return;

    const elapsed = performance.now() - anim.startTime;
    const progress = Math.min(elapsed / anim.duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(anim.startPos, anim.targetPos, eased);
    camera.lookAt(binCenter);
    invalidate();

    if (progress >= 1) {
      animRef.current = null;
      controlsRef.current?.update();
    }
  });

  return null;
}

/**
 * Manages smooth camera preset transitions using spherical coordinate interpolation.
 */
function usePresetTransition(
  controlsRef: React.RefObject<OrbitControlsType | null>,
  invalidateRef: React.RefObject<(() => void) | null>,
  width: number,
  depth: number,
  height: number
) {
  const animFrameRef = useRef<number | null>(null);

  const setCameraPreset = useCallback(
    (preset: CameraPreset) => {
      const controls = controlsRef.current;
      if (!controls) return;

      const camera = controls.object;
      const fov = 45;
      const binCenter = calculateBinCenter(width, depth, height);
      const idealDistance = calculateIdealDistance(width, depth, height, fov);

      // Calculate target position from preset direction
      const direction = new Vector3(...CAMERA_PRESETS[preset]).normalize();
      const targetPosition = direction.multiplyScalar(idealDistance).add(binCenter);

      // Current camera state
      const startPosition = camera.position.clone();
      const target = binCenter.clone();

      // Convert to spherical for smooth arc interpolation
      const startSpherical = new Spherical().setFromVector3(startPosition.clone().sub(target));
      const targetSpherical = new Spherical().setFromVector3(targetPosition.clone().sub(target));

      const startTime = performance.now();

      // Cancel existing animation
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        // Ease-out cubic for natural deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        // Interpolate in spherical coordinates for smooth arc
        const currentSpherical = new Spherical(
          startSpherical.radius + (targetSpherical.radius - startSpherical.radius) * eased,
          startSpherical.phi + (targetSpherical.phi - startSpherical.phi) * eased,
          startSpherical.theta + (targetSpherical.theta - startSpherical.theta) * eased
        );

        const newPosition = new Vector3().setFromSpherical(currentSpherical).add(target);
        camera.position.copy(newPosition);
        camera.up.set(0, 0, 1);
        camera.lookAt(target);
        // Update controls and explicitly invalidate for demand mode rendering
        controls.target.copy(target);
        controls.update();
        invalidateRef.current?.();

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          animFrameRef.current = null;
        }
      };

      animate();
    },
    [controlsRef, invalidateRef, width, depth, height]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return setCameraPreset;
}

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

  const { wasmStatus, generationStatus, hasMesh, meshError, params, designName, canRevert } =
    useDesignerStore(
      useShallow((s) => ({
        wasmStatus: s.wasmStatus,
        generationStatus: s.generation.status,
        hasMesh: s.generation.mesh !== null && s.generation.mesh.vertices !== null,
        meshError: s.generation.mesh?.error ?? null,
        params: s.params,
        designName: s.designName,
        canRevert: s.history.past.length > 0,
      }))
    );

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
    params.height
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

  // Bin dimensions for scene elements
  const { width, depth, height } = params;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;

  const showSkeleton = !hasMesh || wasmStatus !== 'ready';
  const showOverlay = generationStatus === 'generating' && hasMesh;

  return (
    <div className="relative h-full w-full" role="img" aria-label={binDescription}>
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
        <>
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

            {/* 3-point lighting (matching main grid preview) */}
            <hemisphereLight args={['#ffffff', '#1a1a2e', 0.65]} />
            <directionalLight position={[-50, 60, 80]} intensity={0.85} color="#fff8f0" />
            <directionalLight position={[40, -40, 30]} intensity={0.15} color="#e0e8ff" />

            {/* Camera controller for auto-framing */}
            <CameraController
              controlsRef={controlsRef}
              invalidateRef={invalidateRef}
              width={width}
              depth={depth}
              height={height}
            />

            {/* Bin mesh with vertex coloring */}
            <BinMesh wireframe={wireframe} color={previewColor} />

            {/* Ghost outlines during generation */}
            <GhostWireframe />
            <GhostDividers />
            <GhostCompartmentPreview />
            <GhostLabelTabs />
            <GhostScoops />
            <GhostSlotLines />
            <GhostDividerPieces />
            <GhostCutouts />

            {/* Split lines for oversized bins */}
            <BinSplitLines />

            {/* Footprint grid */}
            <FootprintGrid width={width} depth={depth} />

            {/* Grid axis labels */}
            <BinAxisLabels width={width} depth={depth} />

            {/* Dimension markers */}
            <BinDimensions
              width={width}
              depth={depth}
              height={height}
              gridUnitMm={params.gridUnitMm}
              heightUnitMm={params.heightUnitMm}
              stackingLip={params.base.stackingLip}
            />

            {/* Design name on floor */}
            <BinNameLabel width={width} depth={depth} name={designName} />

            {/* Orbit controls - Z-up with polar limits */}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              target={[0, 0, totalH / 2]}
              enableDamping
              dampingFactor={0.12}
              rotateSpeed={0.8}
              minDistance={20}
              maxDistance={800}
              maxPolarAngle={Math.PI * 0.85}
              minPolarAngle={Math.PI * 0.05}
              onStart={handleOrbitStart}
            />
          </Canvas>

          {/* Nostalgic loading indicator (bottom center) */}
          {showOverlay && <GeneratingIndicator />}

          {/* Control buttons */}
          <PreviewControls
            wireframe={wireframe}
            previewColor={previewColor}
            activePreset={activePreset}
            onWireframeToggle={toggleWireframe}
            onColorChange={handleColorChange}
            onCameraPreset={setCameraPreset}
            onResetView={resetView}
          />

          {/* Touch gesture hint (mobile/tablet first visit) */}
          <TouchHint />
        </>
      )}
    </div>
  );
}

const TOUCH_HINT_KEY = 'gridfinity-designer-touch-hint-dismissed';

function getStoredHintDismissed(): boolean {
  try {
    return !!localStorage.getItem(TOUCH_HINT_KEY);
  } catch {
    return false;
  }
}

function TouchHint() {
  const t = useTranslation();
  const { isTouchDevice, isDesktop } = useResponsive();
  const [dismissed, setDismissed] = useState(false);

  const visible = !dismissed && isTouchDevice && !isDesktop && !getStoredHintDismissed();

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(TOUCH_HINT_KEY, '1');
    } catch {
      /* storage unavailable */
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-3 flex justify-center"
      role="status"
      aria-label={t('binDesigner.touchGestureHints')}
    >
      <div className="flex items-center gap-3 rounded-full bg-black/70 px-4 py-2 text-[11px] text-white shadow-lg backdrop-blur-sm">
        <span>{t('binDesigner.dragToOrbit')}</span>
        <span className="h-3 w-px bg-white/30" />
        <span>{t('binDesigner.pinchToZoom')}</span>
        <span className="h-3 w-px bg-white/30" />
        <span>{t('binDesigner.2FingersToPan')}</span>
        <button
          onClick={dismiss}
          className="ml-1 rounded-full p-0.5 hover:bg-white/20"
          aria-label={t('binDesigner.dismissTouchHints')}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path d="M3 3l6 6M9 3l-6 6" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Number of nostalgic loading messages (SimCity/Maxis-inspired) available in i18n */
const LOADING_MESSAGE_COUNT = 12;

/**
 * Nostalgic loading indicator that cycles through SimCity-style messages.
 * Shows at the bottom center of the 3D preview during mesh regeneration.
 */
function GeneratingIndicator() {
  const t = useTranslation();

  const loadingMessages = useMemo(
    () =>
      Array.from({ length: LOADING_MESSAGE_COUNT }, (_, i) => t(`binDesigner.loadingMessage.${i}`)),
    [t]
  );

  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGE_COUNT)
  );

  // Cycle through messages every 1.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGE_COUNT);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="absolute inset-x-0 bottom-4 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 rounded-lg border border-stroke-subtle bg-surface-elevated/95 px-4 py-2 font-mono text-xs shadow-lg backdrop-blur-sm">
        <svg
          className="h-4 w-4 shrink-0 text-accent animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-80"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-content-secondary">{loadingMessages[messageIndex]}</span>
      </div>
    </div>
  );
}
