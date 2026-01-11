import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import {
  useBinInspector,
  SingleBinInspector,
  MultiBinInspector,
  EmptyState,
} from '../inspector';

/**
 * Mobile-optimized bin inspector with large touch targets.
 * Uses shared inspector components with mobile variant.
 */
export function MobileInspector() {
  const { t } = useTranslation(['layout', 'common']);
  const inspector = useBinInspector();
  const {
    selectedBins,
    isMultiSelect,
    bin,
    deleteConfirmState,
    confirmDelete,
    cancelDelete,
  } = inspector;

  // Empty state
  if (selectedBins.length === 0) {
    return <EmptyState variant="mobile" />;
  }

  // Multi-select
  if (isMultiSelect) {
    return (
      <div className="pb-4">
        <MultiBinInspector
          inspector={inspector}
          variant="mobile"
        />

        <ConfirmDialog
          isOpen={deleteConfirmState !== null}
          title={deleteConfirmState?.title || t('bin.deleteMultiple')}
          message={deleteConfirmState?.message || t('bin.deleteMultipleConfirm', { count: selectedBins.length })}
          confirmText={t('common:buttons.delete')}
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
      <SingleBinInspector
        inspector={inspector}
        variant="mobile"
      />

      <ConfirmDialog
        isOpen={deleteConfirmState !== null}
        title={deleteConfirmState?.title || t('bin.deleteSingle')}
        message={deleteConfirmState?.message || t('bin.deleteSingleConfirm', { width: bin.width, depth: bin.depth })}
        confirmText={t('common:buttons.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
