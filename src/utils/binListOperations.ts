/**
 * Pure utility functions for the expanded bin list feature.
 * Handles search filtering, selection logic, export formats, and category breakdown.
 */

import type { EnhancedPrintRow, Category, Layout } from '@/core/types';

// === Types ===

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  filament: number;
  cost: number;
  binCount: number;
  /** Percentage of total filament usage (0-100) */
  percentage: number;
}

export interface BinListExportData {
  size: string;
  height: string;
  bins: number;
  pieces: number;
  filament: number;
  label: string;
  notes: string;
  categories: string[];
  customProperties?: Record<string, string>;
}

// === Search Filtering ===

/**
 * Filter rows by search query matching labels or notes.
 * Case-insensitive substring matching.
 */
export function filterBySearch(
  rows: EnhancedPrintRow[],
  query: string
): EnhancedPrintRow[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return rows;

  return rows.filter(row => {
    // Check labels
    const labelMatch = row.labels.some(label =>
      label.toLowerCase().includes(trimmed)
    );
    if (labelMatch) return true;

    // Check notes
    if (row.notes && row.notes.toLowerCase().includes(trimmed)) {
      return true;
    }

    return false;
  });
}

// === Selection Logic ===

/**
 * Calculate selection range for shift-click.
 * Returns new set including all indices between lastClicked and current.
 */
export function calculateSelectionRange(
  currentSelection: Set<number>,
  clickedIndex: number,
  lastClickedIndex: number | null
): Set<number> {
  if (lastClickedIndex === null) {
    // No previous selection, just add this one
    const next = new Set(currentSelection);
    next.add(clickedIndex);
    return next;
  }

  const start = Math.min(lastClickedIndex, clickedIndex);
  const end = Math.max(lastClickedIndex, clickedIndex);

  const next = new Set(currentSelection);
  for (let i = start; i <= end; i++) {
    next.add(i);
  }
  return next;
}

/**
 * Toggle a single index in the selection.
 */
export function toggleSelection(
  currentSelection: Set<number>,
  index: number
): Set<number> {
  const next = new Set(currentSelection);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
  }
  return next;
}

/**
 * Get all bin IDs from selected row indices.
 */
export function getSelectedBinIds(
  rows: EnhancedPrintRow[],
  selectedIndices: Set<number>
): string[] {
  const binIds: string[] = [];
  for (const index of selectedIndices) {
    const row = rows[index];
    if (row) {
      binIds.push(...row.binIds);
    }
  }
  return binIds;
}

// === Export Formats ===

/**
 * Escape a value for CSV format.
 * Handles quotes, commas, newlines, and potential formula injection.
 */
function escapeCSVValue(value: string): string {
  // Prevent formula injection (Excel/Sheets)
  const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
  let escaped = value;
  if (formulaChars.some(char => escaped.startsWith(char))) {
    escaped = `'${escaped}`;
  }

  // Escape double quotes by doubling them
  escaped = escaped.replace(/"/g, '""');

  // Wrap in quotes if contains comma, quote, or newline
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
    escaped = `"${escaped}"`;
  }

  return escaped;
}

/**
 * Metadata for CSV export including layout context.
 */
export interface CSVExportMeta {
  layoutName?: string;
  gridSize?: string;
}

/**
 * Format rows as CSV with proper escaping.
 * Compatible with Excel, Google Sheets, etc.
 * Dynamically adds columns for custom properties that exist in any row.
 * Optionally includes layout name and grid size columns for context.
 */
