/**
 * Three.js 3D preview canvas for the bin designer.
 * Renders the generated mesh with orbit controls and camera presets.
 */

import { useRef, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useDesignerStore } from '@/features/bin-designer/store';
import { BinMesh, PreviewControls, PreviewSkeleton, type CameraPreset } from './preview';
import { useDesignerKeyboard } from '../hooks/useDesignerKeyboard';

/** Camera positions for each preset (eye position looking at origin) */
const CAMERA_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  front: [0, -120, 30],
  side: [120, 0, 30],
  top: [0, -1, 150],
  isometric: [80, -80, 60],
};

const DEFAULT_CAMERA: [number, number, number] = CAMERA_POSITIONS.isometric;

export function PreviewCanvas() {
  const controlsRef = useRef<OrbitControlsType>(null);
  const [wireframe, setWireframe] = useState(false);

  const { wasmStatus, generationStatus, hasMesh } = useDesignerStore(
    useShallow((s) => ({
      wasmStatus: s.wasmStatus,
      generationStatus: s.generation.status,
      hasMesh: s.generation.mesh !== null && s.generation.mesh.vertices !== null,
    }))
  );

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
  });

  const showSkeleton = !hasMesh || wasmStatus !== 'ready';
  const showOverlay = generationStatus === 'generating' && hasMesh;

  return (
    <div className="relative h-full w-full">
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
            onCreated={({ camera }) => {
              // Must set up vector imperatively before OrbitControls reads it.
              // The camera config 'up' prop doesn't apply early enough.
              camera.up.set(0, 0, 1);
              camera.lookAt(0, 0, 20);
            }}
            gl={{ antialias: true }}
          >
            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight position={[50, -50, 100]} intensity={0.8} />
            <directionalLight position={[-30, 40, 60]} intensity={0.3} />

            {/* Mesh */}
            <BinMesh wireframe={wireframe} />

            {/* Floor grid (subtle) */}
            <gridHelper
              args={[200, 20, '#d1d5db', '#e5e7eb']}
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
            onWireframeToggle={toggleWireframe}
            onCameraPreset={setCameraPreset}
            onResetView={resetView}
          />
        </>
      )}
    </div>
  );
}
