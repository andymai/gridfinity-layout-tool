# Bin Designer - Product Requirements Document

## Overview

**Feature:** Standalone Bin Designer with Layout Planner Integration
**Version:** 1.0
**Status:** Planning
**Last Updated:** 2025-01-21

### Related Documents

| Document | Purpose | Link |
|----------|---------|------|
| **Product Requirements** | This document - user stories, acceptance criteria | — |
| **System Architecture** | Technical implementation with replicad | [BIN-DESIGNER-ARCHITECTURE.md](./BIN-DESIGNER-ARCHITECTURE.md) |
| **Design Requirements** | UI/UX specifications, accessibility | [BIN-DESIGNER-DRD.md](./BIN-DESIGNER-DRD.md) |
| **Original Drawer-to-Print PRD** | Layout export features (separate scope) | [PRD.md](./PRD.md) |

---

## Vision

Create a **standalone Bin Designer** at `/designer` that empowers users to create custom parametric Gridfinity bins with full control over dimensions, features, and inserts—then seamlessly sync those designs to the Layout Planner for complete drawer organization workflows.

## Executive Summary

The Bin Designer is a dedicated page for creating parametric Gridfinity bins using the **replicad** library (OpenCascade WASM). It serves two user personas:

1. **Standalone Users** - Want to quickly design and export a custom bin without using the full layout tool
2. **Layout Planner Users** - Want to create custom bins that integrate into their drawer layouts

Key capabilities:
- **Full Parametric Control** - Dimensions, dividers, scoops, labels, magnets, base options
- **Insert Templates** - Pre-built cavity shapes for electronics, hardware, and tools
- **Multiple Export Formats** - STL, STEP, and full 3MF with print settings
- **Auto-Sync to Library** - Designs automatically appear in Layout Planner's bin library
- **Batch Export** - Queue multiple designs for single ZIP download
- **Offline Support** - Full PWA functionality after initial WASM load

---

## Technology Choice: replicad

### Why replicad over JSCAD?

| Aspect | replicad | JSCAD |
|--------|----------|-------|
| **Geometry** | BREP (boundary representation) | Mesh-based CSG |
| **Precision** | CAD-grade (OpenCascade kernel) | Approximate mesh operations |
| **Fillets/Chamfers** | Native, precise | Approximated, can fail |
| **STEP Export** | Native support | Not supported |
| **Text/Embossing** | Built-in text shapes | Requires external fonts |
| **Bundle Size** | ~3MB WASM (lazy loaded) | ~1MB |
| **API Style** | CadQuery-inspired, chainable | OpenSCAD-inspired |

**Decision:** replicad's BREP geometry is essential for:
- Precise fillets on bin edges (Gridfinity spec compliance)
- Native STEP export for CAD software interop
- Text embossing for labels
- Complex insert cavities without mesh artifacts

---

## User Personas

### Primary: DIY Organizer ("Alex")
- Has a 3D printer, wants custom storage solutions
- Comfortable with basic parameters but not CAD software
- Values quick iteration and immediate visual feedback

### Secondary: Power User ("Jordan")
- Uses Layout Planner extensively
- Wants custom bins that match their specific drawer layouts
- May want to share designs with community

### Tertiary: Casual Browser ("Sam")
- Just wants a quick bin, no account needed
- Discovers via search, exports STL, leaves
- May return if experience is good

---

## Epics and User Stories

### Epic 1: Core Bin Generation

#### US-1.1: Set Bin Dimensions
**As a** user
**I want to** specify bin width, depth, and height in Gridfinity units
**So that** I can create bins that fit my drawer layout

**Acceptance Criteria:**
- [ ] Width/depth: 0.5 to 6 units (0.5 increments, matching Layout Planner)
- [ ] Height: 1 to 12 units (7mm per unit)
- [ ] Real-time 3D preview updates within 500ms
- [ ] Invalid combinations show clear error messages
- [ ] Dimensions persist across page reloads (IndexedDB)

#### US-1.2: Configure Base Options
**As a** user
**I want to** customize the bin base (magnets, screws, weighted, stacking lip)
**So that** my bins work with my baseplate setup

**Acceptance Criteria:**
- [ ] Base style presets: Standard, Magnet (6x2mm), Screw (M3), Weighted
- [ ] Stacking lip toggle (allows bins to stack on each other)
- [ ] Magnet hole depth configurable (2-4mm)
- [ ] Preview shows base features accurately

