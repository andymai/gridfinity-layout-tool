import { useCallback, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { LayoutFolder, LayoutLibrary } from '@/core/types';
import { childFolders, entriesInFolder, folderPath } from '@/core/storage';
import { useTranslation } from '@/i18n';
import { Button, IconButton, Input, useInlineEdit } from '@/design-system';
import { useTwoClickDelete } from '@/shared/components';

interface FolderTreeProps {
  readonly library: LayoutLibrary;
  /** The folder whose layouts the list shows; null for every layout. */
  readonly selectedId: string | null;
  readonly onSelect: (folderId: string | null) => void;
  readonly onCreate: (name: string, parentId: string | null) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
}

const ICON = {
  chevron: 'M9 5l7 7-7 7',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  layouts:
    'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  pencil:
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:
    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  plus: 'M12 4v16m8-8H4',
} as const;

function Glyph({ d, className = 'h-4 w-4' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

const ROW =
  'group flex h-8 w-full items-center gap-1 rounded-md pr-1 text-left text-sm transition-colors';
const ROW_ON = 'bg-accent-muted/40 text-content';
const ROW_OFF = 'text-content-secondary hover:bg-surface-hover hover:text-content';

interface FolderRowProps {
  readonly library: LayoutLibrary;
  readonly folder: LayoutFolder;
  readonly depth: number;
  readonly selectedId: string | null;
  readonly expanded: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onSelect: (id: string) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
}

function FolderRow({
  library,
  folder,
  depth,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  onRename,
  onDelete,
}: FolderRowProps) {
  const t = useTranslation();
  const children = childFolders(library, folder.id);
  const count = entriesInFolder(library, folder.id).length;
  const open = expanded.has(folder.id);
  const selected = selectedId === folder.id;
  const {
    isEditing,
    editingValue,
    inputRef,
    startEditing,
    handleChange,
    handleFinish,
    handleKeyDown,
  } = useInlineEdit({
    initialValue: folder.name,
    onSave: (name) => onRename(folder.id, name),
  });
  const {
    isConfirming,
    handleClick: handleDeleteClick,
    reset: resetDelete,
  } = useTwoClickDelete(() => onDelete(folder.id));

  return (
    <li
      role="treeitem"
      aria-selected={selected}
      aria-expanded={children.length > 0 ? open : undefined}
    >
      <div
        className={`${ROW} ${selected ? ROW_ON : ROW_OFF}`}
        style={{ paddingLeft: `${depth * 10}px` }}
      >
        {children.length > 0 ? (
          <IconButton
            size="sm"
            touchTarget={false}
            onClick={() => onToggle(folder.id)}
            aria-label={open ? t('layouts.folders.collapse') : t('layouts.folders.expand')}
            className="h-6 w-6 shrink-0 text-content-tertiary"
          >
            <Glyph
              d={ICON.chevron}
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
            />
          </IconButton>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editingValue}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleFinish}
            onKeyDown={handleKeyDown}
            size="sm"
            fullWidth
            maxLength={32}
            aria-label={t('layouts.folders.rename')}
            className="h-6 text-sm"
          />
        ) : (
          <Button
            variant="ghost"
            onClick={() => onSelect(folder.id)}
            onDoubleClick={startEditing}
            aria-label={t('layouts.folders.open', { name: folder.name })}
            className="h-6 min-w-0 flex-1 justify-start gap-1.5 px-1 font-normal hover:bg-transparent"
          >
            <Glyph d={ICON.folder} className="h-4 w-4 shrink-0 text-content-tertiary" />
            <span className="truncate">{folder.name}</span>
            {count > 0 && (
              <span className="ml-auto shrink-0 text-xs tabular-nums text-content-tertiary">
                {count}
              </span>
            )}
          </Button>
        )}
        {!isEditing && (
          <span
            className={`flex shrink-0 items-center ${
              selected || isConfirming
                ? ''
                : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
            }`}
          >
            <IconButton
              size="sm"
              touchTarget={false}
              onClick={startEditing}
              aria-label={`${t('layouts.folders.rename')}: ${folder.name}`}
              className="h-6 w-6 text-content-tertiary hover:text-content"
            >
              <Glyph d={ICON.pencil} className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              touchTarget={false}
              onClick={handleDeleteClick}
              onBlur={resetDelete}
              aria-label={`${isConfirming ? t('layouts.folders.deleteConfirm') : t('layouts.folders.delete')}: ${folder.name}`}
              title={t('layouts.folders.deleteHint')}
              className={`h-6 ${isConfirming ? 'w-auto px-1.5 text-xs text-danger' : 'w-6 text-content-tertiary hover:text-danger'}`}
            >
              {isConfirming ? (
                t('layouts.folders.deleteConfirm')
              ) : (
                <Glyph d={ICON.trash} className="h-3.5 w-3.5" />
              )}
            </IconButton>
          </span>
        )}
      </div>
      {open && children.length > 0 && (
        <ul role="group">
          {children.map((child) => (
            <FolderRow
              key={child.id}
              library={library}
              folder={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The folder tree beside the layout list: every layout at the top, then the
 * folders, nested. Opens to the selected folder, and grows a new folder under
 * whatever is selected.
 */
export function FolderTree({
  library,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: FolderTreeProps) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [draft, setDraft] = useState<string | null>(null);

  // Ancestors of the selection are always open, so a selection made elsewhere
  // (a breadcrumb, a move) is never hidden inside a collapsed row.
  const openSet = useMemo(
    () =>
      new Set([
        ...expanded,
        ...folderPath(library, selectedId)
          .slice(0, -1)
          .map((f) => f.id),
      ]),
    [expanded, library, selectedId]
  );

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const commitDraft = useCallback(() => {
    const name = draft?.trim() ?? '';
    if (name !== '') {
      onCreate(name, selectedId);
      if (selectedId !== null) setExpanded((prev) => new Set([...prev, selectedId]));
    }
    setDraft(null);
  }, [draft, onCreate, selectedId]);

  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitDraft();
    if (e.key === 'Escape') setDraft(null);
  };

  const roots = childFolders(library, null);
  const selectedName = folderPath(library, selectedId).at(-1)?.name;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul
        role="tree"
        aria-label={t('layouts.folders.tree')}
        className="min-h-0 flex-1 space-y-0.5 overflow-auto pr-1"
      >
        <li role="treeitem" aria-selected={selectedId === null}>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => onSelect(null)}
            className={`${ROW} ${selectedId === null ? ROW_ON : ROW_OFF} justify-start gap-1.5 px-1 font-normal`}
          >
            <span className="h-6 w-6 shrink-0" />
            <Glyph d={ICON.layouts} className="h-4 w-4 shrink-0 text-content-tertiary" />
            <span className="truncate">{t('layouts.folders.all')}</span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-content-tertiary">
              {library.entries.length}
            </span>
          </Button>
        </li>
        {roots.map((folder) => (
          <FolderRow
            key={folder.id}
            library={library}
            folder={folder}
            depth={1}
            selectedId={selectedId}
            expanded={openSet}
            onToggle={toggle}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </ul>
      {draft !== null ? (
        <div className="mt-2 flex items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKey}
            size="sm"
            fullWidth
            maxLength={32}
            placeholder={t('layouts.folders.namePlaceholder')}
            aria-label={t('layouts.folders.namePlaceholder')}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the row exists only to be typed into
            autoFocus
          />
          <Button variant="primary" size="sm" onClick={commitDraft} disabled={draft.trim() === ''}>
            {t('layouts.folders.create')}
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft('')}
          leftIcon={<Glyph d={ICON.plus} />}
          className="mt-2 justify-start text-content-secondary"
          title={
            selectedName ? t('layouts.folders.newSubfolder', { name: selectedName }) : undefined
          }
        >
          {t('layouts.folders.newFolder')}
        </Button>
      )}
    </div>
  );
}
