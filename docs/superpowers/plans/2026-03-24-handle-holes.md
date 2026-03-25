# Handle Holes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace interior handle ledges with through-hole handles — rounded rectangle cutouts in bin walls that serve as finger grips.

**Architecture:** Handle holes are boolean cuts (like wall cutouts) instead of fused shelves. A 2D rounded-rectangle profile is sketched on the XZ plane, extruded through the wall thickness, and positioned at 70% of wall height. The existing `computeHandleSegments()` utility splits holes around wall cutouts. The `HandleConfig` type replaces `depth`/`filletRadius` with `height`/`cornerRadius`. The feature flag is renamed from `handle_ledges` to `handle_holes`. The pipeline target changes from `fuse` to `cut`.

**Tech Stack:** TypeScript, brepjs (CSG), Three.js (preview), React, Zustand + Immer, Vitest

---

## File Map

| File                                                                                | Action      | Responsibility                                                                            |
| ----------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `src/features/bin-designer/types/index.ts`                                          | **Modify**  | Replace `HandleConfig` fields: remove `depth`/`filletRadius`, add `height`/`cornerRadius` |
| `src/features/bin-designer/constants/defaults.ts`                                   | **Modify**  | Update `DEFAULT_HANDLE_CONFIG` with new defaults                                          |
| `src/features/bin-designer/constants/gridfinity.ts`                                 | **Modify**  | Replace handle constraint constants                                                       |
| `src/core/labs/features.ts`                                                         | **Modify**  | Rename flag `handle_ledges` → `handle_holes`                                              |
| `src/features/bin-designer/components/panel/HandleSection/useHandleSection.ts`      | **Modify**  | Replace `setDepth`/`setFilletRadius` with `setHeight`/`setCornerRadius`, update summary   |
| `src/features/bin-designer/components/panel/HandleSection/HandleSection.tsx`        | **Modify**  | Replace depth/fillet steppers with height/cornerRadius steppers                           |
| `src/features/bin-designer/components/panel/WallsSection/WallsSection.tsx`          | **Modify**  | Update flag name reference                                                                |
| `src/features/generation/worker/generators/handleBuilder.ts`                        | **Rewrite** | Replace shelf+fillet fuse builder with rounded-rect cut builder, change target to `cut`   |
| `src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx`        | **Modify**  | Update flag name, replace quad planes with rounded-rect outlines on wall faces            |
| `src/shared/utils/handleCutoutClip.ts`                                              | **Keep**    | No changes — reused for hole clipping                                                     |
| `src/i18n/locales/en.ts`                                                            | **Modify**  | Update handle i18n keys (remove depth/fillet, add height/cornerRadius)                    |
| `src/i18n/locales/*.json`                                                           | **Modify**  | Update all 6 locale files with new keys                                                   |
| `src/features/generation/worker/generators/scenarios/handles.ts`                    | **Modify**  | Update all scenario params for new HandleConfig shape                                     |
| `src/shared/utils/handleCutoutClip.test.ts`                                         | **Keep**    | No changes needed                                                                         |
| `src/features/generation/worker/generators/handleBuilder.test.ts`                   | **Modify**  | Update test params: `depth`→`height`, `filletRadius`→`cornerRadius`, fn name change       |
| `src/features/bin-designer/components/panel/HandleSection/useHandleSection.test.ts` | **Modify**  | Update handler tests: `setDepth`→`setHeight`, `setFilletRadius`→`setCornerRadius`         |
| `src/features/bin-designer/constants/defaults.test.ts`                              | **Modify**  | Update migration assertions: `handles.depth`→`handles.height`                             |
| `src/features/bin-designer/components/preview/GhostHandles/GhostHandles.test.tsx`   | **Modify**  | Update flag mock: `handle_ledges`→`handle_holes`                                          |

---

### Task 1: Update types, defaults, and constraints

**Files:**

- Modify: `src/features/bin-designer/types/index.ts:131-145`
- Modify: `src/features/bin-designer/constants/defaults.ts:76-86`
- Modify: `src/features/bin-designer/constants/gridfinity.ts:78-87`

- [ ] **Step 1: Update `HandleConfig` type**

In `src/features/bin-designer/types/index.ts`, replace:

```typescript
/** Handle configuration for interior grip ledges */
export interface HandleConfig {
  /** Master toggle for the handles feature */
  readonly enabled: boolean;
  /** Ledge depth inward from wall face (mm). Default: 10 */
  readonly depth: number;
  /** Ledge width as % of wall interior span (1-100). Default: 70 */
  readonly width: number;
  /** Concave fillet radius under the shelf (mm). Default: 5 */
  readonly filletRadius: number;
  readonly front: HandleSide;
  readonly back: HandleSide;
  readonly left: HandleSide;
  readonly right: HandleSide;
}
```

