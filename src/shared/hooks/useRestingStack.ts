import { useMemo } from 'react';
import type { Bin, Layer } from '@/core/types';
import type { RestingStack } from '@/shared/utils/restingStack';
import { getRestingStack } from '@/shared/utils/restingStack';
import { useLinkedRiseKey } from './useLinkedRiseKey';

/**
 * The resting stack for `bins`, recomputed when a linked design's rise
 * changes as well as when the arrays do. Its identity is the dependency to
 * use for anything derived from where bins sit.
 */
export function useRestingStack(bins: readonly Bin[], layers: readonly Layer[]): RestingStack {
  const riseKey = useLinkedRiseKey();
  return useMemo(() => getRestingStack(bins, layers, riseKey), [bins, layers, riseKey]);
}
