import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isRealLayoutId } from '@/core/constants';
import { folderPath } from '@/core/storage';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import type { BinId, LayoutId, LayoutLibrary } from '@/core/types';
import { useTranslation } from '@/i18n';
import { reconcileFindIndex, recordsForLayout } from '../find/findIndex';
import { matchBins } from '../find/matchBins';
import type { BinMatch, BinSearchRecord } from '../find/matchBins';

export interface FoundBin {
  readonly key: string;
  readonly layoutId: LayoutId;
  readonly binId: BinId;
  readonly title: string;
  /** Folders, then the layout, then the layer or the stash. */
  readonly path: readonly string[];
}

export interface FindBinsState {
  readonly results: readonly FoundBin[];
  /** True until the stored layouts have been read once this session. */
  readonly indexing: boolean;
}

function pathOf(
  match: BinMatch,
  library: LayoutLibrary,
  stashLabel: string
): readonly string[] | null {
  const entry = library.entries.find((e) => e.id === match.record.layoutId);
  if (!entry) return null;
  return [
    ...folderPath(library, entry.folderId ?? null).map((folder) => folder.name),
    entry.name,
    match.record.layerName ?? stashLabel,
  ];
}

export function useFindBins(query: string): FindBinsState {
  const t = useTranslation();
  const library = useLibraryStore((s) => s.library);
  const { activeLayoutId, layout } = useLayoutStore(
    useShallow((s) => ({ activeLayoutId: s.activeLayoutId, layout: s.layout }))
  );
  const [stored, setStored] = useState<readonly BinSearchRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    reconcileFindIndex(library, activeLayoutId).then(
      (records) => {
        if (!cancelled) setStored(records);
      },
      () => {
        if (!cancelled) setStored([]);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [library, activeLayoutId]);

  const active = useMemo(
    () => (isRealLayoutId(activeLayoutId) ? recordsForLayout(activeLayoutId, layout) : []),
    [activeLayoutId, layout]
  );

  const results = useMemo(() => {
    const stashLabel = t('staging.stash');
    const found: FoundBin[] = [];
    for (const match of matchBins(query, [...active, ...(stored ?? [])])) {
      const path = pathOf(match, library, stashLabel);
      if (!path) continue;
      const { record, field } = match;
      found.push({
        key: `bin::${record.layoutId}::${record.binId}`,
        layoutId: record.layoutId,
        binId: record.binId,
        title: field.kind === 'item' ? field.text : record.label.trim() || t('staging.unlabeled'),
        path,
      });
    }
    return found;
  }, [query, active, stored, library, t]);

  return { results, indexing: stored === null };
}
