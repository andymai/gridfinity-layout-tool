import type { Layout, LayoutPreview } from '@/core/types';

/**
 * Theme categories for inspiration layouts.
 * Based on telemetry data showing common drawer purposes.
 */
export type InspirationTheme = 'kitchen' | 'workshop' | 'office' | 'hobby' | 'personal';

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
export const THEME_CONFIG: Record<InspirationTheme, { label: string }> = {
  kitchen: { label: 'Kitchen' },
  workshop: { label: 'Workshop' },
  office: { label: 'Office' },
  hobby: { label: 'Hobby' },
  personal: { label: 'Personal' },
};
