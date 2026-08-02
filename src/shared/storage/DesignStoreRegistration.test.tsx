import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDesignStorePort, resetDesignStorePort } from '@/core/storage/designStorePort';

// Stand in for the real feature adapter so this test never pulls the
// bin-designer barrel's runtime graph.
const { fakeAdapter } = vi.hoisted(() => ({
  fakeAdapter: {
    loadDesign: vi.fn(),
    saveDesign: vi.fn(),
    upsertRegistryEntry: vi.fn(),
    registryEdgeFields: vi.fn(),
  },
}));

vi.mock('@/features/bin-designer', () => ({ designStoreAdapter: fakeAdapter }));

afterEach(() => {
  resetDesignStorePort();
});

describe('DesignStoreRegistration', () => {
  it('registers the bin-designer adapter with the core port on import', async () => {
    await import('@/shared/storage/DesignStoreRegistration');
    expect(getDesignStorePort()).toBe(fakeAdapter);
  });

  it('renders nothing', async () => {
    const { DesignStoreRegistration } = await import('@/shared/storage/DesignStoreRegistration');
    expect(DesignStoreRegistration()).toBeNull();
  });
});
