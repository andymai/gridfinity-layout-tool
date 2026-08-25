import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Dialog, EmptyState, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { designId as toDesignId } from '@/core/types';
import { useToastStore } from '@/core/store/toast';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useDesignVersionStore } from '@/features/bin-designer/store/versionStore';
import { loadDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { MAX_VERSIONS_PER_DESIGN } from '@/features/bin-designer/types';
import type { DesignVersionContent, DesignVersionSummary } from '@/features/bin-designer/types';
import { VersionEntry } from './VersionEntry';

export interface VersionHistoryProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * Named version history for the open design.
 *
 * A dialog rather than a docked drawer because the designer has four responsive
 * layout trees and no drawer primitive; the adjacent "Designs" header button
 * already opens a dialog, so this matches the surface it sits beside.
 */
export function VersionHistory({ open, onClose }: VersionHistoryProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const { currentDesignId, designName, params, itemKind, envelope, structure } = useDesignerStore(
    useShallow((s) => ({
      currentDesignId: s.currentDesignId,
      designName: s.designName,
      params: s.params,
      itemKind: s.itemKind,
      envelope: s.envelope,
      structure: s.structure,
    }))
  );
  const restoreVersion = useDesignerStore((s) => s.restoreVersion);

  const {
    versions,
    isLoading,
    loadForDesign,
    saveVersion,
    readVersion,
    rename,
    setPinned,
    remove,
  } = useDesignVersionStore(
    useShallow((s) => ({
      versions: s.versions,
      isLoading: s.isLoading,
      loadForDesign: s.loadForDesign,
      saveVersion: s.saveVersion,
      readVersion: s.readVersion,
      rename: s.rename,
      setPinned: s.setPinned,
      remove: s.remove,
    }))
  );

  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (naming) nameRef.current?.focus();
  }, [naming]);

  useEffect(() => {
    if (open && currentDesignId) void loadForDesign(toDesignId(currentDesignId));
  }, [open, currentDesignId, loadForDesign]);

  /** The slice of the working state a version restores. */
  const captureContent = useCallback(
    (): DesignVersionContent => ({
      name: designName,
      ...(itemKind === 'bin' ? { params } : { kind: itemKind, envelope, structure }),
    }),
    [designName, itemKind, params, envelope, structure]
  );

  // The design's stored thumbnail is the freshest render of the state being
  // captured (autosave and the background regenerator keep it current), so a
  // version reuses it rather than forcing a re-render of the 3D scene.
  const captureThumbnail = useCallback(async (id: string): Promise<string | null> => {
    const result = await loadDesign(toDesignId(id));
    return isOk(result) ? result.value.thumbnail : null;
  }, []);

  const announceEvictions = useCallback(() => {
    const evicted = useDesignVersionStore.getState().lastEvicted;
    for (const victim of evicted) {
      addToast(t('binDesigner.versions.evicted', { name: victim.name }), 'info');
    }
    useDesignVersionStore.getState().clearEvicted();
  }, [addToast, t]);

  const handleSave = async () => {
    if (!currentDesignId) return;
    const name = draftName.trim() || designName;
    setBusy(true);
    try {
      const saved = await saveVersion(
        toDesignId(currentDesignId),
        name,
        captureContent(),
        await captureThumbnail(currentDesignId)
      );
      if (saved) {
        addToast(t('binDesigner.versions.saved', { name: saved.name }), 'success');
        announceEvictions();
      }
      setNaming(false);
      setDraftName('');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (version: DesignVersionSummary) => {
    if (!currentDesignId) return;
    setBusy(true);
    try {
      const content = await readVersion(version.id);
      if (!content) return;

      // Captured BEFORE the swap, and unconditionally: undo is bounded and lost
      // on reload, so this is the only thing standing between a restore and
      // work the user never named.
      const backupName = t('binDesigner.versions.preRestoreName');
      await saveVersion(
        toDesignId(currentDesignId),
        backupName,
        captureContent(),
        await captureThumbnail(currentDesignId),
        'pre-restore'
      );

      restoreVersion(content);
      addToast(
        t('binDesigner.versions.restored', { name: version.name, backup: backupName }),
        'success'
      );
      announceEvictions();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (version: DesignVersionSummary) => {
    await remove(version.id);
    addToast(t('binDesigner.versions.deleted', { name: version.name }), 'info');
  };

  return (
    <Dialog.Root open={open} onClose={onClose} size="lg">
      <Dialog.Header
        title={t('binDesigner.versions.title')}
        closeAriaLabel={t('common.closeDialog')}
      />
      <Dialog.Body>
        {!currentDesignId ? (
          <EmptyState
            title={t('binDesigner.versions.emptyTitle')}
            description={t('binDesigner.versions.unsavedDesign')}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-content-tertiary">
                {t('binDesigner.versions.count', {
                  count: versions.length,
                  max: MAX_VERSIONS_PER_DESIGN,
                })}
              </p>
              {!naming && (
                <Button variant="primary" size="sm" disabled={busy} onClick={() => setNaming(true)}>
                  {t('binDesigner.versions.save')}
                </Button>
              )}
            </div>

            {naming && (
              <div className="flex flex-col gap-2 rounded-sm border border-stroke-subtle bg-surface-elevated p-3">
                <Input
                  ref={nameRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave();
                    if (e.key === 'Escape') setNaming(false);
                  }}
                  placeholder={t('binDesigner.versions.namePlaceholder')}
                  aria-label={t('binDesigner.versions.namePlaceholder')}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">
                    {t('binDesigner.versions.nameHint')}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setNaming(false)}>
                      {t('binDesigner.versions.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleSave()}
                    >
                      {t('binDesigner.versions.confirmSave')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!isLoading && versions.length === 0 ? (
              <EmptyState
                title={t('binDesigner.versions.emptyTitle')}
                description={t('binDesigner.versions.emptyBody')}
              />
            ) : (
              <ul className="rounded-sm border border-stroke-subtle">
                {versions.map((version) => (
                  <VersionEntry
                    key={version.id}
                    version={version}
                    busy={busy}
                    onRestore={(v) => void handleRestore(v)}
                    onRename={(v, name) => void rename(v.id, name)}
                    onTogglePin={(v) => void setPinned(v.id, !v.pinned)}
                    onDelete={(v) => void handleDelete(v)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </Dialog.Body>
    </Dialog.Root>
  );
}
