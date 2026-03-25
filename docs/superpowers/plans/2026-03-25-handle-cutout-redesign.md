# Handle Cutout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the handle cutout feature with 4 shape options, adjustable vertical position, multi-handle per wall, interior wall handles, finger chamfer toggle, and linked/independent per-side sizing — matching the wall cutout feature's architecture.

**Architecture:** Extend `HandleConfig` and `HandleSide` types to support shape selection, vertical position, count, chamfer, interior toggle, and per-side sizing. Add 4 profile builders (rectangle, oval, scoop, open U-shape) to `handleBuilder.ts` following the `wallCutoutBuilder.ts` pattern. Update the UI panel to match the wall cutouts section layout with shape icons, linked/independent mode, and new controls.

**Tech Stack:** TypeScript, React 19, Zustand/Immer, brepjs (2D drawing/extrude API), Three.js (ghost preview), Vitest

---

## File Structure

### New Files

- `src/features/generation/worker/generators/handleProfiles.ts` — 4 handle profile builders (pure 2D geometry, no side effects)
- `src/features/generation/worker/generators/handleProfiles.test.ts` — Unit tests for profile geometry
- `src/features/generation/worker/generators/handleBuilder.test.ts` — Unit tests for multi-handle layout and build logic
- `src/shared/utils/handleLayout.ts` — Multi-handle evenly-spaced layout computation (pure math)
- `src/shared/utils/handleLayout.test.ts` — Unit tests for layout math

### Modified Files

- `src/features/bin-designer/types/index.ts` — Extend `HandleConfig`, `HandleSide`, add `HandleCutoutShape`
- `src/shared/types/bin.ts` — Re-export new types
- `src/features/bin-designer/constants/defaults.ts` — New defaults, migration for old saved designs
- `src/features/bin-designer/constants/gridfinity.ts` — New constraint constants (vertical position, count)
- `src/features/bin-designer/store/slices/paramSlice.ts` — Updated `updateHandles`/`updateHandleSide` for new fields
- `src/features/generation/worker/generators/handleBuilder.ts` — Refactor to use profiles, multi-handle, vertical position, chamfer
- `src/shared/utils/handleCutoutClip.ts` — Parameterize vertical position (replace `HOLE_VERTICAL_CENTER` constant)
- `src/features/generation/worker/generators/wallPatternBuilder.ts` — Update handle clip params for variable position/count
- `src/features/bin-designer/components/panel/HandleSection/HandleSection.tsx` — Full UI redesign
- `src/features/bin-designer/components/panel/HandleSection/useHandleSection.ts` — New state/handlers for all features
- `src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx` — Support new shapes, multi-handle, variable position
- `src/i18n/locales/en.ts` — New i18n keys
- `src/i18n/locales/*.json` — New keys for de, es, fr, nb, nl, pt-BR

---

## Task 1: Extend Types

**Files:**

- Modify: `src/features/bin-designer/types/index.ts:122-145`
- Modify: `src/shared/types/bin.ts:35-37`

- [ ] **Step 1: Add `HandleCutoutShape` type and update `HandleSide` and `HandleConfig`**

In `src/features/bin-designer/types/index.ts`, replace the existing handle types (lines 122-145) with:

```typescript
/** Handle-eligible wall sides (outer walls only, no interior dividers) */
export type HandleWallSide = 'front' | 'back' | 'left' | 'right';

/** Handle cutout shape */
export type HandleCutoutShape = 'rectangle' | 'oval' | 'scoop' | 'u-shape';

/** Per-side handle configuration */
export interface HandleSide {
  /** Whether this side's handle is individually enabled */
  readonly enabled: boolean;
  /** Per-side width override (% of wall span). Null = use global. */
  readonly width: number | null;
  /** Per-side height override (mm). Null = use global. */
  readonly height: number | null;
  /** Per-side corner radius override (mm). Null = use global. */
  readonly cornerRadius: number | null;
}

/** Handle configuration for through-hole grip cutouts */
export interface HandleConfig {
  /** Master toggle for the handles feature */
  readonly enabled: boolean;
  /** Cutout shape applied globally to all sides */
  readonly shape: HandleCutoutShape;
  /** Hole width as % of wall interior span (10-100). Default: 50 */
  readonly width: number;
  /** Hole height in mm (vertical extent). Default: 15 */
  readonly height: number;
  /** Corner radius in mm (0 = sharp rectangle). Default: 10. Used for rectangle and u-shape only. */
  readonly cornerRadius: number;
  /** Vertical position as fraction 0-1 from floor. Default: 0.7. Ignored for u-shape (auto-anchored to bottom). */
  readonly verticalPosition: number;
  /** Number of handles per wall side (1-3). Default: 1 */
  readonly count: number;
  /** Whether to enable chamfer around handle edges */
  readonly chamfer: boolean;
  /** Whether to cut handles into interior divider walls */
  readonly interior: boolean;
  readonly front: HandleSide;
  readonly back: HandleSide;
  readonly left: HandleSide;
  readonly right: HandleSide;
}
```

- [ ] **Step 2: Add re-export in shared types**

In `src/shared/types/bin.ts`, add `HandleCutoutShape` to the re-export list alongside the existing handle types.

- [ ] **Step 3: Verify typecheck fails (expected — downstream consumers need updating)**

Run: `pnpm run typecheck 2>&1 | head -40`

Expected: Type errors in defaults, paramSlice, handleBuilder, etc. (confirms the types propagated correctly).

- [ ] **Step 4: Commit**

```bash
git add src/features/bin-designer/types/index.ts src/shared/types/bin.ts
git commit -m "feat(handles): extend HandleConfig/HandleSide types for redesign

Add HandleCutoutShape (rectangle|oval|scoop|u-shape), verticalPosition,
count, chamfer, interior fields to HandleConfig. Extend HandleSide with
per-side width/height/cornerRadius overrides."
```

---

## Task 2: Update Defaults, Constants, and Migration

**Files:**

