import { useRef } from 'react';
import { Button, Select } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { SharePermission } from '@/core/types';

interface ShareLinkSectionProps {
  shareUrl: string;
  urlCopied: boolean;
  onCopyUrl: () => void;
  /**
   * When true, the permission control renders as read-only text (the user
   * is viewing someone else's share and can't change its permission).
   */
  readOnlyPermission: boolean;
  permission: SharePermission;
  onPermissionChange: (next: SharePermission) => void;
}

/**
 * Shared-state body of the share popover: the link input, copy button, and
 * permission control. Used in both 'idle/success' (own share) and
 * 'deleting' phases — the parent decides when to render this section.
 */
export function ShareLinkSection({
  shareUrl,
  urlCopied,
  onCopyUrl,
  readOnlyPermission,
  permission,
  onPermissionChange,
}: ShareLinkSectionProps) {
  const t = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={shareUrl}
          readOnly
          onClick={() => inputRef.current?.select()}
          className="flex-1 bg-surface text-content text-xs px-3 py-2 rounded border border-stroke focus:outline-none font-mono truncate"
        />
        <Button
          variant={urlCopied ? 'secondary' : 'primary'}
          onClick={onCopyUrl}
          className={`px-3 text-sm whitespace-nowrap ${urlCopied ? 'text-success' : ''}`}
        >
          {urlCopied ? (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('common.copied')}
            </span>
          ) : (
            t('common.copy')
          )}
        </Button>
      </div>

      {readOnlyPermission ? (
        <div className="text-sm text-content-secondary">
          {t('share.anyoneWithLinkCan')}
          {permission}
        </div>
      ) : (
        <Select
          fullWidth
          value={permission}
          onValueChange={(v) => {
            onPermissionChange(v as SharePermission);
          }}
          options={[
            { id: 'view', name: t('share.anyoneWithLinkCanView') },
            { id: 'edit', name: t('share.anyoneWithLinkCanEdit') },
          ]}
          aria-label={t('share.anyoneWithLinkCan')}
          className="text-sm"
        />
      )}
    </>
  );
}
