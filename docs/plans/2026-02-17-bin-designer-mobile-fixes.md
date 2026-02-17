# Bin Designer Mobile Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 21 mobile UI issues in the bin designer — missing functionality, undersized touch targets, layout overflow, and UX inconsistencies.

**Architecture:** All changes are CSS/layout adjustments and conditional mobile logic using the existing `useResponsive()` hook. No new stores, routes, or data model changes. The existing `ConfirmDialog` component replaces `window.confirm()`. The existing `StepperControl` `variant="mobile"` replaces hardcoded `variant="desktop"`.

**Tech Stack:** React 19, Tailwind CSS 4, existing design system (`Dialog`, `Button`, `StepperControl`), `useResponsive()` hook.

---

## Task 1: Add mobile export button in DesignerPage header

**Files:**

- Modify: `src/features/bin-designer/components/DesignerPage/DesignerPage.tsx`

**Step 1: Write the failing test**

Add to `DesignerPage.test.tsx` (or create if missing) a test that the export icon button renders on mobile:

```tsx
it('renders export icon button on mobile', () => {
  // Mock useResponsive to return isMobile: true, isDesktop: false
  // Render DesignerPage
  // Expect a button with aria-label matching export/download to be in the document
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/bin-designer/components/DesignerPage`
Expected: FAIL

**Step 3: Add mobile export icon button**

In the header, next to the existing mobile designs button (which uses pattern `sm:hidden`), add an export icon button:

```tsx
{
  /* Mobile export button - mirrors the sm:hidden pattern of the designs button */
}
<button
  className="btn btn-ghost btn-icon sm:hidden"
  onClick={() => setExportDialogOpen(true)}
  disabled={!canExport}
  aria-label={t('binDesigner.export')}
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
    />
  </svg>
</button>;
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/features/bin-designer/components/DesignerPage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/bin-designer/components/DesignerPage/
git commit -m "fix(bin-designer): add mobile export icon button in header"
```

---

## Task 2: Fix landscape mobile layout — use side-by-side

**Files:**

- Modify: `src/features/bin-designer/components/DesignerPage/DesignerPage.tsx`

**Step 1: Add `isLandscape` from `useResponsive()`**

Change the destructure:

```tsx
// Before:
const { isDesktop, isMobile } = useResponsive();
// After:
const { isDesktop, isMobile, isLandscape } = useResponsive();
```

**Step 2: Add landscape mobile layout branch**

In the main content area, the current logic is:

- `isDesktop && cutoutEditorOpen` → cutout layout
- `isDesktop` → side-by-side
- else → stacked (mobile/tablet)

Add a new branch for `!isDesktop && isLandscape`:

```tsx
{/* Landscape mobile/tablet: side-by-side like desktop but without cutout */}
{!isDesktop && isLandscape ? (
  <main className="flex flex-1 overflow-hidden">
    <div className="relative flex-1">
      <PreviewCanvas />
    </div>
    <div className="w-64 flex-shrink-0 overflow-hidden border-l border-stroke-subtle bg-surface-secondary">
      <ParameterPanel />
    </div>
  </main>
) : /* existing stacked layout for portrait mobile/tablet */ ...}
```

**Step 3: Test manually on mobile emulator in landscape**

Verify: Preview fills left side, parameter panel is 256px on the right, both are usable.

**Step 4: Commit**

```bash
git add src/features/bin-designer/components/DesignerPage/DesignerPage.tsx
git commit -m "fix(bin-designer): use side-by-side layout in landscape mobile/tablet"
```

---

## Task 3: Add cutout workspace info banner on mobile

**Files:**

- Modify: `src/features/bin-designer/components/DesignerPage/DesignerPage.tsx`
- Modify: `src/i18n/en.ts` (add i18n key)

**Step 1: Add i18n key**

In `src/i18n/en.ts`, add under `binDesigner`:

```ts
cutoutDesktopOnly: 'The cutout editor is available on desktop. Please switch to a wider screen to use this feature.',
```

