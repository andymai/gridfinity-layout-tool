import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF, useProgress } from '@react-three/drei';
// Side-effect: must run before any <Text> mounts under this Canvas.
import '@/shared/webgl/configureTroikaText';
import { Button, ProgressBar, cn } from '@/design-system';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useTranslation } from '@/i18n';
import { SpaceMouseController } from '@/shared/spacemouse/components/SpaceMouseController';
import { ensureVertexNormals } from './ensureVertexNormals';

// Self-hosted Draco decoder (public/draco/): CSP forbids the default gstatic CDN.
useGLTF.setDecoderPath('/draco/');

export type GlbViewerLoadBehavior = 'auto' | 'tap';

interface GlbViewerProps {
  meshUrl: string;
  posterUrl: string;
  alt: string;
  loadBehavior?: GlbViewerLoadBehavior;
  autoRotate?: boolean;
  /** Fires once when the model has loaded and the poster is fading out. */
  onModelReady?: () => void;
  className?: string;
  children?: ReactNode;
}

function Model({ url, onReady }: { url: string; onReady: () => void }) {
  const gltf = useGLTF(url, true);
  // Layout effect, not a passive one: this must land before the first frame is
  // drawn, and React runs layout effects before the browser paints and before
  // the render loop's next animation frame.
  useLayoutEffect(() => ensureVertexNormals(gltf.scene), [gltf.scene]);
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

interface ModelErrorBoundaryProps {
  onError: () => void;
  children: ReactNode;
}

interface ModelErrorBoundaryState {
  failed: boolean;
}

class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function LoadingProgress({ label }: { label: string }) {
  const { progress } = useProgress();
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-3">
      <ProgressBar size="sm" value={progress} label={label} />
    </div>
  );
}

export function GlbViewer({
  meshUrl,
  posterUrl,
  alt,
  loadBehavior = 'auto',
  autoRotate = true,
  onModelReady,
  className,
  children,
}: GlbViewerProps) {
  const t = useTranslation();
  const [tapped, setTapped] = useState(false);
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const onModelReadyRef = useRef(onModelReady);
  useEffect(() => {
    onModelReadyRef.current = onModelReady;
  }, [onModelReady]);
  const handleReady = useCallback(() => {
    setReady(true);
    onModelReadyRef.current?.();
  }, []);
  const handleError = useCallback(() => setErrored(true), []);
  const handleTap = useCallback(() => setTapped(true), []);

  const canvasActive = loadBehavior === 'auto' || tapped;

  return (
    <div className={cn('relative', className)}>
      {canvasActive ? (
        <Canvas
          // Bin geometry is Z-up (designer convention); orient the camera so
          // OrbitControls orbits/auto-rotates around vertical instead of tumbling.
          camera={{ position: [180, -180, 150], up: [0, 0, 1], fov: 35 }}
          gl={{ antialias: true }}
          style={{ borderRadius: '0.5rem' }}
        >
          {children}
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, -5, 8]} intensity={1.4} />
          <directionalLight position={[-6, 4, 3]} intensity={0.5} />
          <ModelErrorBoundary onError={handleError}>
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.2}>
                <Model url={meshUrl} onReady={handleReady} />
              </Bounds>
            </Suspense>
          </ModelErrorBoundary>
          <OrbitControls
            autoRotate={autoRotate && !reduceMotion}
            autoRotateSpeed={1.2}
            enablePan={false}
            enableDamping
            makeDefault
          />
          <SpaceMouseController />
        </Canvas>
      ) : null}

      <img
        src={posterUrl}
        alt={alt}
        aria-hidden={ready}
        className={cn(
          'pointer-events-none absolute inset-0 h-full w-full rounded-lg object-contain transition-opacity duration-500 motion-reduce:transition-none',
          ready ? 'opacity-0' : 'opacity-100'
        )}
      />

      {canvasActive && !ready && !errored ? (
        <LoadingProgress label={t('glbViewer.loading')} />
      ) : null}

      {errored ? (
        <p className="absolute inset-x-0 bottom-2 text-center text-xs text-content-secondary">
          {t('glbViewer.loadFailed')}
        </p>
      ) : null}

      {!canvasActive ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button variant="secondary" touchTarget onClick={handleTap}>
            {t('glbViewer.show3d')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
