# Bin Designer - Design Requirements Document

## Overview

**Feature:** Bin Designer UI/UX Specifications
**Version:** 1.0
**Status:** Planning
**Last Updated:** 2025-01-21

### Related Documents

| Document | Purpose | Link |
|----------|---------|------|
| **Product Requirements** | User stories, acceptance criteria | [BIN-DESIGNER-PRD.md](./BIN-DESIGNER-PRD.md) |
| **System Architecture** | Technical implementation with replicad | [BIN-DESIGNER-ARCHITECTURE.md](./BIN-DESIGNER-ARCHITECTURE.md) |
| **Design Requirements** | This document - UI/UX specifications | — |
| **Original DRD** | Layout export features (separate scope) | [DRD.md](./DRD.md) |

---

## Design Philosophy

### Core Principles

1. **Match Layout Planner Aesthetic** - Dark theme, amber accents, consistent with existing tool
2. **Progressive Disclosure** - Simple interface with advanced options available on demand
3. **Immediate Feedback** - Real-time preview updates as parameters change
4. **Mobile-First Touch** - All controls optimized for touch, but keyboard accessible
5. **Beginner-Friendly** - No CAD knowledge required; templates make common tasks easy

### Visual Language

The Bin Designer inherits the Layout Planner's design system:

| Element | Value |
|---------|-------|
| **Background** | `#0f0f0f` (near black) |
| **Surface** | `#1a1a1a` (panels), `#262626` (cards) |
| **Primary** | `#f59e0b` (amber-500) |
| **Text Primary** | `#fafafa` (zinc-50) |
| **Text Secondary** | `#a1a1aa` (zinc-400) |
| **Border** | `#27272a` (zinc-800) |
| **Success** | `#22c55e` (green-500) |
| **Error** | `#ef4444` (red-500) |
| **Font** | Inter (UI), JetBrains Mono (code) |

---

## Layout Specifications

