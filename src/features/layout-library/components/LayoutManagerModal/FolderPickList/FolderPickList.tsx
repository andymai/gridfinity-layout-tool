import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
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

const ROOT_KEY = '';
const keyOf = (id: string | null): string => id ?? ROOT_KEY;

/**
 * The folder tree as one indented list of radio buttons, root first. One row
 * is in the tab order; the arrow keys move the choice through the enabled
 * rows, Home and End jump to the ends.
 */
export function FolderPickList({ library, value, movingFolderId, onPick }: FolderPickListProps) {
  const t = useTranslation();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const rows: Row[] = [{ folder: null, depth: 0 }, ...flatten(library, null, 1)];
  const isDisabled = (id: string | null): boolean =>
    movingFolderId !== undefined &&
    id !== null &&
    (id === movingFolderId || isDescendantFolder(library, id, movingFolderId));
  const enabled = rows.map((r) => r.folder?.id ?? null).filter((id) => !isDisabled(id));
  const tabbable = enabled.includes(value) ? value : (enabled[0] ?? null);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const at = enabled.indexOf(value);
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = at < 0 ? 0 : (at + 1) % enabled.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = at < 0 ? enabled.length - 1 : (at - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const id = enabled[next] ?? null;
    onPick(id);
    buttons.current.get(keyOf(id))?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('layouts.folders.moveTo')}
      className="flex flex-col gap-0.5"
    >
      {rows.map(({ folder, depth }) => {
        const id = folder?.id ?? null;
        const checked = id === value;
        return (
          <Button
            key={keyOf(id)}
            ref={(el) => {
              if (el) buttons.current.set(keyOf(id), el);
              else buttons.current.delete(keyOf(id));
            }}
            variant="ghost"
            fullWidth
            role="radio"
            aria-checked={checked}
            tabIndex={id === tabbable ? 0 : -1}
            disabled={isDisabled(id)}
            onClick={() => onPick(id)}
            onKeyDown={onKeyDown}
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