With:

```typescript
/** Handle configuration for through-hole grip cutouts */
export interface HandleConfig {
  /** Master toggle for the handles feature */
  readonly enabled: boolean;
  /** Hole width as % of wall interior span (1-100). Default: 50 */
  readonly width: number;
  /** Hole height in mm (vertical extent). Default: 15 */
  readonly height: number;
  /** Corner radius in mm (0 = sharp rectangle, max = oval/circle). Default: 3 */
  readonly cornerRadius: number;
  readonly front: HandleSide;
  readonly back: HandleSide;
  readonly left: HandleSide;
  readonly right: HandleSide;
}
```

- [ ] **Step 2: Update `DEFAULT_HANDLE_CONFIG`**

In `src/features/bin-designer/constants/defaults.ts`, replace:

```typescript
const DEFAULT_HANDLE_CONFIG: HandleConfig = {
  enabled: false,
  depth: 10,
  width: 70,
  filletRadius: 5,
  front: { enabled: true },
  back: { enabled: false },
  left: { enabled: true },
  right: { enabled: true },
} as const;
```

With:

```typescript
const DEFAULT_HANDLE_CONFIG: HandleConfig = {
  enabled: false,
  width: 50,
  height: 15,
  cornerRadius: 3,
  front: { enabled: true },
  back: { enabled: false },
  left: { enabled: true },
  right: { enabled: true },
} as const;
```

- [ ] **Step 3: Update constraint constants**

In `src/features/bin-designer/constants/gridfinity.ts`, replace lines 78-87:

```typescript
  // Handle ledges
  MIN_HANDLE_DEPTH: 4, // mm
  MAX_HANDLE_DEPTH: 20, // mm
  HANDLE_DEPTH_STEP: 1, // mm
  MIN_HANDLE_WIDTH: 10, // % of wall span
  MAX_HANDLE_WIDTH: 100, // %
  HANDLE_WIDTH_STEP: 10, // %
  MIN_HANDLE_FILLET: 2, // mm
  MAX_HANDLE_FILLET: 10, // mm
  HANDLE_FILLET_STEP: 1, // mm
```

With:

```typescript
  // Handle holes
  MIN_HANDLE_WIDTH: 10, // % of wall span
  MAX_HANDLE_WIDTH: 100, // %
  HANDLE_WIDTH_STEP: 10, // %
  MIN_HANDLE_HEIGHT: 8, // mm (minimum finger clearance)
  MAX_HANDLE_HEIGHT: 30, // mm
  HANDLE_HEIGHT_STEP: 1, // mm
  MIN_HANDLE_CORNER_RADIUS: 0, // mm (sharp rectangle)
  MAX_HANDLE_CORNER_RADIUS: 10, // mm
  HANDLE_CORNER_RADIUS_STEP: 1, // mm
```

- [ ] **Step 4: Update migration in defaults.ts**

In `src/features/bin-designer/constants/defaults.ts`, find the handle migration block (~line 400-408) and update it to handle old configs that have `depth`/`filletRadius` but no `height`/`cornerRadius`:

```typescript
// Migrate handle config (v2: ledges → holes)
// Strip legacy ledge fields (depth, filletRadius) to prevent storage pollution
const rawHandles = (params.handles ?? {}) as Record<string, unknown>;
const { depth: _legacyDepth, filletRadius: _legacyFillet, ...cleanHandles } = rawHandles;
const handlesConfig: HandleConfig = {
  ...DEFAULT_HANDLE_CONFIG,
  ...(cleanHandles as Partial<HandleConfig>),
  front: { ...DEFAULT_HANDLE_CONFIG.front, ...((rawHandles.front as object) ?? {}) },
  back: { ...DEFAULT_HANDLE_CONFIG.back, ...((rawHandles.back as object) ?? {}) },
  left: { ...DEFAULT_HANDLE_CONFIG.left, ...((rawHandles.left as object) ?? {}) },
  right: { ...DEFAULT_HANDLE_CONFIG.right, ...((rawHandles.right as object) ?? {}) },
};
```

- [ ] **Step 5: Fix TypeScript errors from removed fields**

Run: `npx tsc --noEmit --pretty 2>&1 | head -50`

Fix any remaining references to `handles.depth`, `handles.filletRadius` in the codebase. These will appear in:

- `useHandleSection.ts` (Step 6 will fix)
- `HandleSection.tsx` (Step 6 will fix)
- `handleBuilder.ts` (Task 3 will fix)
- `GhostHandles.tsx` (Task 4 will fix)

For now, just verify the type/defaults compile. Other files will be fixed in subsequent tasks.

- [ ] **Step 6: Commit**

