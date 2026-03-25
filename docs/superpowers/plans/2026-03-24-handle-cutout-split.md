# Handle-Cutout Split Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix topology gaps when handles and wall cutouts overlap on the same wall by splitting handle geometry around the cutout region.

**Architecture:** When a wall has both a handle and a cutout enabled, compute the cutout's horizontal span on that wall using `computeCutoutCenter()`, then split the handle into one or two segments that flank the cutout. Segments narrower than 10mm are suppressed. The same split logic applies to both the generation builder (`handleBuilder.ts`) and the ghost preview (`GhostHandles.tsx`). A shared pure function `computeHandleSegments()` is extracted into a utility so both consumers stay in sync.

**Tech Stack:** TypeScript, brepjs (CSG), Three.js (preview), Vitest (tests)

---

## File Map

| File                                                                         | Action     | Responsibility                                                                                          |
| ---------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `src/shared/utils/handleCutoutClip.ts`                                       | **Create** | Pure function: given handle width/span and cutout span, returns array of `{offset, width}` segments     |
| `src/shared/utils/handleCutoutClip.test.ts`                                  | **Create** | Unit tests for the clipping logic                                                                       |
| `src/features/generation/worker/generators/handleBuilder.ts`                 | **Modify** | Use `computeHandleSegments()` to split handles per wall; update cache key to include wall cutout params |
| `src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx` | **Modify** | Use `computeHandleSegments()` to split ghost quads per wall                                             |
| `src/features/generation/worker/generators/scenarios/handles.ts`             | **Modify** | Add edge-case scenarios for cutout+handle combinations                                                  |

---

### Task 1: Create `computeHandleSegments()` utility with tests

**Files:**

- Create: `src/shared/utils/handleCutoutClip.ts`
- Create: `src/shared/utils/handleCutoutClip.test.ts`
- Reference: `src/shared/utils/wallCutoutPosition.ts` (for `computeCutoutCenter`)

This pure function computes handle segment ranges that avoid a cutout's horizontal span. Both the generation builder and ghost preview will call it.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/shared/utils/handleCutoutClip.test.ts
import { describe, it, expect } from 'vitest';
import { computeHandleSegments } from './handleCutoutClip';

