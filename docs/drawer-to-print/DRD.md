# Drawer-to-Print: Design Requirements Document

## Overview

**Feature:** Drawer-to-Print STL Generation & Export System
**Version:** 1.0
**Status:** Planning
**Last Updated:** 2025-01-14

### Related Documents

| Document | Purpose | Link |
|----------|---------|------|
| **Product Requirements (PRD)** | User stories, acceptance criteria, success metrics | [PRD.md](./PRD.md) |
| **System Architecture** | Technical implementation, data models, APIs | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Design Requirements (DRD)** | This document - UI/UX specifications | — |

### Document Purpose

This Design Requirements Document (DRD) specifies the user interface, interaction patterns, visual design, and accessibility requirements for the Drawer-to-Print feature set. It ensures design consistency with the existing application while introducing new generation and export capabilities.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Design System Integration](#design-system-integration)
3. [New Components](#new-components)
4. [Interaction Patterns](#interaction-patterns)
5. [Responsive Behavior](#responsive-behavior)
6. [Accessibility Requirements](#accessibility-requirements)
7. [Animation & Feedback](#animation--feedback)
8. [Error States & Recovery](#error-states--recovery)
9. [Component Specifications](#component-specifications)
10. [Research Sources](#research-sources)

---

## Design Principles

### Core Principles (Inherited)

The Drawer-to-Print features follow the established design principles of the application:

1. **Dark-first, warm palette** - Near-black backgrounds with amber accents
2. **Density without clutter** - Efficient use of space with clear hierarchy
3. **Progressive disclosure** - Advanced options hidden until needed
4. **Immediate feedback** - Every action has visible response
5. **Touch-friendly targets** - Minimum 44px touch targets on interactive elements

### Feature-Specific Principles

6. **Generation transparency** - Users always know what's being generated and progress status
7. **Validation before action** - Problems shown before export, not after
8. **Recoverable workflows** - Cancel any operation, resume where you left off
9. **Offline-capable** - All generation works without network after initial load

---

## Design System Integration

### Existing Design Tokens

The new components use the established design tokens from `src/index.css`:

#### Colors

```css
/* Surface hierarchy */
--bg-primary: #0f0f12;      /* Main background */
--bg-secondary: #1a1a1f;    /* Panels, sidebars */
--bg-elevated: #252530;     /* Cards, modals */
--bg-hover: #2a2a35;        /* Hover states */
--bg-active: #323240;       /* Active/pressed */

/* Semantic colors for generation states */
--color-success: #22c55e;   /* Generation complete */
--color-warning: #f59e0b;   /* Validation warnings */
--color-error: #ef4444;     /* Generation failed */
--color-info: #3b82f6;      /* Informational */

/* Primary accent (amber) */
--color-primary: #f59e0b;   /* Buttons, progress */
--color-primary-hover: #fbbf24;
```

#### Typography

```css
--text-xxs: 0.625rem;   /* 10px - File sizes, metadata */
--text-xs: 0.75rem;     /* 12px - Labels, badges */
--text-sm: 0.8125rem;   /* 13px - Secondary content */
--text-base: 0.875rem;  /* 14px - Body text */
--text-lg: 1rem;        /* 16px - Section headers */
--text-xl: 1.125rem;    /* 18px - Modal titles */
```

#### Spacing

```css
--space-xs: 4px;    /* Tight spacing */
--space-sm: 8px;    /* Default gap */
--space-md: 12px;   /* Component padding */
--space-lg: 16px;   /* Section spacing */
--space-xl: 20px;   /* Large gaps */
--space-2xl: 24px;  /* Modal padding */
```

#### Radii & Shadows

```css
--radius-sm: 4px;   /* Buttons, inputs */
--radius-md: 8px;   /* Cards, panels */
--radius-lg: 12px;  /* Modals */

--shadow-elevated: 0 4px 12px rgba(0, 0, 0, 0.2);
--shadow-floating: 0 8px 24px rgba(0, 0, 0, 0.3);
```

### New Design Tokens

Additional tokens needed for generation features:

```css
/* Generation progress */
--progress-track: var(--bg-active);
--progress-fill: var(--color-primary);
--progress-fill-complete: var(--color-success);
--progress-fill-error: var(--color-error);

/* Model library */
--thumbnail-size: 80px;
--thumbnail-size-lg: 120px;
--thumbnail-border: var(--border-subtle);
--thumbnail-hover: var(--border-default);

/* Drop zone */
--dropzone-border: var(--border-default);
--dropzone-border-active: var(--color-primary);
--dropzone-bg-active: var(--color-primary-muted);

/* Generation queue */
--queue-item-height: 48px;
--queue-item-gap: var(--space-sm);
```

---

## New Components

### Component Inventory

| Component | Purpose | PRD Reference | Architecture Reference |
|-----------|---------|---------------|----------------------|
| BinStylePicker | Select bin generation style | [US-1.2](./PRD.md#epic-1-basic-stl-generation) | [BinParams.style](./ARCHITECTURE.md#1-generation-engine) |
| BinParameterPanel | Configure dividers, scoops, labels | [US-3.1 - US-3.4](./PRD.md#epic-3-bin-customization) | [BinParams](./ARCHITECTURE.md#1-generation-engine) |
| ModelLibraryPanel | Browse templates and custom models | [US-6.1](./PRD.md#epic-6-model-library) | [ModelLibraryState](./ARCHITECTURE.md#2-model-library-store) |
| CustomModelUploader | Drag-drop STL upload | [US-4.1](./PRD.md#epic-4-custom-model-import) | [CustomModelService](./ARCHITECTURE.md#3-custom-model-service) |
| GridCompatibilityCard | Show upload validation results | [US-4.2](./PRD.md#epic-4-custom-model-import) | [GridCompatibilityResult](./ARCHITECTURE.md#3-custom-model-service) |
| ExportModal | Configure and execute export | [US-5.1 - US-5.5](./PRD.md#epic-5-full-export-package) | [ExportOptions](./ARCHITECTURE.md#4-export-pipeline) |
| GenerationProgress | Show STL generation progress | [US-1.3, US-5.5](./PRD.md#epic-5-full-export-package) | [GenerationJob](./ARCHITECTURE.md#1-generation-engine) |
| BOMPreview | Bill of materials preview | [US-5.2](./PRD.md#epic-5-full-export-package) | [BillOfMaterials](./ARCHITECTURE.md#bom-generation) |
| BaseplateConfigurator | Baseplate style options | [US-2.1 - US-2.3](./PRD.md#epic-2-baseplate-generation) | [BaseplateConfig](./ARCHITECTURE.md#extended-layout-type) |

### Component Hierarchy

```
┌─ App ──────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─ Sidebar ─────────┐  ┌─ Grid ───────┐  ┌─ RightPanel ────────┐ │
│  │                   │  │              │  │                      │ │
│  │ [Layers Panel]    │  │   (existing) │  │ [Bin Inspector]      │ │
│  │                   │  │              │  │   └─ BinStylePicker  │ │
│  │ [Categories]      │  │              │  │   └─ BinParameterPanel│ │
│  │                   │  │              │  │                      │ │
│  │ [ModelLibraryPanel] ◄─── NEW        │  │ [Export STL Button]  │ │
│  │   └─ TemplateGrid │  │              │  │                      │ │
│  │   └─ CustomModels │  │              │  └──────────────────────┘ │
│  │   └─ UploadTrigger│  │              │                           │
│  │                   │  │              │                           │
│  └───────────────────┘  └──────────────┘                           │
│                                                                     │
│  ┌─ ExportModal (overlay) ─────────────────────────────────────┐   │
│  │  ┌─ ExportOptions ─┐  ┌─ BOMPreview ──┐  ┌─ GenerationProgress│ │
│  │  │ BaseplateConfig │  │ Parts list    │  │ Progress bars     ││ │
│  │  │ BinDefaults     │  │ Estimates     │  │ Current file      ││ │
│  │  │ FileOptions     │  │ Warnings      │  │ Cancel button     ││ │
│  │  └─────────────────┘  └───────────────┘  └───────────────────┘│ │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ CustomModelUploader (modal) ───────────────────────────────┐   │
│  │  ┌─ DropZone ──────┐  ┌─ GridCompatibilityCard ────────────┐│   │
│  │  │ Drag STL here   │  │ Size detected: 2x3x4               ││   │
│  │  │ or click browse │  │ Warnings: [list]                   ││   │
│  │  └─────────────────┘  │ [Accept] [Cancel]                  ││   │
│  └───────────────────────└────────────────────────────────────┘┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Interaction Patterns

### 1. Bin Style Selection

**Trigger:** User clicks style dropdown in Bin Inspector

**Behavior:**
1. Dropdown shows available styles with visual previews
2. Selecting style updates 3D preview immediately
3. Style persists with bin data

```
┌─ Style Dropdown ────────────────────┐
│ ┌─────────┐                         │
│ │ [icon]  │ Standard               ✓│
│ │         │ Full Gridfinity spec    │
│ └─────────┘                         │
├─────────────────────────────────────┤
│ ┌─────────┐                         │
│ │ [icon]  │ Lite                    │
│ │         │ Faster print, thin walls│
│ └─────────┘                         │
├─────────────────────────────────────┤
│ ┌─────────┐                         │
│ │ [icon]  │ Solid                   │
│ │         │ No internal features    │
│ └─────────┘                         │
├─────────────────────────────────────┤
│ ┌─────────┐                         │
│ │ [icon]  │ From Library...         │
│ │         │ Browse templates        │
│ └─────────┘                         │
└─────────────────────────────────────┘
```

**States:**
- Default: Shows current selection
- Hover: `--bg-hover` background
- Selected: Checkmark, `--color-primary` accent
- Disabled: 50% opacity (if no bin selected)

### 2. Parameter Configuration

**Pattern:** Collapsible sections with real-time preview updates

**Dividers Section:**
```
┌─ Dividers ──────────────────────────────────┐
│ [✓] Enabled                                 │
│                                             │
│ X Divisions     Y Divisions                 │
│ [  2  ] [-][+]  [  2  ] [-][+]             │
│                                             │
│ Style                                       │
│ [Full Height    ▼]                          │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │  ┌───┬───┐                              │ │
│ │  │   │   │   Preview                    │ │
│ │  ├───┼───┤                              │ │
│ │  │   │   │                              │ │
│ │  └───┴───┘                              │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Interaction Notes:**
- Enable checkbox toggles entire section
- Number inputs use stepper buttons + direct input
- Preview updates on every change (debounced 150ms)
- Invalid combinations show inline warning

### 3. STL File Upload

**Pattern:** Drag-and-drop with fallback button ([NN/g best practices](https://www.nngroup.com/articles/drag-drop/))

**Drop Zone States:**

```
┌─ DEFAULT STATE ─────────────────────────────┐
│                                             │
│           ┌─────────┐                       │
│           │  📁    │                       │
│           └─────────┘                       │
│                                             │
│     Drag STL file here or                   │
│     [Browse Files]                          │
│                                             │
│     Supported: .stl (up to 20MB)            │
│                                             │
└─────────────────────────────────────────────┘

┌─ DRAG ACTIVE STATE ─────────────────────────┐
│ ┌─────────────────────────────────────────┐ │
│ │           ┌─────────┐                   │ │
│ │           │  📥    │                   │ │  Border: --color-primary
│ │           └─────────┘                   │ │  Background: --color-primary-muted
│ │                                         │ │  Dashed border animation
│ │     Drop to upload                      │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘

┌─ UPLOADING STATE ───────────────────────────┐
│                                             │
│     battery-holder.stl                      │
│     ████████████░░░░░░░░░  65%             │
│                                             │
│     Analyzing geometry...                   │
│                                             │
│     [Cancel]                                │
│                                             │
└─────────────────────────────────────────────┘

┌─ ERROR STATE ───────────────────────────────┐
│                                             │
│     ⚠️  Upload failed                       │
│                                             │
│     File exceeds 20MB limit                 │
│     Your file: 24.5MB                       │
│                                             │
│     [Try Another File]                      │
│                                             │
└─────────────────────────────────────────────┘
```

**Accessibility Requirements:**
- `[Browse Files]` button is keyboard accessible
- Drop zone has `role="button"` and `aria-label`
- Upload progress announced to screen readers
- Keyboard alternative: Tab to browse button, Enter to open file picker

### 4. Grid Compatibility Validation

**Pattern:** Immediate validation feedback with actionable suggestions

```
┌─ Grid Compatibility ────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────────────┐   Detected Size                      │
│  │                      │   2 × 3 × 4 grid units               │
│  │     [3D Preview]     │                                       │
│  │                      │   Dimensions                          │
│  │                      │   84.2mm × 126.1mm × 28.3mm          │
│  └──────────────────────┘                                       │
│                                                                 │
│  ┌─ Compatibility ─────────────────────────────────────────────┐│
│  │ ✓ Width aligns to grid (84mm = 2 units)                    ││
│  │ ⚠ Depth slightly off (126.1mm ≈ 3 units, 0.1mm over)       ││
│  │ ✓ Height aligns to units (28mm = 4 height units)           ││
│  │ ⚠ No stacking lip detected                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ Recommendations ───────────────────────────────────────────┐│
│  │ This model will work but may have slight gaps. Consider:   ││
│  │ • Scaling depth to exactly 126mm                           ││
│  │ • Model may not stack with standard bins                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                          [Cancel]  [Add to Library]             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Status Indicators:**
- ✓ Green checkmark: Fully compatible
- ⚠ Yellow warning: Minor issues, usable
- ✗ Red X: Significant problems

### 5. Export Flow

**Pattern:** Multi-step modal with persistent progress ([Carbon Design System export pattern](https://carbondesignsystem.com/community/patterns/export-pattern/))

**Step 1: Configuration**
```
┌─ Export Drawer Package ─────────────────────────────────────[X]─┐
│                                                                 │
│  "Workshop Main Drawer" • 10×8 grid • 24 bins                  │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  INCLUDE IN EXPORT                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [✓] Bins                              12 unique STLs    │   │
│  │ [✓] Baseplates                        4 sections        │   │
│  │ [✓] Bill of Materials                 CSV format        │   │
│  │ [✓] Print Instructions                README.md         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▼ BASEPLATE OPTIONS                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Style         [Weighted ▼]                              │   │
│  │ Magnets       [✓] 6×2mm holes  Screws  [ ] M3 holes    │   │
│  │                                                         │   │
│  │ ℹ️ Baseplate will be split into 4 sections to fit      │   │
│  │   your 256mm print bed                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▶ BIN DEFAULTS (click to expand)                               │
│  ▶ FILE OPTIONS (click to expand)                               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ESTIMATES                                                      │
│  Filament: ~847m        Time: ~42 hours        Size: ~12 MB    │
│                                                                 │
│                              [Cancel]  [Generate & Download]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Step 2: Generation Progress**
```
┌─ Generating Export Package ─────────────────────────────────────┐
│                                                                 │
│  Overall Progress                                               │
│  ████████████████████░░░░░░░░░░░░░░░░░░░  52%                  │
│                                                                 │
│  Estimated time remaining: ~45 seconds                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  GENERATING FILES                                               │
│                                                                 │
│  ✓ baseplate-10x8-section-A.stl          2.4 MB               │
│  ✓ baseplate-10x8-section-B.stl          2.4 MB               │
│  ● bin-3x2x4-standard.stl                Generating...         │
│  ○ bin-2x2x3-divided-2x2.stl             Pending               │
│  ○ bin-1x1x4-standard.stl                Pending               │
│  ○ ... and 8 more files                                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│                              [Cancel Export]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Step 3: Complete**
```
┌─ Export Complete ───────────────────────────────────────────────┐
│                                                                 │
│                         ✓                                       │
│                                                                 │
│  Successfully generated 17 files                                │
│                                                                 │
│  workshop-main-drawer-2025-01-14.zip                           │
│  12.4 MB                                                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  SUMMARY                                                        │
│  • 4 baseplate sections                                        │
│  • 12 unique bin STLs (24 total copies needed)                 │
│  • Bill of materials (CSV)                                     │
│  • Print instructions                                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│                    [Done]  [Download Again]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Progress Indicator Behavior:**
- Use determinate progress bar (shows percentage)
- Show "X of Y files" for clarity
- List completed files with checkmarks
- Highlight currently generating file
- Animate progress smoothly (ease-in acceleration)
- Never freeze - if delayed, slow down animation

### 6. Model Library Navigation

**Pattern:** Grid-based browser with search and filtering

```
┌─ MODEL LIBRARY ──────────────────────────────────[≡]──┐
│                                                       │
│  [🔍 Search models...                            ]   │
│                                                       │
│  [All ▼] [Standard ▼] [Sort: Recent ▼]              │
│                                                       │
│  ─────────────────────────────────────────────────   │
│                                                       │
│  STANDARD BINS                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │      │ │      │ │  │   │ │ ─┼─  │               │
│  │      │ │ \_/  │ │  │   │ │ ─┼─  │               │
│  │      │ │      │ │      │ │      │               │
│  └──────┘ └──────┘ └──────┘ └──────┘               │
│   Plain    Scoop   2-Div    4-Div                   │
│                                                       │
│  ┌──────┐ ┌──────┐                                  │
│  │ ═══  │ │ [_]  │                                  │
│  │      │ │      │                                  │
│  └──────┘ └──────┘                                  │
│   Label    Magnet                                    │
│                                                       │
│  ─────────────────────────────────────────────────   │
│                                                       │
│  MY UPLOADS (3)                                       │
│  ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │ 🔋   │ │ 📱   │ │ 🔧   │  [+ Upload]            │
│  │      │ │      │ │      │                        │
│  └──────┘ └──────┘ └──────┘                        │
│  Battery  Phone    Custom                            │
│   2×1×2   3×2×3    2×2×4                            │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Thumbnail Interaction:**
- Click: Select and show details
- Double-click: Quick-add to layout (places at cursor or center)
- Right-click: Context menu (Edit, Delete, Duplicate)
- Hover: Show larger preview tooltip with dimensions

---

## Responsive Behavior

### Breakpoints

| Breakpoint | Width | Layout Adaptation |
|------------|-------|-------------------|
| Desktop | ≥900px | Full three-column layout, export modal centered |
| Tablet | 768-899px | Collapsible panels, overlay export modal |
| Mobile | <768px | Bottom sheet export, full-screen model library |

### Desktop (≥900px)

- Export modal: Centered overlay, 600px max-width
- Model library: Sidebar panel, scrollable grid
- Generation progress: Modal with detailed file list

### Tablet (768-899px)

- Export modal: Full-width with padding, scrollable
- Model library: Overlay panel triggered from toolbar
- Generation progress: Simplified, fewer file details

### Mobile (<768px)

**Export Flow:**
```
┌─────────────────────────────────────┐
│ ◀ Export Package                    │  ← Header with back
├─────────────────────────────────────┤
│                                     │
│ Workshop Main Drawer                │
│ 10×8 grid • 24 bins                │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ INCLUDE                             │
│ [✓] Bins (12 STLs)                 │
│ [✓] Baseplates (4 sections)        │
│ [✓] Bill of Materials              │
│ [✓] Instructions                   │
│                                     │
│ ▶ Baseplate Options                 │
│ ▶ Bin Defaults                      │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ ~847m filament • ~42 hours         │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │     Generate & Download         │ │  ← Sticky bottom button
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Model Library (Mobile):**
- Full-screen modal triggered from bottom nav
- Larger touch targets (56px thumbnails minimum)
- Pull-to-refresh for templates
- Swipe to delete custom models

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Color contrast** | 4.5:1 minimum for text, 3:1 for UI elements |
| **Focus indicators** | 2px `--focus-ring` outline on all interactive elements |
| **Touch targets** | Minimum 44×44px (48×48px preferred on mobile) |
| **Reduced motion** | Respect `prefers-reduced-motion` for all animations |
| **Screen reader** | ARIA labels on all custom controls |

### Keyboard Navigation

**Export Modal:**
| Key | Action |
|-----|--------|
| Tab | Move between interactive elements |
| Enter/Space | Activate buttons, toggle checkboxes |
| Escape | Close modal (with confirmation if generating) |
| Arrow keys | Navigate within dropdown/radio groups |

**Model Library:**
| Key | Action |
|-----|--------|
| Tab | Move to model grid |
| Arrow keys | Navigate between thumbnails |
| Enter | Select model / Open details |
| Delete | Delete selected custom model (with confirmation) |

**File Upload:**
| Key | Action |
|-----|--------|
| Tab | Focus on browse button |
| Enter/Space | Open file picker |
| Escape | Cancel upload in progress |

### ARIA Implementation

```html
<!-- Progress bar -->
<div
  role="progressbar"
  aria-valuenow="52"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-label="Export progress: 52% complete, generating bin-3x2x4-standard.stl"
>

<!-- Drop zone -->
<div
  role="button"
  tabindex="0"
  aria-label="Upload STL file. Drag and drop or press Enter to browse."
  aria-describedby="upload-instructions"
>

<!-- Model thumbnail grid -->
<div role="grid" aria-label="Model library">
  <div role="row">
    <div role="gridcell" aria-label="Plain bin, 1x1x3">
```

### Screen Reader Announcements

| Event | Announcement |
|-------|--------------|
| Upload started | "Uploading [filename], 0%" |
| Upload progress | (Every 25%) "[filename] upload: 25% complete" |
| Upload complete | "[filename] uploaded successfully. Analyzing compatibility." |
| Validation complete | "Model analyzed. 2 by 3 by 4 grid units. 2 warnings." |
| Generation started | "Generating export package. 17 files to create." |
| Generation progress | (Every 5 files) "Generated 5 of 17 files" |
| Generation complete | "Export complete. 17 files ready. Download starting." |
| Error | "Error: [message]. Press Escape to dismiss." |

---

## Animation & Feedback

### Timing Standards

| Animation | Duration | Easing |
|-----------|----------|--------|
| Button hover/press | 100ms | ease-out |
| Panel expand/collapse | 250ms | ease-out |
| Modal enter | 200ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Modal exit | 150ms | ease-out |
| Progress bar | Linear | — |
| Toast notification | 200ms in, 150ms out | spring |

### Progress Feedback

**Determinate Progress Bar:**
```css
.progress-bar {
  transition: width 150ms ease-out;
  /* Never animate backwards - only forward */
}

.progress-bar--complete {
  background: var(--color-success);
  transition: background 300ms ease-out;
}
```

**Progress States:**
1. **Pending**: Empty bar, `--progress-track` background
2. **In Progress**: Filling bar, `--progress-fill` (amber)
3. **Complete**: Full bar, transitions to `--color-success` (green)
4. **Error**: Bar stops, turns `--color-error` (red)

### Micro-interactions

**File List Items:**
- Appear with `slideUp` animation (staggered 50ms each)
- Checkmark appears with `scaleIn` on completion
- Error shake animation on failure

**Thumbnail Selection:**
- Scale to 1.02 on hover
- Ring appears with `--selection-ring` color
- Selection persists until another item selected

**Drop Zone:**
- Dashed border animates (marching ants) when drag active
- Background pulses subtly during upload
- Success checkmark scales in on complete

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .progress-bar,
  .file-list-item,
  .thumbnail {
    animation: none;
    transition: opacity 0.01ms;
  }

  /* Keep essential state changes visible */
  .progress-bar--complete {
    transition: background 0.01ms;
  }
}
```

---

## Error States & Recovery

### Error Hierarchy

| Level | Visual | Use Case |
|-------|--------|----------|
| **Info** | Blue info icon | Non-blocking tips |
| **Warning** | Yellow warning icon | Compatibility issues, can proceed |
| **Error** | Red error icon | Blocking issue, must resolve |
| **Critical** | Red banner | System failure, export failed |

### Error Patterns

**Inline Validation Error:**
```
┌─ Dividers ─────────────────────────────┐
│ [✓] Enabled                            │
│                                        │
│ X Divisions     Y Divisions            │
│ [ 12  ] [-][+]  [  2  ] [-][+]        │
│ ⚠️ Max 6 divisions per axis            │  ← Inline error
│                                        │
└────────────────────────────────────────┘
```

**Upload Error:**
```
┌─ Upload Error ─────────────────────────┐
│                                        │
│  ❌ Invalid file format                │
│                                        │
│  Expected: .stl file                   │
│  Received: .obj file                   │
│                                        │
│  [Try Again] [Cancel]                  │
│                                        │
└────────────────────────────────────────┘
```

**Generation Error (Recoverable):**
```
┌─ Generation Issue ─────────────────────────────────────────────┐
│                                                                 │
│  ⚠️ 1 file failed to generate                                  │
│                                                                 │
│  bin-6x6x8-divided-4x4.stl                                     │
│  Error: Model too complex for browser generation               │
│                                                                 │
│  16 of 17 files completed successfully.                        │
│                                                                 │
│  [Download Partial]  [Retry Failed]  [Cancel]                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Critical Error (Unrecoverable):**
```
┌─ Export Failed ────────────────────────────────────────────────┐
│                                                                 │
│  ╔════════════════════════════════════════════════════════╗   │
│  ║  ❌ Export could not be completed                      ║   │  ← Red background
│  ║                                                        ║   │
│  ║  Browser ran out of memory while generating files.    ║   │
│  ║                                                        ║   │
│  ║  Try:                                                  ║   │
│  ║  • Closing other browser tabs                         ║   │
│  ║  • Exporting fewer bins at once                       ║   │
│  ║  • Using a desktop browser instead of mobile          ║   │
│  ╚════════════════════════════════════════════════════════╝   │
│                                                                 │
│                              [Close]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Recovery Actions

| Error Type | Recovery Options |
|------------|------------------|
| Upload format error | "Try Another File" button |
| Upload size error | Show file size, suggest compression |
| Validation warnings | "Proceed Anyway" or "Cancel" |
| Generation timeout | "Retry" or "Skip" individual file |
| Memory error | Suggest closing tabs, reducing scope |
| Network error (for templates) | "Retry" with exponential backoff |

---

## Component Specifications

> **Data Types:** TypeScript interfaces referenced here (e.g., `BinParams`, `GenerationJob`) are defined in the [Architecture Document](./ARCHITECTURE.md#core-components). User stories are documented in the [PRD](./PRD.md#user-stories).

### BinStylePicker

**Props:**
```typescript
interface BinStylePickerProps {
  value: BinStyle;
  onChange: (style: BinStyle) => void;
  disabled?: boolean;
  showLibraryOption?: boolean;
}
```

**Visual Specs:**
- Dropdown width: 100% of container
- Item height: 56px
- Icon size: 32×32px
- Padding: 12px horizontal, 8px vertical

### BinParameterPanel

**Props:**
```typescript
interface BinParameterPanelProps {
  params: BinParams;
  onChange: (params: BinParams) => void;
  previewEnabled?: boolean;
}
```

**Visual Specs:**
- Section header: `--text-sm`, `--font-semibold`
- Input width: 64px for number inputs
- Stepper buttons: 24×24px
- Preview canvas: 120×80px, 16:9 aspect

### CustomModelUploader

**Props:**
```typescript
interface CustomModelUploaderProps {
  onUpload: (file: File) => Promise<void>;
  onCancel: () => void;
  maxSizeMB?: number;  // default: 20
  acceptedFormats?: string[];  // default: ['.stl']
}
```

**Visual Specs:**
- Drop zone: 280×200px minimum
- Icon size: 48×48px
- Border: 2px dashed `--dropzone-border`
- Border radius: `--radius-lg`

### ExportModal

**Props:**
```typescript
interface ExportModalProps {
  layout: Layout;
  onExport: (options: ExportOptions) => Promise<void>;
  onClose: () => void;
}
```

**Visual Specs:**
- Modal width: 600px max (desktop), 100% - 32px (mobile)
- Modal max-height: 90vh
- Header height: 56px
- Footer height: 64px
- Content padding: 24px

### GenerationProgress

**Props:**
```typescript
interface GenerationProgressProps {
  jobs: GenerationJob[];
  overallProgress: number;
  estimatedTimeRemaining?: number;
  onCancel: () => void;
}
```

**Visual Specs:**
- Progress bar height: 8px
- Progress bar radius: 4px
- File list item height: 40px
- Status icon size: 16×16px

---

## Research Sources

### UI/UX Best Practices

- [NN/g: Drag-and-Drop Design Guidelines](https://www.nngroup.com/articles/drag-drop/) - Drag-drop accessibility and usability
- [Carbon Design System: Export Pattern](https://carbondesignsystem.com/community/patterns/export-pattern/) - Modal export workflows
- [Pencil & Paper: Loading Feedback UX](https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback) - Progress indicator design
- [Uploadcare: File Uploader Best Practices](https://uploadcare.com/blog/file-uploader-ux-best-practices/) - Upload interaction patterns
- [LogRocket: Drag-and-Drop UI Patterns](https://blog.logrocket.com/ux-design/drag-and-drop-ui-examples/) - Modern drag-drop examples
- [Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/) - Comprehensive drag-drop guide

### 3D/CAD Interface Patterns

- [Configurator.Tech: 3D Printing Configurators](https://www.configurator.tech/3d-printing-industries) - Parametric model UI patterns
- [Autodesk Fusion Documentation](https://www.autodesk.com/solutions/3d-modeling-for-3d-printing) - Professional CAD UX
- [Shapr3D: Manufacturing CAD](https://www.shapr3d.com/) - Touch-friendly 3D modeling

### Technical Implementation

- [WebGL Fundamentals: Canvas Screenshots](https://webglfundamentals.org/webgl/lessons/webgl-tips.html) - 3D thumbnail capture
- [React Three Fiber: Canvas Export](https://github.com/pmndrs/react-three-fiber/discussions/2054) - Three.js screenshot methods
- [Siemens Design System: Download Pattern](https://design.mindsphere.io/patterns/download.html) - Industrial download UX

---

*Document created: 2025-01-14*
*Status: Design Requirements - For Review*
