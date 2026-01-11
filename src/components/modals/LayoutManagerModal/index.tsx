import { useState, useEffect, useRef, useCallback } from 'react';
import { useLayoutSwitcher } from '../../../hooks/useLayoutSwitcher';
import { useUIStore } from '../../../store/ui';
import { LayoutList } from './LayoutList';
import { ImportView } from './ImportView';
import type { Layout } from '../../../types';

type Tab = 'layouts' | 'import';

interface LayoutManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Layout Manager Modal - main entry point.
 * Provides tabbed interface for managing layouts (list view) and importing layouts.
 */
export function LayoutManagerModal({ isOpen, onClose }: LayoutManagerModalProps) {
  if (!isOpen) return null;
  return <LayoutManagerModalContent onClose={onClose} />;
}

function LayoutManagerModalContent({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('layouts');
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const {
    activeLayoutId,
    library,
    switchLayout,
    createNewLayout,
    deleteLayout,
    duplicateLayout,
    renameLayout,
    importLayoutFromJSON,
  } = useLayoutSwitcher();

  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  // Announce modal opened
  useEffect(() => {
    announceToScreenReader(`Layouts dialog opened. ${library.entries.length} layouts available.`);
  }, [announceToScreenReader, library.entries.length]);

  // Handle escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap - Tab key
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [onClose]);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleSwitch = useCallback(
    (id: string) => {
      const entry = library.entries.find((e) => e.id === id);
      const result = switchLayout(id);
      if (result.success) {
        announceToScreenReader(`Switched to ${entry?.name || 'layout'}`);
        onClose();
      }
    },
    [library.entries, switchLayout, announceToScreenReader, onClose]
  );

  const handleCreate = useCallback(() => {
    const result = createNewLayout();
    if (result.success) {
      announceToScreenReader('New layout created');
      onClose();
    }
  }, [createNewLayout, announceToScreenReader, onClose]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteLayout(id);
    },
    [deleteLayout]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateLayout(id);
    },
    [duplicateLayout]
  );

  const handleRename = useCallback(
    (id: string, newName: string) => {
      renameLayout(id, newName);
    },
    [renameLayout]
  );

  const handleImport = useCallback(
    (layout: Layout) => {
      const result = importLayoutFromJSON({
        ...layout,
        name: `${layout.name} (imported)`,
      });

      if (result.success && result.data) {
        // Switch to the imported layout
        switchLayout(result.data);
        announceToScreenReader(`Imported ${layout.name}`);
        onClose();
      }
    },
    [importLayoutFromJSON, switchLayout, announceToScreenReader, onClose]
  );

  const handleImportCancel = useCallback(() => {
    setActiveTab('layouts');
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-manager-title"
        className="bg-surface-elevated rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] grid grid-rows-[auto_auto_1fr] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 id="layout-manager-title" className="text-2xl font-bold text-content">
            Layouts
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 text-content-secondary hover:text-content transition-colors rounded hover:bg-surface"
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
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1" role="tablist">
          <button
            id="layouts-tab"
            role="tab"
            aria-selected={activeTab === 'layouts'}
            aria-controls="layouts-panel"
            onClick={() => setActiveTab('layouts')}
            className={`
              flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'layouts'
                ? 'bg-blue-600 text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            My Layouts
          </button>
          <button
            id="import-tab"
            role="tab"
            aria-selected={activeTab === 'import'}
            aria-controls="import-panel"
            onClick={() => setActiveTab('import')}
            className={`
              flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'import'
                ? 'bg-blue-600 text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-0 overflow-hidden">
          {activeTab === 'layouts' && (
            <div id="layouts-panel" role="tabpanel" aria-labelledby="layouts-tab" className="h-full">
              <LayoutList
                entries={library.entries}
                activeLayoutId={activeLayoutId}
                onSwitch={handleSwitch}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onCreate={handleCreate}
              />
            </div>
          )}

          {activeTab === 'import' && (
            <div id="import-panel" role="tabpanel" aria-labelledby="import-tab" className="h-full">
              <ImportView onImport={handleImport} onCancel={handleImportCancel} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
