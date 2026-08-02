/**
 * Mirrors ACTIVE_DESIGN_KEY in src/features/bin-designer/storage/DesignerStorage.ts
 * (the cross-feature import is forbidden). The key exists once the visitor has
 * ever worked on a design, which is all the empty-state CTA needs to decide
 * between "Publish a design" and "Design a bin".
 */
const DESIGNER_ACTIVE_DESIGN_KEY = 'gridfinity-designer-active-v1';

export function hasLocalDesigns(): boolean {
  try {
    return localStorage.getItem(DESIGNER_ACTIVE_DESIGN_KEY) !== null;
  } catch {
    return false;
  }
}