```bash
git add src/features/bin-designer/types/index.ts src/features/bin-designer/constants/defaults.ts src/features/bin-designer/constants/gridfinity.ts
git commit -m "refactor(handles): update HandleConfig type from ledge to hole parameters"
```

---

### Task 2: Update UI (HandleSection + hook + i18n + feature flag)

**Files:**

- Modify: `src/core/labs/features.ts:59-68`
- Modify: `src/features/bin-designer/components/panel/WallsSection/WallsSection.tsx:19,45`
- Modify: `src/features/bin-designer/components/panel/HandleSection/useHandleSection.ts`
- Modify: `src/features/bin-designer/components/panel/HandleSection/HandleSection.tsx`
- Modify: `src/i18n/locales/en.ts:1312-1324`
- Modify: `src/i18n/locales/*.json` (6 files)

- [ ] **Step 1: Rename feature flag**

In `src/core/labs/features.ts`, replace lines 59-68:

```typescript
  {
    id: 'handle_holes',
    name: 'Handle Holes',
    description:
      'Cut finger-grip holes through bin walls. Rounded rectangle cutouts make it easy to pull bins out of drawers.',
    status: 'experimental',
    risk: 'low',
    addedAt: '2026-03',
    requiresRefresh: false,
  },
```

- [ ] **Step 2: Update WallsSection flag reference**

In `src/features/bin-designer/components/panel/WallsSection/WallsSection.tsx`, change:

```typescript
const handleLedgesFlag = useFeatureFlag('handle_ledges');
```

To:

```typescript
const handleHolesFlag = useFeatureFlag('handle_holes');
```

And update the usage on line 45 from `handleLedgesFlag` to `handleHolesFlag`.

- [ ] **Step 3: Update useHandleSection hook**

Rewrite `src/features/bin-designer/components/panel/HandleSection/useHandleSection.ts`:

```typescript
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { GRIDFINITY } from '../../../constants';
import { useTranslation } from '@/i18n';
import { getFeatureStatus } from '@/shared/constraints';
import type { HandleWallSide } from '@/features/bin-designer/types';
import type { SectionMeta } from '../types';

export const HANDLE_SIDES: readonly HandleWallSide[] = ['front', 'back', 'left', 'right'];

export function useHandleSection() {
  const { handles, updateHandles, updateHandleSide, params, width, depth, wallThickness } =
    useDesignerStore(
      useShallow((s) => ({
        handles: s.params.handles,
        updateHandles: s.updateHandles,
        updateHandleSide: s.updateHandleSide,
        params: s.params,
        width: s.params.width,
        depth: s.params.depth,
        wallThickness: s.params.wallThickness,
      }))
    );
  const t = useTranslation();

  const featureStatus = getFeatureStatus(params, 'handles');
  const isUnavailable = !featureStatus.available;
  const isBackDisabled = params.label.enabled;

  const activeSides = useMemo(
    () =>
      HANDLE_SIDES.filter((side) => {
        if (side === 'back' && isBackDisabled) return false;
        return handles[side].enabled;
      }),
    [handles, isBackDisabled]
  );

  const toggleEnabled = useCallback(() => {
    updateHandles({ enabled: !handles.enabled });
  }, [handles.enabled, updateHandles]);

  const toggleSide = useCallback(
    (side: HandleWallSide) => {
      if (side === 'back' && isBackDisabled) return;
      updateHandleSide(side, { enabled: !handles[side].enabled });
    },
    [handles, updateHandleSide, isBackDisabled]
  );

  const setWidth = useCallback(
    (w: number) => {
      updateHandles({ width: w });
    },
    [updateHandles]
  );

  const setHeight = useCallback(
    (h: number) => {
      updateHandles({ height: h });
    },
    [updateHandles]
  );

  const setCornerRadius = useCallback(
    (r: number) => {
      updateHandles({ cornerRadius: r });
    },
    [updateHandles]
  );

  const handleWidthMm = useMemo(() => {
    const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
    const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
    const innerW = outerW - 2 * wallThickness;
    const innerD = outerD - 2 * wallThickness;
    const fbEnabled = handles.front.enabled || (handles.back.enabled && !isBackDisabled);
    const lrEnabled = handles.left.enabled || handles.right.enabled;
    const span = fbEnabled && lrEnabled ? Math.min(innerW, innerD) : lrEnabled ? innerD : innerW;
    return Math.round(span * (handles.width / 100) * 10) / 10;
  }, [width, depth, wallThickness, handles, isBackDisabled]);

  const summary = useMemo(() => {
    if (!handles.enabled || activeSides.length === 0) return undefined;
    const sideNames = activeSides.map((s) => t(`binDesigner.handles.${s}`)).join(', ');
    return t('binDesigner.handles.summary', {
      sides: sideNames,
      height: String(handles.height),
    });
  }, [handles, activeSides, t]);

  const disabledReason = featureStatus.reason ? t(featureStatus.reason) : undefined;

  const meta: SectionMeta = useMemo(
    () => ({
      summary: isUnavailable ? undefined : summary,
      disabledReason,
    }),
    [isUnavailable, summary, disabledReason]
  );

  return {
    state: { handles, isBackDisabled, handleWidthMm },
    handlers: { toggleEnabled, toggleSide, setWidth, setHeight, setCornerRadius },
    meta,
    t,
  };
}
```