### Desktop Layout (≥900px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Header: Logo | "Bin Designer" | [Layout Planner] [Share] [Export]     │
├──────────────────────┬─────────────────────────────────────────────────┤
│                      │                                                 │
│   Parameter Panel    │               3D Preview Canvas                 │
│   (320px fixed)      │               (flexible, min 400px)             │
│                      │                                                 │
│   ┌──────────────┐   │   ┌─────────────────────────────────────────┐   │
│   │ Dimensions   │   │   │                                         │   │
│   │ ├ Width      │   │   │                                         │   │
│   │ ├ Depth      │   │   │                                         │   │
│   │ └ Height     │   │   │              [3D Bin Model]              │   │
│   ├──────────────┤   │   │                                         │   │
│   │ Base         │   │   │                                         │   │
│   │ ├ Style      │   │   │                                         │   │
│   │ └ Options    │   │   │                                         │   │
│   ├──────────────┤   │   └─────────────────────────────────────────┘   │
│   │ Features     │   │                                                 │
│   │ ├ Dividers   │   │   [Rotate] [Zoom] [Reset View] [Fullscreen]     │
│   │ ├ Scoop      │   │                                                 │
│   │ └ Label      │   │   ┌─────────────────────────────────────────┐   │
│   ├──────────────┤   │   │ Estimates: ~45g PLA | ~2h 15m print     │   │
│   │ Walls        │   │   └─────────────────────────────────────────┘   │
│   │ └ Cutouts    │   │                                                 │
│   ├──────────────┤   ├─────────────────────────────────────────────────┤
│   │ [+ Inserts]  │   │                                                 │
│   └──────────────┘   │   Insert Editor / Template Library (collapsed)  │
│                      │                                                 │
└──────────────────────┴─────────────────────────────────────────────────┘
```

**Key Dimensions:**
- Parameter Panel: 320px fixed width
- Preview Canvas: Minimum 400px, fills remaining space
- Header: 56px height
- Insert Editor (when open): 280px height, slides up from bottom

### Tablet Layout (768px - 899px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Header: Logo | "Bin Designer" | [≡ Menu]                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                         3D Preview Canvas                              │
│                         (full width, 50vh)                             │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                     [3D Bin Model]                              │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   [Rotate] [Zoom] [Reset]               ~45g | ~2h 15m                 │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Tabbed Parameter Panel (Dimensions | Features | Inserts | Export)    │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │  Width: [─────●────] 2u    Depth: [─────●────] 3u              │   │
│   │                                                                 │   │
│   │  Height: [─────●────] 6u                                        │   │
│   │                                                                 │   │
│   │  [More Dimensions Options...]                                   │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Adjustments:**
- Preview takes top 50% of viewport
- Parameters in horizontally-scrollable tabs below
- Menu button reveals overlay with Share/Export/Settings

### Mobile Layout (<768px)

```
┌──────────────────────────────┐
│  Logo  "Designer"  [≡]       │
├──────────────────────────────┤
│                              │
│      3D Preview Canvas       │
│      (full width, 40vh)      │
│                              │
│   ┌──────────────────────┐   │
│   │    [3D Bin Model]    │   │
│   └──────────────────────┘   │
│                              │
│   ~45g PLA  |  ~2h 15m       │
│                              │
├──────────────────────────────┤
│                              │
│   [Dims] [Base] [+] [Export] │
│   ─────────────────────────  │
│                              │
│   Width                      │
│   [──────────●──────] 2u     │
│                              │
│   Depth                      │
│   [──────────●──────] 3u     │
│                              │
│   Height                     │
│   [──────────●──────] 6u     │
│                              │
│   [Show Advanced ▼]          │
│                              │
└──────────────────────────────┘
```

**Key Adjustments:**
- Preview: 40vh minimum height
- Bottom tabs for parameter categories
- Full-width sliders with large touch targets (44px minimum)
- "Show Advanced" reveals less common options
- Floating action button for quick export

---

## Component Specifications

### 1. Parameter Panel

#### Dimensions Section

```
┌─ Dimensions ──────────────────────────┐
│                                       │
│  Width (units)                        │
│  [──────────●──────────] 2.0          │
│  ○ 0.5  ○ 1  ○ 1.5  ● 2  ○ 3  ○ 4    │  ← Quick-select buttons
│                                       │
│  Depth (units)                        │
│  [──────────●──────────] 3.0          │
│  ○ 1  ○ 2  ● 3  ○ 4  ○ 5  ○ 6        │
│                                       │
│  Height (units)                       │
│  [──────────●──────────] 6            │
│  ○ 3  ● 6  ○ 9  ○ 12  [Custom...]    │
│                                       │
│  Actual size: 83 × 125 × 42mm         │  ← Calculated dimensions
│                                       │
└───────────────────────────────────────┘
```

**Interactions:**
- Slider: Drag or click to set value
- Quick-select buttons: One-tap for common sizes
- Number input: Click on value to type directly
- Half-unit increments: Slider snaps to 0.5 units

#### Base Options Section

```
┌─ Base ────────────────────────────────┐
│                                       │
│  Style                                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │ ○   │ │ ◉   │ │ ○   │ │ ○   │     │
│  │ Std │ │ Mag │ │ Scr │ │ Wgt │     │
│  └─────┘ └─────┘ └─────┘ └─────┘     │
│                                       │
│  ▼ Magnet Options                     │
│  ┌───────────────────────────────┐    │
│  │ Diameter: [──●──] 6mm         │    │
│  │ Depth:    [──●──] 2mm         │    │
│  └───────────────────────────────┘    │
│                                       │
│  [✓] Stacking lip                     │
│                                       │
└───────────────────────────────────────┘
```

**Interactions:**
- Style buttons: Visual cards with icon/label
- Magnet options: Conditionally shown when "Mag" selected
- Expandable section: Chevron indicates more options
- Checkbox: Standard toggle

#### Features Section

```
┌─ Features ────────────────────────────┐
│                                       │
│  Dividers                             │
│  X: [──●──] 1    Y: [──●──] 2         │
│  Thickness: [──●──] 1.2mm             │
│                                       │
│  ─────────────────────────────────    │
│                                       │
│  Scoop                                │
│  [━━━━━━━●] ON                        │
│                                       │
│  ─────────────────────────────────    │
│                                       │
│  Label                                │
│  [━━━━━━━●] ON                        │
│                                       │
│  Text: [Screws M3_____________]       │
│  (Auto-sized to fit label area)       │
│                                       │
└───────────────────────────────────────┘
```

**Interactions:**
- Toggle switch: Slide or tap to enable/disable
- Text input: Standard text field, max 20 chars
- Divider sliders: Integer values only (0-10)

#### Walls Section

```
┌─ Walls (Side Cutouts) ────────────────┐
│                                       │
│  ┌─────────────────────────────┐      │
│  │         Back: 100%          │      │
│  │   ┌─────────────────┐       │      │
│  │   │                 │       │      │
│  │ L │                 │ R     │      │
│  │ 50%                 │ 100%  │      │
│  │   │                 │       │      │
│  │   └─────────────────┘       │      │
│  │         Front: 75%          │      │
│  └─────────────────────────────┘      │
│                                       │
│  Tip: Reduce wall height for easy     │
│  access to long items                 │
│                                       │
└───────────────────────────────────────┘
```

**Interactions:**
- Visual diagram: Click on side to select
- Slider appears for selected side
- Percentage value shown inline
- Preview updates in real-time

### 2. 3D Preview Canvas

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                                                                        │
│                           [3D Bin Mesh]                                │
│                                                                        │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ⟲ Generating... ████████████░░░░░░ 65%                           │  │  ← Progress bar (when generating)
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  [↻ Reset] [🔍 Zoom In] [🔍 Zoom Out] [⤢ Fullscreen]    [1] [2] [3] [4] │  ← Camera presets
└────────────────────────────────────────────────────────────────────────┘
```

