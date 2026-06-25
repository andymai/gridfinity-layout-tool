/**
 * A SECONDARY "Export…" action that opens the existing export dialog (the header
 * keeps the single primary Download). No export logic here.
 */

import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { ExportFileFormat } from '@/features/bin-designer/types';

interface ExportSplitSectionProps {
  readonly format: ExportFileFormat | undefined;
  readonly needsSplit: boolean;
  readonly splitPieceCount: number;
  readonly canExport: boolean;
  readonly onExport: () => void;
}

export function ExportSplitSection({
  format,
  needsSplit,
  splitPieceCount,
  canExport,
  onExport,
}: ExportSplitSectionProps) {
  const t = useTranslation();
  const formatLabel = (format ?? 'stl').toUpperCase();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-content-tertiary">{t('binDesigner.inspector.export.format')}</span>
        <span className="font-medium text-content-secondary">{formatLabel}</span>
      </div>
      {needsSplit && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-content-tertiary">{t('binDesigner.inspector.export.pieces')}</span>
          <span className="font-medium tabular-nums text-content-secondary">{splitPieceCount}</span>
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={!canExport}
        onClick={onExport}
      >
        {t('binDesigner.inspector.export.action')}
      </Button>
    </div>
  );
}