- [ ] **Step 4: Update HandleSection component**

Rewrite `src/features/bin-designer/components/panel/HandleSection/HandleSection.tsx`:

```typescript
/**
 * Handle section: through-hole grip cutouts in bin walls.
 *
 * Controls: master toggle, side chip toggles (F/B/L/R),
 * width/height/corner-radius steppers.
 */

import { FeatureToggle } from '../FeatureToggle';
import { StepperControl } from '@/shared/components/StepperControl';
import { DESIGNER_CONSTRAINTS } from '../../../constants';
import { useHandleSection, HANDLE_SIDES } from './useHandleSection';

export function HandleSection() {
  const { state, handlers, meta, t } = useHandleSection();
  const { handles, isBackDisabled, handleWidthMm } = state;

  return (
    <FeatureToggle
      label={t('binDesigner.handles')}
      checked={handles.enabled}
      onChange={handlers.toggleEnabled}
      disabledReason={meta.disabledReason}
      valueSummary={meta.summary}
    >
      {/* Side toggle chips */}
      <div className="flex gap-1">
        {HANDLE_SIDES.map((side) => {
          const isActive = handles[side].enabled;
          const isDisabled = side === 'back' && isBackDisabled;
          return (
            <button
              key={side}
              type="button"
              role="switch"
              aria-checked={isActive}
              disabled={isDisabled}
              title={isDisabled ? t('binDesigner.handles.backDisabledByLabelTab') : undefined}
              onClick={() => handlers.toggleSide(side)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                isDisabled
                  ? 'border border-stroke-subtle bg-surface-secondary text-content-tertiary cursor-not-allowed opacity-50'
                  : isActive
                    ? 'bg-accent text-on-accent'
                    : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {t(`binDesigner.handles.${side}`)}
            </button>
          );
        })}
      </div>

      {/* Width + Height steppers side by side */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {/* eslint-disable-next-line i18next/no-literal-string -- unit suffix */}
            {t('binDesigner.handles.width')} {'(%)'}
          </span>
          <StepperControl
            value={handles.width}
            onChange={handlers.setWidth}
            onStep={(delta) =>
              handlers.setWidth(
                Math.min(
                  DESIGNER_CONSTRAINTS.MAX_HANDLE_WIDTH,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_HANDLE_WIDTH,
                    handles.width + delta * DESIGNER_CONSTRAINTS.HANDLE_WIDTH_STEP
                  )
                )
              )
            }
            min={DESIGNER_CONSTRAINTS.MIN_HANDLE_WIDTH}
            max={DESIGNER_CONSTRAINTS.MAX_HANDLE_WIDTH}
            step={DESIGNER_CONSTRAINTS.HANDLE_WIDTH_STEP}
            variant="desktop"
            ariaLabel="Handle width"
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {/* eslint-disable-next-line i18next/no-literal-string -- unit suffix */}
            {t('binDesigner.handles.height')} {'(mm)'}
          </span>
          <StepperControl
            value={handles.height}
            onChange={handlers.setHeight}
            onStep={(delta) =>
              handlers.setHeight(
                Math.min(
                  DESIGNER_CONSTRAINTS.MAX_HANDLE_HEIGHT,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_HANDLE_HEIGHT,
                    handles.height + delta * DESIGNER_CONSTRAINTS.HANDLE_HEIGHT_STEP
                  )
                )
              )
            }
            min={DESIGNER_CONSTRAINTS.MIN_HANDLE_HEIGHT}
            max={DESIGNER_CONSTRAINTS.MAX_HANDLE_HEIGHT}
            step={DESIGNER_CONSTRAINTS.HANDLE_HEIGHT_STEP}
            variant="desktop"
            ariaLabel="Handle height"
          />
        </div>
      </div>

      {/* Physical dimensions */}
      <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
        <svg
          className="h-3.5 w-3.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2"
          />
        </svg>
        <span className="tabular-nums">
          {handleWidthMm} × {handles.height} mm
        </span>
      </div>

      {/* Corner radius stepper */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.handles.cornerRadius')}
          </span>
          <StepperControl
            value={handles.cornerRadius}
            onChange={handlers.setCornerRadius}
            onStep={(delta) =>
              handlers.setCornerRadius(
                Math.min(
                  DESIGNER_CONSTRAINTS.MAX_HANDLE_CORNER_RADIUS,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_HANDLE_CORNER_RADIUS,
                    handles.cornerRadius + delta * DESIGNER_CONSTRAINTS.HANDLE_CORNER_RADIUS_STEP
                  )
                )
              )
            }
            min={DESIGNER_CONSTRAINTS.MIN_HANDLE_CORNER_RADIUS}
            max={DESIGNER_CONSTRAINTS.MAX_HANDLE_CORNER_RADIUS}
            step={DESIGNER_CONSTRAINTS.HANDLE_CORNER_RADIUS_STEP}
            variant="desktop"
            ariaLabel="Handle corner radius"
          />
        </div>
      </div>
    </FeatureToggle>
  );
}
```

