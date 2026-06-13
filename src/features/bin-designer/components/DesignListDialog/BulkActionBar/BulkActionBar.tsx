import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';

interface BulkActionBarProps {
  count: number;
  onSelectAll: () => void;
  onTag: () => void;
  onExport: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/** Action bar shown in bulk-selection mode. Bulk actions disable when nothing is selected. */
export function BulkActionBar({
  count,
  onSelectAll,
  onTag,
  onExport,
  onDelete,
  onCancel,
}: BulkActionBarProps) {
  const t = useTranslation();
  const none = count === 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stroke bg-surface px-3 py-2">
      <span className="text-sm font-medium text-content">
        {t('binDesigner.bulk.selected', { count })}
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={onSelectAll}
        className="rounded-none px-0 py-0 hover:bg-transparent text-xs font-medium text-accent hover:underline"
      >
        {t('binDesigner.bulk.selectAll')}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onTag} disabled={none}>
          {t('binDesigner.bulk.tag')}
        </Button>
        <Button variant="secondary" size="sm" onClick={onExport} disabled={none}>
          {t('binDesigner.bulk.export')}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete} disabled={none}>
          {t('binDesigner.bulk.delete')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t('binDesigner.bulk.cancelSelection')}
        </Button>
      </div>
    </div>
  );
}
