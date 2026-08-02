/**
 * Contract between the shell's DesignGalleryModal and the community feature's
 * gallery tab content. The shell owns all dialog chrome (backdrop, focus trap,
 * Escape, scroll lock, tab bar); the tab content renders inside the tab panel
 * with no chrome of its own and calls onRequestClose to dismiss the whole
 * modal (e.g. after a successful import into the designer).
 */
export interface CommunityGalleryTabProps {
  onRequestClose: () => void;
  /**
   * Opens the publish dialog for the visitor's active local design after the
   * empty-state CTA switches to the designer. Implemented by the shell (it
   * crosses into bin-designer); resolves false when no publishable design
   * exists, in which case the CTA has already fallen back to a plain switch.
   */
  onRequestPublish?: () => Promise<boolean>;
}
