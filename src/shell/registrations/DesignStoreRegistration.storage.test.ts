// Real storage end to end: the registered port, IndexedDB (fake-indexeddb) and
// the localStorage registry, so a design that arrives with a layout file is
// checked where the layout reads it.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/analytics/posthog', () => ({ trackDesignCreated: vi.fn() }));

import { restoreEmbeddedDesigns } from '@/core/storage';
import { designId } from '@/core/types';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { loadRegistry } from '@/features/bin-designer/store/customBinRegistry';
import { closeDesignerDb, loadDesign } from '@/features/bin-designer/storage/DesignerStorage';
import '@/shell/registrations/DesignStoreRegistration';

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  localStorage.clear();
  closeDesignerDb();
  await deleteDb('gridfinity-designer-v1');
});

describe('a layout file that carries its designs', () => {
  it('registers each parametric design it saves, split switch included', async () => {
    const layout = createTestLayout({
      bins: [createTestBin({ linkedDesignId: designId('file-design') })],
    });
    const json = JSON.stringify({
      ...layout,
      linkedDesigns: [
        {
          id: 'file-design',
          name: 'Long tray',
          params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 1, splitToFitBed: false },
        },
      ],
    });

    const { layout: restored, importedDesignCount } = await restoreEmbeddedDesigns(json, layout);

    expect(importedDesignCount).toBe(1);
    const id = restored.bins[0].linkedDesignId;
    expect(id).toBeDefined();
    expect(id).not.toBe('file-design');
    const stored = await loadDesign(designId(String(id)));
    expect(stored.ok).toBe(true);
    expect(loadRegistry().find((r) => r.id === id)).toMatchObject({
      name: 'Long tray',
      width: 8,
      depth: 1,
      splitToFitBed: false,
    });
  });
});
