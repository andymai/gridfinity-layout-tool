import type { ComponentType } from 'react';

/**
 * The drawer-shape editor the shell hands the panel, because one feature cannot
 * import another. It edits the layout's drawer, so it takes a reason to stay
 * disabled while the plate does not follow that drawer.
 */
export type ShapeEditorSlot = ComponentType<{ disabledReason?: string }>;
