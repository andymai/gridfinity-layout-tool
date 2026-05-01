import { describe, it, expect, vi } from 'vitest';
import { produce } from 'immer';
import { isOk } from '@/core/result';
import type * as StorageModule from '@/core/storage';
import { importLayout } from './importLayout';
import { makeLibrary } from './_testHelpers';

// computePreview lives in @/core/storage and reads from a real Layout.
// Stub it so the test can pass an opaque layout payload.
vi.mock('@/core/storage', async () => {
  const actual = await vi.importActual<typeof StorageModule>('@/core/storage');
  return {
    ...actual,
    computePreview: vi.fn(() => ({
      drawerWidth: 6,
      drawerDepth: 4,
      drawerHeight: 7,
      binCount: 3,
      layerCount: 1,
    })),
  };
});

describe('v2 library.importLayout', () => {
  it('builds an entry from the imported layout via computePreview', () => {
    const library = makeLibrary();
    const result = importLayout.handle(
      { layout: { foo: 'bar' }, name: 'Imported' },
      { aggregate: library }
    );

    if (!isOk(result)) throw new Error('handle failed');
    expect(result.value.event.payload.entry?.name).toBe('Imported');
    expect(result.value.event.payload.entry?.preview.binCount).toBe(3);
  });

  it('apply() pushes the new entry onto the draft', () => {
    const library = makeLibrary();
    const result = importLayout.handle(
      { layout: { foo: 'bar' }, name: 'X' },
      { aggregate: library }
    );
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(library, (draft) => {
      importLayout.apply(
        { type: 'library.entryCreated', payload: result.value.event.payload },
        draft
      );
    });
    expect(applied.entries).toHaveLength(2);
    expect(applied.entries[1]).toEqual(result.value.event.payload.entry);
  });
});
