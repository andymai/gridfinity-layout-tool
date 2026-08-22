/**
 * The Workshop 3D editor canvas — replaces the bin PreviewCanvas while the
 * designer holds an assembly. Parts render as instant client-side proxies;
 * the exact worker-fused solid joins in a later phase.
 */
import { Canvas } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { detectWebGL, WebGLFallback, WebGLErrorBoundary } from '@/shared/webgl';
import { WorkshopScene } from './WorkshopScene';

export function WorkshopCanvas() {
  const { structure, envelope } = useDesignerStore(
    useShallow((s) => ({ structure: s.structure, envelope: s.envelope }))
  );
  const webgl = detectWebGL();

  if (structure?.kind !== 'assembly' || !envelope) return null;
  if (!webgl.available && webgl.reason) {
    return <WebGLFallback reason={webgl.reason} component="designer" />;
  }

  return (
    <div className="relative h-full w-full" translate="no" data-testid="workshop-canvas">
      <WebGLErrorBoundary component="designer">
        <Canvas frameloop="demand" gl={{ antialias: true }}>
          <WorkshopScene structure={structure} envelope={envelope} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
