# Handle Honeycomb Border Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add solid border clipping around handle holes in honeycomb wall patterns so hex prisms don't overlap with handle cutouts.

**Architecture:** Mirror the existing cutout border clipping in `wallPatternBuilder.ts`. Extract shared handle height math into `handleCutoutClip.ts`. Build expanded rectangular clip solids for each handle segment and `cut()` them from the hex compound.

**Tech Stack:** brepjs (drawRectangle, cut, fuse, compound), Vitest scenario tests

**Spec:** `docs/superpowers/specs/2026-03-25-handle-honeycomb-border-design.md`

---

### Task 1: Extract `computeHandleHoleGeometry` into shared helper

**Files:**

- Modify: `src/shared/utils/handleCutoutClip.ts`
- Modify: `src/features/generation/worker/generators/handleBuilder.ts:87-94`
- Modify: `src/features/generation/worker/generators/handleBuilder.test.ts`

- [ ] **Step 1: Write test for the new helper**

In `src/shared/utils/handleCutoutClip.test.ts` (if it exists, add to it; otherwise check for colocated tests), add:

```ts
import { computeHandleHoleGeometry, HOLE_VERTICAL_CENTER } from './handleCutoutClip';

describe('computeHandleHoleGeometry', () => {
  it('computes centerZ at 70% of interior height', () => {
    const { centerZ } = computeHandleHoleGeometry(100, 20);
    expect(centerZ).toBe(100 * HOLE_VERTICAL_CENTER);
  });

  it('clamps height to available space around centerZ', () => {
    // interiorHeight=100, centerZ=70, margin=10
    // maxHalfHeight = min(70, 30) - 10 = 20
    // effectiveHeight = min(requestedHeight=50, 40) = 40
    const { effectiveHeight } = computeHandleHoleGeometry(100, 50);
    expect(effectiveHeight).toBe(40);
  });

  it('returns requested height when it fits', () => {
    const { effectiveHeight } = computeHandleHoleGeometry(100, 20);
    expect(effectiveHeight).toBe(20);
  });

  it('returns effectiveHeight below 1 for very short interior', () => {
    // interiorHeight=2, centerZ=1.4, margin=0.2
    // maxHalfHeight = max(0, min(1.4, 0.6) - 0.2) = 0.4
    // effectiveHeight = min(10, 0.8) = 0.8 → below the <1 guard
    const { effectiveHeight } = computeHandleHoleGeometry(2, 10);
    expect(effectiveHeight).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/utils/handleCutoutClip.test.ts -t "computeHandleHoleGeometry"`
Expected: FAIL — `computeHandleHoleGeometry is not a function`

- [ ] **Step 3: Implement `computeHandleHoleGeometry` in `handleCutoutClip.ts`**

Add after the existing constants (around line 42):

```ts
/**
 * Compute handle hole vertical center and clamped height.
 *
 * Shared between handleBuilder (hole geometry) and wallPatternBuilder
 * (border clipping) to prevent drift.
 */
export function computeHandleHoleGeometry(
  interiorHeight: number,
  requestedHeight: number
): { centerZ: number; effectiveHeight: number } {
  const centerZ = interiorHeight * HOLE_VERTICAL_CENTER;
  const margin = interiorHeight * 0.1;
  const maxHalfHeight = Math.max(0, Math.min(centerZ, interiorHeight - centerZ) - margin);
  const effectiveHeight = Math.min(requestedHeight, maxHalfHeight * 2);
  return { centerZ, effectiveHeight };
}
```

- [ ] **Step 4: Refactor `handleBuilder.ts` to use the shared helper**

Replace lines 87-93 in `buildHandleHoles()`:

```ts
// Before:
const centerZ = interiorHeight * HOLE_VERTICAL_CENTER;
const margin = interiorHeight * 0.1;
const maxHalfHeight = Math.max(0, Math.min(centerZ, interiorHeight - centerZ) - margin);
const effectiveHeight = Math.min(height, maxHalfHeight * 2);

// After:
const { centerZ, effectiveHeight } = computeHandleHoleGeometry(interiorHeight, height);
```

Update the import to include `computeHandleHoleGeometry`.

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `pnpm vitest run src/shared/utils/handleCutoutClip.test.ts src/features/generation/worker/generators/handleBuilder.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/utils/handleCutoutClip.ts src/shared/utils/handleCutoutClip.test.ts src/features/generation/worker/generators/handleBuilder.ts
git commit -m "refactor(handles): extract computeHandleHoleGeometry shared helper"
```

---

