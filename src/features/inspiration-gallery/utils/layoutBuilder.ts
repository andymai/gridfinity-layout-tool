import type { Layout, Bin, Layer, Category } from '@/core/types';
import { binId, layerId, categoryId, gridUnits, heightUnits } from '@/core/types';
import type { InspirationLayout, InspirationTheme } from '../types';
import { computePreview } from '@/core/storage';

let idCounter = 0;
function genId(): string {
  return `insp-${++idCounter}`;
}

/**
 * Helper to create a bin with sensible defaults.
 */
export function createBin(
  x: number,
  y: number,
  width: number,
  depth: number,
  options: {
    layerId: string;
    categoryId: string;
    height?: number;
    label?: string;
    notes?: string;
    clearanceHeight?: number;
  }
): Bin {
  return {
    id: binId(genId()),
    x: gridUnits(x),
    y: gridUnits(y),
    width: gridUnits(width),
    depth: gridUnits(depth),
    height: heightUnits(options.height ?? 3),
    layerId: layerId(options.layerId),
    category: categoryId(options.categoryId),
    label: options.label ?? '',
    notes: options.notes ?? '',
    ...(options.clearanceHeight !== undefined && {
      clearanceHeight: heightUnits(options.clearanceHeight),
    }),
  };
}

/**
 * Helper to create a layer.
 */
export function createLayer(name: string, height: number): Layer {
  return {
    id: layerId(genId()),
    name,
    height: heightUnits(height),
  };
}

/**
 * Helper to create a category.
 */
export function createCategory(name: string, color: string): Category {
  return {
    id: categoryId(genId()),
    name,
    color,
  };
}

// Re-export canonical computePreview from storage
export { computePreview };

/**
 * Calculate metrics from a layout.
 */
export function calculateMetrics(layout: Layout): InspirationLayout['metrics'] {
  return {
    binCount: layout.bins.filter((b) => b.layerId !== '__staging__').length,
    layerCount: layout.layers.length,
    categoryCount: layout.categories.length,
    labeledBinCount: layout.bins.filter((b) => b.label.trim() !== '').length,
    drawerSize: {
      width: layout.drawer.width,
      depth: layout.drawer.depth,
      height: layout.drawer.height,
    },
  };
}

interface BuilderOptions {
  id: string;
  name: string;
  theme: InspirationTheme;
  description: string;
  shortDescription: string;
  tags: string[];
}

/**
 * Build an InspirationLayout from a Layout and metadata.
 */
export function buildInspirationLayout(layout: Layout, options: BuilderOptions): InspirationLayout {
  return {
    id: options.id,
    name: options.name,
    theme: options.theme,
    description: options.description,
    shortDescription: options.shortDescription,
    metrics: calculateMetrics(layout),
    preview: computePreview(layout),
    layout,
    tags: options.tags,
  };
}
