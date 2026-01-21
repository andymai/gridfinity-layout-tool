# Template Gallery Design

Help new users overcome "blank canvas paralysis" with pre-built starter layouts.

## Overview

Add a template gallery with 3-4 curated layouts. Users discover templates via:
1. A "Templates" tab in the Layout Manager modal
2. A subtle hint below an empty grid

Applying a template creates a new layout in the user's library.

## Template Data Model

```typescript
// src/features/templates/types.ts
interface Template {
  id: string;                    // e.g., 'kitchen-utensils'
  name: string;                  // e.g., 'Kitchen Utensils'
  description: string;           // 1-2 sentence description
  category: 'household' | 'workshop' | 'office';
  layout: Layout;                // Full layout data
}
```

Templates bundled in app code as static data (offline, versioned with releases).

## Initial Templates

| ID | Name | Category | Drawer | Description |
|----|------|----------|--------|-------------|
| `kitchen-utensils` | Kitchen Utensils | household | 10×8 | Spatulas, spoons, and cooking tools |
| `tool-chest` | Tool Chest | workshop | 12×10 | Screwdrivers, pliers, and hand tools |
| `desk-drawer` | Desk Drawer | office | 8×6 | Pens, clips, and desk essentials |
| `junk-drawer` | Junk Drawer | household | 8×8 | Batteries, tape, scissors, misc items |

## Templates Tab

Add as 4th tab in Layout Manager:

```
[ My Layouts ] [ Shared ] [ Import ] [ Templates ]
```

Display as thumbnail grid (reuse existing `LayoutThumbnail` component):

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ thumbnail│  │ thumbnail│  │ thumbnail│  │ thumbnail│
├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤
│ Kitchen  │  │ Tool     │  │ Desk     │  │ Junk     │
│ Utensils │  │ Chest    │  │ Drawer   │  │ Drawer   │
│ 10×8     │  │ 12×10    │  │ 8×6      │  │ 8×8      │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

Clicking a template shows confirmation: "Create layout from Kitchen Utensils?" with Cancel/Create buttons. On confirm, creates new layout and switches to it.

## Empty Grid Hint

Subtle text link below grid when layout has zero bins:

```
        Need inspiration? Browse templates →
```

- Clicking opens Layout Manager with Templates tab selected
- Disappears when user places first bin
- No dismiss button needed (unobtrusive)
- Works on desktop, tablet, and mobile

## File Structure

```
src/features/templates/
├── index.ts                  # Barrel export
├── types.ts                  # Template interface
├── data/
│   └── templates.ts          # All template definitions
└── components/
    ├── TemplatesTab.tsx      # Tab content with grid and confirmation
    └── EmptyGridHint.tsx     # Hint for empty grid
```

## Modified Files

| File | Change |
|------|--------|
| `LayoutManagerModal/index.tsx` | Add Templates tab |
| `features/grid-editor/components/Grid/index.tsx` | Render EmptyGridHint |

## Implementation Order

1. Create `src/features/templates/` with types and data
2. Build `TemplatesTab.tsx` with thumbnail grid and confirmation
3. Add tab to `LayoutManagerModal`
4. Create `EmptyGridHint.tsx`
5. Integrate hint into Grid component
6. Tests for core flows

## Out of Scope (Future)

- Category filter pills
- Scaling templates to different drawer sizes
- "Apply to current layout" option
- More than 4 templates
