/**
 * The Workshop 3D editor canvas — replaces the bin PreviewCanvas while the
 * designer holds an assembly. Parts render as instant client-side proxies;
 * the exact worker-fused solid joins in a later phase.
 */
import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { detectWebGL, WebGLFallback, WebGLErrorBoundary } from '@/shared/webgl';
import {
  clearPreviewCanvas,
  setPreviewCanvas,
  setPreviewContext,
} from '@/features/bin-designer/utils/thumbnail';
import { useDesignerKeyboard } from '@/features/bin-designer/hooks/useDesignerKeyboard';
import { WorkshopScene } from './WorkshopScene';

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
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const webgl = detectWebGL();
  useEffect(() => () => clearPreviewCanvas(), []);
  // The bin preview mounts the shared designer shortcuts; this canvas
  // replaces it wholesale, so undo/redo must be re-bound here. Camera and
  // render-mode shortcuts are bin-preview concerns and stay inert.
  useDesignerKeyboard({
    onCameraPreset: noop,
    onResetView: noop,
    onToggleWireframe: noop,
    onToggleXray: noop,
    onToggleProjection: noop,
    onUndo: undo,
    onRedo: redo,
  });

  if (structure?.kind !== 'assembly' || !envelope) return null;
  if (!webgl.available && webgl.reason) {
    return <WebGLFallback reason={webgl.reason} component="designer" />;
  }

  return (
    <div className="relative h-full w-full" translate="no" data-testid="workshop-canvas">
      <WebGLErrorBoundary component="designer">
        <Canvas
          frameloop="demand"
          gl={{ antialias: true, localClippingEnabled: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => setPreviewCanvas(gl.domElement)}
        >
          <WorkshopContextSync />
          <WorkshopScene structure={structure} envelope={envelope} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
