import { useState, useEffect, useRef, useCallback } from 'react';
import { useLayoutSwitcher } from '../../hooks/useLayoutSwitcher';
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sort entries: active first, then by modifiedAt descending
  const sortedEntries = [...library.entries].sort((a, b) => {
    if (a.id === activeLayoutId) return -1;
    if (b.id === activeLayoutId) return 1;
    return b.modifiedAt - a.modifiedAt;
  });

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else if (confirmDeleteId) {
          setConfirmDeleteId(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, editingId, confirmDeleteId]);

  const handleStartRename = useCallback((entry: LayoutEntry) => {
    setEditingId(entry.id);
    setEditingName(entry.name);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (editingId && editingName.trim()) {
      renameLayout(editingId, editingName.trim());
    }
    setEditingId(null);
  }, [editingId, editingName, renameLayout]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }, [handleFinishRename]);

  const handleSwitch = useCallback((id: string) => {
    if (id !== activeLayoutId) {
      const result = switchLayout(id);
      if (result.success) {
        onClose();
      }
    }
  }, [activeLayoutId, switchLayout, onClose]);

  const handleCreate = useCallback(() => {
    const result = createNewLayout();
    if (result.success) {
      onClose();
    }
  }, [createNewLayout, onClose]);

  const handleDuplicate = useCallback((id: string) => {
    duplicateLayout(id);
  }, [duplicateLayout]);

  const handleDelete = useCallback((id: string) => {
    if (library.entries.length <= 1) return;

    if (confirmDeleteId === id) {
      deleteLayout(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  }, [confirmDeleteId, deleteLayout, library.entries.length]);

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
    >
      <div
        className="bg-surface-elevated rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-content">Layouts</h2>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Create New Button */}
        <button
          onClick={handleCreate}
          className="w-full mb-4 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Layout
        </button>

        {/* Layout List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto space-y-2 min-h-0"
        >
          {sortedEntries.map((entry) => {
            const isActive = entry.id === activeLayoutId;
            const isEditing = editingId === entry.id;
            const isConfirmingDelete = confirmDeleteId === entry.id;

            return (
              <div
                key={entry.id}
                className={`
                  p-4 rounded-lg border transition-colors cursor-pointer
                  ${isActive
                    ? 'bg-blue-900/30 border-blue-500'
                    : 'bg-surface-secondary border-stroke hover:border-stroke-subtle hover:bg-surface'
                  }
                `}
                onClick={() => !isEditing && handleSwitch(entry.id)}
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
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-content truncate">
                          {entry.name}
                        </h3>
                        {isActive && (
                          <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">
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
                  >
                    {/* Rename Button */}
                    <button
                      onClick={() => handleStartRename(entry)}
                      className="p-2 text-content-secondary hover:text-content hover:bg-surface rounded transition-colors"
                      title="Rename"
                      aria-label="Rename layout"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Duplicate Button */}
                    <button
                      onClick={() => handleDuplicate(entry.id)}
                      className="p-2 text-content-secondary hover:text-content hover:bg-surface rounded transition-colors"
                      title="Duplicate"
                      aria-label="Duplicate layout"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>

                    {/* Delete Button */}
                    {library.entries.length > 1 && (
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className={`
                          p-2 rounded transition-colors
                          ${isConfirmingDelete
                            ? 'bg-red-600 text-white hover:bg-red-500'
                            : 'text-content-secondary hover:text-red-400 hover:bg-surface'
                          }
                        `}
                        title={isConfirmingDelete ? 'Click again to confirm' : 'Delete'}
                        aria-label={isConfirmingDelete ? 'Confirm delete' : 'Delete layout'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
