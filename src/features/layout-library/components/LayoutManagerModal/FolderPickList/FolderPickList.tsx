import type { LayoutFolder, LayoutLibrary } from '@/core/types';
import { childFolders, isDescendantFolder } from '@/core/storage';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';

interface FolderPickListProps {
  readonly library: LayoutLibrary;
  /** The folder currently chosen; null for the root. */
  readonly value: string | null;
  /**
   * A folder being moved cannot go into itself or its own subtree; those rows
   * render disabled.
   */
  readonly movingFolderId?: string;
  readonly onPick: (folderId: string | null) => void;
}

interface Row {
  readonly folder: LayoutFolder | null;
  readonly depth: number;
}

function flatten(library: LayoutLibrary, parentId: string | null, depth: number): Row[] {
  return childFolders(library, parentId).flatMap((folder) => [
    { folder, depth },
    ...flatten(library, folder.id, depth + 1),
  ]);
}

/** The folder tree as one indented list of radio buttons, root first. */
export function FolderPickList({ library, value, movingFolderId, onPick }: FolderPickListProps) {
  const t = useTranslation();
  const rows: Row[] = [{ folder: null, depth: 0 }, ...flatten(library, null, 1)];
  return (
    <div
      role="radiogroup"
      aria-label={t('layouts.folders.moveTo')}
      className="flex flex-col gap-0.5"
    >
      {rows.map(({ folder, depth }) => {
        const id = folder?.id ?? null;
        const checked = id === value;
        const disabled =
          movingFolderId !== undefined &&
          id !== null &&
          (id === movingFolderId || isDescendantFolder(library, id, movingFolderId));
        return (
          <Button
            key={id ?? 'root'}
            variant="ghost"
            fullWidth
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onPick(id)}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            className={`h-9 justify-start gap-2 rounded-md text-sm font-normal ${
              checked
                ? 'bg-accent-muted/40 text-content'
                : 'text-content-secondary hover:text-content'
            }`}
          >
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${checked ? 'bg-accent' : 'bg-transparent'}`}
            />
            <span className="truncate">{folder ? folder.name : t('layouts.folders.noFolder')}</span>
          </Button>
        );
      })}
    </div>
  );
}
