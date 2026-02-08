# Cutout Top Offset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `topOffset` property to cutouts, allowing users to control where the top surface of cutouts begins (creating recessed platforms below the bin rim).

**Architecture:** Add property to Cutout interface with default value 0 (backward compatible). Update generator Z-positioning logic, add UI slider with dynamic constraints, and add i18n strings for all 7 locales.

**Tech Stack:** TypeScript 5.9 (strict), React 19, Zustand + Immer, i18n (7 locales), brepjs 3D generation

---

## Task 1: Add topOffset to Cutout Type

**Files:**

- Modify: `src/features/bin-designer/types/index.ts:213-235`

**Step 1: Write failing test**

```typescript
// src/features/bin-designer/types/index.test.ts (create new file)
import { describe, it, expect } from 'vitest';
import type { Cutout } from './index';

describe('Cutout interface', () => {
  it('accepts topOffset property', () => {
    const cutout: Cutout = {
      id: 'test-1',
      shape: 'rectangle',
      x: 10,
      y: 10,
      width: 20,
      depth: 15,
      cutDepth: 5,
      topOffset: 3,
      rotation: 0,
      cornerRadius: 0,
    };
    expect(cutout.topOffset).toBe(3);
  });

  it('topOffset can be zero', () => {
    const cutout: Cutout = {
      id: 'test-1',
      shape: 'circle',
      x: 10,
      y: 10,
      width: 20,
      depth: 20,
      cutDepth: 5,
      topOffset: 0,
      rotation: 0,
      cornerRadius: 0,
    };
    expect(cutout.topOffset).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/bin-designer/types/index.test.ts`
Expected: FAIL with "Property 'topOffset' is missing"

**Step 3: Add topOffset property to Cutout interface**

```typescript
// src/features/bin-designer/types/index.ts (line ~213)
export interface Cutout {
  readonly id: string;
  readonly shape: CutoutShape;
  /** X position of left edge in mm from bin interior left edge */
  readonly x: number;
  /** Y position of bottom edge in mm from bin interior front edge */
  readonly y: number;
  /** Width in mm (or diameter for circle) */
  readonly width: number;
  /** Depth in mm (ignored for circle) */
  readonly depth: number;
  /** Cavity depth in mm (how deep the cut goes from top surface) */
  readonly cutDepth: number;
  /** Distance below rim where top surface begins in mm (0 = flush with rim) */
  readonly topOffset: number;
  /** Rotation in degrees (0-359) */
  readonly rotation: number;
  /** Corner radius for rectangle shape (mm) */
  readonly cornerRadius: number;
  /** Optional fillet radius at cavity bottom (mm) */
  readonly scoopRadius?: number;
  /** Optional group identifier for multi-cutout operations */
  readonly groupId?: string | null;
  /** When true, cutout cannot be selected or modified in the editor */
  readonly locked?: boolean;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/features/bin-designer/types/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/bin-designer/types/index.ts src/features/bin-designer/types/index.test.ts
git commit -m "feat(cutouts): add topOffset property to Cutout interface"
```

---

## Task 2: Update Generator Z-Positioning Logic

**Files:**

- Modify: `src/features/generation/worker/generators/binGenerator.ts:809-814` (ungrouped cutouts)
- Modify: `src/features/generation/worker/generators/binGenerator.ts:823-829` (grouped cutouts)
- Create test: `src/features/generation/worker/generators/binGenerator.scenario.cutout-offset.test.ts`

**Step 1: Write failing scenario test**

