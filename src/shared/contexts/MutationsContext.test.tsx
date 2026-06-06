import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok } from '@/core/result';
import { layerId, categoryId, binId } from '@/core/types';
import type { Bin } from '@/core/types';
import type { CommandBus } from '@/core/cqrs';
import type * as CqrsModule from '@/core/cqrs';

// Controls what the mocked `commandBus` binding resolves to. The shim in
// MutationsContext reads it live on every dispatch, so flipping it mid-test
// simulates a chunk-cycle/stale-chunk race where the binding resolves late.
let currentBus: CommandBus | undefined;

const fakeBus: CommandBus = {
  dispatch: vi.fn(() => ok({ value: binId('bin_fake'), events: [] })),
  use: vi.fn(),
  resetMiddleware: vi.fn(),
};

vi.mock('@/core/cqrs', async (importOriginal) => {
  const actual = await importOriginal<typeof CqrsModule>();
  return {
    ...actual,
    get commandBus() {
      return currentBus;
    },
  };
});

function makeBin(): Omit<Bin, 'id'> {
  return {
    layerId: layerId('layer_1'),
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 3,
    category: categoryId('cat_1'),
    label: '',
    notes: '',
  };
}

// Re-import the module under test (and the renderer) fresh per test so each
// case rebuilds the module-scoped mutations singleton from scratch — otherwise
// the first test to build it would mask the "built while bus was undefined"
// regression scenario. renderHook and useMutations are imported together after
// the reset so they share the same freshly-evaluated React instance.
async function freshRender() {
  vi.resetModules();
  const [{ renderHook }, { useMutations }] = await Promise.all([
    import('@testing-library/react'),
    import('./MutationsContext'),
  ]);
  return renderHook(() => useMutations());
}

describe('MutationsContext bus resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentBus = fakeBus;
  });

  it('routes mutations through the current command bus', async () => {
    const { result } = await freshRender();
    const res = result.current.addBin(makeBin());

    expect(res.ok).toBe(true);
    expect(fakeBus.dispatch).toHaveBeenCalledOnce();
  });

  it('does not permanently break when the bus is undefined at first use (regression #1563/#1466)', async () => {
    // Singleton is first built while the bus binding is still undefined…
    currentBus = undefined;
    const { result } = await freshRender();

    // …then the binding resolves (cycle settles / fresh chunk loads).
    currentBus = fakeBus;
    const res = result.current.addBin(makeBin());

    expect(res.ok).toBe(true);
    expect(fakeBus.dispatch).toHaveBeenCalledOnce();
  });

  it('throws a reload-actionable error when the bus is unavailable', async () => {
    currentBus = undefined;
    const { result } = await freshRender();

    expect(() => result.current.addBin(makeBin())).toThrow(/stale build/i);
  });
});
