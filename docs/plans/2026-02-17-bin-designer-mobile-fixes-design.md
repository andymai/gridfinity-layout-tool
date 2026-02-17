# Bin Designer Mobile Fixes

## Problem

The bin designer UI has ~21 issues on mobile web spanning missing functionality, undersized touch targets, layout overflow, and UX inconsistencies.

## Decisions

- **Min supported width:** 360px
- **Touch targets:** 44px primary, 36px secondary
- **Landscape mobile:** Side-by-side layout (preview left, panel right)
- **CutoutWorkspace:** Info banner on mobile (desktop-only feature)
- **Export on mobile:** Icon-only header button
- **Panel scrolling:** Always-visible thin scrollbar
- **Confirm dialogs:** Replace `window.confirm()` with custom Dialog

## Changes

### Critical

1. **Export button missing on mobile** — Add icon-only export button in header, visible below `sm:` breakpoint
2. **CutoutWorkspace desktop-only** — Show info banner explaining desktop requirement when cutout editing is attempted on mobile/tablet
3. **Landscape mobile broken** — Detect `isLandscape && isMobile` and use side-by-side layout (preview left 50%, panel right 50%)

### Touch Targets

4. **FeatureToggle** — Increase switch from `h-5 w-9` to `h-7 w-12` on mobile; fix label alignment
5. **SnappingSlider ticks** — Increase from `text-[10px]` to `min-h-[36px]` clickable area
6. **SliderInput number inputs** — Add `min-h-[36px]` on mobile
7. **StepperControl** — Use `variant="mobile"` when `isMobile` (existing variant, just unwired)
8. **ToolSwitcher tabs** — Increase compact tab height to 44px
9. **TouchHint dismiss** — Increase from 12px to 36px button
10. **PreviewControls mobile buttons** — Increase from 36px to 44px `min-w`/`min-h`
11. **DesignActions menu items** — Increase `py-2` to `py-2.5` for ~44px height
12. **ExportDialog buttons** — Increase FormatSelector + NameStyleButton to 44px height

### Layout/Overflow

13. **Header overflow** — Reduce gap, adjust truncation for 360px
14. **ExportDialog** — Add `max-h-[80vh] overflow-y-auto`
15. **CartDialog estimates** — Add `flex-wrap`
16. **DesignListDialog header** — Compact buttons or allow wrapping
17. **PreviewControls + TouchHint overlap** — Z-index layering

### UX

18. **Panel scrollbar** — Force visible thin scrollbar on mobile
19. **window.confirm() → Dialog** — CartDialog clear + DesignListDialog new design
20. **CompartmentEditor cells** — Enforce `min-w-[28px] min-h-[28px]`
21. **Slider tick labels** — Increase from 10px to 12px text
