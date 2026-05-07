import { useLayoutStore, useLibraryStore } from '@/core/store';
import type { Layout, LayoutEntry, LayoutId, LayoutLibrary } from '@/core/types';
import { loadLayoutAsync, saveLayoutAsync, saveLibrary, loadLayoutSync } from '@/core/storage';
import type { AdapterChange, AdapterChangeListener, LayoutAdapter, SyncableItem } from './types';

/**
 * `LayoutAdapter` implementation backed by `useLibraryStore` (entry
 * metadata) and `useLayoutStore` (currently-loaded layout) plus the
 * `saveLayoutAsync` / `loadLayoutAsync` storage helpers.
 *
 * Lives in `core/` because both `useLibraryStore` and `LayoutManager`
 * are in `core/` — no module-boundary concern. The corresponding
 * `DesignAdapter` lives in `src/features/bin-designer/sync/` and is
 * registered with the engine at app-shell boot.
 *
 * Echo suppression: when the engine calls `applyRemote*` to write a
 * cloud-sourced change locally, we add the id to `suppressed` for one
 * tick. The `subscribe` listener checks the set and skips emitting,
 * so the engine doesn't observe its own remote-write as a fresh local
 * change and re-push it. Single-tick is enough because the library-
 * store change fires synchronously after `saveLibrary`.
 */
const suppressed = new Set<string>();

function suppress(id: string): void {
  suppressed.add(id);
  // Release on the next macrotask — Zustand listeners fire synchronously.
  queueMicrotask(() => suppressed.delete(id));
}

export const layoutAdapter: LayoutAdapter = {
  async list(): Promise<SyncableItem<Layout>[]> {
    const { library } = useLibraryStore.getState();
    const items: SyncableItem<Layout>[] = [];
    for (const entry of library.entries) {
      const payload = await loadLayoutAsync(entry.id);
      if (!payload) continue;
      items.push({ id: entry.id, payload, modifiedAt: entry.modifiedAt });
    }
    return items;
  },

  async get(id: string): Promise<SyncableItem<Layout> | null> {
    const entry = findEntry(useLibraryStore.getState().library, id);
    if (!entry) return null;
    const payload = await loadLayoutAsync(id);
    if (!payload) return null;
    return { id, payload, modifiedAt: entry.modifiedAt };
  },

  async applyRemote(item: SyncableItem<Layout>): Promise<void> {
    suppress(item.id);

    const layout = item.payload;
    const saveResult = await saveLayoutAsync(item.id, layout);
    if (!saveResult.ok) {
      // Storage failure — the engine catches and surfaces a toast. We
      // still leave the suppression in place; releasing it on the next
      // tick is harmless.
      throw new Error(`saveLayoutAsync failed for ${item.id}`);
    }

    // Upsert the library entry so the user sees the updated metadata.
    const { library, setLibrary } = useLibraryStore.getState();
    const existingIndex = library.entries.findIndex((e) => e.id === item.id);
    const nextEntries: LayoutEntry[] =
      existingIndex >= 0
        ? library.entries.map((e, i) =>
            i === existingIndex
              ? { ...e, modifiedAt: item.modifiedAt, name: layout.name || e.name }
              : e
          )
        : [
            ...library.entries,
            {
              id: item.id as LayoutEntry['id'],
              name: layout.name || 'Untitled',
              createdAt: item.modifiedAt,
              modifiedAt: item.modifiedAt,
              preview: undefined as never,
            } satisfies LayoutEntry,
          ];
    const nextLibrary: LayoutLibrary = { ...library, entries: nextEntries };
    setLibrary(nextLibrary);
    await saveLibrary(nextLibrary);

    // If the user is viewing this layout right now, replace what the
    // store has so the UI re-renders. `source: 'remote'` flags the
    // store's `lastEditSource` so other subscribers can distinguish
    // remote-applied changes from user edits.
    const { activeLayoutId, importLayout } = useLayoutStore.getState();
    if (activeLayoutId === item.id) {
      importLayout(layout, item.id as LayoutId, 'remote');
    }
  },

  async applyRemoteDelete(id: string): Promise<void> {
    suppress(id);

    // Drop from library entries and persist. We don't proactively
    // remove the layout blob from IndexedDB here — that happens via
    // the existing delete flow when the user navigates away. The
    // important thing is that the entry disappears from the library
    // index so the user doesn't see a phantom layout.
    const { library, setLibrary } = useLibraryStore.getState();
    if (!library.entries.some((e) => e.id === id)) return;

    const nextLibrary: LayoutLibrary = {
      ...library,
      entries: library.entries.filter((e) => e.id !== id),
    };
    setLibrary(nextLibrary);
    await saveLibrary(nextLibrary);

    // If the user was viewing the deleted layout, switch them to
    // whatever's first in the (now-trimmed) library so they aren't
    // looking at stale data.
    const { activeLayoutId, importLayout } = useLayoutStore.getState();
    if (activeLayoutId === id && nextLibrary.entries.length > 0) {
      const fallback: LayoutEntry = nextLibrary.entries[0];
      const layout = loadLayoutSync(fallback.id);
      if (layout) importLayout(layout, fallback.id, 'remote');
    }
  },

  subscribe(listener: AdapterChangeListener): () => void {
    let prev = snapshot(useLibraryStore.getState().library);
    return useLibraryStore.subscribe((state) => {
      const next = snapshot(state.library);
      for (const change of diffSnapshots(prev, next)) {
        if (suppressed.has(change.id)) continue;
        listener(change);
      }
      prev = next;
    });
  },
};

function findEntry(library: LayoutLibrary, id: string): LayoutEntry | null {
  return library.entries.find((e) => e.id === id) ?? null;
}

interface EntrySnapshot {
  modifiedAt: number;
}

function snapshot(library: LayoutLibrary): Map<string, EntrySnapshot> {
  const out = new Map<string, EntrySnapshot>();
  for (const e of library.entries) out.set(e.id, { modifiedAt: e.modifiedAt });
  return out;
}

function diffSnapshots(
  prev: Map<string, EntrySnapshot>,
  next: Map<string, EntrySnapshot>
): AdapterChange[] {
  const changes: AdapterChange[] = [];
  for (const [id, entry] of next) {
    const prior = prev.get(id);
    if (!prior) {
      changes.push({ kind: 'put', id, modifiedAt: entry.modifiedAt });
    } else if (prior.modifiedAt !== entry.modifiedAt) {
      changes.push({ kind: 'put', id, modifiedAt: entry.modifiedAt });
    }
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) {
      changes.push({ kind: 'delete', id, modifiedAt: Date.now() });
    }
  }
  return changes;
}