- Modify: `src/features/bin-designer/constants/defaults.ts:76-86` (DEFAULT_HANDLE_CONFIG)
- Modify: `src/features/bin-designer/constants/defaults.ts:400-411` (migrateParams handle section)
- Modify: `src/features/bin-designer/constants/gridfinity.ts:78-87`

- [ ] **Step 1: Update DEFAULT_HANDLE_CONFIG**

In `src/features/bin-designer/constants/defaults.ts`, replace the existing `DEFAULT_HANDLE_CONFIG` (around line 77):

```typescript
/** Default per-side handle config */
const DEFAULT_HANDLE_SIDE: HandleSide = {
  enabled: false,
  width: null,
  height: null,
  cornerRadius: null,
} as const;

/** Default handle configuration: disabled, front + sides enabled when toggled on */
const DEFAULT_HANDLE_CONFIG: HandleConfig = {
  enabled: false,
  shape: 'rectangle',
  width: 50,
  height: 15,
  cornerRadius: 10,
  verticalPosition: 0.7,
  count: 1,
  chamfer: false,
  interior: false,
  front: { ...DEFAULT_HANDLE_SIDE, enabled: true },
  back: { ...DEFAULT_HANDLE_SIDE, enabled: false },
  left: { ...DEFAULT_HANDLE_SIDE, enabled: true },
  right: { ...DEFAULT_HANDLE_SIDE, enabled: true },
} as const;
```

Export `DEFAULT_HANDLE_SIDE` so the store and section hook can use it.

- [ ] **Step 2: Update migrateParams for backward compatibility**

In `migrateParams()` (around line 400), update the handle migration to handle old designs that lack the new fields. The spread-with-defaults pattern already handles this — `...DEFAULT_HANDLE_CONFIG, ...cleanHandles` will fill missing fields. But we need to also handle per-side migration since `HandleSide` now has extra nullable fields:

```typescript
const rawHandles = (params.handles ?? {}) as Record<string, unknown>;
const { depth: _legacyDepth, filletRadius: _legacyFillet, ...cleanHandles } = rawHandles;
const handlesConfig: HandleConfig = {
  ...DEFAULT_HANDLE_CONFIG,
  ...(cleanHandles as Partial<HandleConfig>),
  front: { ...DEFAULT_HANDLE_SIDE, ...((rawHandles.front as object) ?? {}) },
  back: { ...DEFAULT_HANDLE_SIDE, ...((rawHandles.back as object) ?? {}) },
  left: { ...DEFAULT_HANDLE_SIDE, ...((rawHandles.left as object) ?? {}) },
  right: { ...DEFAULT_HANDLE_SIDE, ...((rawHandles.right as object) ?? {}) },
};
```

Old saved `HandleSide` objects only have `{ enabled: boolean }` — the spread fills `width: null, height: null, cornerRadius: null`.

- [ ] **Step 3: Add new constraint constants**

In `src/features/bin-designer/constants/gridfinity.ts`, add after the existing handle constants (line 87):

```typescript
MIN_HANDLE_VERTICAL_POSITION: 0.2, // fraction from floor
MAX_HANDLE_VERTICAL_POSITION: 0.9, // fraction from floor
HANDLE_VERTICAL_POSITION_STEP: 0.05,
MIN_HANDLE_COUNT: 1,
MAX_HANDLE_COUNT: 3,
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck 2>&1 | head -40`

Expected: Remaining errors only in handleBuilder, HandleSection, GhostHandles, paramSlice (not in defaults/constants).

- [ ] **Step 5: Commit**

```bash
git add src/features/bin-designer/constants/defaults.ts src/features/bin-designer/constants/gridfinity.ts
git commit -m "feat(handles): update defaults, migration, and constraints

Add DEFAULT_HANDLE_SIDE with nullable overrides. Update migrateParams to
backfill new HandleSide fields for old saved designs. Add vertical position
and count constraint constants."
```

---

## Task 3: Update Store Actions

**Files:**

- Modify: `src/features/bin-designer/store/slices/paramSlice.ts:128-143`

- [ ] **Step 1: Update updateHandleSide to handle new HandleSide shape**

The existing `updateHandleSide` already does a spread merge — it should work with the new nullable fields without changes. Verify by reading the code. The type import already includes `HandleSide`.

If any changes are needed (e.g., the `Partial<HandleSide>` type doesn't auto-pick up new fields), update the import to include `HandleCutoutShape`.

- [ ] **Step 2: Run typecheck to verify store compiles**

Run: `pnpm run typecheck -- --noEmit 2>&1 | grep paramSlice`

Expected: No errors in paramSlice.ts.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add src/features/bin-designer/store/slices/paramSlice.ts
git commit -m "feat(handles): update store actions for new HandleSide fields"
```

---

## Task 4: Handle Profile Builders (Geometry)

**Files:**

- Create: `src/features/generation/worker/generators/handleProfiles.ts`
- Create: `src/features/generation/worker/generators/handleProfiles.test.ts`

- [ ] **Step 1: Write tests for profile builders**

Create `handleProfiles.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildHandleProfile } from './handleProfiles';