#### US-1.3: Add Dividers
**As a** user
**I want to** add internal dividers to my bin
**So that** I can organize multiple item types in one bin

**Acceptance Criteria:**
- [ ] X and Y divider count (0-10 each direction)
- [ ] Divider thickness: 1.2mm default (configurable 0.8-2.0mm)
- [ ] Dividers snap to grid when count changes
- [ ] Preview shows divider positions accurately

#### US-1.4: Configure Scoops
**As a** user
**I want to** add finger scoops to compartments
**So that** I can easily pick up small items

**Acceptance Criteria:**
- [ ] Simple on/off toggle (not per-compartment in MVP)
- [ ] Scoop radius proportional to compartment size
- [ ] Scoops applied to all compartments uniformly

#### US-1.5: Add Label Area
**As a** user
**I want to** add a label embossing area with optional text
**So that** I can identify bin contents

**Acceptance Criteria:**
- [ ] Label toggle (on/off)
- [ ] Single-line text input (max 20 characters)
- [ ] Auto-sizing font to fit label area
- [ ] Text embossed 0.4mm deep (single-color print friendly)
- [ ] Label position: front lip (standard Gridfinity location)

### Epic 2: Bin Style Variants

#### US-2.1: Select Bin Style
**As a** user
**I want to** choose from multiple bin styles
**So that** I can optimize for my use case (strength, print time, material)

**Acceptance Criteria:**
- [ ] **Standard** - Full walls, maximum durability
- [ ] **Lite** - Reduced infill/walls, faster print
- [ ] **Solid** - No internal features, for heavy items
- [ ] **Vase Mode** - Single-wall spiral, fastest print
- [ ] **Rugged** - Thicker walls, reinforced corners
- [ ] Style selection updates preview and print estimates

### Epic 3: Insert Templates

#### US-3.1: Browse Insert Templates
**As a** user
**I want to** browse pre-made insert templates
**So that** I can quickly create bins for common items

**Acceptance Criteria:**
- [ ] Template categories: Electronics, Hardware, Tools
- [ ] Search/filter by name or category
- [ ] Template preview thumbnails
- [ ] One-click apply to current bin

#### US-3.2: Electronics Templates (Priority)
**As a** user
**I want to** insert templates for batteries, SD cards, and USB drives
**So that** I can organize my electronics drawer

**Templates Required:**
- [ ] **AA Battery** - 14.5mm diameter, 50.5mm length
- [ ] **AAA Battery** - 10.5mm diameter, 44.5mm length
- [ ] **9V Battery** - 26.5 x 17.5 x 48.5mm
- [ ] **CR2032 Coin Cell** - 20mm diameter, 3.2mm height (stackable)
- [ ] **SD Card** - 32 x 24 x 2.1mm (with spring holder option)
- [ ] **MicroSD Card** - 15 x 11 x 1mm
- [ ] **USB-A Drive** - 12 x 5 x 45mm (configurable length)
- [ ] **USB-C Cable Coil** - Circular, diameter configurable

#### US-3.3: Hardware Templates
**As a** user
**I want to** insert templates for screws, nuts, and fasteners
**So that** I can organize my hardware collection

**Templates Required:**
- [ ] **M2-M8 Screw Slots** - Length-configurable channels
- [ ] **Hex Nut Pockets** - M2-M8 with exact hex cutouts
- [ ] **Washer Stack** - Circular posts for washer storage
- [ ] **Hex Key Holder** - Angled slots for Allen keys (1.5-10mm)
- [ ] **Bit Holder** - 1/4" hex bit slots

#### US-3.4: Tool Templates
**As a** user
**I want to** insert templates for common tools
**So that** I can organize my toolbox

**Templates Required:**
- [ ] **Screwdriver Slot** - Configurable shaft diameter
- [ ] **Pliers Cradle** - V-groove for plier handles
- [ ] **Marker/Pen Holder** - Cylindrical holes (diameter configurable)
- [ ] **Tape Measure Pocket** - Curved pocket for tape measure body
- [ ] **Utility Knife Slot** - Standard utility knife profile

