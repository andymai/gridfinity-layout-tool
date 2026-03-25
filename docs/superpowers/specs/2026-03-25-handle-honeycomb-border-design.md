# Handle Border in Honeycomb Wall Pattern

**Issue:** [#1240](https://github.com/andymai/gridfinity-layout-tool/issues/1240)
**Date:** 2026-03-25

## Problem

When handle holes and honeycomb wall patterns are both enabled, hex prisms overlap with the handle cutout regions, producing jagged edges. The wall pattern builder (`wallPatternBuilder.ts`) clips hexes around wall cutouts but has no awareness of handle holes.

## Approach

Mirror the existing cutout border clipping. For each wall with both a honeycomb pattern and an enabled handle, build expanded clipping solids around each handle segment and `cut()` them from the hex compound. Reuse `CUTOUT_BORDER_WIDTH` (1.5mm) for visual consistency.

## Files to Change

### `wallPatternBuilder.ts` (primary)

1. **Imports:** Add `buildHandleWallDefs`, `computeWallHandleSegments`, `HOLE_VERTICAL_CENTER` from `handleCutoutClip.ts`.

2. **New interface `HandleClipParams`** (parallel to `CutoutClipParams`):

   ```ts
   interface HandleClipParams {
     readonly segments: HandleSegment[];
     readonly effectiveHeight: number;
     readonly centerZ: number;
     readonly clipExtrudeDepth: number;
   }
   ```

3. **In `buildWallPatterns()`**, compute handle clip params per wall:
   - Skip if `!params.handles.enabled` or `!params.handles[wall.side].enabled`
   - Skip if `wall.side === 'back' && params.label.enabled` (matches handleBuilder)
   - Compute `centerZ`, `effectiveHeight` inline (same math as handleBuilder:88-93)
   - Compute segments via `computeWallHandleSegments()`
   - Pass `HandleClipParams` to `buildWallPatternShape()`

4. **In `buildWallPatternShape()`**, after existing cutout clip:
   - For each handle segment, build a box: `(segmentWidth + 2*CUTOUT_BORDER_WIDTH)` x `(effectiveHeight + 2*CUTOUT_BORDER_WIDTH)`
   - Position at segment's `offset` horizontally, `centerZ` vertically
   - Extrude through wall (same `clipExtrudeDepth`)
   - Rotate/translate to wall position
   - Fuse multiple segment clips into one solid, then single `cut()` from hex compound

5. **Cache key:** Add handle params (enabled per-side, width %, height) plus cutout info that affects splitting.

### `handleCutoutClip.ts` (minor)

Extract handle height calculation into a shared pure helper:

```ts
export function computeHandleHoleGeometry(
  interiorHeight: number,
  requestedHeight: number
): { centerZ: number; effectiveHeight: number };
```

This replaces the inline math in `handleBuilder.ts:88-93` and is called from both `handleBuilder.ts` and `wallPatternBuilder.ts`, preventing drift between hole geometry and clip geometry.

### `handleBuilder.ts` (minor)

Refactor to call `computeHandleHoleGeometry()` instead of inline math.

### No changes required

- `wallPatterns.ts` — reuse existing `CUTOUT_BORDER_WIDTH`

## Guards

- Skip handle clipping if `effectiveHeight < 1` (matches `handleBuilder.ts:94`) — avoids clipping around non-existent holes
- Skip back wall if `params.label.enabled` (matches `handleBuilder.ts:101`)

## Cache Key

Bump wall key prefix from `'v3'` to `'v4'` since handle params are added. Add: handle enabled per-side, width %, height.

## Memory Cleanup

Individual clip box shapes must be `.delete()`d after fusion. The fused clip solid must be `.delete()`d after `cut()`. Follow the same try/finally pattern as the existing cutout clip code (wallPatternBuilder.ts:284-296).

## Testing

- New scenario tests: honeycomb + handles, honeycomb + handles + cutout (both on same wall)
- Handle on back wall with label enabled (should skip clipping)
- Snapshot triangle counts (same pattern as existing scenarios)
- Verify structural validity via `assertStructurallyValid`

## Design Principle

Any feature that cuts through a wall must have corresponding border clipping in `wallPatternBuilder.ts`. This ensures clean edges wherever a wall pattern meets a subtracted feature. See README for the full rule.