**Step 2: Show banner when cutoutEditorOpen on non-desktop**

In the stacked layout branch (portrait mobile/tablet), add a dismissible info banner above the preview when `cutoutEditorOpen`:

```tsx
{
  !isDesktop && cutoutEditorOpen && (
    <div className="flex items-center gap-2 bg-info/10 px-4 py-2 text-xs text-info border-b border-info/20">
      <svg
        className="h-4 w-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{t('binDesigner.cutoutDesktopOnly')}</span>
    </div>
  );
}
```

**Step 3: Add to all locale JSON files**

Run `npm run check:i18n` and add the key to de, es, fr, nb, nl, pt-BR JSONs.

**Step 4: Commit**

```bash
git add src/features/bin-designer/components/DesignerPage/ src/i18n/
git commit -m "fix(bin-designer): show info banner for cutout editor on mobile"
```

---

## Task 4: Fix FeatureToggle touch targets and alignment

**Files:**

- Modify: `src/features/bin-designer/components/panel/FeatureToggle/FeatureToggle.tsx`

The current toggle switch is `h-5 w-9` (20x36px) with a `h-3.5 w-3.5` (14px) thumb. This is too small for touch and looks misaligned on mobile.

**Step 1: Write the failing test**

```tsx
it('renders toggle with adequate touch target size', () => {
  render(<FeatureToggle label="Test" checked={false} onChange={vi.fn()} />);
  const toggle = screen.getByRole('switch');
  // Check that the button has min-h-[44px] or appropriate sizing class
  expect(toggle.className).toMatch(/min-h-\[44px\]|h-7/);
});
```

**Step 2: Increase toggle size**

Change the toggle button classes:

```tsx
// Before:
className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ...`}
// After:
className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ...`}
```

Change thumb:

```tsx
// Before:
className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform`}
// After:
className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform`}
```

Update translate for active state:

```tsx
// Before: translate-x-5 (moves 20px — matches h-5 w-9 geometry)
// After: translate-x-6 (moves 24px — matches h-7 w-12 geometry: 48 - 20 - 4 = 24px)
```

Also increase the "Customize" link touch target:

```tsx
// Before:
className = 'text-[11px] font-medium text-accent ...';
// After:
className = 'text-xs font-medium text-accent py-2 -my-2 ...'; // invisible padding
```

**Step 3: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/panel/FeatureToggle`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/bin-designer/components/panel/FeatureToggle/
git commit -m "fix(bin-designer): increase FeatureToggle touch targets"
```

---

## Task 5: Use StepperControl variant="mobile" on mobile devices

**Files:**

- Modify: `src/features/bin-designer/components/panel/DimensionsSection/DimensionsSection.tsx`
- Modify: `src/features/bin-designer/components/CompartmentEditor/CompartmentEditor.tsx`

The `StepperControl` already has a `variant="mobile"` (48px h-12 buttons). Currently all bin designer usage hardcodes `variant="desktop"`.

**Step 1: In DimensionsSection, use responsive variant**

```tsx
// Add at top:
import { useResponsive } from '@/shared/hooks/useResponsive';

// In component:
const { isMobile } = useResponsive();
const stepperVariant = isMobile ? 'mobile' : 'desktop';

// Replace all variant="desktop" with variant={stepperVariant}
```

Also update the swap button to match height:

```tsx
// Before:
className="flex h-8 w-8 flex-shrink-0 items-center justify-center ..."
// After (responsive):
className={`flex ${isMobile ? 'h-12 w-12' : 'h-8 w-8'} flex-shrink-0 items-center justify-center ...`}
```

**Step 2: In CompartmentEditor, same pattern**

```tsx
const { isMobile } = useResponsive();
const stepperVariant = isMobile ? 'mobile' : 'desktop';
// Replace variant="desktop" with variant={stepperVariant}
```