**Camera Controls:**
- **Orbit:** Left-click + drag (mouse), single-finger drag (touch)
- **Pan:** Right-click + drag (mouse), two-finger drag (touch)
- **Zoom:** Scroll wheel (mouse), pinch (touch)
- **Presets:** 1=Front, 2=Top, 3=Isometric, 4=Back

**Visual Features:**
- Grid floor for scale reference
- Soft shadows for depth perception
- Subtle ambient occlusion
- Wireframe toggle (for detailed inspection)

**Loading States:**
- Skeleton mesh (low-poly placeholder) during generation
- Progress bar overlay
- "Generating..." label with spinner

### 3. Insert Editor

```
┌─ Insert Editor ───────────────────────────────────────────────────────┐
│                                                                        │
│  Templates    Custom Shapes    My Inserts                              │
│  ━━━━━━━━━━   ───────────────  ───────────────                         │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                                                                  │  │
│  │    [AA]  [AAA]  [9V]  [CR2032]  [SD]  [μSD]  [USB]              │  │
│  │                                                                  │  │
│  │    [M3 Nut]  [M4 Nut]  [Screw]  [Hex Key]  [Bit]               │  │
│  │                                                                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Selected: AA Battery                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Orientation: [Vertical ▼]    Count: [──●──] 4                  │  │
│  │                                                                  │  │
│  │  [+ Add to Bin]                                                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Tabs:**
- **Templates:** Pre-built insert shapes (batteries, SD cards, etc.)
- **Custom Shapes:** Basic primitives (rectangle, circle, hex)
- **My Inserts:** Previously saved custom shapes

**Interactions:**
- Click template to select
- Configure parameters in bottom section
- "Add to Bin" places insert in bin floor plan
- Drag placed inserts to reposition

### 4. Template Library Browser

```
┌─ Insert Templates ─────────────────────────────────────────────────────┐
│                                                                         │
│  Search: [________________________] [🔍]                                │
│                                                                         │
│  Categories: [All ▼]  [Electronics]  [Hardware]  [Tools]               │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │ │  [img]  │  │  [img]  │  │  [img]  │  │  [img]  │  │  [img]  │ │  │
│  │ │ AA Batt │  │ AAA     │  │ 9V Batt │  │ CR2032  │  │ SD Card │ │  │
│  │ └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │  │
│  │                                                                  │  │
│  │ ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │ │  [img]  │  │  [img]  │  │  [img]  │  │  [img]  │  │  [img]  │ │  │
│  │ │ MicroSD │  │ USB-A   │  │ M3 Nut  │  │ M4 Nut  │  │ Screw   │ │  │
│  │ └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Showing 1-10 of 24 templates                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Template Cards:**
- Thumbnail image (3D render of cavity)
- Name label
- Hover: Brief description tooltip
- Click: Select and show configuration

