import type { MobilePanel } from '@/core/store';

/**
 * Get the title for a mobile panel
 */
export function getPanelTitle(panel: MobilePanel): string {
  switch (panel) {
    case 'layers':
      return 'Layers & bins';
    case 'inspector':
      return 'Bin properties';
    case 'categories':
      return 'Categories';
    case 'print':
      return 'Bin list';
    case 'settings':
      return 'Settings';
    case 'layouts':
      return 'My Layouts';
    case 'participants':
      return 'Collaborators';
    default:
      return '';
  }
}