```typescript
// src/features/generation/worker/generators/binGenerator.scenario.cutout-offset.test.ts
import { describe, it, expect } from 'vitest';
import type { BinParams } from '@/features/bin-designer/types';
import { generateBin } from './binGenerator';
import { unwrap } from '@/core/result';

describe('binGenerator - cutout top offset scenarios', () => {
  const baseParams: BinParams = {
    width: 2,
    depth: 2,
    height: 5, // 35mm interior
    style: 'solid',
    wallThickness: 1,
    baseHeight: 7,
    cutouts: [],
    compartments: { cols: 1, rows: 1, cells: [0], thickness: 1.2 },
    dividers: { x: [], y: [], thickness: 1.2 },
  };

  it('positions cutout with zero offset flush with rim', async () => {
    const params: BinParams = {
      ...baseParams,
      cutouts: [
        {
          id: 'test-1',
          shape: 'rectangle',
          x: 10,
          y: 10,
          width: 20,
          depth: 15,
          cutDepth: 10,
          topOffset: 0, // flush
          rotation: 0,
          cornerRadius: 0,
        },
      ],
    };

    const result = await generateBin(params, 42, 7);
    expect(result).toBeDefined();
    // Generator should succeed - actual Z-position validation would require brepjs inspection
  });

  it('positions cutout with 5mm offset below rim', async () => {
    const params: BinParams = {
      ...baseParams,
      cutouts: [
        {
          id: 'test-2',
          shape: 'circle',
          x: 10,
          y: 10,
          width: 25,
          depth: 25,
          cutDepth: 10,
          topOffset: 5, // recessed platform
          rotation: 0,
          cornerRadius: 0,
        },
      ],
    };

    const result = await generateBin(params, 42, 7);
    expect(result).toBeDefined();
    // Top surface should be at wallHeight - 5, bottom at wallHeight - 5 - 10
  });

  it('handles maximum offset (near floor)', async () => {
    const params: BinParams = {
      ...baseParams,
      cutouts: [
        {
          id: 'test-3',
          shape: 'rectangle',
          x: 5,
          y: 5,
          width: 15,
          depth: 15,
          cutDepth: 0.5, // minimal depth
          topOffset: 34.5, // 35mm - 0.5mm
          rotation: 0,
          cornerRadius: 2,
        },
      ],
    };

    const result = await generateBin(params, 42, 7);
    expect(result).toBeDefined();
    // Should work even when platform is just above floor
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/generation/worker/generators/binGenerator.scenario.cutout-offset.test.ts`
Expected: FAIL - topOffset not read or used in generator

**Step 3: Update ungrouped cutout Z-positioning**

```typescript
// src/features/generation/worker/generators/binGenerator.ts (line ~809)
cutoutShapes.push(
  translate(shape, [
    originX + cutout.x + cutout.width / 2,
    originY + cutout.y + cutout.depth / 2,
    wallHeight - (cutout.topOffset ?? 0) - cutout.cutDepth,
  ])
);
```

**Step 4: Update grouped cutout Z-positioning**

```typescript
// src/features/generation/worker/generators/binGenerator.ts (line ~823)
memberShapes.push(
  translate(shape, [
    originX + cutout.x + cutout.width / 2,
    originY + cutout.y + cutout.depth / 2,
    wallHeight - (cutout.topOffset ?? 0) - cutout.cutDepth,
  ])
);
```

**Step 5: Update grouped cutout zBottom calculation**

```typescript
// src/features/generation/worker/generators/binGenerator.ts (line ~860)
const groupTopOffset = Math.max(...groupMembers.map((c) => c.topOffset ?? 0));
const zBottom = wallHeight - groupTopOffset - groupCutDepth;
```

**Step 6: Run tests to verify they pass**

Run: `npm run test:run -- src/features/generation/worker/generators/binGenerator.scenario.cutout-offset.test.ts`
Expected: PASS

**Step 7: Run all generator tests**

Run: `npm run test:run -- src/features/generation/worker/generators/binGenerator.scenario`
Expected: All existing scenario tests still pass

**Step 8: Commit**

```bash
git add src/features/generation/worker/generators/binGenerator.ts src/features/generation/worker/generators/binGenerator.scenario.cutout-offset.test.ts
git commit -m "feat(generator): apply topOffset in cutout Z-positioning"
```

---

## Task 3: Add topOffset Slider to UI

**Files:**

- Modify: `src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.tsx:79-88`
- Modify: `src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.test.tsx`

**Step 1: Write failing test**

