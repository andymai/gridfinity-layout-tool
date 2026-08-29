/**
 * One table mapping designer controls to their rail category.
 *
 * Feeds the help-jump remap (a deep link opens the right category before the
 * dispatcher scrolls to the control) and, later, the command palette's
 * settings search. controlIds are the `data-help-target` markers set by
 * PanelSection and individual sections; keep entries in sync when a control
 * moves between categories.
 */

import type { DesignerCategory } from '@/features/bin-designer/types';

export interface DesignerSettingEntry {
  readonly controlId: string;
  readonly category: Exclude<DesignerCategory, 'selection'>;
}

export const DESIGNER_SETTINGS: readonly DesignerSettingEntry[] = [
  { controlId: 'bd-dimensions', category: 'shape' },
  { controlId: 'bd-overhang', category: 'shape' },
  { controlId: 'bd-shape', category: 'shape' },
  { controlId: 'bd-walls', category: 'shape' },
  { controlId: 'bd-base', category: 'shape' },
  { controlId: 'bd-interior', category: 'interior' },
  { controlId: 'bd-label-tabs', category: 'interior' },
  { controlId: 'bd-scoop', category: 'interior' },
  { controlId: 'bd-knife-rest', category: 'interior' },
  { controlId: 'bd-lid', category: 'features' },
  { controlId: 'bd-lid-grip', category: 'features' },
  { controlId: 'bd-type', category: 'style' },
  { controlId: 'bd-colors', category: 'style' },
  { controlId: 'bd-physical-units', category: 'print' },
];

export function categoryForControl(
  controlId: string
): Exclude<DesignerCategory, 'selection'> | undefined {
  return DESIGNER_SETTINGS.find((entry) => entry.controlId === controlId)?.category;
}