**Step 3: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/panel/DimensionsSection src/features/bin-designer/components/CompartmentEditor`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/bin-designer/components/panel/DimensionsSection/ src/features/bin-designer/components/CompartmentEditor/
git commit -m "fix(bin-designer): use mobile StepperControl variant on mobile devices"
```

---

## Task 6: Fix ToolSwitcher compact tab touch targets

**Files:**

- Modify: `src/shared/components/ToolSwitcher/ToolSwitcher.tsx`

**Step 1: Increase compact segment padding for touch-friendly height**

The compact variant uses `px-2 py-0.5` (effective ~18px height). Change to ensure minimum 44px touch target:

```tsx
// Before:
const segmentPadding = compact ? 'px-2 py-0.5' : 'px-3 py-1';
// After:
const segmentPadding = compact ? 'px-2.5 py-2.5' : 'px-3 py-1';
```

This makes compact tabs ~44px tall (14px text + 20px padding).

**Step 2: Run tests**

Run: `npm run test:run -- src/shared/components/ToolSwitcher`
Expected: PASS

**Step 3: Commit**

```bash
git add src/shared/components/ToolSwitcher/
git commit -m "fix(tool-switcher): increase compact tab touch targets to 44px"
```

---

## Task 7: Fix TouchHint dismiss button size

**Files:**

- Modify: `src/features/bin-designer/components/PreviewCanvas/PreviewCanvas.tsx`

**Step 1: Increase dismiss button from 12px to 36px**

Find the TouchHint dismiss button and change:

```tsx
// Before:
<button onClick={dismiss} className="ml-1 rounded-full p-0.5 hover:bg-white/20" aria-label={...}>
  <svg className="h-3 w-3" ...>
// After:
<button onClick={dismiss} className="ml-1 flex items-center justify-center rounded-full p-2 hover:bg-white/20 min-w-[36px] min-h-[36px]" aria-label={...}>
  <svg className="h-3.5 w-3.5" ...>
```

**Step 2: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/PreviewCanvas`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/PreviewCanvas/
git commit -m "fix(bin-designer): increase TouchHint dismiss button touch target"
```

---

## Task 8: Fix PreviewControls mobile button sizes and z-index overlap

**Files:**

- Modify: `src/features/bin-designer/components/preview/PreviewControls/PreviewControls.tsx`

**Step 1: Increase mobile button min sizes from 36px to 44px**

Find all mobile button instances with `min-w-[36px] min-h-[36px]` and change to `min-w-[44px] min-h-[44px]`.

**Step 2: Add z-index to prevent overlap with TouchHint**

The mobile controls container:

```tsx
// Before:
className = 'absolute bottom-2 left-2 flex flex-col gap-1 md:hidden';
// After:
className = 'absolute bottom-2 left-2 z-30 flex flex-col gap-1 md:hidden';
```

The TouchHint is at `z-20`, so `z-30` ensures controls are always on top.

**Step 3: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/preview/PreviewControls`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/bin-designer/components/preview/PreviewControls/
git commit -m "fix(bin-designer): increase mobile preview controls to 44px and fix z-index"
```

---

## Task 9: Fix SnappingSlider tick label touch targets

**Files:**

- Modify: `src/features/bin-designer/components/controls/SnappingSlider/SnappingSlider.tsx`

**Step 1: Increase tick label buttons**

Find the tick label buttons (text-[10px]) and add minimum touch target:

```tsx
// Before:
className = 'absolute -translate-x-1/2 text-[10px] ...';
// After:
className = 'absolute -translate-x-1/2 text-[11px] min-h-[36px] flex items-end pb-0.5 ...';
```

Also increase the tick label container height:

```tsx
// Before:
className = 'relative mt-1 h-4';
// After:
className = 'relative mt-1 h-9';
```

**Step 2: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/controls/SnappingSlider`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/controls/SnappingSlider/
git commit -m "fix(bin-designer): increase SnappingSlider tick touch targets"
```

---

## Task 10: Fix SliderInput number input touch target

**Files:**

