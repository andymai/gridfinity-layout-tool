/**
 * Contract between the shell (which composes both features) and the community
 * detail view. The detail's designer-facing actions (remix, edit original)
 * are implemented shell-side against the bin-designer barrel and passed down
 * as props, so features/community never imports features/bin-designer.
 */
import type { CommunityDesign } from '@/shared/types/community';
import type { CommunityGallerySurface } from '@/shared/types/communityGalleryTab';

/**
 * `missing` = no local design carries this publishedId (cross-device or
 * deleted-locally); the detail falls back to "Duplicate as new" and says so.
 */
export type CommunityEditOriginalOutcome = 'opened' | 'missing' | 'error';

export interface CommunityDetailProps {
  /** Closes the whole gallery modal (used after switching to the designer). */
  onRequestCloseGallery: () => void;
  /**
   * Creates a local editable copy with lineage recorded; resolves false on
   * failure. `ownDuplicate` marks the owner's Duplicate-as-new path so the
   * designer suppresses the "Remixing ... by ..." banner for a self-copy.
   */
  onRemixDesign: (
    design: CommunityDesign,
    options?: { ownDuplicate?: boolean }
  ) => Promise<boolean>;
  /** Loads the owner's local original and opens the publish dialog in update mode. */
  onEditOriginal: (design: CommunityDesign) => Promise<CommunityEditOriginalOutcome>;
  /**
   * Host surface, used as the analytics `surface` property. On 'route' the
   * detail is addressable at /community/d/<id> and the host owns the
   * history/URL semantics, so the overlay's own history trap is disabled.
   * @default 'tab'
   */
  surface?: CommunityGallerySurface;
}
