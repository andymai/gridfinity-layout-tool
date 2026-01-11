import { useState, useEffect, useRef, useCallback } from 'react';
import { useLayoutSwitcher } from '../../hooks/useLayoutSwitcher';
import { useLayoutStore } from '../../store/layout';
import { useUIStore } from '../../store/ui';
import { loadLayoutById, downloadLayoutAsFile, generateShareableURL, copyToClipboard } from '../../utils/storage';
import type { LayoutEntry } from '../../types';

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
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentLayout = useLayoutStore((state) => state.layout);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const layoutItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Sort entries: active first, then by modifiedAt descending
  const sortedEntries = [...library.entries].sort((a, b) => {
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

  const handleStartRename = useCallback((entry: LayoutEntry) => {
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
    const entry = library.entries.find(e => e.id === id);
    const result = duplicateLayout(id);
    if (result.success) {
      announceToScreenReader(`Duplicated ${entry?.name || 'layout'}`);
    }
  }, [duplicateLayout, library.entries, announceToScreenReader]);

  const handleDelete = useCallback((id: string) => {
    if (library.entries.length <= 1) {
      announceToScreenReader('Cannot delete the only layout');
      return;
    }

    const entry = library.entries.find(e => e.id === id);
    if (confirmDeleteId === id) {
      deleteLayout(id);
      setConfirmDeleteId(null);
      announceToScreenReader(`${entry?.name || 'Layout'} deleted`);
    } else {
      setConfirmDeleteId(id);
      announceToScreenReader(`Press delete again to confirm deleting ${entry?.name || 'this layout'}`);
    }
  }, [confirmDeleteId, deleteLayout, library.entries, announceToScreenReader]);

  const handleShareClick = useCallback((id: string) => {
    setShareMenuId(shareMenuId === id ? null : id);
  }, [shareMenuId]);

  const handleDownload = useCallback((id: string) => {
    const entry = library.entries.find(e => e.id === id);
    // For active layout, use current state; otherwise load from storage
    const layout = id === activeLayoutId ? currentLayout : loadLayoutById(id);
    if (layout && entry) {
      downloadLayoutAsFile(layout, `${entry.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`);
      announceToScreenReader('Layout downloaded');
    }
    setShareMenuId(null);
  }, [activeLayoutId, currentLayout, library.entries, announceToScreenReader]);

  const handleCopyLink = useCallback(async (id: string) => {
    const entry = library.entries.find(e => e.id === id);
    // For active layout, use current state; otherwise load from storage
    const layout = id === activeLayoutId ? currentLayout : loadLayoutById(id);
    if (layout) {
      const url = generateShareableURL(layout);
      const success = await copyToClipboard(url);
      if (success) {
        setCopiedLink(true);
        announceToScreenReader(`Link copied for ${entry?.name || 'layout'}`);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    }
    setShareMenuId(null);
  }, [activeLayoutId, currentLayout, library.entries, announceToScreenReader]);

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
        className="bg-surface-elevated rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
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

        {/* Create New Button */}
        <button
          ref={createButtonRef}
          onClick={handleCreate}
          className="w-full mb-4 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Layout
        </button>

        {/* Layout List */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Available layouts"
          aria-activedescendant={sortedEntries[focusedIndex]?.id}
          className="flex-1 overflow-y-auto space-y-2 min-h-0"
        >
          {sortedEntries.map((entry, index) => {
            const isActive = entry.id === activeLayoutId;
            const isEditing = editingId === entry.id;
            const isConfirmingDelete = confirmDeleteId === entry.id;

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
                  w-full text-left p-4 rounded-lg border transition-colors cursor-pointer
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
                <div className="flex items-start justify-between gap-3">
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
                        className="w-full bg-surface px-2 py-1 rounded border border-stroke focus:border-blue-500 focus:outline-none text-content"
                        maxLength={64}
                        aria-label="Layout name"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-content truncate">
                          {entry.name}
                        </span>
                        {isActive && (
                          <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded" aria-label="Currently active layout">
                            Active
                          </span>
                        )}
                      </div>
                    )}

                    {/* Preview Info */}
                    <div className="mt-1 text-sm text-content-secondary flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        {entry.preview.drawerWidth}×{entry.preview.drawerDepth}×{entry.preview.drawerHeight}
                      </span>
                      <span>{entry.preview.binCount} bins</span>
                      <span>{entry.preview.layerCount} layers</span>
                      <span className="text-content-tertiary">
                        {formatDate(entry.modifiedAt)}
                      </span>
                    </div>

                    {/* Forked From */}
                    {entry.forkedFrom && (
                      <div className="mt-1 text-xs text-content-tertiary">
                        Forked from {entry.forkedFrom.name}
                        {entry.forkedFrom.author && ` by ${entry.forkedFrom.author}`}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                    role="group"
                    aria-label={`Actions for ${entry.name}`}
                  >
                    {/* Share Button with Dropdown */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareClick(entry.id);
                        }}
                        className="p-2 text-content-secondary hover:text-content hover:bg-surface rounded transition-colors"
                        title="Share"
                        aria-label={`Share ${entry.name}`}
                        aria-expanded={shareMenuId === entry.id}
                        aria-haspopup="menu"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                      {shareMenuId === entry.id && (
                        <div
                          className="absolute right-0 mt-1 w-48 bg-surface-elevated border border-stroke rounded-lg shadow-lg py-1 z-10"
                          role="menu"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLink(entry.id);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
                            role="menuitem"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            {copiedLink ? 'Copied!' : 'Copy Link'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(entry.id);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
                            role="menuitem"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download JSON
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Rename Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(entry);
                      }}
                      className="p-2 text-content-secondary hover:text-content hover:bg-surface rounded transition-colors"
                      title="Rename"
                      aria-label={`Rename ${entry.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Duplicate Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicate(entry.id);
                      }}
                      className="p-2 text-content-secondary hover:text-content hover:bg-surface rounded transition-colors"
                      title="Duplicate"
                      aria-label={`Duplicate ${entry.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>

                    {/* Delete Button */}
                    {library.entries.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry.id);
                        }}
                        className={`
                          p-2 rounded transition-colors
                          ${isConfirmingDelete
                            ? 'bg-red-600 text-white hover:bg-red-500'
                            : 'text-content-secondary hover:text-red-400 hover:bg-surface'
                          }
                        `}
                        title={isConfirmingDelete ? 'Click again to confirm' : 'Delete'}
                        aria-label={isConfirmingDelete ? `Confirm delete ${entry.name}` : `Delete ${entry.name}`}
                        aria-pressed={isConfirmingDelete}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Storage Info */}
        <div className="mt-4 pt-4 border-t border-stroke text-sm text-content-tertiary flex justify-between">
          <span>{library.entries.length} layouts</span>
          <span className="text-xs">
            Press <kbd className="px-1 py-0.5 bg-surface rounded">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
