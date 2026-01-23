/**
 * Three.js 3D preview canvas for the bin designer.
 * Renders the generated mesh with orbit controls and camera presets.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useDesignerStore } from '@/features/bin-designer/store';
import { BinMesh, PreviewControls, PreviewSkeleton, type CameraPreset } from './preview';
import { useDesignerKeyboard } from '../hooks/useDesignerKeyboard';
import { setPreviewCanvas, clearPreviewCanvas } from '../utils/thumbnail';
import { describeBin, getStatusAnnouncement } from '../utils/a11y';
import { useResponsive } from '@/shared/hooks/useResponsive';

/** Camera positions for each preset (eye position looking at origin) */
const CAMERA_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  front: [0, -120, 30],
  side: [120, 0, 30],
  top: [0, -1, 150],
  isometric: [80, -80, 60],
};

const DEFAULT_CAMERA: [number, number, number] = CAMERA_POSITIONS.isometric;

/**
 * Render the 3D preview canvas for the bin designer, including scene, controls, UI overlays, and input handlers.
 *
 * The component:
 * - Renders lighting, the bin mesh, a subtle floor grid, and OrbitControls configured for a Z-up workflow.
 * - Exposes camera presets and a reset view, a wireframe toggle, and undo/redo integration via keyboard shortcuts.
 * - Registers the WebGL canvas for thumbnail capture on creation and clears that registration on unmount.
 * - Shows a skeleton placeholder when no mesh is available or WASM is not ready, and a translucent "Updating..." overlay while generation is in progress.
 *
 * @returns The React element containing the preview canvas and its associated controls and overlays.
 */
export function PreviewCanvas() {
  const controlsRef = useRef<OrbitControlsType>(null);
  const [wireframe, setWireframe] = useState(false);

  // Clean up canvas ref on unmount
  useEffect(() => {
    return () => clearPreviewCanvas();
  }, []);

  const { wasmStatus, generationStatus, hasMesh, params } = useDesignerStore(
    useShallow((s) => ({
      wasmStatus: s.wasmStatus,
      generationStatus: s.generation.status,
      hasMesh: s.generation.mesh !== null && s.generation.mesh.vertices !== null,
      params: s.params,
    }))
  );

  // Screen reader description of the current bin
  const binDescription = describeBin(params);
  const statusAnnouncement = getStatusAnnouncement(wasmStatus, generationStatus, hasMesh);

  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);

  const setCameraPreset = useCallback((preset: CameraPreset) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const pos = CAMERA_POSITIONS[preset];
    controls.object.up.set(0, 0, 1); // Maintain Z-up after orbit manipulation
    controls.object.position.set(pos[0], pos[1], pos[2]);
    controls.target.set(0, 0, 20);
    controls.update();
  }, []);

  const resetView = useCallback(() => {
    setCameraPreset('isometric');
  }, [setCameraPreset]);

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
  });

  const [highContrast, setHighContrast] = useState(false);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((hc) => !hc);
  }, []);

  const showSkeleton = !hasMesh || wasmStatus !== 'ready';
  const showOverlay = generationStatus === 'generating' && hasMesh;

  return (
    <div
      className="relative h-full w-full"
      role="img"
      aria-label={binDescription}
    >
      {/* ARIA live region for status announcements (visually hidden) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusAnnouncement}
      </div>

      {showSkeleton ? (
        <PreviewSkeleton wasmStatus={wasmStatus} generationStatus={generationStatus} />
      ) : (
        <>
          <Canvas
            camera={{
              position: new Vector3(...DEFAULT_CAMERA),
              fov: 45,
              near: 0.1,
              far: 1000,
            }}
            onCreated={({ camera, gl }) => {
              // Must set up vector imperatively before OrbitControls reads it.
              // The camera config 'up' prop doesn't apply early enough.
              camera.up.set(0, 0, 1);
              camera.lookAt(0, 0, 20);
              // Register canvas for thumbnail capture
              setPreviewCanvas(gl.domElement);
            }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
          >
            {/* Scene background (high contrast = dark) */}
            <color attach="background" args={[highContrast ? '#1a1a2e' : '#f8f9fa']} />

            {/* Lighting - boosted for high contrast */}
            <ambientLight intensity={highContrast ? 0.6 : 0.4} />
            <directionalLight position={[50, -50, 100]} intensity={highContrast ? 1.0 : 0.8} />
            <directionalLight position={[-30, 40, 60]} intensity={highContrast ? 0.5 : 0.3} />

            {/* Mesh */}
            <BinMesh wireframe={wireframe} highContrast={highContrast} />

            {/* Floor grid */}
            <gridHelper
              args={[200, 20, highContrast ? '#4a5568' : '#d1d5db', highContrast ? '#2d3748' : '#e5e7eb']}
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, 0, 0]}
            />

            {/* Controls - Z-up orbit with polar limits to prevent flipping */}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              target={[0, 0, 20]}
              enableDamping
              dampingFactor={0.12}
              rotateSpeed={0.8}
              minDistance={20}
              maxDistance={400}
              maxPolarAngle={Math.PI * 0.85}
              minPolarAngle={Math.PI * 0.05}
            />
          </Canvas>

          {/* Generating overlay */}
          {showOverlay && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[1px]">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                Updating...
              </span>
            </div>
          )}

          {/* Control buttons */}
          <PreviewControls
            wireframe={wireframe}
            highContrast={highContrast}
            onWireframeToggle={toggleWireframe}
            onHighContrastToggle={toggleHighContrast}
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

/**
 * Displays a one-time, dismissible touch-gesture hint bar for touch-enabled, non-desktop devices.
 *
 * The hint appears on first visit when a touch device is detected and no prior dismissal is recorded.
 * Dismissing the hint hides it and persists the dismissal in localStorage so it does not reappear.
 *
 * @returns A React element rendering the touch hint bar, or `null` when the hint is not visible.
 */
function TouchHint() {
  const { isTouchDevice, isDesktop } = useResponsive();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isTouchDevice && !isDesktop && !localStorage.getItem(TOUCH_HINT_KEY)) {
      setVisible(true);
    }
  }, [isTouchDevice, isDesktop]);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(TOUCH_HINT_KEY, '1');
  }, []);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-3 flex justify-center"
      role="status"
      aria-label="Touch gesture hints"
    >
      <div className="flex items-center gap-3 rounded-full bg-black/70 px-4 py-2 text-[11px] text-white shadow-lg backdrop-blur-sm">
        <span>Drag to orbit</span>
        <span className="h-3 w-px bg-white/30" />
        <span>Pinch to zoom</span>
        <span className="h-3 w-px bg-white/30" />
        <span>2 fingers to pan</span>
        <button
          onClick={dismiss}
          className="ml-1 rounded-full p-0.5 hover:bg-white/20"
          aria-label="Dismiss touch hints"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}