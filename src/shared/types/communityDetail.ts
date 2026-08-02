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

/**
 * `no-fit` = the design fits in neither orientation at the gap target (or
 * its grid/height unit scales differ from the layout's); no mutation was
 * attempted and the gallery should stay open. `error-copy-saved` = placement
 * failed after the local remix copy was already saved and registered, so the
 * failure message must mention the copy now in the library.
 */
export type CommunityPlaceOutcome = 'placed' | 'no-fit' | 'error' | 'error-copy-saved';

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
   * Fits-gap flow only (wired by the gallery modal host): saves a local copy,
   * registers it as a custom bin, and places it at the gap recorded in the
   * core gapFit store, trying the swapped orientation before giving up. The
   * detail shows "Place in layout" only when this prop is present AND a gap
   * constraint is active.
   */
  onPlaceInLayout?: (design: CommunityDesign) => Promise<CommunityPlaceOutcome>;
  /**
   * Host surface, used as the analytics `surface` property. On 'route' the
   * detail is addressable at /community/d/<id> and the host owns the
   * history/URL semantics, so the overlay's own history trap is disabled.
   * @default 'tab'
   */
  surface?: CommunityGallerySurface;
}
