import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import {
  useBinInspector,
  SingleBinInspector,
  MultiBinInspector,
  EmptyState,
} from '../../features/bin-inspector';

/**
 * Mobile-optimized bin inspector with large touch targets.
 * Uses shared inspector components with mobile variant.
 */
export function MobileInspector() {
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
          title={deleteConfirmState?.title || 'Delete Bins'}
          message={deleteConfirmState?.message || `Delete ${selectedBins.length} selected bins?`}
          confirmText="Delete"
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
        title={deleteConfirmState?.title || 'Delete Bin'}
        message={deleteConfirmState?.message || `Delete this ${bin.width}×${bin.depth} bin?`}
        confirmText="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
