import { useState, useEffect, useRef, useCallback } from 'react';
import { useLayoutSwitcher } from '../../hooks/useLayoutSwitcher';
import { useLayoutStore } from '../../store/layout';
import { useUIStore } from '../../store/ui';
import { loadLayoutById, downloadLayoutAsFile, generateShareableURL, copyToClipboard, saveLayoutById, saveLibrary } from '../../utils/storage';
import { useLibraryStore, computePreview } from '../../store/library';
import { generateUUID } from '../../utils/uuid';
import { ImportModal } from './ImportModal';
import { LayoutThumbnail } from '../LayoutThumbnail';
import type { Layout, LayoutEntry } from '../../types';

/** Threshold for showing search bar */
const SEARCH_THRESHOLD = 6;

interface LayoutManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Wrapper that only mounts the inner component when open
export function LayoutManagerModal({ isOpen, onClose }: LayoutManagerModalProps) {
  if (!isOpen) return null;
  return <LayoutManagerModalContent onClose={onClose} />;
}

function LayoutManagerModalContent({ onClose }: { onClose: () => void }) {
  const {
    activeLayoutId,
    library,
    switchLayout,
    createNewLayout,
    deleteLayout,
    duplicateLayout,
    renameLayout,
  } = useLayoutSwitcher();

  const announceToScreenReader = useUIStore(state => state.announceToScreenReader);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const { createEntry, setActiveLayoutId } = useLibraryStore();
  const importLayout = useLayoutStore((state) => state.importLayout);

  const currentLayout = useLayoutStore((state) => state.layout);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const layoutItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const menuButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);

  const showSearch = library.entries.length >= SEARCH_THRESHOLD;

  // Filter and sort entries: active first, then by modifiedAt descending
  const sortedEntries = [...library.entries]
    .filter(entry => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return entry.name.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (a.id === activeLayoutId) return -1;
      if (b.id === activeLayoutId) return 1;
      return b.modifiedAt - a.modifiedAt;
    });

  // Focus first interactive element on mount
  useEffect(() => {
    createButtonRef.current?.focus();
    announceToScreenReader(`Layouts dialog opened. ${library.entries.length} layouts available.`);
  }, [announceToScreenReader, library.entries.length]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Handle keyboard navigation within modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle escape
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else if (confirmDeleteId) {
          setConfirmDeleteId(null);
          announceToScreenReader('Delete cancelled');
        } else {
          onClose();
        }
        return;
      }

      // Arrow key navigation in layout list
      if (!editingId && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const newIndex = e.key === 'ArrowDown'
          ? Math.min(focusedIndex + 1, sortedEntries.length - 1)
          : Math.max(focusedIndex - 1, 0);
        setFocusedIndex(newIndex);
        const entry = sortedEntries[newIndex];
        if (entry) {
          layoutItemRefs.current.get(entry.id)?.focus();
        }
      }

      // Focus trap - Tab key
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, editingId, confirmDeleteId, focusedIndex, sortedEntries, announceToScreenReader]);

  // Close overflow menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;

    const handleClick = (e: MouseEvent) => {
      const menuButton = menuButtonRefs.current.get(openMenuId);
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        (!menuButton || !menuButton.contains(e.target as Node))
      ) {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const handleStartRename = useCallback((entry: LayoutEntry) => {
    setOpenMenuId(null);
    setEditingId(entry.id);
    setEditingName(entry.name);
    announceToScreenReader(`Editing name of ${entry.name}`);
  }, [announceToScreenReader]);

  const handleFinishRename = useCallback(() => {
    if (editingId && editingName.trim()) {
      renameLayout(editingId, editingName.trim());
      announceToScreenReader(`Layout renamed to ${editingName.trim()}`);
    }
    setEditingId(null);
  }, [editingId, editingName, renameLayout, announceToScreenReader]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }, [handleFinishRename]);

  const handleSwitch = useCallback((id: string) => {
    if (id !== activeLayoutId) {
      const entry = library.entries.find(e => e.id === id);
      const result = switchLayout(id);
      if (result.success) {
        announceToScreenReader(`Switched to ${entry?.name || 'layout'}`);
        onClose();
      }
    }
  }, [activeLayoutId, switchLayout, onClose, library.entries, announceToScreenReader]);

  const handleCreate = useCallback(() => {
    const result = createNewLayout();
    if (result.success) {
      announceToScreenReader('New layout created');
      onClose();
    }
  }, [createNewLayout, onClose, announceToScreenReader]);

  const handleDuplicate = useCallback((id: string) => {
    setOpenMenuId(null);
    const entry = library.entries.find(e => e.id === id);
    const result = duplicateLayout(id);
    if (result.success) {
      announceToScreenReader(`Duplicated ${entry?.name || 'layout'}`);
    }
  }, [duplicateLayout, library.entries, announceToScreenReader]);

  const handleDelete = useCallback((id: string) => {
    if (library.entries.length <= 1) {
      announceToScreenReader('Cannot delete the only layout');
      setOpenMenuId(null);
      return;
    }

    const entry = library.entries.find(e => e.id === id);
    const hasBins = entry && entry.preview.binCount > 0;

    if (confirmDeleteId === id) {
      setOpenMenuId(null);
      deleteLayout(id);
      setConfirmDeleteId(null);
      announceToScreenReader(`${entry?.name || 'Layout'} deleted`);
    } else {
      setConfirmDeleteId(id);
      if (hasBins) {
        announceToScreenReader(`Layout has ${entry.preview.binCount} bins. Press delete again to confirm deleting ${entry?.name || 'this layout'}`);
      } else {
        announceToScreenReader(`Press delete again to confirm deleting ${entry?.name || 'this layout'}`);
      }
    }
  }, [confirmDeleteId, deleteLayout, library.entries, announceToScreenReader]);

  const handleDownload = useCallback((id: string) => {
    setOpenMenuId(null);
    const entry = library.entries.find(e => e.id === id);
    // For active layout, use current state; otherwise load from storage
    const layout = id === activeLayoutId ? currentLayout : loadLayoutById(id);
    if (layout && entry) {
      downloadLayoutAsFile(layout, `${entry.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`);
      announceToScreenReader('Layout downloaded');
    }
  }, [activeLayoutId, currentLayout, library.entries, announceToScreenReader]);

  const handleCopyLink = useCallback(async (id: string) => {
    setOpenMenuId(null);
    const entry = library.entries.find(e => e.id === id);
    // For active layout, use current state; otherwise load from storage
    const layout = id === activeLayoutId ? currentLayout : loadLayoutById(id);
    if (layout) {
      const url = generateShareableURL(layout);
      const success = await copyToClipboard(url);
      if (success) {
        announceToScreenReader(`Link copied for ${entry?.name || 'layout'}`);
      }
    }
  }, [activeLayoutId, currentLayout, library.entries, announceToScreenReader]);

  const handleImportLayout = useCallback((layout: Layout) => {
    const layoutId = generateUUID();
    const importedLayout = {
      ...layout,
      name: `${layout.name} (imported)`,
    };

    // Save layout to storage
    saveLayoutById(layoutId, importedLayout);

    // Create library entry
    createEntry(importedLayout.name, layoutId, computePreview(importedLayout));

    // Switch to the imported layout
    importLayout(importedLayout, layoutId);
    setActiveLayoutId(layoutId);

    // Save library
    saveLibrary(useLibraryStore.getState().library);

    announceToScreenReader(`Imported ${importedLayout.name}`);
    onClose();
  }, [createEntry, importLayout, setActiveLayoutId, announceToScreenReader, onClose]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-manager-title"
        className="bg-surface-elevated rounded-lg p-6 max-w-2xl w-full mx-4 min-h-[400px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 id="layout-manager-title" className="text-2xl font-bold text-content">Layouts</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-content-secondary hover:text-content transition-colors"
            aria-label="Close layouts dialog"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Create New / Import Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            ref={createButtonRef}
            onClick={handleCreate}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Layout
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="py-2.5 px-4 bg-surface-secondary hover:bg-surface border border-stroke text-content rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            aria-label="Import layout from JSON file"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
        </div>

        {/* Search (appears with 6+ layouts) */}
        {showSearch && (
          <div className="relative mb-4">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search layouts..."
              className="w-full pl-9 pr-8 py-2 bg-surface border border-stroke rounded-lg text-sm text-content placeholder:text-content-tertiary focus:outline-none focus:border-blue-500"
              aria-label="Search layouts"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-tertiary hover:text-content"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Layout List */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Available layouts"
          aria-activedescendant={sortedEntries[focusedIndex]?.id}
          className="flex-1 overflow-y-auto space-y-2 min-h-0"
        >
          {sortedEntries.length === 0 && searchQuery && (
            <div className="text-center py-8 text-content-tertiary">
              No layouts match "{searchQuery}"
            </div>
          )}
          {sortedEntries.map((entry, index) => {
            const isActive = entry.id === activeLayoutId;
            const isEditing = editingId === entry.id;
            const isMenuOpen = openMenuId === entry.id;

            return (
              <div
                key={entry.id}
                id={entry.id}
                ref={(el) => {
                  if (el) layoutItemRefs.current.set(entry.id, el);
                  else layoutItemRefs.current.delete(entry.id);
                }}
                role="option"
                aria-selected={isActive}
                aria-current={isActive ? 'true' : undefined}
                tabIndex={index === focusedIndex ? 0 : -1}
                className={`
                  w-full text-left p-3 rounded-lg border transition-colors cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-surface-elevated
                  ${isActive
                    ? 'bg-blue-900/30 border-blue-500'
                    : 'bg-surface-secondary border-stroke hover:border-stroke-subtle hover:bg-surface'
                  }
                `}
                onClick={() => !isEditing && handleSwitch(entry.id)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
                    e.preventDefault();
                    handleSwitch(entry.id);
                  }
                }}
                onFocus={() => setFocusedIndex(index)}
              >
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <LayoutThumbnail preview={entry.preview} size={48} />
                  </div>

                  {/* Name and Info */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-surface px-2 py-1 rounded border border-stroke focus:border-blue-500 focus:outline-none text-content text-sm"
                        maxLength={64}
                        aria-label="Layout name"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-content text-sm truncate">
                          {entry.name}
                        </span>
                        {isActive && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded" aria-label="Currently active layout">
                            Active
                          </span>
                        )}
                      </div>
                    )}

                    {/* Preview Info */}
                    <div className="mt-0.5 text-xs text-content-secondary flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>
                        {entry.preview.drawerWidth}×{entry.preview.drawerDepth}×{entry.preview.drawerHeight}
                      </span>
                      <span>{entry.preview.binCount} bins</span>
                      <span className="text-content-tertiary">
                        {formatDate(entry.modifiedAt)}
                      </span>
                    </div>

                    {/* Forked From */}
                    {entry.forkedFrom && (
                      <div className="mt-0.5 text-xs text-content-tertiary">
                        Forked from {entry.forkedFrom.name}
                      </div>
                    )}
                  </div>

                  {/* Overflow Menu Button */}
                  <div
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      ref={(el) => {
                        if (el) menuButtonRefs.current.set(entry.id, el);
                        else menuButtonRefs.current.delete(entry.id);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMenuOpen) {
                          setOpenMenuId(null);
                          setMenuPosition(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPosition({
                            top: rect.bottom + 4,
                            right: window.innerWidth - rect.right,
                          });
                          setOpenMenuId(entry.id);
                        }
                        setConfirmDeleteId(null);
                      }}
                      className={`
                        p-1.5 rounded transition-colors
                        ${isMenuOpen
                          ? 'bg-surface text-content'
                          : 'text-content-secondary hover:text-content hover:bg-surface'
                        }
                      `}
                      aria-label={`Actions for ${entry.name}`}
                      aria-expanded={isMenuOpen}
                      aria-haspopup="menu"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dropdown Menu - rendered outside scrollable list */}
        {openMenuId && menuPosition && (() => {
          const entry = sortedEntries.find(e => e.id === openMenuId);
          if (!entry) return null;
          const isConfirmingDelete = confirmDeleteId === entry.id;

          return (
            <div
              ref={menuRef}
              role="menu"
              className="fixed w-44 bg-surface-elevated border border-stroke rounded-lg shadow-lg py-1 z-50"
              style={{ top: menuPosition.top, right: menuPosition.right }}
            >
              <button
                role="menuitem"
                onClick={() => handleCopyLink(entry.id)}
                className="w-full px-3 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Copy share link
              </button>
              <button
                role="menuitem"
                onClick={() => handleDownload(entry.id)}
                className="w-full px-3 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download JSON
              </button>
              <div className="border-t border-stroke my-1" />
              <button
                role="menuitem"
                onClick={() => handleStartRename(entry)}
                className="w-full px-3 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Rename
              </button>
              <button
                role="menuitem"
                onClick={() => handleDuplicate(entry.id)}
                className="w-full px-3 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-content-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicate
              </button>
              {library.entries.length > 1 && (
                <>
                  <div className="border-t border-stroke my-1" />
                  <button
                    role="menuitem"
                    onClick={() => handleDelete(entry.id)}
                    className={`
                      w-full px-3 py-2 text-left text-sm flex flex-col gap-0.5
                      ${isConfirmingDelete
                        ? 'bg-red-600 text-white'
                        : 'text-red-400 hover:bg-surface'
                      }
                    `}
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {isConfirmingDelete ? 'Click to confirm' : 'Delete'}
                    </span>
                    {isConfirmingDelete && entry.preview.binCount > 0 && (
                      <span className="text-xs text-red-200 ml-6">
                        {entry.preview.binCount} bin{entry.preview.binCount === 1 ? '' : 's'} will be deleted
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          );
        })()}

        {/* Storage Info */}
        <div className="mt-4 pt-4 border-t border-stroke text-sm text-content-tertiary flex justify-between">
          <span>{library.entries.length} layouts</span>
          <span className="text-xs">
            Press <kbd className="px-1 py-0.5 bg-surface rounded">Esc</kbd> to close
          </span>
        </div>
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportLayout}
      />
    </div>
  );
}
