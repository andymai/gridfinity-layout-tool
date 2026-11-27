import { describe, expect, it, vi } from 'vitest';
import { err, ok, storageUnavailable } from '@/core/result';
import type { DesignSummary } from '@/core/storage/designStorePort';
import { designId, layoutId, type LayoutEntry } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { loadYearSources } from './loadYearSources';

const at = (year: number, month: number, day: number): number =>
  new Date(year, month, day, 12).getTime();

function entry(id: string, createdAt: number): LayoutEntry {
  return {
    id: layoutId(id),
    name: `Drawer ${id}`,
    createdAt,
    modifiedAt: createdAt,
    preview: {
      drawerWidth: 10,
      drawerDepth: 8,
      drawerHeight: 12,
      binCount: 1,
      layerCount: 1,
    },
  } as LayoutEntry;
}

const summary: DesignSummary = {
  id: designId('d1'),
  name: 'Caddy',
  createdAt: new Date(at(2026, 2, 1)).toISOString(),
  updatedAt: new Date(at(2026, 2, 1)).toISOString(),
  thumbnail: null,
  remixed: false,
  untouched: false,
  versionDates: [],
};

describe('loadYearSources', () => {
  it('loads only drawers started in the year, and takes the open one from the editor', async () => {
    const stored = createTestLayout({ name: 'stored', bins: [createTestBin()] });
    const live = createTestLayout({ name: 'live', bins: [createTestBin(), createTestBin()] });
    const loadLayout = vi.fn(async () => stored);

    const sources = await loadYearSources(2026, {
      entries: [
        entry('old', at(2025, 5, 1)),
        entry('open', at(2026, 3, 1)),
        entry('new', at(2026, 4, 1)),
      ],
      active: { id: 'open', layout: live },
      loadLayout,
      port: { listDesignSummaries: async () => ok([summary]) },
    });

    expect(loadLayout).toHaveBeenCalledTimes(1);
    expect(loadLayout).toHaveBeenCalledWith('new');
    expect(sources.layouts.map((source) => [source.id, source.layout.name])).toEqual([
      ['open', 'live'],
      ['new', 'stored'],
    ]);
    expect(sources.designs).toEqual([summary]);
  });

  it('skips a drawer that storage cannot read', async () => {
    const sources = await loadYearSources(2026, {
      entries: [entry('gone', at(2026, 4, 1))],
      active: null,
      loadLayout: async () => null,
      port: null,
    });
    expect(sources.layouts).toEqual([]);
  });

  it('reads no designs when the port is missing or fails', async () => {
    const failing = await loadYearSources(2026, {
      entries: [],
      active: null,
      loadLayout: async () => null,
      port: {
        listDesignSummaries: async () => err(storageUnavailable('indexedDB', new Error('closed'))),
      },
    });
    expect(failing.designs).toEqual([]);
  });
});