### 5. Export Dialog

```
┌─ Export ───────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │               │  │               │  │               │               │
│  │   ┌─────┐     │  │   ┌─────┐     │  │   ┌─────┐     │               │
│  │   │.STL │     │  │   │.STEP│     │  │   │.3MF │     │               │
│  │   └─────┘     │  │   └─────┘     │  │   └─────┘     │               │
│  │               │  │               │  │               │               │
│  │   [● Select]  │  │   [○ Select]  │  │   [○ Select]  │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                         │
│  STL Options                                                            │
│  ──────────────────────────────────────────────────────                │
│  Quality:  ○ Draft (fast)  ● Standard  ○ High (slow)                   │
│                                                                         │
│  File Naming                                                            │
│  ──────────────────────────────────────────────────────                │
│  ○ Descriptive: gridfinity_2x3x6_dividers_scoop.stl                    │
│  ● Compact: gf_2x3x6.stl                                               │
│  Prefix: [gridfinity_______]                                           │
│                                                                         │
│  Preview: gridfinity_2x3x6_dividers_scoop.stl                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Estimated: ~45g PLA ($0.90)  |  ~2h 15m print time             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                              [Cancel]  [Download]                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Format Cards:**
- Visual icon for each format
- Radio selection (one at a time, or checkbox for multiple)
- Format-specific options appear below

**Quality Options (STL only):**
- Draft: 0.5mm tolerance, fastest
- Standard: 0.1mm tolerance, balanced
- High: 0.02mm tolerance, largest file

### 6. Batch Cart

```
┌─ Export Cart ──────────────────────────────────────────────────────────┐
│                                                                         │
│  3 designs in cart                                      [Clear All]     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  ┌─────┐  2x3x6 Standard                               [✕]      │  │
│  │  │     │  Dividers: 1×2, Scoop, Label: "Screws"                 │  │
│  │  └─────┘  ~45g, ~2h 15m                                          │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  ┌─────┐  1x2x3 Lite                                   [✕]      │  │
│  │  │     │  No dividers, Magnet base                               │  │
│  │  └─────┘  ~12g, ~45m                                             │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  ┌─────┐  3x3x9 Rugged                                 [✕]      │  │
│  │  │     │  Battery template (AA ×6)                               │  │
│  │  └─────┘  ~85g, ~4h 30m                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│  Total: ~142g PLA ($2.84)  |  ~7h 30m print time                       │
│                                                                         │
│                    [Download ZIP]                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Cart Item:**
- Thumbnail preview
- Design summary (dimensions, key features)
- Estimates
- Remove button (×)

**Actions:**
- Clear All: Removes all items from cart
- Download ZIP: Generates all STLs and packages

### 7. Share Dialog

