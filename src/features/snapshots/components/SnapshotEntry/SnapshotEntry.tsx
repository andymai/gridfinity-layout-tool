import { Button, IconButton, InlineEditText } from '@/design-system';
import { LayoutThumbnail } from '@/shell/LayoutThumbnail';
import { useRelativeTime } from '@/shared/hooks/useRelativeTime';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { Snapshot } from '@/core/types';

interface SnapshotEntryProps {
  snapshot: Snapshot;
  isLast: boolean;
  onRestore: (snapshotId: string) => void;
  onDelete: (snapshotId: string) => void;
  onUpdateLabel: (snapshotId: string, label: string) => void;
}

export function SnapshotEntry({
  snapshot,
  isLast,
  onRestore,
  onDelete,
  onUpdateLabel,
}: SnapshotEntryProps) {
  const t = useTranslation();
  const relativeTime = useRelativeTime(snapshot.timestamp);
  return (
    <div
      className="flex items-start gap-3 pl-2 pr-4 py-3 hover:bg-surface-hover transition-colors group"
      data-testid="snapshot-entry"
    >
      <div className="flex flex-col items-center flex-shrink-0 w-4 pt-1" aria-hidden="true">
        <div className="w-2.5 h-2.5 rounded-full bg-accent-muted border-2 border-accent flex-shrink-0" />
        {!isLast && <div className="w-px flex-1 bg-stroke-subtle mt-1" />}
      </div>

      <div className="flex-shrink-0">
        <LayoutThumbnail preview={snapshot.preview} size={48} />
      </div>

      <div className="flex-1 min-w-0">
        <InlineEditText
          value={snapshot.label ?? ''}
          // An unlabelled snapshot reads "Auto-saved" but must edit as empty,
          // so the display string and the editable value differ here.
          displayValue={snapshot.label ?? t('snapshots.autoSaved')}
          onCommit={(label) => onUpdateLabel(snapshot.id, label)}
          placeholder={t('snapshots.labelPlaceholder')}
          aria-label={t('snapshots.editLabel')}
          displayClassName="!px-0 h-auto max-w-full text-xs font-medium text-content hover:bg-transparent"
          inputClassName="w-full text-xs font-medium"
        />

        <div className="text-label text-content-tertiary mt-0.5">
          <span>{relativeTime}</span>
          <span className="mx-1">&middot;</span>
          <span>{t('snapshots.bins', { count: snapshot.preview.binCount })}</span>
          <span className="mx-1">&middot;</span>
          <span>{t('snapshots.layers', { count: snapshot.preview.layerCount })}</span>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRestore(snapshot.id)}
          className="text-xs font-normal px-2 py-1 rounded text-accent hover:bg-accent-muted hover:text-accent h-auto"
          aria-label={t('snapshots.restore')}
        >
          {t('snapshots.restore')}
        </Button>
        <IconButton
          type="button"
          variant="dangerGhost"
          size="sm"
          touchTarget={false}
          onClick={() => onDelete(snapshot.id)}
          className="text-content-tertiary"
          aria-label={t('snapshots.deleteSnapshot')}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {ICON_PATHS.trash.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
        </IconButton>
      </div>
    </div>
  );
}