- [ ] **Step 5: Update i18n keys in en.ts**

Replace the handles block in `src/i18n/locales/en.ts` (lines 1312-1324):

```typescript
  'binDesigner.handles': 'Handles',
  'binDesigner.handles.enable': 'Enable handles',
  'binDesigner.handles.sides': 'Sides',
  'binDesigner.handles.front': 'Front',
  'binDesigner.handles.back': 'Back',
  'binDesigner.handles.left': 'Left',
  'binDesigner.handles.right': 'Right',
  'binDesigner.handles.width': 'Width',
  'binDesigner.handles.height': 'Height',
  'binDesigner.handles.cornerRadius': 'Corner radius',
  'binDesigner.handles.backDisabledByLabelTab': 'Back handle disabled — label tab active',
  'binDesigner.handles.summary': '{sides}: {height}mm tall',
  'binDesigner.handles.unavailableSlotted': 'Not available for slotted bins',
```

- [ ] **Step 6: Update all 6 locale JSON files**

Run `pnpm run check:i18n` to identify missing/extra keys, then update each locale file (`de.json`, `es.json`, `fr.json`, `nb.json`, `nl.json`, `pt-BR.json`):

- Remove: `binDesigner.handles.depth`, `binDesigner.handles.filletRadius`
- Add: `binDesigner.handles.height`, `binDesigner.handles.cornerRadius`
- Update: `binDesigner.handles.summary` interpolation (change `{depth}` → `{height}`)

- [ ] **Step 7: Commit**

```bash
git add src/core/labs/features.ts src/features/bin-designer/components/ src/i18n/
git commit -m "feat(handles): update UI for hole-style handles

Replace depth/fillet steppers with height/cornerRadius steppers.
Rename feature flag handle_ledges → handle_holes."
```

---

### Task 3: Rewrite handle builder (generation)

**Files:**

- Rewrite: `src/features/generation/worker/generators/handleBuilder.ts`

The builder changes from fusing shelf+fillet geometry to cutting rounded-rectangle holes through walls. The approach mirrors `buildSingleCutout()` in wallCutoutBuilder.ts: sketch a 2D profile on XZ, extrude through the wall, position at 70% wall height.

- [ ] **Step 1: Rewrite handleBuilder.ts**

