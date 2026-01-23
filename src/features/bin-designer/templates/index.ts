/**
 * Insert template library for the Bin Designer.
 *
 * All templates are grouped by category and exported as a flat list.
 * Categories: electronics, hardware, tools.
 */

import type { InsertTemplate, TemplateCategory } from '../types';
import { ELECTRONICS_TEMPLATES } from './electronics';
import { HARDWARE_TEMPLATES } from './hardware';
import { TOOLS_TEMPLATES } from './tools';

/** All available insert templates */
export const ALL_TEMPLATES: readonly InsertTemplate[] = [
  ...ELECTRONICS_TEMPLATES,
  ...HARDWARE_TEMPLATES,
  ...TOOLS_TEMPLATES,
] as const;

/** Get templates filtered by category */
export function getTemplatesByCategory(category: TemplateCategory): readonly InsertTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

/** Get a single template by ID */
export function getTemplateById(id: string): InsertTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Search templates by name or description (case-insensitive).
 * Returns all matches across all categories.
 */
export function searchTemplates(query: string): readonly InsertTemplate[] {
  if (!query.trim()) return ALL_TEMPLATES;
  const lower = query.toLowerCase();
  return ALL_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower) ||
      t.defaults.label.toLowerCase().includes(lower)
  );
}

/** Available categories (only those with at least one template) */
export const AVAILABLE_CATEGORIES: readonly TemplateCategory[] = [
  ...new Set(ALL_TEMPLATES.map((t) => t.category)),
] as unknown as readonly TemplateCategory[];

export { ELECTRONICS_TEMPLATES } from './electronics';
export { HARDWARE_TEMPLATES } from './hardware';
export { TOOLS_TEMPLATES } from './tools';