```typescript
// Add to src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.test.tsx
it('renders topOffset slider between cutDepth and cornerRadius', () => {
  const cutout: Cutout = {
    id: 'test-1',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 15,
    cutDepth: 5,
    topOffset: 3,
    rotation: 0,
    cornerRadius: 2,
  };

  render(
    <CutoutPropertyPanel
      cutout={cutout}
      maxWidth={100}
      maxDepth={80}
      maxCutDepth={35}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onDuplicate={mockOnDuplicate}
    />
  );

  const labels = screen.getAllByRole('slider');
  const topOffsetLabel = screen.getByText(/top offset/i);
  expect(topOffsetLabel).toBeInTheDocument();
});

it('calls onUpdate when topOffset changes', () => {
  const cutout: Cutout = {
    id: 'test-1',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 15,
    cutDepth: 5,
    topOffset: 0,
    rotation: 0,
    cornerRadius: 0,
  };

  render(
    <CutoutPropertyPanel
      cutout={cutout}
      maxWidth={100}
      maxDepth={80}
      maxCutDepth={35}
      onUpdate={mockOnUpdate}
      onRemove={mockOnRemove}
      onDuplicate={mockOnDuplicate}
    />
  );

  const sliders = screen.getAllByRole('slider');
  const topOffsetSlider = sliders.find((s) =>
    s.getAttribute('aria-label')?.includes('Top Offset')
  );

  fireEvent.change(topOffsetSlider!, { target: { value: '5' } });
  expect(mockOnUpdate).toHaveBeenCalledWith('test-1', { topOffset: 5 });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.test.tsx`
Expected: FAIL - topOffset slider not rendered

**Step 3: Add topOffset slider to component**

```typescript
// src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.tsx
// Insert after cutDepth slider (after line 88), before cornerRadius slider

<SliderInput
  label={t('binDesigner.cutouts.topOffset')}
  value={cutout.topOffset ?? 0}
  onChange={(topOffset) => onUpdate(cutout.id, { topOffset })}
  min={0}
  max={maxCutDepth - 0.5}
  step={0.5}
  unit="mm"
  disabled={disabled}
/>
```

**Step 4: Update cutDepth slider max constraint**

```typescript
// src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.tsx (line ~84)
<SliderInput
  label={t('binDesigner.cutouts.cutDepth')}
  value={cutout.cutDepth}
  onChange={(cutDepth) => onUpdate(cutout.id, { cutDepth })}
  min={0.5}
  max={maxCutDepth - (cutout.topOffset ?? 0)}
  step={0.5}
  unit="mm"
  disabled={disabled}
/>
```

**Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.tsx src/features/bin-designer/components/panel/CutoutsSection/CutoutPropertyPanel.test.tsx
git commit -m "feat(ui): add topOffset slider to cutout property panel"
```

---

## Task 4: Add i18n Strings for All Locales

**Files:**

- Modify: `src/i18n/locales/en.ts` (add key ~line 1265)
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/nb.json`
- Modify: `src/i18n/locales/nl.json`
- Modify: `src/i18n/locales/pt-BR.json`

**Step 1: Verify current i18n structure**

Run: `npm run check:i18n`
Expected: All locales in sync (before adding new key)

**Step 2: Add key to English source**

```typescript
// src/i18n/locales/en.ts (add near line 1265, in binDesigner.cutouts section)
'binDesigner.cutouts.topOffset': 'Top Offset',
```

**Step 3: Add translations to all locale JSONs**

```json
// src/i18n/locales/de.json (in binDesigner.cutouts section, alphabetically)
"binDesigner.cutouts.topOffset": "Oberer Versatz"

// src/i18n/locales/es.json
"binDesigner.cutouts.topOffset": "Desplazamiento superior"

// src/i18n/locales/fr.json
"binDesigner.cutouts.topOffset": "Décalage supérieur"

// src/i18n/locales/nb.json
"binDesigner.cutouts.topOffset": "Toppsett"

// src/i18n/locales/nl.json
"binDesigner.cutouts.topOffset": "Bovenverschuiving"

// src/i18n/locales/pt-BR.json
"binDesigner.cutouts.topOffset": "Deslocamento superior"
```

**Step 4: Run i18n check to verify**

Run: `npm run check:i18n`
Expected: All locales in sync, new key present in all files

**Step 5: Commit**

```bash
git add src/i18n/locales/*.ts src/i18n/locales/*.json
git commit -m "feat(i18n): add topOffset label for all 7 locales"
```

---

## Task 5: Add topOffset to Cutout Creation

