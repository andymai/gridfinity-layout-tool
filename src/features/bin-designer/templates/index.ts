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

/**
 * Returns templates that belong to the specified category.
 *
 * @param category - The template category to filter by
 * @returns A readonly array of templates whose category equals `category`
 */
export function getTemplatesByCategory(category: TemplateCategory): readonly InsertTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Retrieve the template matching the given id.
 *
 * @param id - The template's unique identifier
 * @returns The InsertTemplate with the matching id, or `undefined` if no template has that id
 */
export function getTemplateById(id: string): InsertTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Find templates whose name, description, or defaults.label contains the query string (case-insensitive).
 *
 * @param query - The substring to search for; if empty or only whitespace, all templates are returned.
 * @returns A readonly array of templates whose `name`, `description`, or `defaults.label` includes `query` (case-insensitive).
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