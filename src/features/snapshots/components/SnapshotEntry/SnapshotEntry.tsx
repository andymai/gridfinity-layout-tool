import { useState, useRef, useEffect } from 'react';
import { LayoutThumbnail } from '@/components/LayoutThumbnail';
import { useRelativeTime } from '../../hooks/useRelativeTime';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(snapshot.label ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleLabelSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== snapshot.label) {
      onUpdateLabel(snapshot.id, trimmed);
    }
    setIsEditing(false);
  };

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
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleLabelSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelSubmit();
              if (e.key === 'Escape') {
                setEditValue(snapshot.label ?? '');
                setIsEditing(false);
              }
            }}
            className="w-full text-xs font-medium bg-surface border border-stroke rounded px-1.5 py-0.5"
            placeholder={t('snapshots.labelPlaceholder')}
            aria-label={t('snapshots.editLabel')}
          />
        ) : (
          <button
            onClick={() => {
              setEditValue(snapshot.label ?? '');
              setIsEditing(true);
            }}
            className="text-xs font-medium text-content truncate block max-w-full bg-transparent text-left"
            title={t('snapshots.editLabel')}
          >
            {snapshot.label ?? t('snapshots.autoSaved')}
          </button>
        )}

        <div className="text-[11px] text-content-tertiary mt-0.5">
          <span>{relativeTime}</span>
          <span className="mx-1">&middot;</span>
          <span>{t('snapshots.bins', { count: snapshot.preview.binCount })}</span>
          <span className="mx-1">&middot;</span>
          <span>{t('snapshots.layers', { count: snapshot.preview.layerCount })}</span>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => onRestore(snapshot.id)}
          className="text-xs px-2 py-1 rounded bg-transparent text-accent hover:bg-accent-muted transition-colors"
          aria-label={t('snapshots.restore')}
        >
          {t('snapshots.restore')}
        </button>
        <button
          onClick={() => onDelete(snapshot.id)}
          className="p-1 rounded bg-transparent text-content-tertiary hover:text-[var(--color-error)] hover:bg-surface-hover transition-colors"
          aria-label={t('snapshots.deleteSnapshot')}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {ICON_PATHS.trash.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
        </button>
      </div>
    </div>
  );
}