```
┌─ Share Design ─────────────────────────────────────────────────────────┐
│                                                                         │
│  Share your design with others                                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  https://gridfinity.xyz/designer?share=AB12CD34                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                          [Copy Link]                    │
│                                                                         │
│  Or share the code: AB12CD34                          [Copy Code]       │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  Load a shared design                                                   │
│  Enter code: [________________]  [Load]                                 │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  ℹ️  Shares expire after 90 days of inactivity                          │
│                                                                         │
│                                         [Close]                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8. WASM Loading Screen

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                                                                        │
│                                                                        │
│                           ┌─────────────┐                              │
│                           │             │                              │
│                           │   [Logo]    │                              │
│                           │             │                              │
│                           └─────────────┘                              │
│                                                                        │
│                         Bin Designer                                   │
│                                                                        │
│                    Loading 3D Engine...                                │
│                                                                        │
│                 ████████████████░░░░░░░░░░ 65%                         │
│                                                                        │
│                    ~3 seconds remaining                                │
│                                                                        │
│                                                                        │
│                                                                        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**States:**
- Loading: Progress bar, ETA
- Ready: Fade out and reveal Designer
- Error: Error message with retry button

### 9. Header Bar

```
┌────────────────────────────────────────────────────────────────────────┐
│  [◇] Bin Designer              [Layout Planner ↗]  [Share]  [Export ▼] │
└────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Logo: Links to home/Designer
- "Layout Planner": Opens planner in new tab
- "Share": Opens share dialog
- "Export": Dropdown with format options + "Add to Cart"

### 10. Mobile Action Sheet

```
┌────────────────────────────────────────┐
│                                        │
│  Actions                               │
│  ─────────────────────────────────     │
│                                        │
│  [↓] Download STL                      │
│  [↓] Download STEP                     │
│  [↓] Download 3MF                      │
│  ─────────────────────────────────     │
│  [🛒] Add to Cart                      │
│  [↗] Share Design                      │
│  [🗑] Reset to Defaults                │
│  ─────────────────────────────────     │
│  [✕] Cancel                            │
│                                        │
└────────────────────────────────────────┘
```

---

## Interaction Patterns

### Parameter Changes

1. User adjusts slider/input
2. Value updates immediately in UI
3. Debounce: 200ms after last change
4. Generation starts in Web Worker
5. Progress shown in preview area
6. On complete: Mesh fades in smoothly
7. Estimates update

### Insert Placement

1. User selects template from library
2. Configures parameters (count, orientation)
3. Clicks "Add to Bin"
4. 2D floor plan view appears
5. Insert shape follows cursor
6. Click to place (snaps to grid)
7. Drag to reposition
8. Generation triggers with new insert

### Export Flow

1. User clicks Export button
2. Dialog shows format options
3. User selects format(s) and quality
4. Clicks "Download"
5. Generation starts (if not already cached)
6. Progress bar shows export progress
7. Download triggers automatically
8. Success toast appears

### Batch Export Flow

1. User designs a bin
2. Clicks "Add to Cart"
3. Design added with thumbnail and estimates
4. User designs another bin
5. Repeats add to cart
6. Clicks "Download ZIP" in cart
7. All designs generated sequentially
8. ZIP file downloads
9. Cart cleared (with undo option)

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Color Contrast** | Minimum 4.5:1 for text, 3:1 for UI elements |
| **Focus Indicators** | 2px amber outline, visible on all backgrounds |
| **Touch Targets** | Minimum 44×44px for all interactive elements |
| **Text Sizing** | Base 16px, scales with browser settings |
| **Motion** | Respect `prefers-reduced-motion` |
| **Screen Readers** | Full ARIA labeling |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move between controls |
| `Shift+Tab` | Move backwards |
| `Enter` | Activate button/select |
| `Space` | Toggle checkbox/switch |
| `Arrow keys` | Adjust sliders, navigate options |
| `Escape` | Close dialog/cancel action |
| `1-4` | Camera presets (when preview focused) |
| `R` | Reset camera view |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save design |
| `Ctrl+E` | Export |

