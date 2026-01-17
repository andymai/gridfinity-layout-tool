# Analytics Architecture Design

## Context

**Goal**: Comprehensive feature usage tracking derived from existing Layout data model.

**Current state**: Basic Vercel Analytics (page views) + Speed Insights.

**Constraint discovered**: Vercel Analytics Pro plan allows only 2 custom properties per event (8 with $50/mo addon). Values capped at 255 chars each.

---

## Approach: Derived Metrics from Layout JSON

Instead of tracking individual events throughout the codebase, compute a comprehensive metrics snapshot from the existing `Layout` type at key moments. This keeps one source of truth and requires minimal code changes.

### Core Principle

```
Layout JSON → computeLayoutMetrics() → Analytics Event
```

The same Layout data you already export for JSON sharing becomes the input for analytics.

---

## Architecture

### 1. Metrics Computation Layer

**File**: `src/utils/analytics.ts`

```typescript
import type { Layout } from '../types';
import { STAGING_ID, DEFAULT_CATEGORIES, calcMaxGridUnits, hasFractionalDimensions } from '../constants';

// ============================================
// METRICS TYPES
// ============================================

export interface LayoutMetrics {
  // Drawer configuration
  drawer: {
    width: number;
    depth: number;
    height: number;
    gridUnitMm: number;
    heightUnitMm: number;
    printBedSize: number;
    isDefaultSize: boolean;  // 10×8×12
  };

  // Bins summary
  bins: {
    total: number;
    onGrid: number;
    inStaging: number;
    withLabels: number;
    withNotes: number;
    withClearance: number;
    withHalfUnits: number;
    // Top 5 most common sizes as "WxD" strings
    topSizes: Array<{ size: string; count: number }>;
    // Height distribution
    heights: Record<number, number>;
    // Average bin area (width × depth)
    avgArea: number;
  };

  // Layers summary
  layers: {
    count: number;
    heights: number[];
    totalHeight: number;
  };

  // Categories summary
  categories: {
    total: number;
    customCount: number;  // Non-default categories
    // Distribution: category name → bin count (top 5)
    topCategories: Array<{ name: string; count: number }>;
  };

  // Boolean feature flags
  features: {
    usesMultiLayer: boolean;
    usesHalfBins: boolean;
    usesClearanceHeight: boolean;
    usesCustomCategories: boolean;
    usesLabels: boolean;
    usesNotes: boolean;
    usesNonDefaultDrawer: boolean;
    usesNonDefaultPrintBed: boolean;
  };

  // Print readiness
  print: {
    hasOversizedBins: boolean;
    maxBinWidth: number;
    maxBinDepth: number;
  };

  // Engagement signal
  engagement: {
    binCount: number;
    isEngaged: boolean;  // 5+ bins = meaningful usage
    isSubstantial: boolean;  // 15+ bins = real project
  };
}

// ============================================
// COMPUTATION
// ============================================

const DEFAULT_DRAWER = { width: 10, depth: 8, height: 12 };
const DEFAULT_PRINT_BED = 256;
const DEFAULT_CATEGORY_IDS = new Set(DEFAULT_CATEGORIES.map(c => c.id));

export function computeLayoutMetrics(layout: Layout): LayoutMetrics {
  const gridBins = layout.bins.filter(b => b.layerId !== STAGING_ID);
  const stagingBins = layout.bins.filter(b => b.layerId === STAGING_ID);

  // Bin size distribution
  const sizeCount = new Map<string, number>();
  const heightCount = new Map<number, number>();
  let totalArea = 0;
  let withLabels = 0;
  let withNotes = 0;
  let withClearance = 0;
  let withHalfUnits = 0;
  let maxWidth = 0;
  let maxDepth = 0;

  for (const bin of gridBins) {
    // Size tracking
    const sizeKey = `${bin.width}x${bin.depth}`;
    sizeCount.set(sizeKey, (sizeCount.get(sizeKey) || 0) + 1);

    // Height tracking
    heightCount.set(bin.height, (heightCount.get(bin.height) || 0) + 1);

    // Area
    totalArea += bin.width * bin.depth;

    // Feature detection
    if (bin.label?.trim()) withLabels++;
    if (bin.notes?.trim()) withNotes++;
    if (bin.clearanceHeight && bin.clearanceHeight > 0) withClearance++;
    if (hasFractionalDimensions(bin)) {
      withHalfUnits++;
    }

    // Max dimensions for print check
    maxWidth = Math.max(maxWidth, bin.width);
    maxDepth = Math.max(maxDepth, bin.depth);
  }

  // Top 5 sizes
  const topSizes = [...sizeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([size, count]) => ({ size, count }));

  // Height distribution
  const heights: Record<number, number> = {};
  for (const [h, c] of heightCount) {
    heights[h] = c;
  }

  // Category distribution
  const categoryCount = new Map<string, number>();
  for (const bin of gridBins) {
    categoryCount.set(bin.category, (categoryCount.get(bin.category) || 0) + 1);
  }

  const categoryIdToName = new Map(layout.categories.map(c => [c.id, c.name]));
  const topCategories = [...categoryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ name: categoryIdToName.get(id) || 'Unknown', count }));

  // Custom categories (not in default set)
  const customCategoryCount = layout.categories.filter(
    c => !DEFAULT_CATEGORY_IDS.has(c.id) &&
         !DEFAULT_CATEGORIES.some(dc => dc.name === c.name && dc.color === c.color)
  ).length;

  // Print bed check (reuse existing utility)
  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);
  const hasOversizedBins = maxWidth > maxGridUnits || maxDepth > maxGridUnits;

  return {
    drawer: {
      width: layout.drawer.width,
      depth: layout.drawer.depth,
      height: layout.drawer.height,
      gridUnitMm: layout.gridUnitMm,
      heightUnitMm: layout.heightUnitMm,
      printBedSize: layout.printBedSize,
      isDefaultSize:
        layout.drawer.width === DEFAULT_DRAWER.width &&
        layout.drawer.depth === DEFAULT_DRAWER.depth &&
        layout.drawer.height === DEFAULT_DRAWER.height,
    },
    bins: {
      total: layout.bins.length,
      onGrid: gridBins.length,
      inStaging: stagingBins.length,
      withLabels,
      withNotes,
      withClearance,
      withHalfUnits,
      topSizes,
      heights,
      avgArea: gridBins.length > 0 ? Math.round(totalArea / gridBins.length * 10) / 10 : 0,
    },
    layers: {
      count: layout.layers.length,
      heights: layout.layers.map(l => l.height),
      totalHeight: layout.layers.reduce((sum, l) => sum + l.height, 0),
    },
    categories: {
      total: layout.categories.length,
      customCount: customCategoryCount,
      topCategories,
    },
    features: {
      usesMultiLayer: layout.layers.length > 1,
      usesHalfBins: withHalfUnits > 0,
      usesClearanceHeight: withClearance > 0,
      usesCustomCategories: customCategoryCount > 0,
      usesLabels: withLabels > 0,
      usesNotes: withNotes > 0,
      usesNonDefaultDrawer:
        layout.drawer.width !== DEFAULT_DRAWER.width ||
        layout.drawer.depth !== DEFAULT_DRAWER.depth ||
        layout.drawer.height !== DEFAULT_DRAWER.height,
      usesNonDefaultPrintBed: layout.printBedSize !== DEFAULT_PRINT_BED,
    },
    print: {
      hasOversizedBins,
      maxBinWidth: maxWidth,
      maxBinDepth: maxDepth,
    },
    engagement: {
      binCount: gridBins.length,
      isEngaged: gridBins.length >= 5,
      isSubstantial: gridBins.length >= 15,
    },
  };
}
```