describe('computeHandleSegments', () => {
  // wallSpan=80mm, handle centered at 70% width = 56mm
  // cutout centered, 50% width = 40mm
  it('splits handle into two segments around a centered cutout', () => {
    const segments = computeHandleSegments({
      wallSpan: 80,
      handleWidthPercent: 70,
      cutoutCenter: 0, // centered on wall
      cutoutWidth: 40,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle spans [-28, 28]. Cutout spans [-20, 20]. +1mm clearance -> [-21, 21].
    // Left segment: [-28, -21] = 7mm -> below 10mm min -> suppressed
    // Right segment: [21, 28] = 7mm -> below 10mm min -> suppressed
    expect(segments).toEqual([]);
  });

  it('returns full handle when no cutout overlaps', () => {
    const segments = computeHandleSegments({
      wallSpan: 80,
      handleWidthPercent: 70,
      cutoutCenter: 0,
      cutoutWidth: 0, // no cutout
      clearance: 1,
      minSegmentWidth: 10,
    });
    // No cutout -> full handle: offset=0, width=56
    expect(segments).toEqual([{ offset: 0, width: 56 }]);
  });

  it('splits into two usable segments with wide wall', () => {
    // wallSpan=120mm, handle 80% = 96mm, cutout center=0, width=30mm
    const segments = computeHandleSegments({
      wallSpan: 120,
      handleWidthPercent: 80,
      cutoutCenter: 0,
      cutoutWidth: 30,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle: [-48, 48]. Cutout: [-15, 15] + clearance -> [-16, 16].
    // Left: [-48, -16] = 32mm. Right: [16, 48] = 32mm.
    expect(segments).toHaveLength(2);
    expect(segments[0].width).toBeCloseTo(32);
    expect(segments[1].width).toBeCloseTo(32);
  });

  it('keeps one segment when cutout is left-aligned', () => {
    // wallSpan=80mm, handle 90% = 72mm, cutout left-aligned center=-25, width=20mm
    const segments = computeHandleSegments({
      wallSpan: 80,
      handleWidthPercent: 90,
      cutoutCenter: -25,
      cutoutWidth: 20,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle: [-36, 36]. Cutout: [-35, -15] + clearance -> [-36, -14].
    // Left: [-36, -36] = 0mm -> suppressed. Right: [-14, 36] = 50mm -> kept.
    expect(segments).toHaveLength(1);
    expect(segments[0].width).toBeCloseTo(50);
  });

  it('suppresses segments below minSegmentWidth', () => {
    const segments = computeHandleSegments({
      wallSpan: 80,
      handleWidthPercent: 70,
      cutoutCenter: -5,
      cutoutWidth: 50,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle: [-28, 28]. Cutout: [-30, 20] + cl -> [-31, 21].
    // Left: [-28, -31] = negative -> suppressed. Right: [21, 28] = 7mm -> suppressed.
    expect(segments).toEqual([]);
  });

  it('returns full handle when cutout does not overlap handle at all', () => {
    // Narrow handle, cutout way off to the side
    const segments = computeHandleSegments({
      wallSpan: 120,
      handleWidthPercent: 30,
      cutoutCenter: 50,
      cutoutWidth: 20,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle: [-18, 18]. Cutout: [40, 60]. No overlap -> full handle.
    expect(segments).toEqual([{ offset: 0, width: 36 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/shared/utils/handleCutoutClip.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `computeHandleSegments()`**

```typescript
// src/shared/utils/handleCutoutClip.ts

/** A handle segment: horizontal offset from wall center and width in mm. */
export interface HandleSegment {
  /** Horizontal center offset from wall center (mm). Negative = toward left. */
  readonly offset: number;
  /** Segment width (mm). */
  readonly width: number;
}

interface HandleSegmentInput {
  /** Full wall interior span in mm. */
  readonly wallSpan: number;
  /** Handle width as percentage of wallSpan (1-100). */
  readonly handleWidthPercent: number;
  /** Cutout horizontal center relative to wall center (mm). 0 = centered. */
  readonly cutoutCenter: number;
  /** Cutout width in mm. 0 means no cutout. */
  readonly cutoutWidth: number;
  /** Clearance gap between handle edge and cutout edge (mm). */
  readonly clearance: number;
  /** Minimum segment width to keep (mm). Segments below this are discarded. */
  readonly minSegmentWidth: number;
}

/**
 * Compute handle segments that avoid a wall cutout's horizontal span.
 *
 * Given a handle centered on the wall and a cutout with known center/width,
 * returns 0, 1, or 2 segments representing the remaining handle regions.
 *
 * Pure function — shared between generation builder and ghost preview.
 */
/** Clearance gap between handle edge and cutout edge (mm). */
export const CUTOUT_CLEARANCE = 1.0;
/** Minimum handle segment width to generate (mm). */
export const MIN_SEGMENT_WIDTH = 10.0;

/** Clearance gap between handle edge and cutout edge (mm). */
export const CUTOUT_CLEARANCE = 1.0;
/** Minimum handle segment width to generate (mm). */
export const MIN_SEGMENT_WIDTH = 10.0;

export function computeHandleSegments(input: HandleSegmentInput): HandleSegment[] {
  const { wallSpan, handleWidthPercent, cutoutCenter, cutoutWidth, clearance, minSegmentWidth } =
    input;

  const handleWidth = wallSpan * (handleWidthPercent / 100);
  if (handleWidth <= 0) return [];

  const handleLeft = -handleWidth / 2;
  const handleRight = handleWidth / 2;

  // No cutout or zero-width cutout -> return full handle
  if (cutoutWidth <= 0) {
    return [{ offset: 0, width: handleWidth }];
  }

  const cutLeft = cutoutCenter - cutoutWidth / 2 - clearance;
  const cutRight = cutoutCenter + cutoutWidth / 2 + clearance;

  // No overlap -> return full handle
  if (cutRight <= handleLeft || cutLeft >= handleRight) {
    return [{ offset: 0, width: handleWidth }];
  }

  const segments: HandleSegment[] = [];

  // Left segment: from handleLeft to cutLeft
  const leftWidth = cutLeft - handleLeft;
  if (leftWidth >= minSegmentWidth) {
    const leftCenter = handleLeft + leftWidth / 2;
    segments.push({ offset: leftCenter, width: leftWidth });
  }

  // Right segment: from cutRight to handleRight
  const rightWidth = handleRight - cutRight;
  if (rightWidth >= minSegmentWidth) {
    const rightCenter = cutRight + rightWidth / 2;
    segments.push({ offset: rightCenter, width: rightWidth });
  }

  return segments;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/shared/utils/handleCutoutClip.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/handleCutoutClip.ts src/shared/utils/handleCutoutClip.test.ts
git commit -m "feat(handles): add computeHandleSegments utility for cutout clipping"
```

---

### Task 2: Integrate clipping into `handleBuilder.ts`

**Files:**

- Modify: `src/features/generation/worker/generators/handleBuilder.ts`
- Reference: `src/shared/utils/wallCutoutPosition.ts` (for `computeCutoutCenter`)
- Reference: `src/shared/utils/handleCutoutClip.ts` (from Task 1)

The handle builder currently generates one full-width handle per wall. We modify the wall loop to detect cutout overlap and generate split segments instead.

- [ ] **Step 1: Add imports and helper to resolve cutout span per wall**

At the top of `handleBuilder.ts`, add:

```typescript
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { computeHandleSegments } from '@/shared/utils/handleCutoutClip';
import type { HandleSegment } from '@/shared/utils/handleCutoutClip';
```

- [ ] **Step 2: Extract single-handle-segment builder**

Refactor the inner body of the wall loop (lines 77-126) into a helper function `buildHandleSegment()` that accepts the segment offset and width instead of computing them from `params.handles.width`. This avoids duplicating the shelf+fillet construction code.

```typescript
import { CUTOUT_CLEARANCE, MIN_SEGMENT_WIDTH } from '@/shared/utils/handleCutoutClip';

function buildHandleSegment(
  segmentWidth: number,
  segmentOffset: number,
  effectiveDepth: number,
  effectiveFilletR: number,
  shelfThickness: number,
  interiorHeight: number,
  wall: WallDef
): Shape3D {
  // Shelf plate
  const shelfDrawing = draw([0, 0])
    .lineTo([segmentWidth, 0])
    .lineTo([segmentWidth, -effectiveDepth])
    .lineTo([0, -effectiveDepth])
    .close();
  const shelf = sketch(shelfDrawing, 'XY', 0).extrude(shelfThickness);

  // Fillet support
  const filletHeight = Math.min(effectiveFilletR, interiorHeight - shelfThickness);
  let solid: Shape3D;
  if (filletHeight > 0) {
    const filletProfile = buildFilletProfile(effectiveFilletR, filletHeight);
    const filletShape = sketch(filletProfile, 'YZ', 0).extrude(segmentWidth);
    solid = unwrap(fuse(shelf, filletShape));
  } else {
    solid = shelf;
  }

  // Center segment on wall at its offset position
  solid = translate(solid, [-segmentWidth / 2 + segmentOffset, 0, 0]);

  // Rotate to wall orientation
  if (wall.rotateZ !== 0) {
    solid = rotate(solid, wall.rotateZ, { axis: [0, 0, 1] });
  }

  // Position at wall, shelf top at interiorHeight
  solid = translate(solid, [wall.x, wall.y, interiorHeight - shelfThickness]);

  return solid;
}
```

- [ ] **Step 3: Modify the wall loop to use segments**

Replace the single-handle-per-wall logic with segment iteration:

```typescript
for (const wall of walls) {
  if (!params.handles[wall.side].enabled) continue;
  if (wall.side === 'back' && params.label.enabled) continue;

  const effectiveDepth = Math.min(depth, wall.depthSpan / 2 - wallThickness);
  if (effectiveDepth <= 0) continue;
  const effectiveFilletR = Math.min(filletRadius, effectiveDepth * 0.7);

  // Compute segments (split around cutout if present on this wall)
  const wallCutout = params.walls.enabled ? params.walls[wall.side] : undefined;
  let segments: HandleSegment[];

  if (wallCutout?.enabled) {
    const cutWidth =
      wallCutout.widthMm !== null
        ? Math.min(wallCutout.widthMm, wall.wallSpan)
        : wall.wallSpan * (wallCutout.width / 100);
    const cutCenter = computeCutoutCenter(
      wall.wallSpan,
      cutWidth,
      params.wallThickness,
      wallCutout.alignment,
      wallCutout.offset
    );
    segments = computeHandleSegments({
      wallSpan: wall.wallSpan,
      handleWidthPercent: width,
      cutoutCenter: cutCenter,
      cutoutWidth: cutWidth,
      clearance: CUTOUT_CLEARANCE,
      minSegmentWidth: MIN_SEGMENT_WIDTH,
    });
  } else {
    segments = [{ offset: 0, width: wall.wallSpan * (width / 100) }];
  }

  for (const seg of segments) {
    if (seg.width <= 0) continue;
    allHandles.push(
      buildHandleSegment(
        seg.width,
        seg.offset,
        effectiveDepth,
        effectiveFilletR,
        shelfThickness,
        interiorHeight,
        wall
      )
    );
  }
}
```

- [ ] **Step 4: Update the cache key**

In `handlesFeature.cacheKey`, add wall cutout params since they now affect handle geometry:

```typescript
cacheKey: (ctx) => {
  const { dimensions: dim, params } = ctx;
  // Only serialize per-side cutout fields that affect horizontal clipping
  // (enabled, width, widthMm, alignment, offset). Exclude shape/depth/interior
  // which don't affect handle splitting.
  const cutoutClipKey = params.walls.enabled
    ? (['front', 'back', 'left', 'right'] as const)
        .map((s) => {
          const c = params.walls[s];
          return c.enabled ? `${s}:${c.width},${c.widthMm},${c.alignment},${c.offset}` : '';
        })
        .join('|')
    : '';
  return compactKey(
    buildCacheKey(
      'v2', // bump version
      dim.shellKey,
      stableSerialize(params.handles),
      cutoutClipKey,
      quantize(dim.innerW),
      quantize(dim.innerD),
      quantize(dim.interiorHeight),
      quantize(params.wallThickness),
      params.label.enabled,
      dim.hasLip
    )
  );
},
```

- [ ] **Step 5: Run existing scenario tests**

Run: `pnpm vitest run src/features/generation/worker/generators/binGenerator.scenario`
Expected: All pass (including "handles with wall cutouts on same sides")

- [ ] **Step 6: Commit**

```bash
git add src/features/generation/worker/generators/handleBuilder.ts
git commit -m "fix(handles): split handles around wall cutouts to prevent topology gaps

Closes #1232"
```

---

### Task 3: Update ghost preview to match split logic

**Files:**

- Modify: `src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx`
- Reference: `src/shared/utils/handleCutoutClip.ts`
- Reference: `src/shared/utils/wallCutoutPosition.ts`

The ghost preview must mirror the builder's split logic so users see accurate handle previews.

- [ ] **Step 1: Add imports**

```typescript
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeHandleSegments,
  CUTOUT_CLEARANCE,
  MIN_SEGMENT_WIDTH,
} from '@/shared/utils/handleCutoutClip';
```

- [ ] **Step 2: Destructure `walls` from params (aliased) and rename local `walls` array**

Destructure `walls` from params with an alias to avoid colliding with the existing `walls` local variable (the `WallDef[]` array). Rename the local `walls` variable to `wallDefs`:

```typescript
// In the destructure (line 47):
const {
  width,
  depth,
  height,
  wallThickness,
  style,
  handles,
  label,
  base,
  walls: wallConfig,
} = params;

// Rename the local WallDef[] array (line 71) from `walls` to `wallDefs`:
const wallDefs: readonly WallDef[] = [
  // ... same content ...
];
```

- [ ] **Step 3: Replace single-quad-per-wall with segment loop**

Inside the `useMemo`, replace the single `handleWidth` calculation and matrix push with:

```typescript
for (const wall of wallDefs) {
  if (!handles[wall.side].enabled) continue;
  if (wall.side === 'back' && label.enabled) continue;

  const effectiveDepth = Math.min(handles.depth, wall.depthSpan / 2 - wallThickness);
  if (effectiveDepth <= 0) continue;

  // Compute segments (wallConfig = params.walls, aliased to avoid local name collision)
  const wallCutout = wallConfig.enabled ? wallConfig[wall.side] : undefined;
  let segments: { offset: number; width: number }[];

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
    segments = computeHandleSegments({
      wallSpan: wall.wallSpan,
      handleWidthPercent: handles.width,
      cutoutCenter: cutCenter,
      cutoutWidth: cutWidth,
      clearance: CUTOUT_CLEARANCE,
      minSegmentWidth: MIN_SEGMENT_WIDTH,
    });
  } else {
    const handleWidth = wall.wallSpan * (handles.width / 100);
    if (handleWidth <= 0) continue;
    segments = [{ offset: 0, width: handleWidth }];
  }

  for (const seg of segments) {
    const matrix = new THREE.Matrix4();
    const scaleMatrix = new THREE.Matrix4().makeScale(seg.width, effectiveDepth, 1);

    const localX = seg.offset;
    const localY = -effectiveDepth / 2;
    const angle = (wall.rotateZ * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const worldX = wall.x + localX * cos - localY * sin;
    const worldY = wall.y + localX * sin + localY * cos;

    const rotateMatrix = new THREE.Matrix4().makeRotationZ(angle);
    const translateMatrix = new THREE.Matrix4().makeTranslation(worldX, worldY, 0);

    matrix.multiplyMatrices(translateMatrix, rotateMatrix);
    matrix.multiply(scaleMatrix);
    matrices.push(matrix);
  }
}
```

- [ ] **Step 4: Update `useMemo` dependencies**

Add `walls` to the dependency array:

```typescript
}, [shouldShow, innerW, innerD, wallThickness, handles, label.enabled, wallConfig]);
```

- [ ] **Step 5: Commit**

```bash
git add src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx
git commit -m "fix(preview): ghost handles respect wall cutout clipping"
```

---

### Task 4: Add scenario tests for edge cases

**Files:**

- Modify: `src/features/generation/worker/generators/scenarios/handles.ts`

Add scenarios that cover the split behavior across all four walls and different cutout alignments.

- [ ] **Step 1: Add new scenario cases**

```typescript
defineScenario('handles', 'handles + cutouts on all four walls', {
  assert: 'structural',
  params: {
    width: 2,
    depth: 2,
    height: 5,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
      back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
      left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
      right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
    },
    handles: {
      ...DEFAULT_BIN_PARAMS.handles,
      enabled: true,
      front: { enabled: true },
      back: { enabled: true },
      left: { enabled: true },
      right: { enabled: true },
    },
  },
  timeout: 60_000,
}),

defineScenario('handles', 'handles + left-aligned cutout (asymmetric split)', {
  assert: 'structural',
  params: {
    width: 3,
    depth: 2,
    height: 5,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 30, depth: 50, alignment: 'left', offset: 0, widthMm: null },
    },
    handles: {
      ...DEFAULT_BIN_PARAMS.handles,
      enabled: true,
      width: 90,
      front: { enabled: true },
    },
  },
  timeout: 60_000,
}),

defineScenario('handles', 'handles + wide cutout suppresses all segments', {
  assert: 'structural',
  params: {
    width: 1,
    depth: 1,
    height: 3,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 90, depth: 50 },
    },
    handles: {
      ...DEFAULT_BIN_PARAMS.handles,
      enabled: true,
      front: { enabled: true },
    },
  },
  timeout: 60_000,
}),
```

- [ ] **Step 2: Run the scenario tests**

Run: `pnpm vitest run src/features/generation/worker/generators/binGenerator.scenario`
Expected: All pass (new scenarios generate valid structural meshes or empty handles)

- [ ] **Step 3: Commit**

```bash
git add src/features/generation/worker/generators/scenarios/handles.ts
git commit -m "test(handles): add scenarios for cutout-clipped handles"
```

---

### Task 5: File vertical handle feature request as separate issue

- [ ] **Step 1: Create GitHub issue**

```bash
gh issue create \
  --title "Feature: Vertical handle style (side-wall hole)" \
  --body "From #1232: add an alternate handle style where handles face vertical (flush hole in bin side) instead of horizontal ledges. This would play nicely with wall cutouts and have a slimmer profile." \
  --label "enhancement"
```

- [ ] **Step 2: Verify**

Run: `gh issue list --state open --limit 5`
Expected: New issue appears alongside #1232
