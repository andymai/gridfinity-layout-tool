# Interior Panel Card-Based Redesign

**Date:** 2025-02-07
**Status:** Design Complete
**Context:** Redesigning the bin designer Interior panel to improve mode switching clarity and content organization

---

## Problem Statement

The current Interior panel has multiple UX issues:

**Mode Switching Problems:**

- Labels unclear ("Fixed" vs "Removable" vs "Cutout")
- No preview or context before selecting
- Visually cramped three-button layout

**Content Organization Problems:**

- Unnecessary collapsible wrapper after selecting mode
- Loss of context when switching modes
- Two-step interaction (click mode → expand section → interact)
- Weak summary text when collapsed

---

## Solution: Card-Based Selection

Replace the segmented button control with **three vertically-stacked cards**. Each card shows icon, title, description, and optional summary. Clicking a card expands it inline to show mode-specific controls.

---

## Design Details

### Overall Structure

Replace:

```
[Fixed | Removable | Cutout]  ← button row
<CollapsibleSection>           ← appears based on selection
  {mode-specific content}
</CollapsibleSection>
```

With:

```tsx
<div className="space-y-2">
  <InteriorModeCard mode="standard" />
  <InteriorModeCard mode="slotted" />
  <InteriorModeCard mode="solid" />
</div>
```

### Card States

**Collapsed (unselected):**

- Height: ~80px
- Border: `border-stroke-subtle`
- Background: `bg-surface-elevated`
- Hover: `hover:bg-surface-hover`
- Shows: icon, title, description, summary (if data exists)

**Expanded (selected):**

- Height: auto
- Border: `border-accent`
- Background: `bg-accent/5`
- Shows: header + full mode controls inline
- No separate CollapsibleSection wrapper

**Behavior:** Only one card expanded at a time. Clicking collapses current and expands clicked card.

### Card Content

| Mode         | Icon     | Title                | Description                               |
| ------------ | -------- | -------------------- | ----------------------------------------- |
| **standard** | Grid3x3  | "Grid Dividers"      | "Fixed compartments with permanent walls" |
| **slotted**  | Layers   | "Removable Dividers" | "Slots for insertable divider pieces"     |
| **solid**    | Scissors | "Custom Cutouts"     | "Tool-shaped recesses cut from the top"   |

### Visual Layout

**Collapsed Card:**

```tsx
<div className="rounded-lg border border-stroke-subtle bg-surface-elevated p-3 hover:bg-surface-hover transition-colors cursor-pointer">
  <div className="flex items-start gap-3">
    <div className="mt-0.5">
      {icon} {/* 20x20px, content-secondary color */}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-content-primary">{title}</h4>
        {summary && <span className="text-xs text-content-tertiary">{summary}</span>}
      </div>
      <p className="text-xs text-content-secondary mt-0.5">{description}</p>
    </div>
  </div>
</div>
```

**Expanded Card:**

Same header structure plus:

- Border → `border-accent`
- Background → `bg-accent/5`
- Divider below header
- Content area with mode-specific editor

```tsx
<div className="mt-3 pt-3 border-t border-stroke-subtle">
  {/* CompartmentEditor, SlotConfigurator, or Cutout button */}
</div>
```

---

## Interaction Behavior

### Click Interaction

1. Current expanded card collapses (content fades, height animates)
2. Clicked card expands (border/bg changes, content fades in, height animates)
3. Both animations simultaneous with 200ms ease transition
4. Store updates: `setParam('style', newMode)`

### Animation (CSS Only)

```tsx
<div
  className={`
    rounded-lg border p-3 cursor-pointer
    transition-all duration-200 ease-in-out
    ${
      isExpanded
        ? 'border-accent bg-accent/5'
        : 'border-stroke-subtle bg-surface-elevated hover:bg-surface-hover'
    }
  `}
>
  <CardHeader />

  {isExpanded && <div className="animate-fadeIn mt-3 pt-3 border-t">{content}</div>}
</div>
```

### Auto-Disable Side Effects

- When switching to `solid` mode, wall pattern automatically disables (already implemented)
- Silent auto-disable (no toast needed)

### Keyboard Navigation

- Cards are `<button>` elements
- Tab to navigate between cards
- Enter/Space to select

---

## Content Integration

### Existing Components (No Changes Needed)

**Standard Mode:**

- `<CompartmentEditor />` renders directly inside expanded card
- Grid visualization, row/col steppers, divider thickness slider

**Slotted Mode:**

- `<SlotConfigurator />` renders directly inside expanded card
- Direction toggles, pitch controls, divider piece settings

**Solid Mode:**

- Desktop: "Cut Editor" button that opens modal
- Content is simplest of the three modes

### Summary Text

Reuse existing summary logic from `useInteriorSection`:

