import type { Layout, Bin, Layer, Category } from '@/core/types';
import type {
  InspirationLayout,
  InspirationTheme,
  LayoutComplexity,
  LayoutFeature,
} from '../types';
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
    id: genId(),
    x,
    y,
    width,
    depth,
    height: options.height ?? 3,
    layerId: options.layerId,
    category: options.categoryId,
    label: options.label ?? '',
    notes: options.notes ?? '',
    ...(options.clearanceHeight !== undefined && { clearanceHeight: options.clearanceHeight }),
  };
}

/**
 * Helper to create a layer.
 */
export function createLayer(name: string, height: number): Layer {
  return {
    id: genId(),
    name,
    height,
  };
}

/**
 * Helper to create a category.
 */
export function createCategory(name: string, color: string): Category {
  return {
    id: genId(),
    name,
    color,
  };
}

// Re-export canonical computePreview from storage
export { computePreview };

/**
 * Detect features from a layout.
 */
export function detectFeatures(layout: Layout): LayoutFeature[] {
  const features: LayoutFeature[] = [];

  if (layout.layers.length > 1) {
    features.push('multiple-layers');
  }

  const hasHalfBins = layout.bins.some(
    (b) => b.x % 1 !== 0 || b.y % 1 !== 0 || b.width % 1 !== 0 || b.depth % 1 !== 0
  );
  if (hasHalfBins) {
    features.push('half-bins');
  }

  const labeledCount = layout.bins.filter((b) => b.label.trim() !== '').length;
  if (labeledCount > 0) {
    features.push('labeled-bins');
  }

  const hasClearance = layout.bins.some((b) => b.clearanceHeight && b.clearanceHeight > 0);
  if (hasClearance) {
    features.push('clearance-height');
  }

  if (layout.categories.length > 2) {
    features.push('multiple-categories');
  }

  return features;
}

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
  complexity: LayoutComplexity;
  tags: string[];
}

/**
 * Build an InspirationLayout from a Layout and metadata.
 */
export function buildInspirationLayout(
  layout: Layout,
  options: BuilderOptions
): InspirationLayout {
  return {
    id: options.id,
    name: options.name,
    theme: options.theme,
    description: options.description,
    shortDescription: options.shortDescription,
    complexity: options.complexity,
    features: detectFeatures(layout),
    metrics: calculateMetrics(layout),
    preview: computePreview(layout),
    layout,
    tags: options.tags,
  };
}
