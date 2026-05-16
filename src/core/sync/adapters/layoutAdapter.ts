import { isErr } from '@/core/result';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import type { Bin, Layout, LayoutEntry, LayoutId, LayoutLibrary } from '@/core/types';
import {
  computePreview,
  loadLayoutAsync,
  loadLayoutSync,
  saveLayoutAsync,
  saveLibrary,
} from '@/core/storage';
import type { AdapterChange, AdapterChangeListener, LayoutAdapter, SyncableItem } from './types';

// Wider than `Bin` because legacy cloud blobs (pre-validator-fix) literally
// omit `notes`/`label`. Without this the runtime guard below reads as
// unreachable to TypeScript.
type IncomingBin = Omit<Bin, 'notes' | 'label'> & { notes?: unknown; label?: unknown };
type IncomingLayout = Omit<Layout, 'bins'> & { bins: IncomingBin[] };

/**
 * Default missing `notes`/`label` to '' so the 3D view's `bin.notes.trim()`
 * doesn't crash on legacy cloud blobs written before `api/lib/validation.ts`
 * began emitting both as required strings.
 */
export function normalizeIncomingLayout(layout: Layout): Layout {
  const bins = (layout as IncomingLayout).bins;
  const needsHealing = bins.some((b) => typeof b.notes !== 'string' || typeof b.label !== 'string');
  if (!needsHealing) return layout;
  return {
    ...layout,
    bins: bins.map(
      (b): Bin => ({
        ...b,
        notes: typeof b.notes === 'string' ? b.notes : '',
        label: typeof b.label === 'string' ? b.label : '',
      })
    ),
  };
}

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
 * Echo suppression: `suppress(id)` must run immediately before the
 * synchronous `setLibrary` call that fires subscribers — zustand
 * notifies listeners synchronously, so the microtask-scheduled cleanup
 * runs after the listener has already observed and skipped.
 */
const suppressed = new Set<string>();

function suppress(id: string): void {
  suppressed.add(id);
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
    const layout = normalizeIncomingLayout(item.payload);
    const saveResult = await saveLayoutAsync(item.id, layout);
    if (!saveResult.ok) {
      throw new Error(`saveLayoutAsync failed for ${item.id}`);
    }

    // Upsert the library entry so the user sees the updated metadata.
    // For new entries we compute a fresh preview from the remote layout —
    // `LayoutEntry.preview` is required and the UI dereferences
    // `entry.preview.binCount` so leaving it undefined would crash.
    const { library, setLibrary } = useLibraryStore.getState();
    const preview = computePreview(layout);
    const existingIndex = library.entries.findIndex((e) => e.id === item.id);
    const nextEntries: LayoutEntry[] =
      existingIndex >= 0
        ? library.entries.map((e, i) =>
            i === existingIndex
              ? {
                  ...e,
                  modifiedAt: item.modifiedAt,
                  name: layout.name || e.name,
                  preview,
                }
              : e
          )
        : [
            ...library.entries,
            {
              id: item.id as LayoutEntry['id'],
              name: layout.name || 'Untitled',
              createdAt: item.modifiedAt,
              modifiedAt: item.modifiedAt,
              preview,
            } satisfies LayoutEntry,
          ];
    const nextLibrary: LayoutLibrary = { ...library, entries: nextEntries };
    suppress(item.id);
    setLibrary(nextLibrary);
    const libraryResult = await saveLibrary(nextLibrary);
    if (isErr(libraryResult)) {
      throw new Error(`saveLibrary failed for ${item.id}`);
    }

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
    suppress(id);
    setLibrary(nextLibrary);
    const libraryResult = await saveLibrary(nextLibrary);
    if (isErr(libraryResult)) {
      throw new Error(`saveLibrary failed during remote-delete of ${id}`);
    }

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
