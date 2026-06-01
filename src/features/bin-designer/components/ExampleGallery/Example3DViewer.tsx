import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei';
import { meshUrl } from '@/features/bin-designer/data/examples/meshes';
import { thumbnailUrl } from '@/features/bin-designer/data/examples/thumbnails';
import { GradientBackground } from '@/features/bin-designer/components/preview/GradientBackground/GradientBackground';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useTranslation } from '@/i18n';

// Self-hosted Draco decoder (public/draco/) — CSP forbids the default gstatic CDN.
useGLTF.setDecoderPath('/draco/');

interface Example3DViewerProps {
  example: ExampleDesign;
}

function Model({ url, onReady }: { url: string; onReady: () => void }) {
  const gltf = useGLTF(url, true);
  // useGLTF suspends until the asset resolves, so reaching here means the model
  // is loaded; signal the overlay to fade out after commit (not during render).
  useEffect(() => {
    onReady();
  }, [onReady]);
  return (
    <Center>
      <primitive object={gltf.scene} />
    </Center>
  );
}

export function Example3DViewer({ example }: Example3DViewerProps) {
  const t = useTranslation();
  const url = meshUrl(example.id);
  const thumb = thumbnailUrl(example.id) ?? '';
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);
  const reduceMotion = usePrefersReducedMotion();

  if (!url) {
    return (
      <img
        src={thumb}
        alt={t(example.nameKey)}
        className="max-w-full max-h-[40vh] object-contain"
      />
    );
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: '1 / 1', maxHeight: '40vh' }}>
      <Canvas
        // Bin geometry is Z-up (designer convention); orient the camera so
        // OrbitControls orbits/auto-rotates around vertical instead of tumbling.
        camera={{ position: [180, -180, 150], up: [0, 0, 1], fov: 35 }}
        gl={{ antialias: true }}
        style={{ borderRadius: '0.5rem' }}
      >
        {/* Same theme-aware gradient the 2D thumbnail was captured with. */}
        <GradientBackground />
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, -5, 8]} intensity={1.4} />
        <directionalLight position={[-6, 4, 3]} intensity={0.5} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <Model url={url} onReady={handleReady} />
          </Bounds>
        </Suspense>
        <OrbitControls
          autoRotate={!reduceMotion}
          autoRotateSpeed={1.2}
          enablePan={false}
          enableDamping
          makeDefault
        />
      </Canvas>

      <img
        src={thumb}
        alt={t(example.nameKey)}
        aria-hidden={ready}
        className={`pointer-events-none absolute inset-0 h-full w-full rounded-lg object-contain transition-opacity duration-500 ${
          ready ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  );
}
