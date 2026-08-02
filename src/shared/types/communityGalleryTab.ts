/**
 * Contract between the shell-composed hosts (the DesignGalleryModal's
 * Community tab and the full-page /community route) and the community
 * feature's gallery content. The host owns all surrounding chrome (dialog
 * backdrop/focus trap/tab bar, or the page header); the gallery renders with
 * no chrome of its own and calls onRequestClose to dismiss the host
 * (e.g. after a successful import into the designer).
 */

/** Which host surface is showing community content; used as the analytics `surface` property. */
export type CommunityGallerySurface = 'tab' | 'route';

export interface CommunityGalleryTabProps {
  onRequestClose: () => void;
  /**
   * Opens the publish dialog for the visitor's active local design after the
   * empty-state CTA switches to the designer. Implemented by the shell (it
   * crosses into bin-designer); resolves false when no publishable design
   * exists, in which case the CTA has already fallen back to a plain switch.
   */
  onRequestPublish?: () => Promise<boolean>;
  /** @default 'tab' */
  surface?: CommunityGallerySurface;
}
