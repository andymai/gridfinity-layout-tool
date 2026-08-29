import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { DesignerCategory } from '@/features/bin-designer/types';

export type PageCategory = Exclude<DesignerCategory, 'selection'>;

export interface CategoryDef {
  readonly id: PageCategory;
  readonly labelKey: string;
  readonly iconPaths: readonly string[];
}

/** Rail order. The contextual 'selection' slot renders above these. */
export const DESIGNER_CATEGORIES: readonly CategoryDef[] = [
  { id: 'shape', labelKey: 'binDesigner.category.shape', iconPaths: ICON_PATHS.cube },
  { id: 'interior', labelKey: 'binDesigner.category.interior', iconPaths: ICON_PATHS.dashboard },
  { id: 'features', labelKey: 'binDesigner.category.features', iconPaths: ICON_PATHS.bolt },
  { id: 'style', labelKey: 'binDesigner.category.style', iconPaths: ICON_PATHS.brush },
  { id: 'print', labelKey: 'binDesigner.category.print', iconPaths: ICON_PATHS.printer },
];