#### US-3.5: Fork and Modify Templates
**As a** user
**I want to** start from a template and modify it
**So that** I can customize without starting from scratch

**Acceptance Criteria:**
- [ ] "Fork" button on any template
- [ ] All parameters become editable after fork
- [ ] No attribution required for forked designs
- [ ] Original template remains unchanged

### Epic 4: Custom Insert Editor

#### US-4.1: Basic Shape Primitives
**As a** user
**I want to** add basic shapes (rectangles, circles, hex) as inserts
**So that** I can create custom cavities

**Acceptance Criteria:**
- [ ] Shape types: Rectangle, Circle, Hexagon, Rounded Rectangle
- [ ] Position via click-and-drag on bin floor plan
- [ ] Size handles for resize
- [ ] Depth configurable per shape
- [ ] Grid snapping (0.5mm increments)

#### US-4.2: Visual Drag-Drop Editor
**As a** user
**I want to** visually arrange insert shapes
**So that** I can design complex cavity layouts

**Acceptance Criteria:**
- [ ] 2D top-down view of bin interior
- [ ] Drag shapes from palette onto bin
- [ ] Snap to grid and to other shapes
- [ ] Multi-select for group operations
- [ ] Copy/paste shapes
- [ ] Undo/redo (parameter-level, 50 states)

#### US-4.3: Side Cutouts
**As a** user
**I want to** add cutouts to bin walls
**So that** long items can extend beyond the bin

**Acceptance Criteria:**
- [ ] Per-side wall height control (0-100% of bin height)
- [ ] Cutout shape: rectangular (full width of side)
- [ ] Preview shows cutout accurately
- [ ] Structural warnings if cutout compromises bin integrity

### Epic 5: Export and Formats

#### US-5.1: STL Export
**As a** user
**I want to** export my bin design as an STL file
**So that** I can print it on any 3D printer

**Acceptance Criteria:**
- [ ] Binary STL format (smaller file size)
- [ ] Mesh quality setting (draft/standard/high)
- [ ] Watertight mesh validation
- [ ] Download triggers immediately after generation

#### US-5.2: STEP Export
**As a** user
**I want to** export my bin design as a STEP file
**So that** I can modify it in CAD software

**Acceptance Criteria:**
- [ ] STEP AP214 format (widely compatible)
- [ ] Preserves BREP geometry (no mesh conversion)
- [ ] Suitable for Fusion 360, FreeCAD, SolidWorks import

#### US-5.3: 3MF Export (Full Project)
**As a** user
**I want to** export a complete 3MF project file
**So that** I can open it in my slicer with all settings ready

**Acceptance Criteria:**
- [ ] 3MF with embedded mesh
- [ ] Print settings metadata (layer height, infill suggestions)
- [ ] Thumbnail preview image
- [ ] Multi-part support (if bin has separate components)
- [ ] Color/texture information for multi-material printers

#### US-5.4: Print Estimates
**As a** user
**I want to** see estimated print time and filament usage
**So that** I can plan my prints

**Acceptance Criteria:**
- [ ] Filament estimate in grams and meters
- [ ] Print time estimate (based on conservative settings)
- [ ] Cost estimate (user-configurable $/kg)
- [ ] Estimates update in real-time with parameter changes

#### US-5.5: File Naming
**As a** user
**I want to** choose my preferred file naming convention
**So that** my downloads are organized how I like

**Acceptance Criteria:**
- [ ] Option: Descriptive (e.g., `gridfinity_2x3x6_dividers_scoop.stl`)
- [ ] Option: Compact (e.g., `gf_2x3x6.stl`)
- [ ] Custom prefix option
- [ ] Preference saved to settings

### Epic 6: Batch Mode

#### US-6.1: Design Queue/Cart
**As a** user
**I want to** queue multiple bin designs
**So that** I can download them all at once

**Acceptance Criteria:**
- [ ] "Add to Cart" button on each design
- [ ] Cart shows design thumbnails and names
- [ ] Remove individual items from cart
- [ ] Cart persists across page reloads

#### US-6.2: Batch Export
**As a** user
**I want to** export all queued designs as a ZIP file
**So that** I don't have to download them one by one

**Acceptance Criteria:**
- [ ] ZIP contains all designs in selected format(s)
- [ ] Progress indicator during generation
- [ ] Can continue designing while export runs in background
- [ ] ZIP includes manifest.txt with design details