### 2. Tracking Layer

Two options based on Vercel Analytics constraints:

#### Option A: Vercel Analytics (Constrained)

Works within 2-property limit by using multiple focused events and compact encoding.
Uses a session ID to correlate related events.

```typescript
import { track } from '@vercel/analytics';

type AnalyticsTrigger =
  | 'export_json'
  | 'export_url'
  | 'export_tsv'
  | 'session_engaged';

// Generate once per session for correlating multi-event snapshots
const sessionId = Math.random().toString(36).slice(2, 10);

export function trackLayoutSnapshot(
  layout: Layout,
  trigger: AnalyticsTrigger,
  sessionContext?: { durationSec: number; deviceType: string }
) {
  try {
    const m = computeLayoutMetrics(layout);

    // Skip non-engaged users (noise filter)
    if (!m.engagement.isEngaged && trigger === 'session_engaged') {
      return;
    }

    // Event 1: Core dimensions (fits in 2 properties)
    // Format: "WxDxH|Bbins|Llayers|sid" - correlate with session ID
    track('layout_snapshot', {
      summary: `${m.drawer.width}x${m.drawer.depth}x${m.drawer.height}|${m.bins.onGrid}b|${m.layers.count}l`,
      ctx: `${trigger}|${sessionId}`,
    });

    // Event 2: Features used (boolean flags as comma-separated)
    const features = Object.entries(m.features)
      .filter(([_, v]) => v)
      .map(([k]) => k.replace('uses', '').replace(/([A-Z])/g, '-$1').toLowerCase())
      .join(',');

    if (features) {
      track('layout_features', {
        features,  // e.g., "multi-layer,labels,custom-categories"
        sid: sessionId,
      });
    }

    // Event 3: Top bin sizes (for grid size analysis)
    if (m.bins.topSizes.length > 0) {
      track('layout_sizes', {
        // Compact: "2x2:5,1x1:3,4x2:2"
        sizes: m.bins.topSizes.map(s => `${s.size}:${s.count}`).join(','),
        sid: sessionId,
      });
    }
  } catch {
    // Analytics should never break the app - fail silently
  }
}

// Discrete events (simple, no snapshot needed)
export function trackEvent(name: string, props?: Record<string, string | number>) {
  try {
    track(name, props);
  } catch {
    // Fail silently
  }
}
```

