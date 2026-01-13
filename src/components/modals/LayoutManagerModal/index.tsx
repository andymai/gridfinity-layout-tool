import { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutSwitcher } from '../../../hooks/useLayoutSwitcher';
import { useUIStore } from '../../../store/ui';
import { useCollectionStore } from '../../../store/collection';
import { useLayoutStore } from '../../../store/layout';
import { useToastStore } from '../../../store/toast';
import { LayoutList } from './LayoutList';
import { CollectionLayoutList } from './CollectionLayoutList';
import { ImportView } from './ImportView';
import { ShareModal } from '../ShareModal';
import { CreateCollectionModal } from '../CreateCollectionModal';
import { JoinCollectionModal } from '../JoinCollectionModal';
import * as collectionApi from '../../../api/collection';
import { loadLayoutById } from '../../../utils/storage';
import type { Layout } from '../../../types';

type Tab = 'layouts' | 'collection' | 'import';

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
  const [shareModalLayoutId, setShareModalLayoutId] = useState<string | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showJoinCollection, setShowJoinCollection] = useState(false);
  const [rejoiningCollectionId, setRejoiningCollectionId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const { isInCollectionMode, activeCollection, activeCollectionLayouts, leaveCollection, addLayoutToCollection, setMembershipActiveLayout, clearActiveCollection, memberships, joinCollection, removeMembership } = useCollectionStore(
    useShallow((state) => ({
      isInCollectionMode: state.isInCollectionMode(),
      activeCollection: state.activeCollection,
      activeCollectionLayouts: state.activeCollectionLayouts,
      leaveCollection: state.leaveCollection,
      addLayoutToCollection: state.addLayoutToCollection,
      setMembershipActiveLayout: state.setMembershipActiveLayout,
      clearActiveCollection: state.clearActiveCollection,
      memberships: state.memberships,
      joinCollection: state.joinCollection,
      removeMembership: state.removeMembership,
    }))
  );

  // Default to collection tab if in collection mode, otherwise layouts
  const [activeTab, setActiveTab] = useState<Tab>(isInCollectionMode ? 'collection' : 'layouts');

  const importLayout = useLayoutStore((state) => state.importLayout);

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
  const addToast = useToastStore((state) => state.addToast);

  // Announce modal opened
  useEffect(() => {
    const count = isInCollectionMode ? activeCollectionLayouts.length : library.entries.length;
    const context = isInCollectionMode ? 'collection' : '';
    announceToScreenReader(`Layouts dialog opened. ${count} ${context} layouts available.`);
  }, [announceToScreenReader, library.entries.length, activeCollectionLayouts.length, isInCollectionMode]);

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
      // Exit collection mode when switching to a local layout
      // This prevents the collection routing hook from re-loading the collection layout
      if (isInCollectionMode) {
        clearActiveCollection();
      }

      const entry = library.entries.find((e) => e.id === id);
      const result = switchLayout(id);
      if (result.success) {
        announceToScreenReader(`Switched to ${entry?.name || 'layout'}`);
        onClose();
      }
    },
    [library.entries, switchLayout, announceToScreenReader, onClose, isInCollectionMode, clearActiveCollection]
  );

  // Handle switching to a collection layout (fetches from server)
  const handleCollectionSwitch = useCallback(
    async (layoutId: string) => {
      if (!activeCollection) return;

      const layoutRef = activeCollectionLayouts.find((l) => l.id === layoutId);
      const result = await collectionApi.fetchLayout(activeCollection.id, layoutId);

      if (result.success) {
        importLayout(result.data.layout as Layout, layoutId);
        // Save active layout ID for restoration on reload
        setMembershipActiveLayout(activeCollection.id, layoutId);
        announceToScreenReader(`Switched to ${layoutRef?.name || 'layout'}`);
        onClose();
      }
    },
    [activeCollection, activeCollectionLayouts, importLayout, setMembershipActiveLayout, announceToScreenReader, onClose]
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

  const handleShare = useCallback((layoutId: string) => {
    setShareModalLayoutId(layoutId);
  }, []);

  // Handle rejoining a previously joined collection
  const handleRejoinCollection = useCallback(
    async (collectionId: string) => {
      setRejoiningCollectionId(collectionId);
      const result = await joinCollection(collectionId);

      if (result.success) {
        addToast(`Rejoined collection: ${result.data.name}`, 'success');
        announceToScreenReader(`Rejoined collection: ${result.data.name}`);
      } else {
        addToast('Failed to rejoin collection', 'error');
        // Remove stale membership if collection no longer exists
        if (result.error.code === 'NOT_FOUND') {
          removeMembership(collectionId);
        }
      }
      setRejoiningCollectionId(null);
    },
    [joinCollection, addToast, announceToScreenReader, removeMembership]
  );

  // Handle forgetting a collection membership (without joining first)
  const handleForgetMembership = useCallback(
    (collectionId: string, collectionName: string) => {
      removeMembership(collectionId);
      addToast(`Removed "${collectionName}" from your collections`, 'success');
      announceToScreenReader(`Removed ${collectionName} from your collections`);
    },
    [removeMembership, addToast, announceToScreenReader]
  );

  const handleCopyToCollection = useCallback(
    async (layoutId: string) => {
      // Load the layout data from storage
      const layoutData = layoutId === activeLayoutId
        ? useLayoutStore.getState().layout
        : loadLayoutById(layoutId);

      if (!layoutData) {
        addToast('Could not load layout', 'error');
        return;
      }

      const result = await addLayoutToCollection(layoutData);

      if (result.success) {
        addToast(`Copied "${result.data.name}" to collection`, 'success');
        announceToScreenReader(`Layout copied to collection`);
      } else {
        addToast(result.error.error, 'error');
      }
    },
    [activeLayoutId, addLayoutToCollection, addToast, announceToScreenReader]
  );

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
                ? 'bg-accent text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            My Layouts
          </button>

          {/* Collection tab - always visible */}
          <button
            id="collection-tab"
            role="tab"
            aria-selected={activeTab === 'collection'}
            aria-controls="collection-panel"
            onClick={() => setActiveTab('collection')}
            className={`
              flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 relative
              ${activeTab === 'collection'
                ? 'bg-accent text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Collection
            {/* Active indicator when in collection mode but tab not selected */}
            {isInCollectionMode && activeTab !== 'collection' && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true" />
            )}
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
                ? 'bg-accent text-white'
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
        <div className="min-h-0 overflow-hidden flex flex-col">
          {/* My Layouts Tab - Always shows personal/local layouts */}
          {activeTab === 'layouts' && (
            <div id="layouts-panel" role="tabpanel" aria-labelledby="layouts-tab" className="flex-1 min-h-0 overflow-auto">
              <LayoutList
                entries={library.entries}
                activeLayoutId={activeLayoutId}
                isInCollectionMode={isInCollectionMode}
                onSwitch={handleSwitch}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onCreate={handleCreate}
                onShare={handleShare}
                onCopyToCollection={isInCollectionMode ? handleCopyToCollection : undefined}
              />
            </div>
          )}

          {/* Collection Tab - Always visible */}
          {activeTab === 'collection' && (
            <div id="collection-panel" role="tabpanel" aria-labelledby="collection-tab" className="flex-1 min-h-0 flex flex-col">
              {/* Show collections list or "Get Started" when not in collection mode */}
              {!isInCollectionMode && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Header with action buttons */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setShowJoinCollection(true)}
                      className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-stroke text-content hover:bg-surface transition-colors"
                    >
                      Join by Code
                    </button>
                    <button
                      onClick={() => setShowCreateCollection(true)}
                      className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create New
                    </button>
                  </div>

                  {/* Previously joined collections */}
                  {memberships.length > 0 ? (
                    <div className="flex-1 min-h-0 overflow-auto">
                      <div className="text-xs font-medium text-content-tertiary uppercase tracking-wide mb-2">
                        Your Collections
                      </div>
                      <div className="space-y-2">
                        {[...memberships]
                          .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
                          .map((membership) => (
                            <div
                              key={membership.collectionId}
                              className="group flex items-center gap-3 p-3 rounded-lg border border-stroke hover:border-stroke-strong hover:bg-surface-secondary transition-all cursor-pointer"
                              onClick={() => handleRejoinCollection(membership.collectionId)}
                            >
                              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-content truncate">
                                  {membership.collectionName}
                                </div>
                                <div className="text-xs text-content-tertiary">
                                  Last accessed {new Date(membership.lastAccessedAt).toLocaleDateString()}
                                </div>
                              </div>
                              {rejoiningCollectionId === membership.collectionId ? (
                                <svg className="w-5 h-5 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleForgetMembership(membership.collectionId, membership.collectionName);
                                    }}
                                    className="p-1.5 rounded hover:bg-surface text-content-tertiary hover:text-red-500 transition-colors"
                                    title="Remove from list"
                                    aria-label={`Remove ${membership.collectionName} from your collections`}
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                  <svg className="w-5 h-5 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-content mb-1 flex items-center gap-2">
                        Shared Collections
                        <span className="text-[9px] leading-none text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">experimental</span>
                      </h3>
                      <p className="text-sm text-content-secondary max-w-xs">
                        Work on layouts together in real-time. Create a collection or join one with a code.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Show collection content when in collection mode */}
              {isInCollectionMode && (
                <>
                  {/* Back to collections list */}
                  {memberships.length > 1 && (
                    <button
                      onClick={() => {
                        leaveCollection();
                        announceToScreenReader('Returned to collections list');
                      }}
                      className="flex items-center gap-1 text-sm text-content-secondary hover:text-content mb-3 -ml-1 group"
                    >
                      <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      All Collections
                    </button>
                  )}

                  {/* Collection Header */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-stroke">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <div>
                        <div className="font-medium text-content">{activeCollection?.name}</div>
                        <div className="text-xs text-content-tertiary">Shared collection</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        leaveCollection();
                        announceToScreenReader('Left collection');
                      }}
                      className="px-3 py-1.5 text-sm font-medium rounded-md text-content-secondary hover:text-content hover:bg-surface transition-colors"
                      title="Leave this collection"
                    >
                      Leave
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-auto">
                    <CollectionLayoutList
                      onSwitch={handleCollectionSwitch}
                      onClose={onClose}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'import' && (
            <div id="import-panel" role="tabpanel" aria-labelledby="import-tab" className="h-full">
              <ImportView onImport={handleImport} onCancel={handleImportCancel} />
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalLayoutId !== null}
        onClose={() => setShareModalLayoutId(null)}
        layoutId={shareModalLayoutId ?? undefined}
      />

      {/* Collection Modals */}
      <CreateCollectionModal
        isOpen={showCreateCollection}
        onClose={() => setShowCreateCollection(false)}
      />
      <JoinCollectionModal
        isOpen={showJoinCollection}
        onClose={() => setShowJoinCollection(false)}
      />
    </div>
  );
}