### Epic 7: Integration with Layout Planner

#### US-7.1: Auto-Sync to Library
**As a** user
**I want to** my Designer bins to automatically appear in Layout Planner
**So that** I can use them in my drawer layouts

**Acceptance Criteria:**
- [ ] Every saved design syncs to shared library index
- [ ] Layout Planner shows Designer bins in bin palette
- [ ] Thumbnail preview generated from 3D model
- [ ] Sync is automatic (no manual export/import)

#### US-7.2: Navigate to Designer from Planner
**As a** user
**I want to** open the Bin Designer from Layout Planner
**So that** I can create custom bins without losing my place

**Acceptance Criteria:**
- [ ] "Create Custom Bin" button in Layout Planner
- [ ] Opens Designer in new tab (preserves Planner state)
- [ ] Optional: Pass current bin dimensions as starting point

#### US-7.3: Navigate to Planner from Designer
**As a** user
**I want to** go to Layout Planner after designing
**So that** I can use my new bin in a layout

**Acceptance Criteria:**
- [ ] "Use in Layout" button in Designer
- [ ] Opens Layout Planner (or switches to existing tab)
- [ ] Newly created bin is highlighted/selected

### Epic 8: Sharing

#### US-8.1: Generate Share Code
**As a** user
**I want to** share my bin design via short code
**So that** others can use my design

**Acceptance Criteria:**
- [ ] "Share" button generates 8-character code
- [ ] Code stored via existing Vercel backend
- [ ] Share includes all parameters (not the STL file)
- [ ] Expiration: 90 days (same as layout shares)

#### US-8.2: Load Shared Design
**As a** user
**I want to** load a bin design from a share code
**So that** I can use or modify someone else's design

**Acceptance Criteria:**
- [ ] Input field for share code
- [ ] Or: URL format `/designer?share=ABCD1234`
- [ ] Loads all parameters into Designer
- [ ] User can modify and re-share (fork)

### Epic 9: Offline and Performance

#### US-9.1: PWA Offline Support
**As a** user
**I want to** use the Designer offline
**So that** I can design bins without internet

**Acceptance Criteria:**
- [ ] WASM bundle cached after first load
- [ ] Full generation works offline
- [ ] Designs saved to IndexedDB
- [ ] Share features gracefully disabled offline

#### US-9.2: WASM Loading Experience
**As a** user
**I want to** see progress while WASM loads
**So that** I know the app is working

**Acceptance Criteria:**
- [ ] Loading indicator with percentage
- [ ] Estimated time remaining
- [ ] Skeleton UI shown during load
- [ ] Error state with retry button if load fails

#### US-9.3: Generation Queue System
**As a** user
**I want to** parameter changes to cancel in-progress generation
**So that** I always see the latest design

**Acceptance Criteria:**
- [ ] New parameter change cancels previous generation
- [ ] Debounce: 200ms after last parameter change
- [ ] Visual indicator when generation is in progress
- [ ] Smooth transition when new model is ready

#### US-9.4: WASM Failure Fallback
**As a** user
**I want to** graceful handling if WASM fails to load
**So that** I understand what happened and what to do

**Acceptance Criteria:**
- [ ] Clear error message explaining the issue
- [ ] Suggestions: try different browser, check memory
- [ ] Link to pre-generated STL library as alternative
- [ ] No crash or white screen

### Epic 10: Accessibility

#### US-10.1: Keyboard Navigation
**As a** keyboard user
**I want to** full keyboard access to all Designer features
**So that** I can design bins without a mouse

**Acceptance Criteria:**
- [ ] Tab order follows logical flow
- [ ] All controls keyboard accessible
- [ ] Focus indicators clearly visible
- [ ] Shortcuts documented in help modal

#### US-10.2: Screen Reader Support
**As a** screen reader user
**I want to** understand the current bin design
**So that** I can create bins without seeing the preview

**Acceptance Criteria:**
- [ ] All controls have descriptive labels
- [ ] 3D preview has text alternative describing bin
- [ ] Parameter changes announced via live regions
- [ ] Export success/failure announced

#### US-10.3: 3D Preview Accessibility
**As a** user with limited vision
**I want to** alternative ways to understand the bin shape
**So that** I can verify my design

