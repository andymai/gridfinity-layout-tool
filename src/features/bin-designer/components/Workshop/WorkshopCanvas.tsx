/**
 * The Workshop 3D editor canvas — replaces the bin PreviewCanvas while the
 * designer holds an assembly. Parts render as instant client-side proxies;
 * the exact worker-fused solid joins in a later phase.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { detectWebGL, WebGLFallback, WebGLErrorBoundary } from '@/shared/webgl';
import {
  clearPreviewCanvas,
  setPreviewCanvas,
  setPreviewContext,
} from '@/features/bin-designer/utils/thumbnail';
import { useDesignerKeyboard } from '@/features/bin-designer/hooks/useDesignerKeyboard';
import { usePresetTransition } from '@/features/bin-designer/components/PreviewCanvas/previewCanvasCamera';
import { assemblyHeightUnits } from '@/shared/types/assemblyPlacement';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { WorkshopScene } from './WorkshopScene';
import { WorkshopViewBar } from './WorkshopViewBar';
import { WorkshopContextMenu, type WorkshopMenuState } from './WorkshopContextMenu';

const noop = (): void => undefined;

/** Registers this canvas with the thumbnail pipeline (see PreviewContextSync). */
function WorkshopContextSync() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      setPreviewContext(gl, scene, camera);
    }
  }, [gl, scene, camera]);
  return null;
}

export function WorkshopCanvas() {
  const { structure, envelope } = useDesignerStore(
    useShallow((s) => ({ structure: s.structure, envelope: s.envelope }))
  );
  // An armed click that hits no surface would otherwise be a silent no-op;
  // a brief pulse on the base plate shows where placement is valid.
  const [missFlashAt, setMissFlashAt] = useState(0);
  const [menu, setMenu] = useState<WorkshopMenuState | null>(null);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const webgl = detectWebGL();
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const isAssembly = structure?.kind === 'assembly';
  const heightUnits =
    isAssembly && envelope
      ? assemblyHeightUnits(
          structure,
          envelope.heightUnitMm,
          GRIDFINITY_SPEC.SOCKET_HEIGHT + structure.base.floorThickness
        )
      : 6;
  const setCameraPreset = usePresetTransition(
    controlsRef,
    invalidateRef,
    envelope?.width ?? 2,
    envelope?.depth ?? 2,
    heightUnits,
    envelope?.gridUnitMm ?? 42,
    envelope?.heightUnitMm ?? 7
  );
  const resetView = useCallback(() => setCameraPreset('isometric'), [setCameraPreset]);
  useEffect(() => () => clearPreviewCanvas(), []);
  // The bin preview mounts the shared designer shortcuts; this canvas
  // replaces it wholesale, so undo/redo and camera presets are re-bound here.
  // Render-mode shortcuts are bin-preview concerns and stay inert.
  useDesignerKeyboard({
    onCameraPreset: setCameraPreset,
    onResetView: resetView,
    onToggleWireframe: noop,
    onToggleXray: noop,
    onToggleProjection: noop,
    onUndo: undo,
    onRedo: redo,
  });

  const onPartContextMenu = useCallback((partId: string, clientX: number, clientY: number) => {
    setMenu({ partId, x: clientX, y: clientY });
  }, []);

  if (structure?.kind !== 'assembly' || !envelope) return null;
  if (!webgl.available && webgl.reason) {
    return <WebGLFallback reason={webgl.reason} component="designer" />;
  }

  return (
    <div
      className="relative h-full w-full"
      translate="no"
      data-testid="workshop-canvas"
      onContextMenu={(e) => e.preventDefault()}
    >
      <WebGLErrorBoundary component="designer">
        <Canvas
          frameloop="demand"
          gl={{ antialias: true, localClippingEnabled: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => setPreviewCanvas(gl.domElement)}
          onPointerMissed={() => {
            if (useDesignerStore.getState().ui.workshopPendingPartType) {
              setMissFlashAt(performance.now());
            }
          }}
        >
          <WorkshopContextSync />
          <WorkshopScene
            structure={structure}
            envelope={envelope}
            missFlashAt={missFlashAt}
            controlsRef={controlsRef}
            invalidateRef={invalidateRef}
            onPartContextMenu={onPartContextMenu}
          />
        </Canvas>
      </WebGLErrorBoundary>
      <WorkshopViewBar onPreset={setCameraPreset} />
      {menu && <WorkshopContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
