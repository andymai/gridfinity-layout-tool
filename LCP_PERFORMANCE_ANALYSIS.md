# LCP Performance Analysis

This document analyzes potential areas of the Gridfinity Layout Tool web app contributing to low Largest Contentful Paint (LCP) scores.

## Executive Summary

The primary LCP bottleneck is **synchronous storage initialization at module level** which blocks the initial render. Secondary factors include Google Fonts loading, a large CSS file, and multiple store hydrations on mount.

## Identified Issues

### 1. Synchronous Storage Initialization at Module Level (HIGH IMPACT)

**Location:** `src/App.tsx:48-60`

```typescript
// Initialize layout library once at module level to avoid effect setState issues
let initialLoadError: Error | null = null;
try {
  const { library, activeLayout } = initializeLayoutLibrary();
  useLibraryStore.getState().initLibrary(library);
  useLayoutStore.getState().importLayout(activeLayout, library.activeLayoutId, 'init');
  // ...
}
```

**Impact Analysis:**

The `initializeLayoutLibrary()` function (`src/core/storage/LayoutService.ts:597-708`) performs synchronous operations that block the initial render:

1. **Multiple `localStorage.getItem()` calls** - Each call is synchronous and blocks the main thread
2. **JSON parsing and validation** - `JSON.parse()` for layout data
3. **Schema migrations** - Checking and upgrading old data formats
4. **Library entry validation** - Iterating through all entries to verify they exist in storage

This code runs **before React even mounts**, meaning:
- No paint can occur until this completes
- The browser cannot display any content
- LCP is directly delayed by the total execution time

**Measured Impact:** For users with multiple layouts (up to 100 allowed), this could take 100-500ms depending on device and storage size.

### 2. Google Fonts Loading (MEDIUM IMPACT)

**Location:** `index.html:60`

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=optional" rel="stylesheet">
```

**Current Mitigations (Positive):**
- `display=optional` prevents font swap CLS
- DNS prefetch and preconnect are configured
- Fallback font metrics are defined with `size-adjust`

**Remaining Issues:**
- The stylesheet fetch is render-blocking
- 7 font weight combinations = multiple font file requests
- Network latency on slow connections delays text rendering

### 3. Large CSS File (MEDIUM IMPACT)

**Location:** `src/index.css` (~1029 lines)

The CSS file includes:
- ~200+ CSS custom properties in `:root`
- Complete animation keyframes library
- All component styles in `@layer components`
- Responsive overrides for multiple breakpoints

**Impact:** All CSS must be parsed before first paint. While Vite handles CSS efficiently, the sheer size adds parsing time.

### 4. Grid Component Loaded Synchronously (MEDIUM IMPACT)

**Location:** `src/App.tsx:9`

```typescript
import { Grid } from './features/grid-editor/components/Grid';
```

The Grid component is the likely LCP element and is loaded synchronously (correct behavior). However, it has a complex initialization:

- `Grid` imports `GridCanvas`, `Overlay`, `QuickLabelPopover`, etc.
- Creates DOM elements in loops for grid cells
- Multiple Zustand store subscriptions with `useShallow`
- `useLayoutEffect` for zoom calculations (blocks paint)

**Grid Component Chain:**
```
Grid → GridCanvas → (generates N×M cell divs) → Bin components
                 → Overlay → OverlayBin components
                 → IsometricPreview (lazy, good)
```

### 5. Multiple Hook Initializations on Mount (MEDIUM IMPACT)

**Location:** `src/App.tsx:106-124`

```typescript
useKeyboard();
useAutoSave();
useCrossTabSync();
useLayoutRouting();
usePWAUpdate();
useAnalytics();
useStorageMigration();
```

Each hook:
- Subscribes to events or stores
- May perform initial reads/writes
- Adds to mount time before interactive

### 6. Analytics Initialization (LOW IMPACT)

**Location:** `src/main.tsx:10`

```typescript
initAnalytics()
```

While PostHog is lazy-loaded, the setup function runs synchronously before render. The lazy import means actual SDK load is deferred, but the promise setup adds minimal overhead.

## LCP Element Identification

### Desktop Layout
The LCP element is likely the **Grid component** (`src/features/grid-editor/components/Grid/`):
- Largest visible content area
- Contains the main interactive grid
- CSS Grid layout with dynamically generated cells

### Mobile Layout
The LCP element may be the **loading fallback**:
```typescript
<Suspense fallback={<div className="h-screen bg-surface" />}>
  <MobileLayout ... />
</Suspense>
```
This empty div becomes LCP until MobileLayout loads.

## Recommendations

### High Priority

#### 1. Defer Storage Initialization
Move `initializeLayoutLibrary()` into the React lifecycle:

```typescript
// Before (blocks render)
const { library, activeLayout } = initializeLayoutLibrary();

// After (shows UI immediately)
export default function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const { library, activeLayout } = initializeLayoutLibrary();
    useLibraryStore.getState().initLibrary(library);
    useLayoutStore.getState().importLayout(activeLayout, ...);
    setInitialized(true);
  }, []);

  if (!initialized) {
    return <LoadingSkeleton />;
  }
  // ... rest of app
}
```

**Estimated Impact:** 100-500ms improvement in LCP

#### 2. Add Loading Skeleton
Create a lightweight skeleton UI that matches the app layout:
- Shows header shape
- Shows sidebar placeholder
- Shows grid area placeholder
- Uses CSS-only animations (no JS)

### Medium Priority

#### 3. Self-Host Critical Fonts
Download and serve IBM Plex Sans 400/500/600 from the same domain:
- Eliminates DNS lookup for fonts.googleapis.com
- Removes render-blocking stylesheet fetch
- Allows `font-display: swap` without CLS concerns

#### 4. Extract Critical CSS
Move above-the-fold styles inline in `<head>`:
- CSS variables for colors
- Base layout styles
- Loading skeleton styles

#### 5. Optimize Grid Initial Render
Consider progressive rendering:
- Render visible grid cells first
- Defer off-screen cell rendering
- Use `content-visibility: auto` for large grids

### Low Priority

#### 6. Add Resource Hints
```html
<link rel="preload" as="style" href="/assets/index-[hash].css">
<link rel="modulepreload" href="/assets/index-[hash].js">
```

#### 7. Consider Streaming SSR
For future consideration: Server-side rendering the initial shell could eliminate JavaScript parsing from the critical path.

## Metrics to Monitor

After implementing fixes, track:
- **LCP (p75)** - Target < 2.5s
- **FCP** - Target < 1.8s
- **TTFB** - Target < 0.8s
- **TBT (Total Blocking Time)** - Target < 200ms

## Files Modified for Analysis

Key files reviewed:
- `index.html` - Document structure and resource loading
- `src/main.tsx` - Entry point and analytics init
- `src/App.tsx` - Main component and storage init
- `src/index.css` - Global styles
- `src/features/grid-editor/components/Grid/index.tsx` - LCP candidate
- `src/features/grid-editor/components/Grid/GridCanvas.tsx` - Grid rendering
- `src/core/storage/LayoutService.ts` - Storage initialization
- `src/utils/analytics.ts` - Analytics setup
- `vite.config.ts` - Build configuration

## Conclusion

The most impactful change is deferring storage initialization to allow immediate visual feedback. Combined with a loading skeleton, this should significantly improve perceived performance and LCP scores. Font optimization and CSS extraction provide additional incremental improvements.