**Acceptance Criteria:**
- [ ] Text description of bin (dimensions, features)
- [ ] High contrast mode for preview
- [ ] Zoom controls with keyboard support
- [ ] Optional: Audio cues for feature toggles

---

## Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| WASM initial load | < 5s on 4G connection |
| Parameter change → preview update | < 500ms |
| STL generation (standard bin) | < 2s |
| STEP generation | < 3s |
| 3MF generation | < 5s |
| Memory usage | < 500MB peak |

### Compatibility

- **Browsers:** Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
- **Devices:** Desktop, tablet, mobile (touch-optimized)
- **Offline:** Full functionality after initial WASM load

### Security

- No user accounts required (anonymous usage)
- Share codes do not contain executable content
- All generation happens client-side (no server processing)
- Rate limiting on share creation (existing backend limits)

---

## Success Metrics

### Adoption

| Metric | Target (6 months) |
|--------|-------------------|
| Monthly active users (Designer) | 5,000 |
| Designs created | 50,000 |
| Designs exported | 30,000 |
| Designs shared | 5,000 |

### Engagement

| Metric | Target |
|--------|--------|
| Avg. designs per user per session | 3+ |
| Return user rate (7-day) | 40% |
| Cross-feature usage (Designer → Planner) | 25% |

### Quality

| Metric | Target |
|--------|--------|
| Generation error rate | < 1% |
| WASM load failure rate | < 2% |
| User-reported issues | < 10/month |

---

## Rollout Plan

### Phase 1: Alpha (Internal)
- Core bin generation (dimensions, base, dividers)
- STL export only
- No sharing or integration
- **Duration:** 4 weeks

### Phase 2: Beta (Limited)
- Add scoops, labels, bin styles
- Add STEP and 3MF export
- Add insert templates (electronics only)
- Basic Layout Planner integration
- **Duration:** 4 weeks

### Phase 3: Public Launch
- Full insert template library
- Visual insert editor
- Sharing via short codes
- Batch export
- **Duration:** 2 weeks

### Phase 4: Enhancement
- Community template submissions
- Additional insert templates
- Performance optimizations
- Mobile experience polish
- **Duration:** Ongoing

---

## Out of Scope (v1.0)

- Custom STL import (planned for future)
- Baseplate generation (separate feature, see PRD.md)
- User accounts / design cloud storage
- Real-time collaboration on designs
- OpenSCAD/FreeCAD code export
- Parametric baseplate generation

---

## Appendix: Insert Template Specifications

### Electronics Templates - Detailed Dimensions

| Item | Outer Dimensions | Clearance | Notes |
|------|------------------|-----------|-------|
| AA Battery | 14.5 × 50.5mm | +0.5mm | Vertical or horizontal orientation |
| AAA Battery | 10.5 × 44.5mm | +0.5mm | Vertical or horizontal orientation |
| 9V Battery | 26.5 × 17.5 × 48.5mm | +0.5mm | Snap connector accessible |
| CR2032 | 20 × 3.2mm | +0.3mm | Stackable, spring optional |
| SD Card | 32 × 24 × 2.1mm | +0.3mm | Spring holder optional |
| MicroSD | 15 × 11 × 1mm | +0.3mm | With adapter pocket option |
| USB-A | 12 × 5 × 45mm | +0.5mm | Length configurable |

### Hardware Templates - Metric Fasteners

| Item | Dimensions | Clearance | Notes |
|------|------------|-----------|-------|
| M2 Screw | 2 × 4-20mm | +0.3mm | Slot or round pocket |
| M3 Screw | 3 × 6-30mm | +0.3mm | Most common size |
| M4 Screw | 4 × 8-40mm | +0.4mm | — |
| M5 Screw | 5 × 10-50mm | +0.4mm | — |
| M6 Screw | 6 × 12-60mm | +0.5mm | — |
| M8 Screw | 8 × 16-80mm | +0.5mm | — |
| M3 Hex Nut | 5.5mm AF × 2.4mm | +0.3mm | Hex pocket |
| M4 Hex Nut | 7mm AF × 3.2mm | +0.3mm | Hex pocket |
| M5 Hex Nut | 8mm AF × 4mm | +0.4mm | Hex pocket |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-21 | AI Assistant | Initial PRD based on requirements gathering |