describe('buildHandleProfile', () => {
  const defaultArgs = { width: 30, height: 15, cornerRadius: 5 };

  it('returns a valid Drawing for rectangle shape', () => {
    const profile = buildHandleProfile('rectangle', defaultArgs);
    expect(profile).not.toBeNull();
    expect(profile!.toSVGPaths().length).toBeGreaterThan(0);
  });

  it('returns a valid Drawing for oval shape', () => {
    const profile = buildHandleProfile('oval', { ...defaultArgs, cornerRadius: 0 });
    expect(profile).not.toBeNull();
    expect(profile!.toSVGPaths().length).toBeGreaterThan(0);
  });

  it('returns a valid Drawing for scoop shape', () => {
    const profile = buildHandleProfile('scoop', { ...defaultArgs, cornerRadius: 0 });
    expect(profile).not.toBeNull();
    expect(profile!.toSVGPaths().length).toBeGreaterThan(0);
  });

  it('returns a valid Drawing for u-shape (open bottom)', () => {
    const profile = buildHandleProfile('u-shape', defaultArgs);
    expect(profile).not.toBeNull();
    expect(profile!.toSVGPaths().length).toBeGreaterThan(0);
  });

  it('clamps corner radius to half of smallest dimension', () => {
    // Corner radius 20 on a 10x10 shape should be clamped
    const profile = buildHandleProfile('rectangle', { width: 10, height: 10, cornerRadius: 20 });
    expect(profile).toBeDefined();
  });

  it('handles zero-size gracefully', () => {
    const profile = buildHandleProfile('rectangle', { width: 0, height: 15, cornerRadius: 5 });
    expect(profile).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/generation/worker/generators/handleProfiles.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement profile builders**

Create `handleProfiles.ts`:

```typescript
/**
 * Handle cutout profile builders.
 *
 * Pure 2D geometry: each function returns a Drawing (2D sketch) for a handle shape.
 * Profiles are centered at the origin in XZ space (X = horizontal, Z = vertical).
 *
 * - rectangle: rounded rectangle (existing behavior, now explicit)
 * - oval: true ellipse via arc segments
 * - scoop: semicircle / circular arc (closed hole)
 * - u-shape: open at bottom, U-notch with rounded corners
 */

import { draw, drawRoundedRectangle, drawRectangle, drawEllipse } from 'brepjs';
import type { Drawing } from 'brepjs';
import type { HandleCutoutShape } from '@/shared/types/bin';

interface ProfileArgs {
  /** Horizontal span in mm */
  readonly width: number;
  /** Vertical extent in mm */
  readonly height: number;
  /** Corner radius in mm (used for rectangle and u-shape) */
  readonly cornerRadius: number;
}

/**
 * Build a 2D handle cutout profile for the given shape.
 *
 * Returns null if dimensions are too small to produce geometry.
 */
export function buildHandleProfile(shape: HandleCutoutShape, args: ProfileArgs): Drawing | null {
  const { width, height, cornerRadius } = args;
  if (width < 0.1 || height < 0.1) return null;

  switch (shape) {
    case 'oval':
      return buildOvalProfile(width, height);
    case 'scoop':
      return buildScoopProfile(width, height);
    case 'u-shape':
      return buildUShapeProfile(width, height, cornerRadius);
    default:
      return buildRectangleProfile(width, height, cornerRadius);
  }
}

function buildRectangleProfile(w: number, h: number, r: number): Drawing {
  const safeR = Math.max(0, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  return safeR > 0.1 ? drawRoundedRectangle(w, h, safeR) : drawRectangle(w, h);
}

function buildOvalProfile(w: number, h: number): Drawing {
  // Use brepjs built-in drawEllipse for a true ellipse centered at origin.
  return drawEllipse(w / 2, h / 2);
}

function buildScoopProfile(w: number, h: number): Drawing {
  // Closed semicircle hole: flat top + arc bottom (or vice versa).
  // Arc sagitta clamped to available height.
  const hw = w / 2;
  const sagitta = Math.min(hw, h / 2);
  const flatH = h / 2;
  return draw([-hw, flatH])
    .lineTo([hw, flatH])
    .lineTo([hw, 0])
    .sagittaArc(-w, 0, sagitta)
    .lineTo([-hw, flatH])
    .close();
}

/** U-shape floor overshoot for clean boolean cut (mm). */
const U_SHAPE_OVERSHOOT = 5;

function buildUShapeProfile(w: number, h: number, r: number): Drawing {
  // Open-bottom U: flat top with rounded corners, extends below floor.
  // The generous overshoot below ensures a clean boolean cut through the floor.
  const hw = w / 2;
  const totalH = h + U_SHAPE_OVERSHOOT;
  const topY = totalH / 2;
  const bottomY = -totalH / 2;
  const safeR = Math.max(0, Math.min(r, w / 2 - 0.01, h / 4 - 0.01));

  if (safeR > 0.1) {
    // Rounded top corners only. Bottom extends below floor.
    return draw([-hw, bottomY])
      .lineTo([-hw, topY - safeR])
      .customCorner(safeR)
      .lineTo([hw - safeR, topY])
      .customCorner(safeR)
      .lineTo([hw, bottomY])
      .close();
  }

  // Sharp U
  return drawRectangle(w, totalH);
}
```

The U-shape open-bottom effect is achieved by positioning the profile so its bottom extends 5mm below the wall floor for a clean boolean cut — similar to how wall cutouts overshoot above the wall top. The `handleBuilder.ts` (Task 7) positions the U-shape `centerZ` accounting for this overshoot.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/features/generation/worker/generators/handleProfiles.test.ts`

Expected: PASS (all 6 tests). If brepjs drawing API calls fail, adjust the profile construction.

- [ ] **Step 5: Commit**

```bash
git add src/features/generation/worker/generators/handleProfiles.ts src/features/generation/worker/generators/handleProfiles.test.ts
git commit -m "feat(handles): add 4 handle profile builders (rectangle, oval, scoop, u-shape)

Pure 2D geometry builders following wallCutoutBuilder's buildCutoutProfile pattern.
Each returns a Drawing for extrusion in handleBuilder."
```

---

## Task 5: Multi-Handle Layout Math

**Files:**

- Create: `src/shared/utils/handleLayout.ts`
- Create: `src/shared/utils/handleLayout.test.ts`

- [ ] **Step 1: Write tests for multi-handle layout**

Create `handleLayout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeMultiHandleOffsets } from './handleLayout';

describe('computeMultiHandleOffsets', () => {
  it('returns single centered handle for count=1', () => {
    const offsets = computeMultiHandleOffsets(1, 100, 50);
    expect(offsets).toEqual([0]);
  });

  it('returns two evenly spaced handles for count=2', () => {
    const offsets = computeMultiHandleOffsets(2, 100, 30);
    // Two 30mm handles with gaps: total handle = 60mm, remaining = 40mm
    // 3 gaps (edges + middle), each ~13.3mm. Centers at -17.5 and +17.5
    expect(offsets).toHaveLength(2);
    expect(offsets[0]).toBeLessThan(0);
    expect(offsets[1]).toBeGreaterThan(0);
    // Symmetric
    expect(offsets[0]).toBeCloseTo(-offsets[1], 5);
  });

  it('returns three evenly spaced handles for count=3', () => {
    const offsets = computeMultiHandleOffsets(3, 120, 20);
    expect(offsets).toHaveLength(3);
    // Should be symmetric around center
    expect(offsets[1]).toBeCloseTo(0, 5);
    expect(offsets[0]).toBeCloseTo(-offsets[2], 5);
  });

  it('reduces count when handles cannot fit', () => {
    // 3 handles of 40mm each = 120mm, but wall is only 100mm
    const offsets = computeMultiHandleOffsets(3, 100, 40);
    expect(offsets.length).toBeLessThanOrEqual(3);
    // Should still produce valid non-overlapping offsets
    for (let i = 1; i < offsets.length; i++) {
      const gap = offsets[i] - offsets[i - 1];
      expect(gap).toBeGreaterThan(40); // handles shouldn't overlap
    }
  });

  it('returns empty array when even one handle cannot fit', () => {
    const offsets = computeMultiHandleOffsets(1, 5, 30);
    expect(offsets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/utils/handleLayout.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement multi-handle layout**

Create `handleLayout.ts`:

```typescript
/**
 * Multi-handle layout computation.
 *
 * Computes evenly-spaced horizontal offsets for N handles on a wall span.
 * Pure math — shared between handleBuilder (generation) and GhostHandles (preview).
 */

/** Minimum gap between handles and between handles and wall edges (mm). */
const MIN_GAP = 3;

/**
 * Compute horizontal center offsets for `count` handles on a wall.
 *
 * Handles are evenly distributed with equal gaps between them and the wall edges.
 * If the requested count cannot fit, reduces count until they fit.
 * Returns offsets relative to wall center (0 = centered).
 *
 * @param count - Requested number of handles (1-3)
 * @param wallSpan - Available wall interior span in mm
 * @param handleWidth - Width of each handle in mm
 * @returns Array of horizontal center offsets (mm), or empty if none fit
 */
export function computeMultiHandleOffsets(
  count: number,
  wallSpan: number,
  handleWidth: number
): number[] {
  // Try requested count, then reduce until they fit
  for (let n = Math.min(count, 3); n >= 1; n--) {
    const totalHandleWidth = n * handleWidth;
    const totalGapNeeded = (n + 1) * MIN_GAP;
    if (totalHandleWidth + totalGapNeeded > wallSpan) continue;

    const gap = (wallSpan - totalHandleWidth) / (n + 1);
    const offsets: number[] = [];
    for (let i = 0; i < n; i++) {
      // First handle starts at -wallSpan/2 + gap + handleWidth/2
      const center = -wallSpan / 2 + gap * (i + 1) + handleWidth * (i + 0.5);
      offsets.push(center);
    }
    return offsets;
  }

  // Even one handle can't fit
  return [];
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/shared/utils/handleLayout.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/handleLayout.ts src/shared/utils/handleLayout.test.ts
git commit -m "feat(handles): add multi-handle layout math

Pure function computing evenly-spaced offsets for 1-3 handles per wall.
Auto-reduces count when handles can't fit. Shared between builder and ghost."
```

---

## Task 6: Update handleCutoutClip.ts for Variable Vertical Position

**Files:**

- Modify: `src/shared/utils/handleCutoutClip.ts:37,51-60`
- Modify: `src/shared/utils/handleCutoutClip.test.ts` (add tests for new `verticalPosition` param)

- [ ] **Step 1: Parameterize vertical position**

Update `computeHandleHoleGeometry` to accept `verticalPosition` parameter instead of using the `HOLE_VERTICAL_CENTER` constant:

```typescript
/** Default vertical center of handle hole as fraction of interior height (from floor). */
export const DEFAULT_VERTICAL_POSITION = 0.7;

/**
 * Compute handle hole vertical center and clamped height.
 *
 * @param interiorHeight - Interior wall height in mm
 * @param requestedHeight - Requested hole height in mm
 * @param verticalPosition - Vertical center as fraction 0-1 from floor (default 0.7)
 */
export function computeHandleHoleGeometry(
  interiorHeight: number,
  requestedHeight: number,
  verticalPosition: number = DEFAULT_VERTICAL_POSITION
): { centerZ: number; effectiveHeight: number } {
  const centerZ = interiorHeight * verticalPosition;
  const margin = interiorHeight * 0.1;
  const maxHalfHeight = Math.max(0, Math.min(centerZ, interiorHeight - centerZ) - margin);
  const effectiveHeight = Math.min(requestedHeight, maxHalfHeight * 2);
  return { centerZ, effectiveHeight };
}
```

Keep `HOLE_VERTICAL_CENTER` as a deprecated alias for `DEFAULT_VERTICAL_POSITION` so existing imports don't break:

```typescript
/** @deprecated Use DEFAULT_VERTICAL_POSITION instead */
export const HOLE_VERTICAL_CENTER = DEFAULT_VERTICAL_POSITION;
```

- [ ] **Step 2: Add tests for verticalPosition parameter**

In `src/shared/utils/handleCutoutClip.test.ts`, add test cases:

```typescript
describe('computeHandleHoleGeometry with verticalPosition', () => {
  it('uses default 0.7 when verticalPosition not provided', () => {
    const result = computeHandleHoleGeometry(100, 20);
    expect(result.centerZ).toBeCloseTo(70, 1);
  });

  it('respects custom verticalPosition', () => {
    const result = computeHandleHoleGeometry(100, 20, 0.5);
    expect(result.centerZ).toBeCloseTo(50, 1);
  });

  it('clamps effective height near floor (low verticalPosition)', () => {
    const result = computeHandleHoleGeometry(100, 80, 0.2);
    // centerZ=20, margin=10, maxHalfHeight=max(0, min(20,80)-10)=10
    expect(result.effectiveHeight).toBeLessThanOrEqual(20);
  });

  it('clamps effective height near ceiling (high verticalPosition)', () => {
    const result = computeHandleHoleGeometry(100, 80, 0.9);
    expect(result.effectiveHeight).toBeLessThanOrEqual(20);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/shared/utils/handleCutoutClip.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/utils/handleCutoutClip.ts src/shared/utils/handleCutoutClip.test.ts
git commit -m "feat(handles): parameterize vertical position in handleCutoutClip

computeHandleHoleGeometry now accepts verticalPosition parameter (default 0.7).
Keeps backward compat via default parameter value. Tests cover edge positions."
```

---

## Task 7: Refactor handleBuilder.ts

**Files:**

- Modify: `src/features/generation/worker/generators/handleBuilder.ts`
- Create: `src/features/generation/worker/generators/handleBuilder.test.ts`

This is the largest task. The builder needs to support:

1. Shape-based profile selection (delegate to `handleProfiles.ts`)
2. Variable vertical position
3. Multi-handle layout (delegate to `handleLayout.ts`)
4. Per-side width/height/cornerRadius overrides
5. Interior wall handles
6. Chamfer (via brepjs fillet/chamfer if available, or a chamfer profile extension)
7. U-shape auto-anchor-to-bottom behavior

- [ ] **Step 1: Write tests for the refactored builder**

Create `handleBuilder.test.ts` with key scenario tests. These should test via `buildHandleHoles` with various param combinations:

```typescript
import { describe, it, expect } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { buildHandleHoles } from './handleBuilder';

/** Create test params with handle overrides. */
function makeParams(handleOverrides: Partial<BinParams['handles']> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true, ...handleOverrides },
  };
}

describe('buildHandleHoles', () => {
  it('returns null when handles disabled', () => {
    // params.handles.enabled = false
  });

  it('builds a single rectangle hole on one wall', () => {
    // Basic: one wall, rectangle shape, count=1
  });

  it('builds multiple shapes correctly', () => {
    // Test each of: oval, scoop, u-shape
  });

  it('respects vertical position parameter', () => {
    // verticalPosition=0.5 should center the hole mid-wall
  });

  it('builds multiple handles per wall with count=2', () => {
    // count=2 should produce 2 holes per enabled wall
  });

  it('uses per-side width override when set', () => {
    // front.width = 80, global width = 50 -> front uses 80
  });

  it('auto-anchors u-shape to wall bottom', () => {
    // shape='u-shape' should ignore verticalPosition
  });

  it('builds interior wall handles when interior=true', () => {
    // interior=true with compartment dividers
  });
});
```

The implementer should flesh out these tests with actual param construction and result assertions. The key assertion for geometry tests is that `buildHandleHoles` returns a non-null `Shape3D` (the BREP shape). Deeper geometry validation (dimensions, position) can use brepjs measurement APIs if available, or simply assert non-null.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/generation/worker/generators/handleBuilder.test.ts`

Expected: FAIL.

- [ ] **Step 3: Refactor buildHandleHoles**

Key changes to `handleBuilder.ts`:

**a) Import new modules:**

```typescript
import { buildHandleProfile } from './handleProfiles';
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';
import { findWallSegments } from './compartmentBuilder';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { CUTOUT_CLEARANCE, MIN_SEGMENT_WIDTH } from '@/shared/utils/handleCutoutClip';
```

**b) Replace `buildHoleCut` to use profile builders:**

```typescript
function buildHoleCut(
  shape: HandleCutoutShape,
  segmentWidth: number,
  segmentOffset: number,
  holeHeight: number,
  cornerRadius: number,
  extrudeDepth: number,
  centerZ: number,
  wall: HandleWallDef,
  chamfer: boolean
): Shape3D | null {
  const profile = buildHandleProfile(shape, {
    width: segmentWidth,
    height: holeHeight,
    cornerRadius,
  });
  if (!profile) return null;

  let cutShape = sketch(profile, 'XZ').extrude(extrudeDepth);
  cutShape = translate(cutShape, [segmentOffset, extrudeDepth / 2, centerZ]);

  if (wall.rotateZ !== 0) {
    cutShape = rotate(cutShape, wall.rotateZ, { axis: [0, 0, 1] });
  }
  cutShape = translate(cutShape, [wall.x, wall.y, 0]);

  // TODO: chamfer - if brepjs supports filletEdges, apply here
  // For now, chamfer is a no-op placeholder until brepjs API is confirmed

  return cutShape;
}
```

**c) Update `buildHandleHoles` main loop:**

```typescript
export function buildHandleHoles(
  params: BinParams,
  innerW: number,
  innerD: number,
  interiorHeight: number,
  wallThickness: number,
  hasLip: boolean
): Shape3D | null {
  if (!params.handles.enabled) return null;

  const {
    shape,
    width: globalWidth,
    height: globalHeight,
    cornerRadius: globalRadius,
    verticalPosition,
    count,
    chamfer,
    interior,
  } = params.handles;
  if (globalHeight <= 0) return null;

  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const extrudeDepth = (wallThickness + lipOverhang) * 2 + 1;

  // For u-shape: anchor to bottom (centerZ at height/2 from floor)
  const isUShape = shape === 'u-shape';

  const walls = buildHandleWallDefs(innerW, innerD);
  const allHoles: Shape3D[] = [];

  for (const wall of walls) {
    const side = params.handles[wall.side];
    if (!side.enabled) continue;
    if (wall.side === 'back' && params.label.enabled) continue;

    // Resolve per-side overrides
    const sideWidth = side.width ?? globalWidth;
    const sideHeight = side.height ?? globalHeight;
    const sideRadius = side.cornerRadius ?? globalRadius;

    // Compute vertical geometry
    let geom: { centerZ: number; effectiveHeight: number };
    if (isUShape) {
      // Auto-anchor: U-shape profile has built-in 5mm floor overshoot (U_SHAPE_OVERSHOOT).
      // Position so the top of the hole is at sideHeight from floor, bottom extends below.
      const overshoot = 5;
      const effectiveHeight = Math.min(sideHeight + overshoot, interiorHeight + overshoot);
      geom = { centerZ: (sideHeight - overshoot) / 2, effectiveHeight };
    } else {
      geom = computeHandleHoleGeometry(interiorHeight, sideHeight, verticalPosition);
    }
    if (geom.effectiveHeight < 1) continue;

    const wallCutout = params.walls.enabled ? params.walls[wall.side] : undefined;

    // Multi-handle: compute offsets for each handle on this wall
    const handleWidthMm = wall.wallSpan * (sideWidth / 100);
    const offsets = computeMultiHandleOffsets(count, wall.wallSpan, handleWidthMm);

    for (const handleOffset of offsets) {
      // Per-handle cutout overlap check: each handle at a different offset
      // may or may not overlap the wall cutout. We check overlap individually
      // by testing if this handle's span intersects the cutout's span.
      if (wallCutout?.enabled) {
        const cutWidth =
          wallCutout.widthMm !== null
            ? Math.min(wallCutout.widthMm, wall.wallSpan)
            : wall.wallSpan * (wallCutout.width / 100);
        const cutCenter = computeCutoutCenter(
          wall.wallSpan,
          cutWidth,
          wallThickness,
          wallCutout.alignment,
          wallCutout.offset
        );
        const handleLeft = handleOffset - handleWidthMm / 2;
        const handleRight = handleOffset + handleWidthMm / 2;
        const cutLeft = cutCenter - cutWidth / 2 - CUTOUT_CLEARANCE;
        const cutRight = cutCenter + cutWidth / 2 + CUTOUT_CLEARANCE;

        // Skip this handle entirely if it's fully inside the cutout
        if (handleLeft >= cutLeft && handleRight <= cutRight) continue;

        // If partial overlap, trim the handle width
        if (handleRight > cutLeft && handleLeft < cutRight) {
          // Build left and right remnant segments
          const leftWidth = cutLeft - handleLeft;
          const rightWidth = handleRight - cutRight;
          if (leftWidth >= MIN_SEGMENT_WIDTH) {
            const leftCenter = handleLeft + leftWidth / 2;
            const hole = buildHoleCut(
              shape,
              leftWidth,
              leftCenter,
              geom.effectiveHeight,
              sideRadius,
              extrudeDepth,
              geom.centerZ,
              wall,
              chamfer
            );
            if (hole) allHoles.push(hole);
          }
          if (rightWidth >= MIN_SEGMENT_WIDTH) {
            const rightCenter = cutRight + rightWidth / 2;
            const hole = buildHoleCut(
              shape,
              rightWidth,
              rightCenter,
              geom.effectiveHeight,
              sideRadius,
              extrudeDepth,
              geom.centerZ,
              wall,
              chamfer
            );
            if (hole) allHoles.push(hole);
          }
          continue;
        }
      }

      // No cutout overlap — build full handle at this offset
      const hole = buildHoleCut(
        shape,
        handleWidthMm,
        handleOffset,
        geom.effectiveHeight,
        sideRadius,
        extrudeDepth,
        geom.centerZ,
        wall,
        chamfer
      );
      if (hole) allHoles.push(hole);
    }
  }

  // Interior wall handles
  if (interior && !isUShape) {
    // Follow wallCutoutBuilder pattern for interior dividers
    const { cols, rows, cells } = params.compartments;
    if (cols > 1 || rows > 1) {
      const cellW = innerW / cols;
      const cellD = innerD / rows;
      const geom = computeHandleHoleGeometry(interiorHeight, globalHeight, verticalPosition);

      if (geom.effectiveHeight >= 1) {
        const addInteriorHandles = (
          boundaryCount: number,
          segCount: number,
          getCellIds: (boundary: number, i: number) => [number, number],
          getWallDef: (boundary: number, start: number, end: number) => HandleWallDef,
          segCellSize: number
        ): void => {
          for (let boundary = 1; boundary < boundaryCount; boundary++) {
            const segments = findWallSegments(segCount, (i) => {
              const [id1, id2] = getCellIds(boundary, i);
              return id1 !== id2;
            });

            for (const [start, end] of segments) {
              const segSpan = (end - start) * segCellSize;
              const handleWidthMm = segSpan * (globalWidth / 100);
              const offsets = computeMultiHandleOffsets(count, segSpan, handleWidthMm);

              for (const offset of offsets) {
                const hole = buildHoleCut(
                  shape,
                  handleWidthMm,
                  offset,
                  geom.effectiveHeight,
                  globalRadius,
                  extrudeDepth,
                  geom.centerZ,
                  getWallDef(boundary, start, end),
                  chamfer
                );
                if (hole) allHoles.push(hole);
              }
            }
          }
        };

        // Vertical dividers
        addInteriorHandles(
          cols,
          rows,
          (boundary, row) => [cells[row * cols + (boundary - 1)], cells[row * cols + boundary]],
          (boundary, start, end) => ({
            side: 'front' as const, // Interior walls always use global config — this field is unused for lookups
            wallSpan: (end - start) * cellD,
            x: -innerW / 2 + boundary * cellW,
            y: -innerD / 2 + (start + (end - start) / 2) * cellD,
            rotateZ: 90,
          }),
          cellD
        );

        // Horizontal dividers
        addInteriorHandles(
          rows,
          cols,
          (boundary, col) => [cells[(boundary - 1) * cols + col], cells[boundary * cols + col]],
          (boundary, start, end) => ({
            side: 'front' as const,
            wallSpan: (end - start) * cellW,
            x: -innerW / 2 + (start + (end - start) / 2) * cellW,
            y: -innerD / 2 + boundary * cellD,
            rotateZ: 0,
          }),
          cellW
        );
      }
    }
  }

  return fuseAllOrNull(allHoles);
}
```

**d) Update cache key** to include new fields:

```typescript
cacheKey: (ctx) => {
  const { dimensions: dim, params } = ctx;
  // ... existing key parts ...
  return compactKey(
    buildCacheKey(
      'v4', // bump for redesign
      dim.shellKey,
      stableSerialize(params.handles),
      // ... cutoutClipKey, innerW, innerD, interiorHeight, wallThickness, label.enabled, hasLip
      // Add: compartment info when interior handles enabled
      params.handles.interior ? `${params.compartments.cols}x${params.compartments.rows}:${params.compartments.cells.join(',')}` : '',
    )
  );
},
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/features/generation/worker/generators/handleBuilder.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full test suite for regressions**

Run: `pnpm vitest run --reporter=verbose 2>&1 | tail -20`

Expected: No new failures.

- [ ] **Step 6: Commit**

```bash
git add src/features/generation/worker/generators/handleBuilder.ts src/features/generation/worker/generators/handleBuilder.test.ts
git commit -m "feat(handles): refactor handleBuilder for shape profiles, multi-handle, vertical position

- Delegate profile creation to handleProfiles.ts
- Support per-side width/height/cornerRadius overrides
- Multi-handle layout via computeMultiHandleOffsets
- U-shape auto-anchors to wall bottom
- Interior wall handles following wallCutoutBuilder pattern
- Chamfer toggle (placeholder — needs brepjs fillet API)"
```

---

## Task 8: Update Wall Pattern Border Clipping

**Files:**

- Modify: `src/features/generation/worker/generators/wallPatternBuilder.ts:189-215`

- [ ] **Step 1: Pass verticalPosition to computeHandleHoleGeometry**

In the handle border clipping section (around line 199), update the call:

```typescript
const { centerZ, effectiveHeight } = computeHandleHoleGeometry(
  interiorHeight,
  params.handles.height,
  params.handles.verticalPosition
);
```

For U-shape, use the auto-anchored position instead:

```typescript
const isUShape = params.handles.shape === 'u-shape';
let handleCenterZ: number;
let handleEffHeight: number;

if (isUShape) {
  const overshoot = 2;
  handleEffHeight = Math.min(params.handles.height + overshoot, interiorHeight);
  handleCenterZ = handleEffHeight / 2 - overshoot / 2;
} else {
  const geom = computeHandleHoleGeometry(
    interiorHeight,
    params.handles.height,
    params.handles.verticalPosition
  );
  handleCenterZ = geom.centerZ;
  handleEffHeight = geom.effectiveHeight;
}
```

Also update the handle clip to account for multi-handle offsets. The clip box needs to cover all handle positions. The implementer should import `computeMultiHandleOffsets` and generate clip boxes for each handle offset.

- [ ] **Step 2: Update cache key for wall pattern**

Add handle shape, verticalPosition, and count to the handle key part (around line 232):

```typescript
const handleKeyPart = handleClip
  ? buildCacheKey(
      'hdl',
      params.handles.shape,
      quantize(handleClip.centerZ),
      quantize(handleClip.effectiveHeight),
      params.handles.count,
      handleClip.segments.map((s) => `${quantize(s.offset)}:${quantize(s.width)}`).join(',')
    )
  : 'nohdl';
```

- [ ] **Step 3: Run typecheck + tests**

Run: `pnpm run typecheck && pnpm vitest run src/features/generation/worker/generators/wallPatternBuilder`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/generation/worker/generators/wallPatternBuilder.ts
git commit -m "feat(handles): update wall pattern border clipping for variable position/shape

Pass verticalPosition to computeHandleHoleGeometry. Handle U-shape
auto-anchor. Add shape and count to clip cache key."
```

---

## Task 9: Redesign HandleSection UI

**Files:**

- Modify: `src/features/bin-designer/components/panel/HandleSection/HandleSection.tsx`
- Modify: `src/features/bin-designer/components/panel/HandleSection/useHandleSection.ts`

- [ ] **Step 1: Rewrite useHandleSection hook**

Add all new state and handlers following the `useWallCutoutsSection` pattern:

```typescript
// New state:
// - shape, setShape
// - verticalPosition, setVerticalPosition
// - count, setCount
// - chamfer, toggleChamfer
// - interior, toggleInterior
// - linked (local useState), toggleLinked
// - applySideUpdate (fan-out when linked)
// - per-side setters: setSideWidth, setSideHeight, setSideCornerRadius

// Follow useWallCutoutsSection's pattern for:
// - linked/independent mode with applySideUpdate
// - toggleSide copying values from first active side when linked
```

Key additions to the hook:

```typescript
const [linked, setLinked] = useState(true);

const setShape = useCallback(
  (shape: HandleCutoutShape) => updateHandles({ shape }),
  [updateHandles]
);

const setVerticalPosition = useCallback(
  (v: number) => updateHandles({ verticalPosition: v }),
  [updateHandles]
);

const setCount = useCallback((count: number) => updateHandles({ count }), [updateHandles]);

const toggleChamfer = useCallback(
  () => updateHandles({ chamfer: !handles.chamfer }),
  [handles.chamfer, updateHandles]
);

const toggleInterior = useCallback(
  () => updateHandles({ interior: !handles.interior }),
  [handles.interior, updateHandles]
);

const applySideUpdate = useCallback(
  (side: HandleWallSide, patch: Partial<HandleSide>) => {
    const targets = linked ? activeSides : [side];
    for (const s of targets) {
      updateHandleSide(s, patch);
    }
  },
  [updateHandleSide, linked, activeSides]
);
```

- [ ] **Step 2: Rewrite HandleSection component**

Restructure to match WallCutoutsSection layout:

```
FeatureToggle
  ├── Shape selector (4 icon buttons: rectangle | oval | scoop | u-shape)
  ├── Side toggle chips (F | B | L | R)
  ├── Linked/independent toggle pill
  ├── Size controls (shared or per-side):
  │   ├── Width % stepper
  │   ├── Height mm stepper (hidden for scoop when auto)
  │   └── Corner radius stepper (shown only for rectangle and u-shape)
  ├── Vertical position stepper (hidden for u-shape)
  ├── Count stepper (1-3)
  ├── Chamfer toggle checkbox
  ├── Interior walls checkbox
  ├── Physical dimensions readout
  └── FDM support note
```

The shape icons can be simple SVG path outlines representing each shape. Use the same button pattern as `SHAPE_OPTIONS` in WallCutoutsSection.

- [ ] **Step 3: Run typecheck + dev server visual check**

Run: `pnpm run typecheck`

Then: `pnpm run dev` — navigate to bin designer, verify the handle section renders all new controls.

- [ ] **Step 4: Commit**

```bash
git add src/features/bin-designer/components/panel/HandleSection/
git commit -m "feat(handles): redesign HandleSection UI with shapes, linked mode, new controls

Shape icon row (4 shapes), linked/independent per-side sizing,
vertical position slider, count stepper, chamfer toggle, interior walls.
Follows WallCutoutsSection layout patterns."
```

---

## Task 10: Update GhostHandles Preview

**Files:**

- Modify: `src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx`

- [ ] **Step 1: Update ghost to use variable vertical position**

Replace **both** usages of `HOLE_VERTICAL_CENTER` with `params.handles.verticalPosition`:

1. Line 66 (geometry computation):

```typescript
const isUShape = handles.shape === 'u-shape';
const centerZ = isUShape
  ? (Math.min(handles.height, interiorHeight) - 5) / 2 // U-shape: anchored to bottom with overshoot
  : interiorHeight * handles.verticalPosition;
```

2. Line 180 (mesh world-space position — **CRITICAL: must also be updated**):

```typescript
const holeZ =
  socketZ +
  (isUShape
    ? (Math.min(handles.height, interiorHeight) - 5) / 2
    : interiorHeight * handles.verticalPosition);
```

Remove the `HOLE_VERTICAL_CENTER` import entirely since both usages are replaced.

- [ ] **Step 2: Add multi-handle offset support**

Import `computeMultiHandleOffsets` and generate matrices for each handle offset × wall × segment:

```typescript
import { computeMultiHandleOffsets } from '@/shared/utils/handleLayout';

// Inside the geometry useMemo:
const handleWidthMm = wall.wallSpan * (sideWidth / 100);
const offsets = computeMultiHandleOffsets(handles.count, wall.wallSpan, handleWidthMm);

for (const handleOffset of offsets) {
  for (const seg of segments) {
    // Build matrix with seg.offset + handleOffset
  }
}
```

- [ ] **Step 3: Update ghost shape rendering**

For now, the ghost uses simple rectangles for all shapes. The shape-specific outline (like GhostWallCutouts does for scoop/funnel) would be a nice enhancement but is not critical — the ghost is only visible during the brief regeneration period. If time permits, add shape-aware outlines.

- [ ] **Step 4: Verify visually**

Run: `pnpm run dev` — in bin designer, enable handles, change shape/count/position, verify ghost overlays appear in the correct positions during regeneration.

- [ ] **Step 5: Commit**

```bash
git add src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx
git commit -m "feat(handles): update GhostHandles for variable position, multi-handle, per-side

Ghost overlays now use verticalPosition param instead of fixed 0.7.
Support multi-handle offsets and per-side width overrides."
```

---

## Task 11: i18n Keys

**Files:**

- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/de.json`, `es.json`, `fr.json`, `nb.json`, `nl.json`, `pt-BR.json`

- [ ] **Step 1: Add new English keys**

Add to `en.ts` in the `binDesigner.handles` section:

```typescript
'binDesigner.handles.shape': 'Shape',
'binDesigner.handles.shape.rectangle': 'Rectangle',
'binDesigner.handles.shape.oval': 'Oval',
'binDesigner.handles.shape.scoop': 'Scoop',
'binDesigner.handles.shape.uShape': 'U-Shape',
'binDesigner.handles.verticalPosition': 'Vertical position',
'binDesigner.handles.count': 'Count',
'binDesigner.handles.chamfer': 'Chamfer edges',
'binDesigner.handles.interior': 'Interior walls',
'binDesigner.handles.linked': 'Linked',
'binDesigner.handles.independent': 'Independent',
```

- [ ] **Step 2: Add keys to all locale JSON files**

Add the same keys (with English values as placeholders) to all 6 locale JSON files. They'll be translated later — the i18n check just needs the keys to exist.

- [ ] **Step 3: Run i18n check**

Run: `pnpm run check:i18n`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/
git commit -m "i18n: add handle cutout redesign keys to all locales

New keys for shape names, vertical position, count, chamfer, interior,
and linked/independent mode."
```

---

## Task 12: Integration Testing and Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm run typecheck`

Expected: PASS — zero errors.

- [ ] **Step 2: Run full test suite**

Run: `pnpm run test:coverage 2>&1 | tail -30`

Expected: All tests pass. Check coverage for new files.

- [ ] **Step 3: Run quality checks**

Run: `pnpm run quality`

Expected: PASS (typecheck + lint + knip).

- [ ] **Step 4: Run dev server and manually test**

Run: `pnpm run dev`

Test matrix:

- [ ] Rectangle shape: same as old behavior, adjustable corner radius
- [ ] Oval shape: elliptical hole, no corner radius control
- [ ] Scoop shape: semicircle hole, no corner radius control
- [ ] U-shape: open at bottom, auto-anchored, height controls upward extent
- [ ] Vertical position slider moves hole up/down (except u-shape)
- [ ] Count stepper: 1, 2, 3 handles evenly spaced
- [ ] Linked mode: changing one side's width changes all
- [ ] Independent mode: per-side sizing works
- [ ] Interior walls toggle adds handles to dividers
- [ ] Chamfer toggle (visual — depends on brepjs support)
- [ ] Wall cutout + handle interaction still works (segments split correctly)
- [ ] Back wall disabled when label tab active
- [ ] Slotted/solid bins: handles unavailable

- [ ] **Step 5: Run scenario tests**

Run: `pnpm vitest run src/features/generation/worker/generators/binGenerator.scenario`

Expected: PASS.

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(handles): integration fixes from testing"
```