**Pros**: No new dependencies, stays in Vercel dashboard
**Cons**: Data is fragmented across events, limited query flexibility

#### Option B: Posthog (Recommended for Full Power)

No property limits, rich querying, generous free tier (1M events/month).

```typescript
import posthog from 'posthog-js';

// Initialize once in main.tsx
export function initAnalytics() {
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    posthog.init('phc_YOUR_KEY', {
      api_host: 'https://app.posthog.com',
      capture_pageview: false,  // Vercel handles this
      persistence: 'localStorage',
    });
  }
}

export function trackLayoutSnapshot(
  layout: Layout,
  trigger: AnalyticsTrigger,
  sessionContext?: { durationSec: number; deviceType: string }
) {
  try {
    const metrics = computeLayoutMetrics(layout);

    // Skip noise
    if (!metrics.engagement.isEngaged && trigger === 'session_engaged') {
      return;
    }

    // Send full metrics object - Posthog handles it
    posthog.capture('layout_snapshot', {
      trigger,
      ...flattenMetrics(metrics),
      ...(sessionContext || {}),
    });
  } catch {
    // Analytics should never break the app - fail silently
  }
}

// Flatten nested object for easier Posthog querying
function flattenMetrics(m: LayoutMetrics): Record<string, unknown> {
  return {
    // Drawer
    drawer_width: m.drawer.width,
    drawer_depth: m.drawer.depth,
    drawer_height: m.drawer.height,
    drawer_is_default: m.drawer.isDefaultSize,
    grid_unit_mm: m.drawer.gridUnitMm,
    print_bed_size: m.drawer.printBedSize,

    // Bins
    bin_count: m.bins.onGrid,
    bins_in_staging: m.bins.inStaging,
    bins_with_labels: m.bins.withLabels,
    bins_with_notes: m.bins.withNotes,
    bins_with_clearance: m.bins.withClearance,
    bins_with_half_units: m.bins.withHalfUnits,
    bin_avg_area: m.bins.avgArea,
    bin_top_sizes: m.bins.topSizes,
    bin_heights: m.bins.heights,

    // Layers
    layer_count: m.layers.count,
    layer_heights: m.layers.heights,

    // Categories
    category_count: m.categories.total,
    custom_category_count: m.categories.customCount,
    top_categories: m.categories.topCategories,

    // Features (individual booleans for easy filtering)
    feature_multi_layer: m.features.usesMultiLayer,
    feature_half_bins: m.features.usesHalfBins,
    feature_clearance: m.features.usesClearanceHeight,
    feature_custom_categories: m.features.usesCustomCategories,
    feature_labels: m.features.usesLabels,
    feature_notes: m.features.usesNotes,
    feature_custom_drawer: m.features.usesNonDefaultDrawer,
    feature_custom_print_bed: m.features.usesNonDefaultPrintBed,

    // Print
    has_oversized_bins: m.print.hasOversizedBins,
    max_bin_width: m.print.maxBinWidth,
    max_bin_depth: m.print.maxBinDepth,

    // Engagement
    is_substantial: m.engagement.isSubstantial,
  };
}
```

**Pros**: Full metrics in one event, powerful querying, funnels, retention
**Cons**: New dependency (~15KB gzipped), separate dashboard

### 3. Integration Points

Track at these moments:

| Trigger | Location | When |
|---------|----------|------|
| `export_json` | `src/components/Modals/ShareModal.tsx` | User clicks "Copy JSON" or "Download" |
| `export_url` | `src/components/Modals/ShareModal.tsx` | User clicks "Copy URL" |
| `export_tsv` | `src/components/RightPanel.tsx` (desktop) or `src/components/mobile/MobilePrintList.tsx` (mobile) | User exports print list |
| `session_engaged` | `visibilitychange` event handler in `src/hooks/useAnalytics.ts` | Tab hidden with 5+ bins (more reliable than `beforeunload`) |

