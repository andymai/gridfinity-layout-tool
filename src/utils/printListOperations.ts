/**
 * Composable, pure functions for print list sorting, filtering, and grouping.
 */

import type { EnhancedPrintRow, PrintListGroup, PrintListSortKey, PrintListSortOrder, Category } from '../types';
import { DEFAULT_CATEGORY_COLOR } from '../constants';

/**
 * Apply category filter to print rows.
 * Returns rows that have at least one visible category.
 */
export function filterByCategory(
  rows: EnhancedPrintRow[],
  hiddenCategoryIds: Set<string>
): EnhancedPrintRow[] {
  if (hiddenCategoryIds.size === 0) return rows;
  return rows.filter(row =>
    !row.categoryIds.every(id => hiddenCategoryIds.has(id))
  );
}

/**
 * Sort print rows by specified key.
 */
export function sortRows(
  rows: EnhancedPrintRow[],
  sortKey: PrintListSortKey,
  sortOrder: PrintListSortOrder
): EnhancedPrintRow[] {
  if (sortKey === 'default') return rows;

  const sorted = [...rows].sort((a, b) => {
    let comparison = 0;
    switch (sortKey) {
      case 'area':
        comparison = a.area - b.area;
        break;
      case 'height':
        comparison = a.height - b.height;
        break;
      case 'filament':
        comparison = a.filament - b.filament;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  return sorted;
}

/**
 * Group print rows by their primary category.
 */
export function groupByCategory(
  rows: EnhancedPrintRow[],
  categories: Category[]
): PrintListGroup[] {
  const groups = new Map<string, EnhancedPrintRow[]>();

  for (const row of rows) {
    const catId = row.categoryIds[0] || 'uncategorized';
    const existing = groups.get(catId);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(catId, [row]);
    }
  }

  // Convert to array and calculate totals
  const result: PrintListGroup[] = [];

  for (const [catId, catRows] of groups) {
    const category = categories.find(c => c.id === catId);
    result.push({
      categoryId: catId,
      categoryName: category?.name || 'Uncategorized',
      categoryColor: category?.color || DEFAULT_CATEGORY_COLOR,
      rows: catRows,
      totalFilament: Math.round(catRows.reduce((sum, r) => sum + r.filament, 0) * 10) / 10,
      totalCost: Math.round(catRows.reduce((sum, r) => sum + r.costEstimate, 0) * 100) / 100,
      totalBins: catRows.reduce((sum, r) => sum + r.binCount, 0),
    });
  }

  // Sort groups by total bins (most bins first)
  result.sort((a, b) => b.totalBins - a.totalBins);

  return result;
}

/**
 * Compose all filter and sort operations.
 * Returns either a flat array of rows or grouped rows based on the groupByCategory flag.
 */
export function applyFiltersAndSort(
  rows: EnhancedPrintRow[],
  hiddenCategoryIds: Set<string>,
  sortKey: PrintListSortKey,
  sortOrder: PrintListSortOrder
): EnhancedPrintRow[] {
  let result = filterByCategory(rows, hiddenCategoryIds);
  result = sortRows(result, sortKey, sortOrder);
  return result;
}