```typescript
/**
 * Handle hole builder for Gridfinity bins.
 *
 * Generates through-hole cutouts in bin walls as finger grips.
 * Each hole is a rounded rectangle (controlled by cornerRadius)
 * extruded through the full wall thickness, positioned at 70%
 * of the interior wall height.
 *
 * When a wall also has a cutout enabled, the hole is split into
 * segments that flank the cutout region via computeHandleSegments().
 */

import { drawRoundedRectangle, drawRectangle, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, HandleWallSide } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './compartmentBuilder';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeHandleSegments,
  CUTOUT_CLEARANCE,
  MIN_SEGMENT_WIDTH,
} from '@/shared/utils/handleCutoutClip';
import type { HandleSegment } from '@/shared/utils/handleCutoutClip';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';

/** Vertical center of hole as fraction of interior height (from floor). Shared with GhostHandles. */
export const HOLE_VERTICAL_CENTER = 0.7;

interface WallDef {
  readonly side: HandleWallSide;
  readonly wallSpan: number;
  readonly x: number;
  readonly y: number;
  readonly rotateZ: number;
}

/**
 * Build a single hole cut solid for one segment.
 *
 * Sketches a rounded rectangle on XZ (width × height), extrudes through
 * the wall, and positions at the correct wall location and Z height.
 */
function buildHoleCut(
  segmentWidth: number,
  segmentOffset: number,
  holeHeight: number,
  cornerRadius: number,
  extrudeDepth: number,
  centerZ: number,
  wall: WallDef
): Shape3D {
  // Clamp corner radius to half of smallest dimension
  const safeR = Math.min(cornerRadius, segmentWidth / 2 - 0.01, holeHeight / 2 - 0.01);

  // 2D profile: rounded rectangle (or plain if radius too small)
  const profile =
    safeR > 0.1
      ? drawRoundedRectangle(segmentWidth, holeHeight, safeR)
      : drawRectangle(segmentWidth, holeHeight);

  // Sketch on XZ plane, extrude along -Y (through wall)
  let shape = sketch(profile, 'XZ').extrude(extrudeDepth);

  // Center extrusion around Y=0 so it straddles the wall face
  shape = translate(shape, [segmentOffset, extrudeDepth / 2, centerZ]);

  // Rotate to wall orientation
  if (wall.rotateZ !== 0) {
    shape = rotate(shape, wall.rotateZ, { axis: [0, 0, 1] });
  }

  // Translate to wall position
  return translate(shape, [wall.x, wall.y, 0]);
}

/**
 * Build handle hole cuts for all enabled walls.
 *
 * @returns Fused cut geometry (all holes merged), or null if none enabled
 */
export function buildHandleHoles(
  params: BinParams,
  innerW: number,
  innerD: number,
  interiorHeight: number,
  wallThickness: number,
  hasLip: boolean
): Shape3D | null {
  if (!params.handles.enabled) return null;

  const { width, height, cornerRadius } = params.handles;
  if (height <= 0) return null;

  // Extrude depth: must fully penetrate the wall (+ lip overhang if present)
  const lipOverhang = hasLip ? LIP_TAPER_WIDTH : 0;
  const extrudeDepth = (wallThickness + lipOverhang) * 2 + 1;

  // Vertical center at 70% of interior height
  const centerZ = interiorHeight * HOLE_VERTICAL_CENTER;

  // Clamp hole height so it stays within wall bounds
  const maxHeight = interiorHeight * 0.8; // leave 10% margin top and bottom
  const effectiveHeight = Math.min(height, maxHeight);
  if (effectiveHeight < 1) return null;

  const walls: readonly WallDef[] = [
    { side: 'front', wallSpan: innerW, x: 0, y: -innerD / 2, rotateZ: 0 },
    { side: 'back', wallSpan: innerW, x: 0, y: innerD / 2, rotateZ: 0 },
    { side: 'left', wallSpan: innerD, x: -innerW / 2, y: 0, rotateZ: 90 },
    { side: 'right', wallSpan: innerD, x: innerW / 2, y: 0, rotateZ: 90 },
  ];

  const allHoles: Shape3D[] = [];

  for (const wall of walls) {
    if (!params.handles[wall.side].enabled) continue;

    // Back-wall suppression when label tabs are active
    if (wall.side === 'back' && params.label.enabled) continue;

    // Compute segments (split around wall cutout if present)
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
      const holeWidth = wall.wallSpan * (width / 100);
      if (holeWidth <= 0) continue;
      segments = [{ offset: 0, width: holeWidth }];
    }

    for (const seg of segments) {
      if (seg.width <= 0) continue;
      allHoles.push(
        buildHoleCut(
          seg.width,
          seg.offset,
          effectiveHeight,
          cornerRadius,
          extrudeDepth,
          centerZ,
          wall
        )
      );
    }
  }

  return fuseAllOrNull(allHoles);
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';

export const handlesFeature: FeatureBuilder = {
  name: 'handles',
  tag: FeatureTag.HANDLE,
  target: 'cut', // Changed from 'fuse' — holes are subtractive
  shouldBuild: (ctx) => ctx.params.handles.enabled && !ctx.dimensions.isSlotted,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    const cutoutClipKey = params.walls.enabled
      ? (['front', 'back', 'left', 'right'] as const)
          .map((s) => {
            const c = params.walls[s];
            return c.enabled ? `${s}:${c.width},${c.widthMm},${c.alignment},${c.offset}` : '';
          })
          .filter(Boolean)
          .join('|')
      : '';
    return compactKey(
      buildCacheKey(
        'v3', // bump: holes replace ledges
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
  build: (ctx) => {
    const result = buildHandleHoles(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.interiorHeight,
      ctx.params.wallThickness,
      ctx.dimensions.hasLip
    );
    return result ? [result] : null;
  },
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean (or only GhostHandles errors which Task 4 fixes)

- [ ] **Step 3: Commit**

```bash
git add src/features/generation/worker/generators/handleBuilder.ts
git commit -m "feat(handles): rewrite builder from ledge fuse to hole cut

