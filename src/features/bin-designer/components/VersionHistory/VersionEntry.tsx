import { useEffect, useRef, useState } from 'react';
import { Button, Badge } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useRelativeTime } from '@/shared/hooks/useRelativeTime';
import type { DesignVersionSummary } from '@/features/bin-designer/types';

export interface VersionEntryProps {
  readonly version: DesignVersionSummary;
  readonly onRestore: (version: DesignVersionSummary) => void;
  readonly onRename: (version: DesignVersionSummary, name: string) => void;
  readonly onTogglePin: (version: DesignVersionSummary) => void;
  readonly onDelete: (version: DesignVersionSummary) => void;
  /** Disables every action while a restore is in flight. */
  readonly busy?: boolean;
}

/**
 * One row of the version list.
 *
 * Restore confirms inline rather than in a nested dialog: the confirmation is
 * about the row you clicked, and a second modal over the version list hides the
 * list you are choosing from.
 */
export function VersionEntry({
  version,
  onRestore,
  onRename,
  onTogglePin,
  onDelete,
  busy = false,
}: VersionEntryProps) {
  const t = useTranslation();
  const relative = useRelativeTime(Date.parse(version.createdAt));
  const [confirming, setConfirming] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName !== null) renameRef.current?.select();
  }, [editingName]);

  const commitRename = () => {
    const next = editingName?.trim();
    if (next && next !== version.name) onRename(version, next);
    setEditingName(null);
  };

  return (
    <li className="flex flex-col gap-2 border-b border-stroke-subtle px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        {version.thumbnail ? (
          <img
            src={version.thumbnail}
            alt=""
            className="h-10 w-12 flex-shrink-0 rounded-sm border border-stroke-subtle object-cover"
          />
        ) : (
          <div className="h-10 w-12 flex-shrink-0 rounded-sm border border-stroke-subtle bg-surface-elevated" />
        )}

        <div className="min-w-0 flex-1">
          {editingName === null ? (
            <p className="truncate text-sm font-medium text-content">{version.name}</p>
          ) : (
            <input
              ref={renameRef}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingName(null);
              }}
              aria-label={t('binDesigner.versions.rename')}
              className="w-full rounded-sm border border-stroke bg-surface px-1.5 py-0.5 text-sm text-content"
            />
          )}
          <p className="flex items-center gap-1.5 text-xs text-content-tertiary">
            {version.pinned && <Badge size="sm">{t('binDesigner.versions.pinned')}</Badge>}
            {version.origin === 'pre-restore' && <span>{t('binDesigner.versions.automatic')}</span>}
            <span>{relative}</span>
          </p>
        </div>

        {!confirming && (
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setEditingName(version.name)}
            >
              {t('binDesigner.versions.rename')}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onTogglePin(version)}>
              {version.pinned ? t('binDesigner.versions.unpin') : t('binDesigner.versions.pin')}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDelete(version)}>
              {t('binDesigner.versions.delete')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              {t('binDesigner.versions.restore')}
            </Button>
          </div>
        )}
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-surface-elevated px-3 py-2">
          <p className="text-xs text-content-secondary">
            {t('binDesigner.versions.restoreWarning')}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {t('binDesigner.versions.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                onRestore(version);
              }}
            >
              {t('binDesigner.versions.restore')}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
