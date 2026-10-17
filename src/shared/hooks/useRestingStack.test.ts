import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Bin, Layer } from '@/core/types';
import { binId, designId, heightUnits, layerId } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import { notifyLinkedExcessChanged, registerLinkedExcessResolver } from '@/shared/utils/collision';
import { useRestingStack } from './useRestingStack';

const layers: Layer[] = [
  { id: layerId('l1'), name: 'Layer 1', height: heightUnits(3) },
  { id: layerId('l2'), name: 'Layer 2', height: heightUnits(3) },
];
const bins: Bin[] = [
  createTestBin({ id: binId('lidded'), layerId: layers[0].id, linkedDesignId: designId('d') }),
  createTestBin({ id: binId('up'), layerId: layers[1].id }),
];

describe('useRestingStack', () => {
  afterEach(() => {
    registerLinkedExcessResolver(null);
  });

  it('restacks when a linked design’s rise changes without the layout changing', () => {
    let rise = 0;
    let tick = 0;
    registerLinkedExcessResolver(
      () => rise,
      () => tick
    );
    const { result } = renderHook(() => useRestingStack(bins, layers));
    expect(result.current.bins.get(binId('up'))?.zStart).toBe(3);
    act(() => {
      rise = 1;
      tick += 1;
      notifyLinkedExcessChanged();
    });
    expect(result.current.bins.get(binId('up'))?.zStart).toBe(4);
  });
});
