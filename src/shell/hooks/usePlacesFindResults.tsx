import { Suspense, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';

const PlacesFindGroup = lazyWithRetry(() =>
  import('@/features/places/components/PlacesFindGroup').then(namedExport('PlacesFindGroup'))
);

type RenderResults = (query: string, close: () => void) => ReactNode;

/**
 * The command palette's bin results while the `places` flag is on; the palette
 * cannot import the slice. Off the layout planner a result has nowhere to land,
 * and Help can open the palette there.
 */
export function usePlacesFindResults(onLayoutRoute: boolean): RenderResults | undefined {
  const enabled = useFeatureFlag('places');
  const render = useCallback<RenderResults>(
    (query, close) => (
      <Suspense fallback={null}>
        <PlacesFindGroup query={query} onDone={close} />
      </Suspense>
    ),
    []
  );
  return enabled && onLayoutRoute ? render : undefined;
}
