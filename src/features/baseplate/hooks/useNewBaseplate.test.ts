import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { err, ok } from '@/core/result';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { baseplateDesignId } from '@/core/types';
import { useNewBaseplate } from './useNewBaseplate';

const mocks = vi.hoisted(() => ({
  saveCurrentAsNew: vi.fn(),
  setActiveBaseplate: vi.fn(),
  addToast: vi.fn(),
  list: [] as { id: string; name: string; updatedAt: string }[],
}));

vi.mock('@/features/baseplate/hooks/useBaseplateLibrary', () => ({
  useBaseplateLibrary: () => ({ list: mocks.list, saveCurrentAsNew: mocks.saveCurrentAsNew }),
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({ setActiveBaseplate: mocks.setActiveBaseplate }),
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: (selector: (s: unknown) => unknown) => selector({ addToast: mocks.addToast }),
}));

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const created = { id: baseplateDesignId('bp-new'), params: { magnetHoles: true } };

describe('useNewBaseplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list = [
      { id: 'bp-1', name: 'Baseplate 1', updatedAt: '2024-01-01' },
      { id: 'bp-3', name: 'Baseplate 3', updatedAt: '2024-01-03' },
    ];
  });

  it('saves the defaults under the next free name and makes the design active', async () => {
    mocks.saveCurrentAsNew.mockResolvedValue(ok(created));
    const { result } = renderHook(() => useNewBaseplate());

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.createBaseplate();
    });

    expect(succeeded).toBe(true);
    expect(mocks.saveCurrentAsNew).toHaveBeenCalledWith('Baseplate 2', {
      ...DEFAULT_BASEPLATE_PARAMS,
    });
    expect(mocks.setActiveBaseplate).toHaveBeenCalledWith(created.id, created.params);
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it('reports a failed save and leaves the active design alone', async () => {
    mocks.saveCurrentAsNew.mockResolvedValue(err({ type: 'STORAGE_ERROR' }));
    const { result } = renderHook(() => useNewBaseplate());

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.createBaseplate();
    });

    expect(succeeded).toBe(false);
    expect(mocks.addToast).toHaveBeenCalledWith('toast.baseplateSaveFailed', 'error');
    expect(mocks.setActiveBaseplate).not.toHaveBeenCalled();
  });

  it('reports creating while the save is in flight', async () => {
    let resolveSave: (value: unknown) => void = () => undefined;
    mocks.saveCurrentAsNew.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    const { result } = renderHook(() => useNewBaseplate());
    expect(result.current.creating).toBe(false);

    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.createBaseplate();
    });
    expect(result.current.creating).toBe(true);

    await act(async () => {
      resolveSave(ok(created));
      await pending;
    });
    expect(result.current.creating).toBe(false);
  });
});