Through-hole rounded rectangles at 70% wall height, extruded through
wall thickness. Pipeline target changed from fuse to cut."
```

---

### Task 4: Update ghost preview

**Files:**

- Modify: `src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx`

Replace the translucent quad planes (which represented shelf ledges) with thin rectangular outlines on the wall face, representing where the holes will be cut.

- [ ] **Step 1: Rewrite GhostHandles.tsx**

The key changes:

1. Flag name `handle_ledges` → `handle_holes`
2. Replace shelf plane geometry with hole rectangle planes on wall faces
3. Z position changes from shelf-top to 70% of interior height
4. Remove `shelfThickness` / `MIN_SHELF_THICKNESS` — no longer relevant
5. Keep segment clipping logic (with `wallConfig` alias)

The ghost now renders flat colored rectangles on each wall face where the holes will be cut. This gives the user a clear preview of hole placement during generation.

```typescript
/**
 * Renders ghost handle hole outlines in the 3D preview during mesh regeneration.
 *
 * Shows translucent cyan rectangles on wall faces where handle holes will be cut.
 * Position math mirrors handleBuilder.ts buildHandleHoles.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import type { HandleWallSide } from '@/features/bin-designer/types';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import {
  computeHandleSegments,
  CUTOUT_CLEARANCE,
  MIN_SEGMENT_WIDTH,
} from '@/shared/utils/handleCutoutClip';

const GHOST_COLOR = '#22d3ee';
const GHOST_OPACITY = 0.4;

import { HOLE_VERTICAL_CENTER } from '@/features/generation/worker/generators/handleBuilder';

interface WallDef {
  readonly side: HandleWallSide;
  readonly wallSpan: number;
  readonly x: number;
  readonly y: number;
  readonly rotateZ: number;
}

export function GhostHandles() {
  const { invalidate } = useThree();
  const flagEnabled = useFeatureFlag('handle_holes');

  const { params, generationStatus } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      generationStatus: s.generation.status,
    }))
  );

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

  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  const isFlat = base.style === 'flat';
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = isFlat ? totalH : totalH - GRIDFINITY.SOCKET_HEIGHT;
  const hasLip = base.stackingLip;
  const interiorHeight = computeInteriorHeight(wallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER);

  const shouldShow =
    flagEnabled &&
    handles.enabled &&
    style !== 'slotted' &&
    style !== 'solid' &&
    generationStatus === 'generating';

  const geometry = useMemo(() => {
    if (!shouldShow) return null;

    // Clamp hole height
    const maxHeight = interiorHeight * 0.8;
    const effectiveHeight = Math.min(handles.height, maxHeight);
    if (effectiveHeight < 1) return null;

    const centerZ = interiorHeight * HOLE_VERTICAL_CENTER;

    // Rotations must match handleBuilder.ts (cut pattern, not fuse pattern)
    const wallDefs: readonly WallDef[] = [
      { side: 'front', wallSpan: innerW, x: 0, y: -innerD / 2, rotateZ: 0 },
      { side: 'back', wallSpan: innerW, x: 0, y: innerD / 2, rotateZ: 0 },
      { side: 'left', wallSpan: innerD, x: -innerW / 2, y: 0, rotateZ: 90 },
      { side: 'right', wallSpan: innerD, x: innerW / 2, y: 0, rotateZ: 90 },
    ];

    const matrices: THREE.Matrix4[] = [];

    for (const wall of wallDefs) {
      if (!handles[wall.side].enabled) continue;
      if (wall.side === 'back' && label.enabled) continue;

      // Compute segments (split around cutout if present)
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
        const holeWidth = wall.wallSpan * (handles.width / 100);
        if (holeWidth <= 0) continue;
        segments = [{ offset: 0, width: holeWidth }];
      }

      for (const seg of segments) {
        // Scale a unit plane to segment width × hole height
        const matrix = new THREE.Matrix4();
        const scaleMatrix = new THREE.Matrix4().makeScale(seg.width, effectiveHeight, 1);

        // Position on wall face (plane is flat against wall, so Y=0 in local space)
        const localX = seg.offset;
        const localY = 0;
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

    if (matrices.length === 0) return null;

    // Merge all quads into a single BufferGeometry
    const plane = new THREE.PlaneGeometry(1, 1);
    const merged = new THREE.BufferGeometry();
    const allPositions: number[] = [];
    const allIndices: number[] = [];

    const basePositions = plane.getAttribute('position');
    const baseIndex = plane.getIndex();
    if (!baseIndex) {
      plane.dispose();
      return null;
    }

    for (let i = 0; i < matrices.length; i++) {
      const offset = i * basePositions.count;
      for (let v = 0; v < basePositions.count; v++) {
        const vec = new THREE.Vector3(
          basePositions.getX(v),
          basePositions.getY(v),
          basePositions.getZ(v)
        );
        vec.applyMatrix4(matrices[i]);
        allPositions.push(vec.x, vec.y, vec.z);
      }
      for (let j = 0; j < baseIndex.count; j++) {
        allIndices.push(baseIndex.array[j] + offset);
      }
    }

    plane.dispose();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
    merged.setIndex(allIndices);
    return merged;
  }, [shouldShow, innerW, innerD, wallThickness, handles, label.enabled, wallConfig, interiorHeight]);

  const material = useMemo(() => {
    if (!shouldShow) return null;
    return new THREE.MeshBasicMaterial({
      color: GHOST_COLOR,
      transparent: true,
      opacity: GHOST_OPACITY,
      side: THREE.DoubleSide,
      depthTest: true,
    });
  }, [shouldShow]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    if (geometry && material) invalidate();
  }, [geometry, material, invalidate]);

  if (!geometry || !material) return null;

  // Z: center of hole in world space
  const socketZ = isFlat ? 0 : GRIDFINITY.SOCKET_HEIGHT;
  const holeZ = socketZ + interiorHeight * HOLE_VERTICAL_CENTER;

  return <mesh geometry={geometry} material={material} position={[0, 0, holeZ]} renderOrder={2} />;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add src/features/bin-designer/components/preview/GhostHandles/GhostHandles.tsx
git commit -m "feat(preview): ghost handles show hole outlines on wall faces"
```

---

### Task 5: Update scenario tests

**Files:**

- Modify: `src/features/generation/worker/generators/scenarios/handles.ts`

All existing scenarios use the old `depth`/`filletRadius` fields which no longer exist on `HandleConfig`. Update them to use `height`/`cornerRadius`.

- [ ] **Step 1: Rewrite scenario file**

```typescript
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { defineScenario } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

export const handles: ScenarioCase[] = [
  defineScenario('handles', 'standard bin with front + side handle holes', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { enabled: true },
        left: { enabled: true },
        right: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes with label tabs (back suppression)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        back: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes with wall cutouts on same sides', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes + cutouts on all four walls', {
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
  defineScenario('handles', 'handle holes with sharp corners (radius=0)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        cornerRadius: 0,
        front: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes with max corner radius (oval)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        cornerRadius: 10,
        height: 20,
        width: 60,
        front: { enabled: true },
      },
    },
    timeout: 60_000,
  }),
  defineScenario('handles', 'handle holes + wide cutout suppresses all segments', {
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
];
```

- [ ] **Step 2: Run scenario tests**

Run: `npx vitest run --reporter=verbose src/features/generation/worker/generators/binGenerator.scenario.test.ts 2>&1 | tail -30`
Expected: All pass

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run src/shared/utils/handleCutoutClip.test.ts`
Expected: All 6 pass (unchanged)

- [ ] **Step 4: Run full quality checks**

Run: `pnpm run quality`
Expected: Clean

- [ ] **Step 5: Commit**

```bash
git add src/features/generation/worker/generators/scenarios/handles.ts
git commit -m "test(handles): update scenarios for hole-style handles"
```

---

### Task 6: Update test files and clean up stale references

**Files:**

- Modify: `src/features/generation/worker/generators/handleBuilder.test.ts`
- Modify: `src/features/bin-designer/components/panel/HandleSection/useHandleSection.test.ts`
- Modify: `src/features/bin-designer/constants/defaults.test.ts`
- Modify: `src/features/bin-designer/components/preview/GhostHandles/GhostHandles.test.tsx`

- [ ] **Step 1: Update handleBuilder.test.ts**

Replace all references to old fields:

- `buildHandles` → `buildHandleHoles`
- `depth: <number>` → `height: 15` (in handle params)
- `filletRadius: <number>` → `cornerRadius: 3` (in handle params)
- Remove any `MIN_SHELF_THICKNESS` references

- [ ] **Step 2: Update useHandleSection.test.ts**

Replace handler tests:

- `setDepth` → `setHeight`
- `setFilletRadius` → `setCornerRadius`
- `handles.depth` → `handles.height`
- `handles.filletRadius` → `handles.cornerRadius`

- [ ] **Step 3: Update defaults.test.ts**

Replace migration assertions:

- `result.handles.depth` → `result.handles.height`
- `result.handles.filletRadius` → `result.handles.cornerRadius`
- Verify legacy layouts with `depth`/`filletRadius` migrate cleanly to new defaults

- [ ] **Step 4: Update GhostHandles.test.tsx**

Replace flag mock: `'handle_ledges'` → `'handle_holes'`

- [ ] **Step 5: Search for any remaining stale references**

```bash
rg -l 'handle_ledges|handles\.depth|handles\.filletRadius|MIN_SHELF_THICKNESS|buildHandles\b' src/ --type ts --type tsx
```

Fix any remaining references.

- [ ] **Step 6: Check if filletProfile.ts is still used**

If `buildFilletProfile` was only used by the old handle builder, check for other consumers. If none, leave it (another feature may use it).

- [ ] **Step 7: Run full typecheck + lint + tests**

Run: `pnpm run quality && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: Clean

- [ ] **Step 8: Commit**

```bash
git add -u
git commit -m "test(handles): update test files for hole-style handles"
```
