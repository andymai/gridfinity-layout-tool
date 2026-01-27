/**
 * Linked Design Section - Shows linked design info in the bin inspector.
 *
 * Displays:
 * - Linked: Thumbnail, name, Edit Design button, Unlink button
 * - Unlinked: Create Design button
 * - Stale (design deleted): Warning + Unlink button
 */

import { useLinkedDesign, useBinLinking } from '../hooks';
import { useTranslation } from '@/i18n';
import type { Bin } from '@/core/types';

interface LinkedDesignSectionProps {
  bin: Bin;
  variant: 'desktop' | 'mobile';
}

export function LinkedDesignSection({ bin, variant }: LinkedDesignSectionProps) {
  const t = useTranslation();
  const { linkedDesign, isStale, hasLink } = useLinkedDesign(bin.linkedDesignId);
  const { editLinkedDesign, showCreateDesignDialog, unlinkBin } = useBinLinking();

  const isMobile = variant === 'mobile';
  const buttonHeight = isMobile ? 'h-10' : 'h-8';
  const textSize = isMobile ? 'text-sm' : 'text-xs';

  // No link - show Create Design button
  if (!hasLink) {
    return (
      <div className="space-y-2">
        <label className={`block ${textSize} text-content-tertiary`}>
          {t('designLinking.inspector.linkedDesign')}
        </label>
        <button
          onClick={() => showCreateDesignDialog(bin.id)}
          className={`btn btn-secondary w-full ${buttonHeight} flex items-center justify-center gap-2`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          {t('designLinking.inspector.createDesign')}
        </button>
      </div>
    );
  }

  // Stale link (design was deleted)
  if (isStale) {
    return (
      <div className="space-y-2">
        <label className={`block ${textSize} text-content-tertiary`}>
          {t('designLinking.inspector.linkedDesign')}
        </label>
        <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/30">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className="w-4 h-4 text-status-warning flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm text-status-warning font-medium">
              {t('designLinking.inspector.designDeleted')}
            </span>
          </div>
          <button
            onClick={() => unlinkBin(bin.id)}
            className={`btn btn-secondary w-full ${buttonHeight} text-sm`}
          >
            {t('designLinking.inspector.unlink')}
          </button>
        </div>
      </div>
    );
  }

  // Linked to existing design
  if (!linkedDesign) return null;

  return (
    <div className="space-y-2">
      <label className={`block ${textSize} text-content-tertiary`}>
        {t('designLinking.inspector.linkedDesign')}
      </label>

      <div className="p-3 rounded-lg bg-surface border border-stroke-subtle">
        {/* Design preview */}
        <div className="flex gap-3 mb-3">
          {/* Thumbnail */}
          {linkedDesign.thumbnail ? (
            <div className="w-14 h-14 rounded-md overflow-hidden bg-surface-elevated flex-shrink-0">
              <img
                src={linkedDesign.thumbnail}
                alt={linkedDesign.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-md bg-surface-elevated flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-content-disabled"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          )}

          {/* Name and dimensions */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-content truncate">{linkedDesign.name}</div>
            <div className="text-xs text-content-tertiary mt-0.5">
              {linkedDesign.width}×{linkedDesign.depth}×{linkedDesign.height}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => editLinkedDesign(linkedDesign.id)}
            className={`btn btn-primary flex-1 ${buttonHeight} text-sm`}
          >
            {t('designLinking.inspector.editDesign')}
          </button>
          <button
            onClick={() => unlinkBin(bin.id)}
            className={`btn btn-secondary ${buttonHeight} text-sm px-3`}
            title={t('designLinking.inspector.unlink')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