- Modify: `src/features/bin-designer/components/controls/SliderInput/SliderInput.tsx`

**Step 1: Increase number input height**

```tsx
// Before:
className =
  'w-14 rounded border border-stroke-subtle bg-surface px-1.5 py-0.5 text-right text-xs ...';
// After:
className =
  'w-16 rounded border border-stroke-subtle bg-surface px-1.5 py-1.5 text-right text-xs min-h-[36px] ...';
```

**Step 2: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/controls/SliderInput`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/controls/SliderInput/
git commit -m "fix(bin-designer): increase SliderInput number input touch target"
```

---

## Task 11: Fix DesignActions menu item touch targets

**Files:**

- Modify: `src/features/bin-designer/components/DesignActions/DesignActions.tsx`

**Step 1: Increase menu item padding**

Find menu item buttons with `py-2` and change:

```tsx
// Before:
className = 'w-full px-3 py-2 text-left text-sm ...';
// After:
className = 'w-full px-3 py-2.5 text-left text-sm ...';
```

This increases effective height from ~38px to ~44px.

**Step 2: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/DesignActions`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/DesignActions/
git commit -m "fix(bin-designer): increase DesignActions menu item touch targets"
```

---

## Task 12: Fix ExportDialog mobile issues (scroll, button sizes)

**Files:**

- Modify: `src/features/bin-designer/components/ExportDialog/ExportDialog.tsx`

**Step 1: Add max-height and scroll to dialog**

```tsx
// Before:
className = 'mx-4 w-full max-w-md rounded-xl bg-surface-elevated p-6 shadow-2xl';
// After:
className =
  'mx-4 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl bg-surface-elevated p-6 shadow-2xl';
```

**Step 2: Increase FormatSelector button height**

```tsx
// Before:
className = 'px-4 py-1.5 text-xs ...';
// After:
className = 'px-4 py-2.5 text-sm ...';
```

**Step 3: Increase NameStyleButton height**

```tsx
// Before:
className = 'px-3 py-1 text-xs ...';
// After:
className = 'px-3 py-2 text-xs ...';
```

**Step 4: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/ExportDialog`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/bin-designer/components/ExportDialog/
git commit -m "fix(bin-designer): fix ExportDialog scroll and button touch targets"
```

---

## Task 13: Fix header overflow on narrow screens

**Files:**

- Modify: `src/features/bin-designer/components/DesignerPage/DesignerPage.tsx`

**Step 1: Reduce header gap and improve truncation**

Find the header element and adjust:

```tsx
// Before:
className =
  'h-12 flex items-center justify-between px-4 bg-surface-secondary border-b border-stroke-subtle overflow-hidden';
// After:
className =
  'h-12 flex items-center justify-between px-2 sm:px-4 gap-1 sm:gap-2 bg-surface-secondary border-b border-stroke-subtle overflow-hidden';
```

Reduce design name max-width constraint if needed for 360px minimum.

**Step 2: Verify visually at 360px**

