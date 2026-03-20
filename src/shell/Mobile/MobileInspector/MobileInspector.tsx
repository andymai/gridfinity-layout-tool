import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import {
  useBinInspector,
  SingleBinInspector,
  MultiBinInspector,
  EmptyState,
} from '@/features/bin-inspector';
import { useTranslation } from '@/i18n';

/**
 * Mobile-optimized bin inspector with large touch targets.
 * Uses shared inspector components with mobile variant.
 */
export function MobileInspector() {
  const t = useTranslation();
  const inspector = useBinInspector();
  const { selectedBins, isMultiSelect, bin, deleteConfirmState, confirmDelete, cancelDelete } =
    inspector;

  // Empty state
  if (selectedBins.length === 0) {
    return <EmptyState variant="mobile" />;
  }

  // Multi-select
  if (isMultiSelect) {
    return (
      <div className="pb-4">
        <MultiBinInspector inspector={inspector} variant="mobile" />

        <ConfirmDialog
          isOpen={deleteConfirmState !== null}
          title={deleteConfirmState?.title || t('mobile.inspector.deleteBins')}
          message={
            deleteConfirmState?.message ||
            t('mobile.confirm.deleteMulti', { count: selectedBins.length })
          }
          confirmText={t('common.delete')}
          destructive
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      </div>
    );
  }

  // Single bin
  if (!bin) return null;

  return (
    <div className="pb-4">
      <SingleBinInspector inspector={inspector} variant="mobile" />

      <ConfirmDialog
        isOpen={deleteConfirmState !== null}
        title={deleteConfirmState?.title || t('mobile.inspector.deleteBin')}
        message={
          deleteConfirmState?.message ||
          t('mobile.confirm.deleteSingle', { width: bin.width, depth: bin.depth })
        }
        confirmText={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
