import type { MobilePanel } from '../../store/ui';

/**
 * Get the title for a mobile panel
 */
export function getPanelTitle(panel: MobilePanel, t: (key: string) => string): string {
  switch (panel) {
    case 'layers':
      return t('mobile.panels.layers');
    case 'inspector':
      return t('mobile.panels.inspector');
    case 'categories':
      return t('mobile.panels.categories');
    case 'print':
      return t('mobile.panels.print');
    case 'settings':
      return t('mobile.panels.settings');
    case 'layouts':
      return t('mobile.panels.layouts');
    default:
      return '';
  }
}
