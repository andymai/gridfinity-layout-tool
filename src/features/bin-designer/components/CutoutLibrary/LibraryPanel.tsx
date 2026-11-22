/**
 * The dock's Library tab: every saved item, found by search or by folder, with
 * the ones this bin already uses first. A click on an item starts placing it.
 */

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Collapsible, EmptyState, NavRow, SearchInput } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { Cutout } from '@/features/bin-designer/types';
import type {
  CutoutLibraryFolder,
  CutoutLibraryItem,
} from '@/features/bin-designer/library/libraryTypes';
import { useCutoutLibrary } from '@/features/bin-designer/library/cutoutLibraryStore';
import { contentBounds, itemsOnBoard } from './libraryContent';
import { itemsIn, matchesQuery } from './libraryFolders';
import { LibraryThumbnail } from './LibraryThumbnail';

const THUMBNAIL_PX = 40;

interface LibraryPanelProps {
  /** The board's cutouts, for the items it already uses. */
  readonly cutouts: readonly Cutout[];
  readonly canSave: boolean;
  /** The item whose ghost follows the cursor, if any. */
  readonly placingId: string | null;
  readonly onSave: () => void;
  readonly onPlace: (item: CutoutLibraryItem) => void;
  /** A press on an item, which becomes a drag to the board when it moves. */
  readonly onPress: (item: CutoutLibraryItem, event: ReactPointerEvent<HTMLElement>) => void;
  readonly onManage: () => void;
}

type RowActions = Pick<LibraryPanelProps, 'onPlace' | 'onPress'>;

const mm = (value: number) => String(Math.round(value * 10) / 10);

function LibraryRow({
  item,
  placing,
  onPlace,
  onPress,
}: RowActions & {
  readonly item: CutoutLibraryItem;
  readonly placing: boolean;
}) {
  const t = useTranslation();
  const subtitle = useMemo(() => {
    const { cutouts } = item.content.params;
    const box = contentBounds(cutouts);
    const count = t('binDesigner.cutouts.library.shapeCount', { count: cutouts.length });
    if (!box) return count;
    const size = t('binDesigner.cutouts.library.size', {
      width: mm(box.maxX - box.minX),
      depth: mm(box.maxY - box.minY),
    });
    return `${size} · ${count}`;
  }, [item.content.params, t]);
  return (
    <NavRow
      icon={<LibraryThumbnail item={item} size={THUMBNAIL_PX} />}
      title={item.name}
      subtitle={subtitle}
      trailing={null}
      aria-pressed={placing}
      className={placing ? 'select-none border-accent' : 'select-none'}
      onClick={() => onPlace(item)}
      onPointerDown={(e) => onPress(item, e)}
    />
  );
}

function FolderSection({
  folder,
  folders,
  items,
  placingId,
  onPlace,
  onPress,
}: RowActions & {
  readonly folder: CutoutLibraryFolder;
  readonly folders: readonly CutoutLibraryFolder[];
  readonly items: readonly CutoutLibraryItem[];
  readonly placingId: string | null;
}) {
  const t = useTranslation();
  const children = folders.filter((f) => f.parentId === folder.id);
  const held = itemsIn(items, folder.id, folders);
  return (
    <Collapsible title={folder.name} size="sm" defaultExpanded={false}>
      <div className="flex flex-col gap-2 pl-2">
        {children.map((child) => (
          <FolderSection
            key={child.id}
            folder={child}
            folders={folders}
            items={items}
            placingId={placingId}
            onPlace={onPlace}
            onPress={onPress}
          />
        ))}
        {held.map((item) => (
          <LibraryRow
            key={item.id}
            item={item}
            placing={item.id === placingId}
            onPlace={onPlace}
            onPress={onPress}
          />
        ))}
        {children.length === 0 && held.length === 0 && (
          <p className="text-xs text-content-tertiary">
            {t('binDesigner.cutouts.library.emptyFolder')}
          </p>
        )}
      </div>
    </Collapsible>
  );
}

export function LibraryPanel({
  cutouts,
  canSave,
  placingId,
  onSave,
  onPlace,
  onPress,
  onManage,
}: LibraryPanelProps) {
  const t = useTranslation();
  const { items, folders, loaded } = useCutoutLibrary();
  const [query, setQuery] = useState('');

  const usedHere = useMemo(() => {
    const ids = itemsOnBoard(cutouts);
    return items.filter((item) => ids.has(item.id));
  }, [cutouts, items]);
  const ids = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  const topFolders = folders.filter((f) => f.parentId === null || !ids.has(f.parentId));
  const searching = query.trim().length > 0;
  const matches = searching ? items.filter((item) => matchesQuery(item, query)) : [];

  const row = (item: CutoutLibraryItem) => (
    <LibraryRow
      key={item.id}
      item={item}
      placing={item.id === placingId}
      onPlace={onPlace}
      onPress={onPress}
    />
  );

  return (
    <div className="flex flex-col gap-3 px-4 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={onSave}
          disabled={!canSave}
          title={canSave ? undefined : t('binDesigner.cutouts.library.saveNeedsSelection')}
        >
          {t('binDesigner.cutouts.library.save')}
        </Button>
        <Button size="sm" variant="secondary" onClick={onManage}>
          {t('binDesigner.cutouts.library.manage')}
        </Button>
      </div>

      {loaded && items.length === 0 ? (
        <EmptyState
          title={t('binDesigner.cutouts.library.emptyTitle')}
          description={t('binDesigner.cutouts.library.emptyBody')}
        />
      ) : (
        <>
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('binDesigner.cutouts.library.search')}
            aria-label={t('binDesigner.cutouts.library.search')}
            clearLabel={t('binDesigner.cutouts.library.clearSearch')}
          />
          {searching ? (
            <div className="flex flex-col gap-2">
              {matches.length > 0 ? (
                matches.map(row)
              ) : (
                <p className="text-xs text-content-tertiary">
                  {t('binDesigner.cutouts.library.noMatches')}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Only a shortcut: listing every item twice would say nothing. */}
              {usedHere.length > 0 && usedHere.length < items.length && (
                <Collapsible title={t('binDesigner.cutouts.library.usedInBin')} size="sm">
                  <div className="flex flex-col gap-2">{usedHere.map(row)}</div>
                </Collapsible>
              )}
              {topFolders.map((folder) => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  folders={folders}
                  items={items}
                  placingId={placingId}
                  onPlace={onPlace}
                  onPress={onPress}
                />
              ))}
              {itemsIn(items, null, folders).map(row)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
