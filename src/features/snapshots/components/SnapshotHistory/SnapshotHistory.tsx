import { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useHistoryStore } from '@/core/store/history';
import { useSnapshotStore } from '@/core/store/snapshots';
import { useToastStore } from '@/core/store/toast';
import { restoreSnapshot, createLayoutEntry, deleteSnapshotById } from '@/core/storage';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { SnapshotEntry } from '../SnapshotEntry/SnapshotEntry';
import { RestoreDialog } from '../RestoreDialog/RestoreDialog';
import type { Snapshot } from '@/core/types';

export function SnapshotHistory() {
  const t = useTranslation();
  const [restoreTarget, setRestoreTarget] = useState<Snapshot | null>(null);

  const { layout, activeLayoutId } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
    }))
  );
  const importLayout = useLayoutStore((state) => state.importLayout);

  const { library, setLibrary } = useLibraryStore(
    useShallow((state) => ({
      library: state.library,
      setLibrary: state.setLibrary,
    }))
  );

  const { snapshots, isLoading, loadForLayout, addSnapshot, softRemove, reinsert, updateLabel } =
    useSnapshotStore(
      useShallow((state) => ({
        snapshots: state.snapshots,
        isLoading: state.isLoading,
        loadForLayout: state.loadForLayout,
        addSnapshot: state.addSnapshot,
        softRemove: state.softRemove,
        reinsert: state.reinsert,
        updateLabel: state.updateLabel,
      }))
    );

  const clearHistory = useHistoryStore((state) => state.clear);
  const addToast = useToastStore((state) => state.addToast);

  // Deferred delete: remove from UI immediately, delay IndexedDB deletion for undo window
  const pendingDeleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isEditable = activeLayoutId !== null && activeLayoutId !== '__shared_preview__';

  useEffect(() => {
    if (isEditable && activeLayoutId) {
      void loadForLayout(activeLayoutId);
    }

    // Commit any pending deletes from the previous layout
    const timers = pendingDeleteTimers.current;
    for (const [id, timer] of timers) {
      clearTimeout(timer);
      void deleteSnapshotById(id);
    }
    timers.clear();
  }, [activeLayoutId, isEditable, loadForLayout]);

  const handleSaveCheckpoint = () => {
    if (!isEditable || !activeLayoutId) return;

    const label = new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    void addSnapshot(activeLayoutId, layout, label).then(() => {
      addToast(t('snapshots.checkpointSaved'), 'success');
    });
  };

  const handleCreateSnapshotNow = () => {
    if (!isEditable || !activeLayoutId) return;
    void addSnapshot(activeLayoutId, layout);
  };

  // Clean up any pending delete timers on unmount
  useEffect(() => {
    const timers = pendingDeleteTimers.current;
    return () => {
      // Commit all pending deletes immediately on unmount
      for (const [id, timer] of timers) {
        clearTimeout(timer);
        void deleteSnapshotById(id);
      }
      timers.clear();
    };
  }, []);

  const handleDelete = (snapshotId: string) => {
    const snapshot = useSnapshotStore.getState().snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return;

    // Remove from UI immediately (IndexedDB data preserved for undo)
    softRemove(snapshotId);

    // Schedule actual IndexedDB deletion after undo window
    const timer = setTimeout(() => {
      pendingDeleteTimers.current.delete(snapshotId);
      void deleteSnapshotById(snapshotId);
    }, 6000); // slightly longer than toast duration
    pendingDeleteTimers.current.set(snapshotId, timer);

    addToast({
      message: t('snapshots.deleted'),
      type: 'info',
      duration: 5000,
      action: {
        label: t('snapshots.undoDelete'),
        onClick: () => {
          // Cancel the scheduled IndexedDB deletion
          const pendingTimer = pendingDeleteTimers.current.get(snapshotId);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            pendingDeleteTimers.current.delete(snapshotId);
          }
          // Re-insert the original snapshot metadata into UI
          reinsert(snapshot);
        },
      },
    });
  };

  const handleRestore = (snapshotId: string) => {
    const snapshot = useSnapshotStore.getState().snapshots.find((s) => s.id === snapshotId);
    if (snapshot) {
      setRestoreTarget(snapshot);
    }
  };

  const handleReplace = async () => {
    if (!restoreTarget || !activeLayoutId) return;

    const restoredLayout = await restoreSnapshot(restoreTarget.id);
    if (!restoredLayout) {
      addToast(t('snapshots.restoreFailed'), 'error');
      setRestoreTarget(null);
      return;
    }

    importLayout(restoredLayout, activeLayoutId, 'init');
    clearHistory();
    addToast(t('snapshots.restored'), 'success');
    setRestoreTarget(null);
  };

  const handleCreateCopy = async () => {
    if (!restoreTarget) return;

    const restoredLayout = await restoreSnapshot(restoreTarget.id);
    if (!restoredLayout) {
      addToast(t('snapshots.restoreFailed'), 'error');
      setRestoreTarget(null);
      return;
    }

    const result = await createLayoutEntry(restoredLayout, library);
    if (isOk(result)) {
      setLibrary(result.value.library);
      addToast(t('snapshots.createdCopy'), 'success');
    }
    setRestoreTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="px-4 py-8 text-center" data-testid="snapshot-empty">
        <svg
          className="w-8 h-8 mx-auto mb-3 text-content-disabled"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {ICON_PATHS.clock.map((d) => (
            <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
          ))}
        </svg>
        <p className="text-sm text-content-secondary">{t('snapshots.empty')}</p>
        <p className="text-xs text-content-tertiary mt-1">{t('snapshots.emptyDescription')}</p>
        {isEditable && layout.bins.length > 0 && (
          <button
            onClick={handleCreateSnapshotNow}
            className="mt-3 text-xs text-accent hover:text-accent-hover transition-colors bg-transparent"
            data-testid="create-snapshot-now"
          >
            {t('snapshots.createSnapshotNow')}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-stroke-subtle">
        <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">
          {t('snapshots.title')}
        </span>
        <button
          onClick={handleSaveCheckpoint}
          className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors bg-transparent"
          aria-label={t('snapshots.saveCheckpoint')}
          data-testid="save-checkpoint"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {ICON_PATHS.plus.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
          {t('snapshots.saveCheckpoint')}
        </button>
      </div>

      <div className="flex flex-col" data-testid="snapshot-history">
        {snapshots.map((snapshot, index) => (
          <SnapshotEntry
            key={snapshot.id}
            snapshot={snapshot}
            isLast={index === snapshots.length - 1}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onUpdateLabel={(id, label) => void updateLabel(id, label)}
          />
        ))}
      </div>

      <RestoreDialog
        snapshot={restoreTarget}
        onReplace={() => void handleReplace()}
        onCreateCopy={() => void handleCreateCopy()}
        onClose={() => setRestoreTarget(null)}
      />
    </>
  );
}
