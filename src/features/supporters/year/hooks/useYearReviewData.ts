import { useEffect, useState } from 'react';
import { isRealLayoutId } from '@/core/constants';
import { loadLayoutAsync } from '@/core/storage';
import { getDesignStorePort } from '@/core/storage/designStorePort';
import { useLayoutStore, useLibraryStore, useSettingsStore } from '@/core/store';
import { readExportCount } from '@/shared/components/ExportDialog/exportSupportGate';
import type { YearStats } from '../types';
import { loadYearSources } from '../utils/loadYearSources';
import { computeYearStats, hasYearActivity } from '../utils/yearStats';

export type YearReviewData =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly stats: YearStats }
  | { readonly status: 'error' };

/**
 * One reading per session: a return from the credits and a replay show the
 * same year without reloading every layout.
 */
let session: { readonly year: number; readonly stats: Promise<YearStats> } | null = null;

async function collect(year: number): Promise<YearStats> {
  const { library } = useLibraryStore.getState();
  const { activeLayoutId, layout } = useLayoutStore.getState();
  const sources = await loadYearSources(year, {
    entries: library.entries,
    active: isRealLayoutId(activeLayoutId) ? { id: activeLayoutId, layout } : null,
    loadLayout: loadLayoutAsync,
    port: getDesignStorePort(),
  });
  return computeYearStats({
    year,
    ...sources,
    exportCount: readExportCount(),
    printSettings: useSettingsStore.getState().settings.printSettings,
  });
}

export function useYearReviewData(year: number): YearReviewData {
  const isLoaded = useLibraryStore((s) => s.isLoaded);
  const [data, setData] = useState<YearReviewData>({ status: 'loading' });

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    if (session?.year !== year) session = { year, stats: collect(year) };
    const current = session;
    current.stats.then(
      (stats) => {
        // An empty year sends the maker off to start work, so the next visit reads again.
        if (!hasYearActivity(stats) && session === current) session = null;
        if (!cancelled) setData({ status: 'ready', stats });
      },
      () => {
        if (session === current) session = null;
        if (!cancelled) setData({ status: 'error' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [isLoaded, year]);

  return data;
}

export function __resetYearReviewSessionForTests(): void {
  session = null;
}