**Files:**

- Modify: `src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.ts:817-829`
- Modify: `src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.test.ts`

**Step 1: Write failing test**

```typescript
// Add to src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.test.ts
it('creates cutout with topOffset defaulting to 0', () => {
  const mockOnAdd = vi.fn();
  const { result } = renderHook(() =>
    useCutoutInteraction({
      cutouts: [],
      binWidth: 100,
      binDepth: 80,
      onAdd: mockOnAdd,
      onUpdate: vi.fn(),
      onUpdateBatch: vi.fn(),
      onRemove: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
    })
  );

  // Start drawing mode
  act(() => {
    result.current.startShape('rectangle', 10, 10);
  });

  // Move to create shape
  act(() => {
    result.current.handlePointerMove(30, 25);
  });

  // Finish drawing
  act(() => {
    result.current.handlePointerUp();
  });

  expect(mockOnAdd).toHaveBeenCalledWith(
    expect.objectContaining({
      shape: 'rectangle',
      topOffset: 0,
    })
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.test.ts`
Expected: FAIL - topOffset not included in created cutout

**Step 3: Add topOffset to cutout creation**

```typescript
// src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.ts (line ~817)
const newId = generateUUID();
onAdd({
  id: newId,
  shape: drawingPreview.shape,
  x: drawingPreview.x,
  y: drawingPreview.y,
  width: drawingPreview.width,
  depth: drawingPreview.depth,
  cutDepth: 5,
  topOffset: 0, // NEW: default to flush with rim
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.test.ts`
Expected: PASS

**Step 5: Update existing test fixtures**

Search for any test files that create Cutout objects and add `topOffset: 0`:

```bash
git grep -l "shape: 'rectangle'" src/features/bin-designer/store/designer.scenario.cutouts.test.ts
```

Update `createTestCutout` helper to include `topOffset: 0`.

**Step 6: Run all cutout-related tests**

Run: `npm run test:run -- src/features/bin-designer`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.ts src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.test.ts src/features/bin-designer/store/designer.scenario.cutouts.test.ts
git commit -m "feat(cutouts): initialize topOffset to 0 when creating shapes"
```

---

## Task 6: Full Integration Test

**Files:**

- Run all tests
- Manual UI verification

**Step 1: Run full test suite**

Run: `npm run test:coverage`
Expected: All tests pass, coverage maintained

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Manual UI verification**

1. Start dev server: `npm run dev`
2. Open bin designer, select "Cutout" interior mode
3. Click "Cut Editor" button
4. Draw a rectangle cutout
5. Verify new "Top Offset" slider appears between "Cut Depth" and "Corner Radius"
6. Set Top Offset to 5mm, Cut Depth to 10mm
7. Verify cutDepth slider max is reduced when topOffset > 0
8. Check 3D preview shows recessed platform (cavity starts 5mm below rim)
9. Test with circle shape
10. Test with grouped cutouts

**Step 4: Commit any missed test fixtures**

```bash
git add -u
git commit -m "test: update remaining cutout test fixtures with topOffset"
```

---

## Verification Checklist

- [ ] TypeScript compiles with no errors
- [ ] All tests pass (`npm run test:coverage`)
- [ ] i18n check passes (`npm run check:i18n`)
- [ ] Build succeeds (`npm run build`)
- [ ] UI renders topOffset slider in correct position
- [ ] Slider constraints work (cutDepth + topOffset ≤ wallHeight)
- [ ] 3D generator positions cutouts correctly with offset
- [ ] Default value (0) maintains backward compatibility
- [ ] All 7 locales have translation
- [ ] Manual testing in browser confirms recessed platform behavior

---

## Critical Notes

- **Backward compatibility**: Use `cutout.topOffset ?? 0` in all logic to handle existing cutouts without the property
- **Constraint relationship**: `topOffset + cutDepth ≤ wallHeight` must be enforced in UI (dynamic max values)
- **Z-position formula**: `wallHeight - topOffset - cutDepth` places the bottom of the cavity
- **Group handling**: Use `Math.max(...topOffsets)` for grouped cutouts (most recessed platform)
- **Test coverage**: Pre-commit hooks enforce coverage, ensure all new code paths are tested