**Note on session tracking**: `beforeunload` is unreliable (async calls may not complete). Use `visibilitychange` API instead, which fires when user switches tabs or minimizes window.

Plus discrete events:

| Event | Location | When |
|-------|----------|------|
| `3d_preview_opened` | `src/components/Grid/IsometricPreview.tsx` | Toggle 3D preview on |
| `layout_created` | `src/hooks/useLayoutSwitcher.ts` → `createNewLayout()` | Create new layout |
| `layout_imported` | `src/hooks/useLayoutSwitcher.ts` → `importLayoutFromJSON()` | Import from JSON/URL |
| `layout_switched` | `src/hooks/useLayoutSwitcher.ts` → `switchLayout()` | Switch to different layout |
| `paint_mode_used` | `src/core/store/ui.ts` → `setPaintMode()` | Enter paint mode |
| `fill_gaps_used` | `src/components/Sidebar/ActiveLayerPanel.tsx` | Click fill gaps button |
| `fill_layer_used` | `src/components/Sidebar/ActiveLayerPanel.tsx` | Click fill layer button |

### 4. Session Context Hook

Create `src/hooks/useAnalytics.ts` to manage session tracking:

```typescript
import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../store';
import { trackLayoutSnapshot, getDeviceType } from '../utils/analytics';
import { BREAKPOINTS } from '../constants';

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < BREAKPOINTS.MD) return 'mobile';
  if (width < BREAKPOINTS.LG) return 'tablet';
  return 'desktop';
}

/**
 * Hook to track engaged sessions via visibilitychange.
 * More reliable than beforeunload for analytics.
 */
export function useAnalytics() {
  const sessionStartRef = useRef(Date.now());
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Only track in production
    if (import.meta.env.DEV) return;

    const handleVisibilityChange = () => {
      // Only track when tab becomes hidden (user leaves)
      if (document.visibilityState !== 'hidden') return;

      // Prevent double-tracking
      if (hasTrackedRef.current) return;

      const layout = useLayoutStore.getState().layout;
      const binCount = layout.bins.filter(b => b.layerId !== '__staging__').length;

      // Only track engaged sessions (5+ bins)
      if (binCount < 5) return;

      hasTrackedRef.current = true;
      const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);

      trackLayoutSnapshot(layout, 'session_engaged', {
        durationSec,
        deviceType: getDeviceType(),
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
```

Usage in `App.tsx`:
```typescript
import { useAnalytics } from './hooks/useAnalytics';

function App() {
  useAnalytics();
  // ...rest of app
}
```

### 5. Privacy Considerations

- **No PII**: Labels and notes are counted, not sent
- **No raw bin data**: Only aggregated metrics
- **Engaged-only**: Skip users with <5 bins (noise filter)
- **Opt-out**: Respect DNT header (Posthog does this automatically)

---

## File Structure

```
src/
├── utils/
│   └── analytics.ts       # Metrics computation + tracking functions
├── hooks/
│   └── useAnalytics.ts    # React hook for session context
└── main.tsx               # Initialize analytics
```

---

## Recommendation

**Use Posthog** if you want the full picture:
- Query any dimension without pre-planning
- Retention analysis, funnels, cohorts
- ~15KB added to bundle (lazy-loadable)
- Free tier is 1M events/month (plenty)

**Use Vercel-only** if you want minimal changes:
- Stays in existing dashboard
- Fragmented data, limited querying
- No new dependencies

---

## Questions to Answer with This Data

Once implemented, you can answer:

1. **Grid sizes**: "What drawer dimensions do engaged users actually use?"
   → Filter by `is_substantial=true`, group by `drawer_width × drawer_depth`

2. **Feature adoption**: "What % use multi-layer?"
   → `feature_multi_layer=true` / total snapshots

3. **3D preview value**: "Is the Three.js bundle worth it?"
   → `3d_preview_opened` event count vs total sessions

4. **Bin sizes**: "What are the most common bin dimensions?"
   → Aggregate `bin_top_sizes` across all snapshots

5. **Mobile usage**: "Are the responsive layouts used?"
   → Group by `device_type`

6. **Print workflow**: "Do users complete the print workflow?"
   → Funnel: session → `export_tsv`

7. **Category usage**: "Do people customize categories?"
   → `custom_category_count > 0` rate

8. **Clearance/half-bin**: "Are advanced features discovered?"
   → `feature_clearance=true` or `feature_half_bins=true` rates
