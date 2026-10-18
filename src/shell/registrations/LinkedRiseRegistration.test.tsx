import { describe, it, expect, vi, afterAll } from 'vitest';
import { registerLinkedExcessResolver } from '@/shared/utils/collision';
import { placedSlant, registerLinkedSlantResolver } from '@/shared/utils/placedSlant';
import { getRestingStack } from '@/shared/utils/restingStack';
import { LIP_PROTRUSION_MM } from '@/shared/utils/heightUnits';
import { createTestBin, createTestLayout } from '@/test/testUtils';
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
  registerLinkedSlantResolver(null);
});

const layers: Layer[] = [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }];

const linkedBin = createTestBin({
  id: binId('1'),
  height: heightUnits(4),
  linkedDesignId: designId('lidded'),
});
// One array throughout, so each read also proves the registry tick reaches the
// resting stack's cache key.
const bins = [linkedBin];
const stackTop = (): number | undefined =>
  getRestingStack(bins, layers).bins.get(linkedBin.id)?.stackTop;

const designRef = (id: string) => ({
  id: designId(id),
  name: id,
  width: 1,
  depth: 1,
  height: 6,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('LinkedRiseRegistration', () => {
  it('wires registry rise data into the resting stack on import', async () => {
    registry.push({
      id: designId('lidded'),
      name: 'Lidded',
      width: 2,
      depth: 2,
      height: 4,
      assembledRiseMm: 4 * 7 + LIP_PROTRUSION_MM + 14,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await import('@/shell/registrations/LinkedRiseRegistration');

    expect(stackTop()).toBeCloseTo(6, 6);
  });

  it('re-reads the registry after a change notification', async () => {
    await import('@/shell/registrations/LinkedRiseRegistration');
    registry.length = 0;
    subscribers.forEach((cb) => cb());

    expect(stackTop()).toBe(4);
  });

  it('re-reads the registry after a cross-tab storage event', async () => {
    await import('@/shell/registrations/LinkedRiseRegistration');
    registry.push({
      id: designId('lidded'),
      name: 'Lidded',
      width: 2,
      depth: 2,
      height: 4,
      assembledRiseMm: 4 * 7 + LIP_PROTRUSION_MM + 14,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    window.dispatchEvent(new StorageEvent('storage', { key: 'gridfinity-custom-bins-v1' }));

    expect(stackTop()).toBeCloseTo(6, 6);
  });

  it("wires a design's slant facts into placement", async () => {
    await import('@/shell/registrations/LinkedRiseRegistration');
    const slant = { angleDeg: 45, side: 'back' as const, endSupport: true };
    registry.length = 0;
    registry.push(
      { ...designRef('leaning'), slant: { config: slant } },
      { ...designRef('mesh'), kind: 'importedMesh' }
    );
    subscribers.forEach((cb) => cb());
    const layout = createTestLayout();
    const bin = (id: string) =>
      createTestBin({ height: heightUnits(6), linkedDesignId: designId(id) });

    expect(placedSlant(bin('leaning'), layout)?.support).toMatchObject({ y: 1, depth: 1 });
    expect(placedSlant({ ...bin('mesh'), slant }, layout)).toBeNull();
    expect(placedSlant({ ...bin('unknown'), slant }, layout)).not.toBeNull();
  });

  it('renders nothing', async () => {
    const { LinkedRiseRegistration } = await import('@/shell/registrations/LinkedRiseRegistration');
    expect(LinkedRiseRegistration()).toBeNull();
  });
});