### Screen Reader Support

- All controls have descriptive `aria-label`
- Live regions announce generation status
- Preview has text alternative: "3D preview of a 2 by 3 by 6 unit Gridfinity bin with 1 X divider and 2 Y dividers"
- Form groups have clear labeling
- Error messages announced via `aria-live`

### 3D Preview Accessibility

For users who cannot see the 3D preview:

```
┌─ Design Summary (screen reader alternative) ──────────────────────────┐
│                                                                        │
│  Current design: Gridfinity bin                                        │
│  • Dimensions: 2×3×6 units (83×125×42mm)                              │
│  • Base: Magnet style with 6mm diameter holes                         │
│  • Dividers: 1 in X direction, 2 in Y direction                       │
│  • Features: Scoop enabled, Label "Screws"                            │
│  • Inserts: 4× AA battery vertical                                    │
│  • Estimated: 45g PLA, 2h 15m print time                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| **Mobile** | <768px | Stacked layout, bottom tabs, FAB |
| **Tablet** | 768-899px | Preview top, tabbed params bottom |
| **Desktop** | ≥900px | Side-by-side, full parameter panel |
| **Wide** | ≥1280px | Expanded insert editor inline |

---

## Animation Specifications

### Transitions

| Element | Duration | Easing |
|---------|----------|--------|
| Parameter panel expand/collapse | 200ms | ease-out |
| Insert editor slide up | 250ms | ease-out |
| Dialog open | 150ms | ease-out |
| Dialog close | 100ms | ease-in |
| Toast appear | 200ms | ease-out |
| Toast dismiss | 150ms | ease-in |
| Mesh fade in | 300ms | ease-out |

### Loading Animations

- Progress bar: Smooth fill animation
- Skeleton: Subtle pulse animation
- Spinner: 1s rotation loop
- WASM loading: Gradient shimmer effect

### Reduced Motion

When `prefers-reduced-motion: reduce`:
- Disable skeleton pulse
- Instant transitions (no duration)
- No spinner rotation (static icon)
- No mesh fade (instant swap)

---

## Error States

### Validation Errors

```
┌─ Width ───────────────────────────────┐
│  [──────────●──────────] 7.0          │
│  ⚠️  Maximum width is 6 units          │  ← Red border, warning icon
└───────────────────────────────────────┘
```

### Generation Errors

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                    ⚠️  Generation Failed                                │
│                                                                        │
│  The model couldn't be generated with these parameters.                │
│  Try reducing insert complexity or adjusting dimensions.               │
│                                                                        │
│                    [Retry]  [Reset Parameters]                         │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Network Errors (Share)

```
┌─ Share Error ──────────────────────────────────────────────────────────┐
│                                                                         │
│  ⚠️  Couldn't create share link                                         │
│                                                                         │
│  Please check your internet connection and try again.                   │
│                                                                         │
│                              [Retry]  [Cancel]                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Empty States

### No Inserts

```
┌─ Inserts ──────────────────────────────────────────────────────────────┐
│                                                                         │
│                         ┌─────────┐                                     │
│                         │  [+]    │                                     │
│                         └─────────┘                                     │
│                                                                         │
│                    No inserts added yet                                 │
│                                                                         │
│              Browse templates or create custom shapes                   │
│                                                                         │
│                    [Browse Templates]                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Empty Cart

```
┌─ Export Cart ──────────────────────────────────────────────────────────┐
│                                                                         │
│                         ┌─────────┐                                     │
│                         │  🛒     │                                     │
│                         └─────────┘                                     │
│                                                                         │
│                      Your cart is empty                                 │
│                                                                         │
│            Add designs to download them all at once                     │
│                                                                         │
│                    [Back to Designer]                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-21 | AI Assistant | Initial DRD based on requirements gathering |
