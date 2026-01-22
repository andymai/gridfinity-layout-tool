import type { Layout, LayoutPreview } from '@/core/types';

/**
 * Theme categories for inspiration layouts.
 * Based on telemetry data showing common drawer purposes.
 */
export type InspirationTheme = 'kitchen' | 'workshop' | 'office' | 'hobby' | 'personal';

/**
 * Features that a layout can showcase.
 * Used to indicate complexity and highlight advanced features.
 */
export type LayoutFeature =
  | 'multiple-layers'
  | 'half-bins'
  | 'labeled-bins'
  | 'clearance-height'
  | 'multiple-categories';

/**
 * Complexity level for progressive discovery.
 * Beginners see simple layouts first, advanced users can explore complex ones.
 */
export type LayoutComplexity = 'beginner' | 'intermediate' | 'advanced';

/**
 * An inspiration layout with metadata for the gallery.
 */
export interface InspirationLayout {
  /** Unique identifier (e.g., 'kitchen-utensils') */
  id: string;
  /** Display name */
  name: string;
  /** Theme category */
  theme: InspirationTheme;
  /** Full description (shown in preview) */
  description: string;
  /** Short description for card (max 80 chars) */
  shortDescription: string;
  /** Complexity level */
  complexity: LayoutComplexity;
  /** Features showcased */
  features: LayoutFeature[];
  /** Pre-calculated metrics for display */
  metrics: {
    binCount: number;
    layerCount: number;
    categoryCount: number;
    labeledBinCount: number;
    drawerSize: { width: number; depth: number; height: number };
  };
  /** Pre-computed preview for thumbnail */
  preview: LayoutPreview;
  /** The actual layout data */
  layout: Layout;
  /** Search tags */
  tags: string[];
}

/**
 * Theme metadata for display.
 */
export const THEME_CONFIG: Record<
  InspirationTheme,
  { label: string; icon: string; description: string }
> = {
  kitchen: {
    label: 'Kitchen',
    icon: 'utensils',
    description: 'Organize cooking tools, utensils, and drawer essentials',
  },
  workshop: {
    label: 'Workshop',
    icon: 'wrench',
    description: 'Tools, fasteners, and maker supplies',
  },
  office: {
    label: 'Office',
    icon: 'briefcase',
    description: 'Desk supplies, stationery, and organization',
  },
  hobby: {
    label: 'Hobby',
    icon: 'palette',
    description: 'Craft supplies, 3D printing, and creative projects',
  },
  personal: {
    label: 'Personal',
    icon: 'sparkles',
    description: 'Bathroom, bedroom, and personal care organization',
  },
};

/**
 * Feature metadata for badges.
 */
export const FEATURE_CONFIG: Record<LayoutFeature, { label: string; description: string }> = {
  'multiple-layers': {
    label: 'Multi-layer',
    description: 'Uses multiple vertical layers for stacking',
  },
  'half-bins': {
    label: 'Half-bins',
    description: 'Uses 0.5 unit increments for fine divisions',
  },
  'labeled-bins': {
    label: 'Labeled',
    description: 'Bins have descriptive labels',
  },
  'clearance-height': {
    label: 'Clearance',
    description: 'Some bins have clearance height for tall items',
  },
  'multiple-categories': {
    label: 'Categories',
    description: 'Uses multiple color categories for organization',
  },
};
