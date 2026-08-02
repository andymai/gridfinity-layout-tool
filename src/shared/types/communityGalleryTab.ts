/**
 * Contract between the shell-composed hosts (the DesignGalleryModal's
 * Community tab and the full-page /community route) and the community
 * feature's gallery content. The host owns all surrounding chrome (dialog
 * backdrop/focus trap/tab bar, or the page header); the gallery renders with
 * no chrome of its own and calls onRequestClose to dismiss the host
 * (e.g. after a successful import into the designer).
 */

import type { CommunityEditOriginalOutcome } from '@/shared/types/communityDetail';

/**
 * Which host surface is showing community content; used as the analytics
 * `surface` property. 'fits_gap' is the gallery tab opened by the layout
 * editor's "find bins that fit" flow.
 */
export type CommunityGallerySurface = 'tab' | 'route' | 'fits_gap';

export interface CommunityGalleryTabProps {
  onRequestClose: () => void;
  /**
   * Opens the publish dialog for the visitor's active local design after the
   * empty-state CTA switches to the designer. Implemented by the shell (it
   * crosses into bin-designer); resolves false when no publishable design
   * exists, in which case the CTA has already fallen back to a plain switch.
   */
  onRequestPublish?: () => Promise<boolean>;
  /**
   * Mine-card Edit action: loads the owner's local original for this
   * published id and opens the publish dialog in update mode. Implemented by
   * the shell (it crosses into bin-designer); only the id is needed, unlike
   * the detail view's full-record onEditOriginal.
   */
  onEditOwnDesign?: (design: { id: string }) => Promise<CommunityEditOriginalOutcome>;
  /**
   * Best-effort local cleanup after a Mine-card unpublish: clears the local
   * design's dangling publishedId pointer. Implemented by the shell.
   */
  onOwnDesignUnpublished?: (publishedId: string) => Promise<void>;
  /** @default 'tab' */
  surface?: CommunityGallerySurface;
}