```tsx
const summary = useMemo(
  () =>
    isSolid
      ? cutoutCount > 0
        ? t('binDesigner.cutouts.summary', { count: cutoutCount })
        : undefined
      : isSlotted
        ? t('binDesigner.slottedInteriorSummary')
        : t('binDesigner.interiorSummary', { count: compartmentCount }),
  [isSolid, isSlotted, compartmentCount, cutoutCount, t]
);
```

Display summary in collapsed card header (right side).

---

## Implementation Structure

### New Component

```
InteriorSection.tsx (refactored)
├── InteriorModeCard.tsx (new)
│   ├── Props: mode, isExpanded, onSelect, summary
│   └── Renders: header + conditional content
└── useInteriorSection.ts (minimal changes)
    └── Returns: current mode, summaries for all modes
```

### InteriorModeCard Component

```tsx
interface InteriorModeCardProps {
  mode: BinStyle;
  isExpanded: boolean;
  onSelect: () => void;
  summary?: string;
}

const MODE_CONFIG: Record<BinStyle, ModeConfig> = {
  standard: {
    icon: <Grid3x3 size={20} />,
    title: 'binDesigner.interior.standard.title',
    description: 'binDesigner.interior.standard.description',
    content: <CompartmentEditor />,
  },
  slotted: {
    icon: <Layers size={20} />,
    title: 'binDesigner.interior.slotted.title',
    description: 'binDesigner.interior.slotted.description',
    content: <SlotConfigurator />,
  },
  solid: {
    icon: <Scissors size={20} />,
    title: 'binDesigner.interior.solid.title',
    description: 'binDesigner.interior.solid.description',
    content: <CutoutEditorButton />,
  },
};
```

### Icons

Using Lucide React icons:

- `Grid3x3` for standard mode
- `Layers` for slotted mode
- `Scissors` for solid mode

All icons: 20x20px, `className="text-content-secondary"`

### i18n Keys to Add

**English (en.ts):**

```typescript
'binDesigner.interior.standard.title': 'Grid Dividers',
'binDesigner.interior.standard.description': 'Fixed compartments with permanent walls',
'binDesigner.interior.slotted.title': 'Removable Dividers',
'binDesigner.interior.slotted.description': 'Slots for insertable divider pieces',
'binDesigner.interior.solid.title': 'Custom Cutouts',
'binDesigner.interior.solid.description': 'Tool-shaped recesses cut from the top',
```

**Translations needed for all 6 locales:**

- de.json (German)
- es.json (Spanish)
- fr.json (French)
- nb.json (Norwegian)
- nl.json (Dutch)
- pt-BR.json (Portuguese Brazil)

---

## Edge Cases

### Initial Load

- Default to `standard` mode expanded
- Other two cards collapsed
- Matches current default behavior

### Empty States

- Standard: always show compartment count (minimum "1 compartment")
- Slotted: show generic "Removable dividers"
- Solid: only show count if cutouts exist, otherwise no summary

### Summary Display Rules

- Show summary only if mode has been configured or has default content
- Right-align in card header
- Text color: `text-content-tertiary`
- Font size: `text-xs`

---

## Migration Notes

### What Changes

- ❌ Remove: 3-button segmented control
- ❌ Remove: `CollapsibleSection` wrapper around mode content
- ✅ Add: `InteriorModeCard` component
- ✅ Modify: `InteriorSection.tsx` to render 3 cards

### What Stays the Same

- ✅ `useInteriorSection` hook logic (minimal changes)
- ✅ All three editor components unchanged
- ✅ Store interactions unchanged
- ✅ Summary text generation unchanged
- ✅ Auto-disable wall pattern behavior unchanged

---

## Testing Checklist

- [ ] Clicking each card expands it and collapses others
- [ ] Content renders correctly in all three modes
- [ ] Summary text appears when collapsed (when applicable)
- [ ] CSS transitions are smooth (200ms)
- [ ] Auto-disable wall pattern when switching to cutout mode
- [ ] Keyboard navigation works (Tab + Enter/Space)
- [ ] Hover states work on collapsed cards
- [ ] Icons render at correct size and color
- [ ] i18n strings display correctly in all locales
- [ ] No layout shifts during expand/collapse

---

## Benefits

### User Experience

- ✅ Clear mode labels with descriptions
- ✅ Visual preview (icons) before selecting
- ✅ All options always visible (context preserved)
- ✅ One-click interaction (no two-step flow)
- ✅ Better use of vertical space
- ✅ More scannable interface

### Implementation

- ✅ Reuses existing editor components
- ✅ Minimal store changes
- ✅ CSS-only animations (no dependencies)
- ✅ Clean component structure
- ✅ Easy to maintain and extend

---

## Future Enhancements (Out of Scope)

- Visual thumbnails/previews in card headers
- Animations when switching modes in 3D preview
- Keyboard shortcuts for mode switching (1/2/3)
- Mode recommendations based on bin size
