import { describe, it, expect, vi, afterAll } from 'vitest';
import { getBin3DRectResult, registerLinkedExcessResolver } from '@/shared/utils/collision';
import { LIP_PROTRUSION_MM } from '@/shared/utils/heightUnits';
import { createTestBin } from '@/test/testUtils';
import type { Layer } from '@/core/types';
import { binId, designId, heightUnits, layerId } from '@/core/types';

const { registry, subscribers } = vi.hoisted(() => ({
  registry: [] as unknown[],
  subscribers: [] as Array<() => void>,
}));

vi.mock('@/features/bin-designer', () => ({
  loadRegistry: () => registry,
  subscribeToRegistry: (cb: () => void) => {
    subscribers.push(cb);
    return () => undefined;
  },
}));

afterAll(() => {
  registerLinkedExcessResolver(null);
});

const layers: Layer[] = [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }];

const linkedBin = createTestBin({
  id: binId('1'),
  height: heightUnits(4),
  linkedDesignId: designId('lidded'),
});

describe('LinkedRiseRegistration', () => {
  it('wires registry rise data into collision on import', async () => {
    registry.push({
      id: designId('lidded'),
      name: 'Lidded',
      width: 2,
      depth: 2,
      height: 4,
      assembledRiseMm: 4 * 7 + LIP_PROTRUSION_MM + 14,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await import('@/shared/storage/LinkedRiseRegistration');

    const rect = getBin3DRectResult(linkedBin, layers);
    expect(rect.ok && rect.value.zEnd).toBeCloseTo(6, 6);
  });

  it('re-reads the registry after a change notification', async () => {
    await import('@/shared/storage/LinkedRiseRegistration');
    registry.length = 0;
    subscribers.forEach((cb) => cb());

    const rect = getBin3DRectResult(linkedBin, layers);
    expect(rect.ok && rect.value.zEnd).toBe(4);
  });

  it('renders nothing', async () => {
    const { LinkedRiseRegistration } = await import('@/shared/storage/LinkedRiseRegistration');
    expect(LinkedRiseRegistration()).toBeNull();
  });
});
