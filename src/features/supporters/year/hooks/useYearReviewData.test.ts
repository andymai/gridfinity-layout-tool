import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import {
  registerDesignStorePort,
  resetDesignStorePort,
  type DesignStorePort,
} from '@/core/storage/designStorePort';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { layoutId, type LayoutEntry } from '@/core/types';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { __resetYearReviewSessionForTests, useYearReviewData } from './useYearReviewData';

const open = layoutId('open');

function seed(createdAt: number): void {
  const entry = {
    id: open,
    name: 'Workbench',
    createdAt,
    modifiedAt: createdAt,
    preview: { drawerWidth: 10, drawerDepth: 8, drawerHeight: 12, binCount: 2, layerCount: 1 },
  } as LayoutEntry;
  useLibraryStore.setState({
    library: { version: '1.0', activeLayoutId: open, settings: {}, entries: [entry] },
    isLoaded: true,
  });
  useLayoutStore.setState({
    activeLayoutId: open,
    layout: createTestLayout({ bins: [createTestBin(), createTestBin()] }),
  });
}

const listDesignSummaries = vi.fn<DesignStorePort['listDesignSummaries']>(async () => ok([]));

beforeEach(() => {
  resetAllStores();
  __resetYearReviewSessionForTests();
  listDesignSummaries.mockClear();
  registerDesignStorePort({ listDesignSummaries } as unknown as DesignStorePort);
});

afterEach(() => {
  resetDesignStorePort();
});

describe('useYearReviewData', () => {
  it('waits for the library, then reads the open drawer from the editor', async () => {
    useLibraryStore.setState({ isLoaded: false });
    const { result, rerender } = renderHook(() => useYearReviewData(2026));
    expect(result.current.status).toBe('loading');
    expect(listDesignSummaries).not.toHaveBeenCalled();

    seed(new Date(2026, 3, 1).getTime());
    rerender();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') return;
    expect(result.current.stats.drawers).toBe(1);
    expect(result.current.stats.binsPlaced).toBe(2);
  });

  it('reads the year once per session', async () => {
    seed(new Date(2026, 3, 1).getTime());
    const first = renderHook(() => useYearReviewData(2026));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();

    const second = renderHook(() => useYearReviewData(2026));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(listDesignSummaries).toHaveBeenCalledTimes(1);
  });

  it('reads an empty year again on the next visit', async () => {
    seed(new Date(2025, 3, 1).getTime());
    const first = renderHook(() => useYearReviewData(2026));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();

    const second = renderHook(() => useYearReviewData(2026));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(listDesignSummaries).toHaveBeenCalledTimes(2);
  });
});
