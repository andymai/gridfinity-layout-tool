/** Persist the last active designer category across sessions (best-effort). */

import type { DesignerCategory } from '@/features/bin-designer/types';

const CATEGORY_KEY = 'gridfinity-designer-category-v1';

const PAGE_CATEGORIES = ['shape', 'interior', 'features', 'style', 'print'] as const;

export function loadLastCategory(): Exclude<DesignerCategory, 'selection'> | null {
  try {
    const stored = localStorage.getItem(CATEGORY_KEY);
    const match = PAGE_CATEGORIES.find((c) => c === stored);
    return match ?? null;
  } catch {
    return null;
  }
}

export function saveLastCategory(category: DesignerCategory): void {
  if (category === 'selection') return;
  try {
    localStorage.setItem(CATEGORY_KEY, category);
  } catch {
    // best-effort
  }
}
