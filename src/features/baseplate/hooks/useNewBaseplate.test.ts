import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { err, ok } from '@/core/result';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { useLayoutStore } from '@/core/store/layout';
import { baseplateDesignId, layoutId } from '@/core/types';
import { claimSelection } from '@/features/baseplate/utils/selectionClaim';
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

function deferSave(): (value: unknown) => void {
  let resolveSave: (value: unknown) => void = () => undefined;
  mocks.saveCurrentAsNew.mockReturnValue(
    new Promise((resolve) => {
      resolveSave = resolve;
    })
  );
  return (value) => resolveSave(value);
}

describe('useNewBaseplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLayoutStore.setState({ activeLayoutId: layoutId('layout-a') });
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

  // The phone menu unmounts its items on click, so a reopened menu is a fresh mount.
  it('keeps the save pending across a remount and starts no second save', async () => {
    const resolveSave = deferSave();
    const first = renderHook(() => useNewBaseplate());
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = first.result.current.createBaseplate();
    });
    first.unmount();

    const second = renderHook(() => useNewBaseplate());
    expect(second.result.current.creating).toBe(true);
    let overlap: Promise<boolean> = Promise.resolve(false);
    act(() => {
      overlap = second.result.current.createBaseplate();
    });
    expect(mocks.saveCurrentAsNew).toHaveBeenCalledOnce();

    await act(async () => {
      resolveSave(ok(created));
      await pending;
    });
    await expect(overlap).resolves.toBe(true);
    expect(mocks.setActiveBaseplate).toHaveBeenCalledOnce();
    expect(second.result.current.creating).toBe(false);
  });

  it('shows the pending save in every mounted entry point', async () => {
    const resolveSave = deferSave();
    const header = renderHook(() => useNewBaseplate());
    const libraryModal = renderHook(() => useNewBaseplate());

    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = header.result.current.createBaseplate();
    });
    expect(libraryModal.result.current.creating).toBe(true);

    await act(async () => {
      resolveSave(ok(created));
      await pending;
    });
    expect(libraryModal.result.current.creating).toBe(false);
  });

  it('does not activate the plate when another layout opens during the save', async () => {
    const resolveSave = deferSave();
    const { result } = renderHook(() => useNewBaseplate());
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.createBaseplate();
    });
    useLayoutStore.setState({ activeLayoutId: layoutId('layout-b') });

    let succeeded: boolean | undefined;
    await act(async () => {
      resolveSave(ok(created));
      succeeded = await pending;
    });

    expect(succeeded).toBe(false);
    expect(mocks.setActiveBaseplate).not.toHaveBeenCalled();
    expect(result.current.creating).toBe(false);
  });

  it('keeps a library pick made during the save', async () => {
    const resolveSave = deferSave();
    const { result } = renderHook(() => useNewBaseplate());
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.createBaseplate();
    });
    claimSelection();

    let succeeded: boolean | undefined;
    await act(async () => {
      resolveSave(ok(created));
      succeeded = await pending;
    });

    expect(succeeded).toBe(false);
    expect(mocks.setActiveBaseplate).not.toHaveBeenCalled();
    expect(result.current.creating).toBe(false);
  });
});
