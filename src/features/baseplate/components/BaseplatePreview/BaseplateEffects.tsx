/**
 * Lazy-loaded post-processing effects for the baseplate 3D preview.
 * Wraps SSAO and Bloom in a Suspense-friendly component that renders
 * nothing when disabled (avoids triggering the lazy import on mobile).
 */

import { lazy, Suspense, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

interface BaseplateEffectsProps {
  readonly enabled: boolean;
}

const LazyEffects = lazy(async () => {
  const { EffectComposer, SSAO, Bloom } = await import('@react-three/postprocessing');
  function Effects() {
    return (
      <EffectComposer>
        <SSAO samples={16} radius={5} intensity={15} />
        <Bloom intensity={0.08} luminanceThreshold={0.85} />
      </EffectComposer>
    );
  }
  return { default: Effects };
});

/** Invalidates the scene whenever the enabled flag changes. */
function EffectsInvalidator({ enabled }: { enabled: boolean }) {
  const { invalidate } = useThree();
  const prevRef = useRef(enabled);
  useEffect(() => {
    if (prevRef.current !== enabled) {
      prevRef.current = enabled;
      invalidate();
    }
  }, [enabled, invalidate]);
  return null;
}

export function BaseplateEffects({ enabled }: BaseplateEffectsProps) {
  return (
    <>
      <EffectsInvalidator enabled={enabled} />
      {enabled && (
        <Suspense fallback={null}>
          <LazyEffects />
        </Suspense>
      )}
    </>
  );
}
