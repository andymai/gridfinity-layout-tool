import { STAGING_ID } from '@/core/constants';
import { loadLayoutAsync } from '@/core/storage';
import type { Bin, Layout, LayoutId, LayoutLibrary } from '@/core/types';
import { searchField } from './matchBins';
import type { BinSearchRecord, SearchField } from './matchBins';

interface IndexedLayout {
  readonly modifiedAt: number;
  readonly records: readonly BinSearchRecord[];
}

/**
 * Per session, keyed by the library entry's `modifiedAt`: every path that
 * changes a stored layout (autosave, a sync pull, an import) bumps it, so a
 * changed stamp is the only cue a layout needs re-reading.
 */
const indexed = new Map<LayoutId, IndexedLayout>();

function fieldsOf(bin: Bin): SearchField[] {
  const fields: SearchField[] = [];
  for (const item of bin.items ?? []) {
    fields.push(searchField('item', item.name));
    if (item.note) fields.push(searchField('note', item.note));
  }
  if (bin.label.trim() !== '') fields.push(searchField('label', bin.label));
  if (bin.notes.trim() !== '') fields.push(searchField('note', bin.notes));
  return fields;
}

export function recordsForLayout(layoutId: LayoutId, layout: Layout): BinSearchRecord[] {
  const layerNames = new Map(layout.layers.map((layer) => [layer.id, layer.name]));
  const records: BinSearchRecord[] = [];
  for (const bin of layout.bins) {
    const fields = fieldsOf(bin);
    if (fields.length === 0) continue;
    records.push({
      layoutId,
      binId: bin.id,
      layerId: bin.layerId,
      layerName: bin.layerId === STAGING_ID ? null : (layerNames.get(bin.layerId) ?? null),
      label: bin.label,
      fields,
    });
  }
  return records;
}

/** Search records for every stored layout but the active one, which the caller reads live. */
export async function reconcileFindIndex(
  library: LayoutLibrary,
  activeLayoutId: LayoutId | null
): Promise<BinSearchRecord[]> {
  const live = new Set(library.entries.map((entry) => entry.id));
  for (const id of indexed.keys()) if (!live.has(id)) indexed.delete(id);

  for (const entry of library.entries) {
    if (entry.id === activeLayoutId) continue;
    if (indexed.get(entry.id)?.modifiedAt === entry.modifiedAt) continue;
    const layout = await loadLayoutAsync(entry.id);
    if (layout) {
      indexed.set(entry.id, {
        modifiedAt: entry.modifiedAt,
        records: recordsForLayout(entry.id, layout),
      });
    } else {
      indexed.delete(entry.id);
    }
  }

  const records: BinSearchRecord[] = [];
  for (const [id, layout] of indexed) if (id !== activeLayoutId) records.push(...layout.records);
  return records;
}

export function __resetForTests(): void {
  indexed.clear();
}