### Task 2: Add handle clip logic to `wallPatternBuilder.ts`

**Files:**

- Modify: `src/features/generation/worker/generators/wallPatternBuilder.ts`

- [ ] **Step 1: Add imports and `HandleClipParams` interface**

Add to imports:

```ts
import { drawRectangle, fuse, translate, rotate } from 'brepjs';
```

(Check which of these are already imported — `cut`, `clone`, `unwrap` are. Add `drawRectangle`, `fuse`, `translate`, `rotate` if missing.)

Also add:

```ts
import {
  computeWallHandleSegments,
  computeHandleHoleGeometry,
} from '@/shared/utils/handleCutoutClip';
import type { HandleSegment } from '@/shared/utils/handleCutoutClip';
import { CUTOUT_BORDER_WIDTH } from './wallPatterns';
```

Add interface after `CutoutClipParams`:

```ts
/** Pre-computed handle clipping parameters for a single wall. */
interface HandleClipParams {
  readonly segments: HandleSegment[];
  readonly effectiveHeight: number;
  readonly centerZ: number;
  readonly clipExtrudeDepth: number;
}
```

- [ ] **Step 2: Compute handle clip params in `buildWallPatterns()`**

Inside the `for (const wall of wallDescriptors)` loop, after the existing `clip` computation (around line 205), add:

```ts
// Handle border clipping
let handleClip: HandleClipParams | null = null;
if (
  params.handles.enabled &&
  !dim.isSlotted &&
  params.handles[wall.side]?.enabled &&
  !(wall.side === 'back' && params.label.enabled)
) {
  const { centerZ, effectiveHeight } = computeHandleHoleGeometry(
    interiorHeight,
    params.handles.height
  );
  if (effectiveHeight >= 1) {
    const cutoutCfg = params.walls.enabled ? params.walls[wall.side] : undefined;
    const segments = computeWallHandleSegments(
      wallSpan,
      params.handles.width,
      params.wallThickness,
      cutoutCfg
    );
    if (segments && segments.length > 0) {
      handleClip = { segments, effectiveHeight, centerZ, clipExtrudeDepth };
    }
  }
}
```

- [ ] **Step 3: Add handle params to cache key**

Update the `wallKey` computation. Bump `'v3'` to `'v4'`. Add handle key part:

```ts
const handleKeyPart = handleClip
  ? buildCacheKey(
      'hdl',
      quantize(handleClip.centerZ),
      quantize(handleClip.effectiveHeight),
      handleClip.segments.map((s) => `${quantize(s.offset)}:${quantize(s.width)}`).join(',')
    )
  : 'nohdl';
```

Then add `handleKeyPart` to the `buildCacheKey()` call for `wallKey`, and bump `'v3'` to `'v4'`:

```ts
const wallKey = compactKey(
  buildCacheKey(
    'v4', // bumped: handle border clipping added
    patternType,
    quantize(shapeRadius),
    quantize(cutDepth),
    wall.centers.length,
    quantize(c0.x),
    quantize(c0.y),
    quantize(wall.translateX),
    quantize(wall.translateY),
    quantize(wall.translateZ),
    wall.zRotation ?? 0,
    cutoutKeyPart,
    handleKeyPart
  )
);
```

- [ ] **Step 4: Pass `handleClip` to `buildWallPatternShape()`**

Update the call site:

```ts
const built = buildWallPatternShape(shapeTemplate, wall, halfDepth, clip, handleClip);
```

Update function signature:

```ts
function buildWallPatternShape(
  shapeTemplate: Shape3D,
  wall: WallPatternDescriptor,
  halfDepth: number,
  clip: CutoutClipParams | null,
  handleClip: HandleClipParams | null
): Shape3D | null {
```

- [ ] **Step 5: Implement handle clipping in `buildWallPatternShape()`**

After the existing cutout clip block (after line 297), before the final `return`, add handle clipping. The function currently returns `hexCompound` or `clipped` — restructure so the result flows through both clips:

```ts
// --- Handle border clipping ---
if (!handleClip || handleClip.segments.length === 0) {
  return result; // result = hexCompound after cutout clip (or raw)
}

const border = CUTOUT_BORDER_WIDTH;
const clipBoxes: Shape3D[] = [];

try {
  for (const seg of handleClip.segments) {
    const boxW = seg.width + 2 * border;
    const boxH = handleClip.effectiveHeight + 2 * border;
    const profile = drawRectangle(boxW, boxH);
    let box = sketch(profile, 'XZ').extrude(clipExtrudeDepth);
    box = translate(box, [seg.offset, clipExtrudeDepth / 2, handleClip.centerZ]);
    if (wall.zRotation !== undefined && wall.zRotation !== 0) {
      box = rotate(box, wall.zRotation, { axis: [0, 0, 1] });
    }
    box = translate(box, [wall.translateX, wall.translateY, 0]);
    clipBoxes.push(box);
  }

  let clipSolid: Shape3D;
  if (clipBoxes.length === 1) {
    clipSolid = clipBoxes[0];
  } else {
    clipSolid = unwrap(fuse(clipBoxes[0], clipBoxes[1]));
    clipBoxes[0].delete();
    clipBoxes[1].delete();
    // Handle 3+ segments (rare but possible)
    for (let i = 2; i < clipBoxes.length; i++) {
      const merged = unwrap(fuse(clipSolid, clipBoxes[i]));
      clipSolid.delete();
      clipBoxes[i].delete();
      clipSolid = merged;
    }
  }

  // Use try/finally for clipSolid cleanup (mirrors existing cutout clip pattern)
  try {
    const handleClipped = unwrap(cut(result, clipSolid));
    result.delete();
    return handleClipped;
  } catch (err: unknown) {
    if (isAbortError(err)) {
      result.delete();
      throw err;
    }
    return result;
  } finally {
    clipSolid.delete();
  }
} catch (err: unknown) {
  for (const box of clipBoxes) {
    try {
      box.delete();
    } catch {
      /* already cleaned */
    }
  }
  if (isAbortError(err)) {
    result.delete();
    throw err;
  }
  return result;
}
```

Note: `clipExtrudeDepth` is passed via `HandleClipParams` (defined in Step 1 with `clipExtrudeDepth` field, set in Step 2).

- [ ] **Step 6: Verify typecheck passes**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/features/generation/worker/generators/wallPatternBuilder.ts
git commit -m "feat(generation): add handle border clipping to honeycomb wall pattern"
```

---

### Task 3: Add scenario tests

**Files:**

- Modify: `src/features/generation/worker/generators/scenarios/combinedFeatures.ts`

- [ ] **Step 1: Add honeycomb + handles scenario**

Add to the `combinedFeatures` array:

```ts
  defineScenario('combined features', '2×2 honeycomb walls + handle holes', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { enabled: true },
        left: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
```

- [ ] **Step 2: Add honeycomb + handles + cutout scenario**

```ts
  defineScenario('combined features', '2×2 honeycomb walls + handles + wall cutouts', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 50 },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { enabled: true },
        right: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
```

- [ ] **Step 3: Add honeycomb + handles + label (back suppression) scenario**

```ts
  defineScenario('combined features', '2×2 honeycomb walls + handles + label (back skip)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { enabled: true },
        back: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
```

- [ ] **Step 4: Run scenario tests**

Run: `pnpm vitest run src/features/generation/worker/generators/binGenerator.scenario.test.ts -t "combined features"`
Expected: New scenarios PASS with structural validity assertions. Existing scenario snapshots may need updating if the snapshot file is checked.

- [ ] **Step 5: Update snapshots if needed**

Run: `pnpm vitest run src/features/generation/worker/generators/binGenerator.scenario.test.ts --update`
Expected: New snapshots added, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/generation/worker/generators/scenarios/combinedFeatures.ts src/features/generation/worker/generators/__snapshots__/
git commit -m "test(generation): add honeycomb + handles scenario tests"
```

---

### Task 4: Update READMEs and run full test suite

**Files:**

- Verify: `src/features/generation/README.md` (already updated in spec phase)
- Verify: `CLAUDE.md` (already updated in spec phase)

- [ ] **Step 1: Verify README updates are present**

Confirm `src/features/generation/README.md` Gotcha #5 mentions the wall pattern border rule. Confirm `CLAUDE.md` Critical Gotcha #5 mentions it too. These were added during the spec phase.

- [ ] **Step 2: Run full test suite**

Run: `pnpm run test:run`
Expected: All tests pass (9000+ tests)

- [ ] **Step 3: Run typecheck + lint**

Run: `pnpm run quality`
Expected: All pass

- [ ] **Step 4: Run scenario benchmarks to verify no major perf regression**

Run: `pnpm vitest bench src/features/generation/worker/generators/binGenerator.bench.ts`
Expected: No significant regression (honeycomb + handle combo may be slightly slower due to extra boolean, but core dimensions should be unchanged)

- [ ] **Step 5: Commit any remaining changes**

Only if there are uncommitted fixes from the verification step.