Use browser dev tools to verify no overflow at 360px width.

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/DesignerPage/
git commit -m "fix(bin-designer): fix header overflow on narrow mobile screens"
```

---

## Task 14: Fix CartDialog estimates row overflow

**Files:**

- Modify: `src/features/bin-designer/components/CartDialog/CartDialog.tsx`

**Step 1: Add flex-wrap to estimates row**

Find the estimates row (filament + time + cost) and add:

```tsx
// Before:
className = 'mb-3 flex gap-4 text-xs';
// After:
className = 'mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs';
```

**Step 2: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/CartDialog`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/CartDialog/
git commit -m "fix(bin-designer): fix CartDialog estimates row overflow on mobile"
```

---

## Task 15: Fix DesignListDialog header button overflow

**Files:**

- Modify: `src/features/bin-designer/components/DesignListDialog/DesignListDialog.tsx`

**Step 1: Allow header buttons to wrap on narrow screens**

Find the header button row and add flex-wrap:

```tsx
// Before:
className = 'flex items-center gap-2';
// After:
className = 'flex items-center gap-2 flex-wrap';
```

Or convert Import and New Design to icon-only buttons on mobile.

**Step 2: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/DesignListDialog`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/DesignListDialog/
git commit -m "fix(bin-designer): fix DesignListDialog header overflow on mobile"
```

---

## Task 16: Replace window.confirm() with ConfirmDialog

**Files:**

- Modify: `src/features/bin-designer/components/CartDialog/CartDialog.tsx`
- Modify: `src/features/bin-designer/components/DesignListDialog/DesignListDialog.tsx`

**Step 1: In CartDialog, replace window.confirm for cart clearing**

Add state:

```tsx
const [showClearConfirm, setShowClearConfirm] = useState(false);
```

Replace the clear handler:

```tsx
// Before:
const handleClear = () => {
  if (window.confirm('Clear all items from cart?')) {
    clearCart();
  }
};
// After:
const handleClear = () => setShowClearConfirm(true);
const handleConfirmClear = () => {
  clearCart();
  setShowClearConfirm(false);
};
```

Add `ConfirmDialog` at the end of the component:

```tsx
<ConfirmDialog
  isOpen={showClearConfirm}
  title={t('binDesigner.clearCart')}
  message={t('binDesigner.clearCartConfirm')}
  confirmText={t('common.clear')}
  destructive
  onConfirm={handleConfirmClear}
  onCancel={() => setShowClearConfirm(false)}
/>
```

**Step 2: In DesignListDialog, same pattern for new design**

Replace `window.confirm` with `ConfirmDialog` state.

**Step 3: Add i18n keys and run i18n check**

Run: `npm run check:i18n`

**Step 4: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/CartDialog src/features/bin-designer/components/DesignListDialog`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/bin-designer/components/CartDialog/ src/features/bin-designer/components/DesignListDialog/ src/i18n/
git commit -m "fix(bin-designer): replace window.confirm with ConfirmDialog"
```

---

## Task 17: Force visible scrollbar on mobile parameter panel

**Files:**

- Modify: `src/features/bin-designer/components/ParameterPanel/ParameterPanel.tsx`

**Step 1: Change scrollbar class**

```tsx
// Before:
className = 'flex-1 overflow-y-auto scrollbar-thin';
// After:
className = 'flex-1 overflow-y-auto scrollbar-thin [&]:overflow-y-scroll';
```

Or use Tailwind's `overflow-y-scroll` which always shows the scrollbar:

```tsx
className = 'flex-1 overflow-y-scroll scrollbar-thin';
```

**Step 2: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/ParameterPanel`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/ParameterPanel/
git commit -m "fix(bin-designer): force visible scrollbar on mobile parameter panel"
```

---

## Task 18: Enforce minimum CompartmentEditor grid cell size

**Files:**

- Modify: `src/features/bin-designer/components/CompartmentEditor/CompartmentEditor.tsx`

**Step 1: Add minimum cell size**

In the GridCell component, add minimum dimensions:

```tsx
// In the cell style or className:
className = 'relative touch-manipulation min-w-[28px] min-h-[28px]';
```

This ensures even large grids (e.g., 8x8) have tappable cells. The grid container's `max-w-[360px]` with `aspectRatio` will handle overflow by allowing horizontal scroll if needed.

**Step 2: Run tests**

Run: `npm run test:run -- src/features/bin-designer/components/CompartmentEditor`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/bin-designer/components/CompartmentEditor/
git commit -m "fix(bin-designer): enforce minimum grid cell size for touch targets"
```

---

## Task 19: Final integration test and typecheck

**Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 2: Run full test suite**

Run: `npm run test:coverage`
Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 4: Run i18n check**

Run: `npm run check:i18n`
Expected: PASS

**Step 5: Build**

Run: `npm run build`
Expected: PASS

**Step 6: Final commit if any fixups needed**

```bash
git add -A && git commit -m "fix(bin-designer): fixups from quality checks"
```