export function formatAsCSV(rows: EnhancedPrintRow[], meta?: CSVExportMeta): string {
  // Collect all unique custom property keys across all rows
  const customKeys = new Set<string>();
  for (const row of rows) {
    if (row.customProperties) {
      for (const key of Object.keys(row.customProperties)) {
        customKeys.add(key);
      }
    }
  }
  const sortedKeys = Array.from(customKeys).sort();

  // Build header with optional metadata and dynamic custom property columns
  const metaHeader = meta ? 'Layout,Grid Size,' : '';
  const baseHeader = `${metaHeader}Size,Height,Bins,Pieces,Filament (m),Label,Notes`;
  const header = sortedKeys.length > 0
    ? `${baseHeader},${sortedKeys.join(',')}`
    : baseHeader;

  // Pre-compute metadata values if provided (with CSV escaping)
  const layoutName = meta ? escapeCSVValue(meta.layoutName || '') : '';
  const gridSize = meta ? escapeCSVValue(meta.gridSize || '') : '';

  // Build data rows
  const lines = rows.map(row => {
    const label = escapeCSVValue((row.labels ?? [])[0] || '');
    const notes = escapeCSVValue(row.notes || '');
    const metaValues = meta ? `${layoutName},${gridSize},` : '';
    const baseLine = `${metaValues}${row.size},${row.height}u,${row.binCount},${row.totalPieces},${row.filament},${label},${notes}`;

    if (sortedKeys.length === 0) {
      return baseLine;
    }

    // Add custom property values in order (with CSV escaping)
    const customValues = sortedKeys.map(key =>
      escapeCSVValue(row.customProperties?.[key] || '')
    );
    return `${baseLine},${customValues.join(',')}`;
  });

  return [header, ...lines].join('\n');
}

/**
 * Format rows as JSON for programmatic use.
 * Includes layout metadata for context.
 */
export function formatAsJSON(
  rows: EnhancedPrintRow[],
  layout: Layout
): string {
  const data: BinListExportData[] = rows.map(row => {
    const item: BinListExportData = {
      size: row.size,
      height: `${row.height}u`,
      bins: row.binCount,
      pieces: row.totalPieces,
      filament: row.filament,
      label: (row.labels ?? [])[0] || '',
      notes: row.notes || '',
      categories: (row.categoryIds ?? []).map(id => {
        const cat = layout.categories.find(c => c.id === id);
        return cat?.name || 'Unknown';
      }),
    };
    // Include custom properties if present
    if (row.customProperties && Object.keys(row.customProperties).length > 0) {
      item.customProperties = row.customProperties;
    }
    return item;
  });

  const exportObj = {
    _meta: {
      exportedFrom: 'Gridfinity Layout Tool',
      exportedAt: new Date().toISOString(),
      layoutName: layout.name,
      drawerSize: `${layout.drawer.width}×${layout.drawer.depth}`,
    },
    bins: data,
  };

  return JSON.stringify(exportObj, null, 2);
}

/**
 * Trigger a file download in the browser.
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// === Category Breakdown ===

/**
 * Calculate category breakdown for visualization.
 * Returns sorted by filament usage (highest first).
 */
export function calculateCategoryBreakdown(
  rows: EnhancedPrintRow[],
  categories: Category[]
): CategoryBreakdown[] {
  // Aggregate by primary category
  const breakdown = new Map<string, { filament: number; cost: number; binCount: number }>();

  for (const row of rows) {
    const catId = row.categoryIds[0] || 'uncategorized';
    const existing = breakdown.get(catId) || { filament: 0, cost: 0, binCount: 0 };
    existing.filament += row.filament;
    existing.cost += row.costEstimate;
    existing.binCount += row.binCount;
    breakdown.set(catId, existing);
  }

  // Calculate total for percentages
  const totalFilament = Array.from(breakdown.values()).reduce(
    (sum, v) => sum + v.filament,
    0
  );

  // Convert to array with category info
  const result: CategoryBreakdown[] = [];
  for (const [catId, data] of breakdown) {
    const category = categories.find(c => c.id === catId);
    result.push({
      categoryId: catId,
      categoryName: category?.name || 'Uncategorized',
      categoryColor: category?.color || '#6B7280',
      filament: Math.round(data.filament * 10) / 10,
      cost: Math.round(data.cost * 100) / 100,
      binCount: data.binCount,
      percentage: totalFilament > 0
        ? Math.round((data.filament / totalFilament) * 1000) / 10
        : 0,
    });
  }

  // Sort by filament usage descending
  result.sort((a, b) => b.filament - a.filament);

  return result;
}
