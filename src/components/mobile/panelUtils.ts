import type { MobilePanel } from '../../store/ui';

/**
 * Get the title for a mobile panel
 */
export function getPanelTitle(panel: MobilePanel): string {
  switch (panel) {
    case 'layers':
      return 'Layers & Bins';
    case 'inspector':
      return 'Bin Properties';
    case 'categories':
      return 'Categories';
    case 'print':
      return 'Bin List';
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
