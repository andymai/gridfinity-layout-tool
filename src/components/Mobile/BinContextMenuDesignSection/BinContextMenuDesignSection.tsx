import { ContextMenuItem, ContextMenuDivider } from '@/shared/components/ContextMenu';
import { useLinkedDesign, useBinLinking, useLinkingStore } from '@/features/design-linking';
import { useTranslation } from '@/i18n';
import type { Bin } from '@/core/types';

interface BinContextMenuDesignSectionProps {
  bin: Bin;
  onClose: () => void;
}

/**
 * Design linking section for the bin context menu.
 * Extracted to enable lazy loading of the design-linking feature.
 */
export function BinContextMenuDesignSection({ bin, onClose }: BinContextMenuDesignSectionProps) {
  const t = useTranslation();

  // Design linking hooks
  const { linkedDesign, hasLink } = useLinkedDesign(bin.linkedDesignId);
  const { editLinkedDesign, showCreateDesignDialog, unlinkBin } = useBinLinking();
  const showLinkDesignDialog = useLinkingStore((state) => state.showLinkDesignDialog);

  const handleEditDesign = () => {
    if (linkedDesign) {
      editLinkedDesign(linkedDesign.id);
    }
    onClose();
  };

  const handleCreateDesign = () => {
    showCreateDesignDialog(bin.id);
    onClose();
  };

  const handleUnlinkDesign = () => {
    unlinkBin(bin.id);
    onClose();
  };

  const handleLinkExisting = () => {
    showLinkDesignDialog(bin.id, bin.width, bin.depth, bin.height);
    onClose();
  };

  return (
    <>
      {/* Section heading with experimental badge */}
      <div className="px-4 py-1.5 flex items-center gap-2">
        <span className="text-xs font-medium text-content-secondary">
          {t('designLinking.menu.sectionTitle')}
        </span>
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
          {t('designLinking.experimental')}
        </span>
      </div>
      {hasLink && linkedDesign ? (
        // Valid link - show edit and unlink options
        <>
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            }
            label={t('designLinking.menu.editDesign')}
            onClick={handleEditDesign}
          />
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
              </svg>
            }
            label={t('designLinking.menu.unlinkDesign')}
            onClick={handleUnlinkDesign}
          />
        </>
      ) : hasLink ? (
        // Stale link - design was deleted, offer to remove the broken link
        <>
          <div className="px-4 py-2 text-xs text-content-disabled">
            {t('designLinking.menu.designDeleted')}
          </div>
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
              </svg>
            }
            label={t('designLinking.menu.unlinkStale')}
            onClick={handleUnlinkDesign}
          />
        </>
      ) : (
        // No link - offer to create or link a design
        <>
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            }
            label={t('designLinking.menu.createDesign')}
            onClick={handleCreateDesign}
          />
          <ContextMenuItem
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            }
            label={t('designLinking.menu.linkExisting')}
            onClick={handleLinkExisting}
          />
        </>
      )}
      <ContextMenuDivider />
    </>
  );
}
