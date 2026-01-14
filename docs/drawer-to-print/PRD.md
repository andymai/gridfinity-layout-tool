# Drawer-to-Print: Product Requirements Document

## Overview

**Product Name:** Gridfinity Layout Tool - Drawer-to-Print Edition
**Version:** 2.0
**Status:** Planning
**Last Updated:** 2025-01-14

### Related Documents

| Document | Purpose | Link |
|----------|---------|------|
| **Product Requirements (PRD)** | This document - user stories, acceptance criteria | — |
| **System Architecture** | Technical implementation, data models, APIs | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **Design Requirements (DRD)** | UI/UX specifications, interaction patterns, accessibility | [DRD.md](./DRD.md) |

---

### Problem Statement

Users of the Gridfinity Layout Tool can design drawer layouts, but must then manually:
1. Find or generate STL files for each unique bin size
2. Find or generate baseplates/grids for their drawer
3. Track quantities and create their own bill of materials
4. Organize files and ensure they have everything needed to print

This fragmented workflow requires jumping between multiple tools, websites, and manual tracking - leading to errors, forgotten pieces, and frustration.

### Vision

Transform the Gridfinity Layout Tool into a **complete end-to-end solution**: input drawer dimensions, design your layout, and download a single ZIP file containing everything needed to print your entire drawer organization system.

### Target Users

| User Type | Description | Key Needs |
|-----------|-------------|-----------|
| **Hobbyist Maker** | 3D prints for personal projects, moderate CAD experience | Simple workflow, good defaults |
| **Power Organizer** | Designs multiple drawers, wants efficiency | Batch operations, templates, reuse |
| **Workshop Owner** | Outfitting tool storage, may have helpers print | Clear BOM, print instructions |
| **Design Contributor** | Creates custom bins to share | Upload/validation, compatibility feedback |

---

## User Stories

### Epic 1: Basic STL Generation

> **Architecture:** [Generation Engine](./ARCHITECTURE.md#1-generation-engine) | **Design:** [Bin Style Selection](./DRD.md#1-bin-style-selection)

**US-1.1: Export Single Bin STL**
> As a user, I want to export an STL file for a specific bin in my layout so that I can print it without using external tools.

Acceptance Criteria:
- [ ] Right-click bin → "Export STL" option
- [ ] Downloads binary STL file with descriptive filename
- [ ] File is valid and prints correctly in common slicers

**US-1.2: Configure Bin Style**
> As a user, I want to choose the style of bin (standard, lite, solid) so that I can optimize for print time or strength.

Acceptance Criteria:
- [ ] Bin inspector shows style dropdown
- [ ] Preview updates to reflect selected style
- [ ] Style persists with bin data

**US-1.3: View Generation Progress**
> As a user, I want to see progress when generating STL files so that I know the system is working.

Acceptance Criteria:
- [ ] Progress indicator shows during generation
- [ ] Estimated time remaining displayed
- [ ] Can cancel long-running generations

---

### Epic 2: Baseplate Generation

> **Architecture:** [BaseplateConfig](./ARCHITECTURE.md#extended-layout-type) | **Design:** Component specs in DRD

**US-2.1: Auto-Generate Baseplate**
> As a user, I want the tool to automatically generate a baseplate that fits my drawer so that I don't have to find one separately.

Acceptance Criteria:
- [ ] Baseplate option in drawer settings
- [ ] Generates correct size for drawer dimensions
- [ ] Handles fractional edges appropriately

**US-2.2: Configure Baseplate Options**
> As a user, I want to configure baseplate options (magnets, screws, style) so that it matches my needs.

Acceptance Criteria:
- [ ] Toggle magnet holes on/off
- [ ] Toggle screw holes on/off
- [ ] Select style (weighted, lite, magnetic)

**US-2.3: Subdivide Large Baseplates**
> As a user, I want large baseplates to be automatically split into printable sections so that I can print them on my printer.

Acceptance Criteria:
- [ ] Detects when baseplate exceeds print bed
- [ ] Automatically subdivides with alignment features
- [ ] Shows subdivision preview
- [ ] Generates separate STL for each section

---

### Epic 3: Bin Customization

> **Architecture:** [BinParams interface](./ARCHITECTURE.md#1-generation-engine) | **Design:** [Parameter Configuration](./DRD.md#2-parameter-configuration)

**US-3.1: Add Dividers**
> As a user, I want to add internal dividers to bins so that I can organize small items within a single bin.

Acceptance Criteria:
- [ ] Specify X and Y division count
- [ ] Preview shows dividers in 3D view
- [ ] Dividers included in generated STL

**US-3.2: Add Scoop**
> As a user, I want to add a finger scoop to bins so that I can easily retrieve items.

Acceptance Criteria:
- [ ] Toggle scoop on/off
- [ ] Configure scoop depth (subtle to full)
- [ ] Select which sides have scoops

**US-3.3: Add Label Tab**
> As a user, I want bins to have label tabs so that I can identify contents at a glance.

Acceptance Criteria:
- [ ] Toggle label tab on/off
- [ ] Select label style (full width, center, left, right)
- [ ] Label tab angle configurable

**US-3.4: Configure Magnets**
> As a user, I want to specify whether bins have magnet holes so that they stay in place.

Acceptance Criteria:
- [ ] Toggle magnet holes on/off
- [ ] Standard 6mm x 2mm magnet size
- [ ] Option for all corners or selective

---

### Epic 4: Custom Model Import

> **Architecture:** [Custom Model Service](./ARCHITECTURE.md#3-custom-model-service) | **Design:** [STL File Upload](./DRD.md#3-stl-file-upload), [Grid Compatibility](./DRD.md#4-grid-compatibility-validation)

**US-4.1: Upload Custom STL**
> As a user, I want to upload my own STL files so that I can use specialty bins I've found or designed.

Acceptance Criteria:
- [ ] Drag-and-drop upload area
- [ ] Accepts .stl files (ASCII and binary)
- [ ] Shows upload progress
- [ ] File size limit clearly communicated (20MB)

**US-4.2: Validate Grid Compatibility**
> As a user, I want uploaded models to be checked for Gridfinity compatibility so that I know if they'll fit properly.

Acceptance Criteria:
- [ ] Automatic dimension analysis
- [ ] Shows detected grid size (e.g., "2x3x4")
- [ ] Warns if dimensions don't align to grid units
- [ ] Suggests nearest compatible size

**US-4.3: Manage Custom Models**
> As a user, I want to manage my uploaded models (rename, delete, organize) so that I can build a personal library.

Acceptance Criteria:
- [ ] List view of uploaded models
- [ ] Rename functionality
- [ ] Delete with confirmation
- [ ] Shows file size and upload date

**US-4.4: Place Custom Model in Layout**
> As a user, I want to place uploaded models in my layout just like regular bins so that I can incorporate them in my design.

Acceptance Criteria:
- [ ] Custom models appear in model picker
- [ ] Drag to place on grid
- [ ] Collision detection works correctly
- [ ] Shows in 3D preview

---

### Epic 5: Full Export Package

> **Architecture:** [Export Pipeline](./ARCHITECTURE.md#4-export-pipeline), [ZIP Structure](./ARCHITECTURE.md#zip-structure) | **Design:** [Export Flow](./DRD.md#5-export-flow)

**US-5.1: Export Complete ZIP**
> As a user, I want to download a single ZIP file with everything I need to print so that I have a complete package.

Acceptance Criteria:
- [ ] Single "Export All" button
- [ ] ZIP contains all unique STLs needed
- [ ] Includes baseplates if enabled
- [ ] Well-organized folder structure

**US-5.2: View Bill of Materials**
> As a user, I want a bill of materials showing what I need to print so that I can plan my print queue.

Acceptance Criteria:
- [ ] Lists all unique parts with quantities
- [ ] Shows estimated filament per part
- [ ] Shows estimated print time per part
- [ ] Includes hardware (magnets, screws) if applicable

**US-5.3: Export BOM as Spreadsheet**
> As a user, I want to export the BOM as a CSV/spreadsheet so that I can track my printing progress.

Acceptance Criteria:
- [ ] CSV export option
- [ ] Includes all relevant columns
- [ ] Formatted for easy spreadsheet import
- [ ] Checkbox column for tracking completion

**US-5.4: View Print Instructions**
> As a user, I want print instructions included in the export so that I or a helper can print correctly.

Acceptance Criteria:
- [ ] README.md with drawer overview
- [ ] Recommended slicer settings
- [ ] Layer-by-layer visual guide
- [ ] Tips for common issues

**US-5.5: Monitor Export Progress**
> As a user, I want to see progress during export so that I know how long it will take.

Acceptance Criteria:
- [ ] Overall progress bar
- [ ] Current file being generated
- [ ] Estimated time remaining
- [ ] Can cancel if needed

---

### Epic 6: Model Library

> **Architecture:** [Model Library Store](./ARCHITECTURE.md#2-model-library-store) | **Design:** [Model Library Navigation](./DRD.md#6-model-library-navigation)

**US-6.1: Browse Built-in Templates**
> As a user, I want to browse a library of bin templates so that I can find bins for specific purposes.

Acceptance Criteria:
- [ ] Categorized template browser
- [ ] Thumbnail previews
- [ ] Search/filter functionality
- [ ] One-click to add to layout

**US-6.2: Save Custom Configurations**
> As a user, I want to save bin configurations as templates so that I can reuse them.

Acceptance Criteria:
- [ ] "Save as Template" option
- [ ] Name and categorize template
- [ ] Appears in personal library
- [ ] Can edit or delete saved templates

**US-6.3: Import from URL**
> As a user, I want to import models from a URL so that I can use models from Printables, Thingiverse, etc.

Acceptance Criteria:
- [ ] Paste URL to import
- [ ] Supports direct STL links
- [ ] Shows source attribution
- [ ] Same validation as file upload

---

## Feature Requirements

> **Implementation Details:** See [Architecture: Technology Recommendations](./ARCHITECTURE.md#technology-recommendations) for bundle sizes and library choices. Phase numbers correspond to [Architecture: Migration Path](./ARCHITECTURE.md#migration-path).

### Functional Requirements

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| FR-01 | Generate valid STL files for standard Gridfinity bins | Must Have | 2 |
| FR-02 | Support bin sizes from 1x1 to 6x6 grid units | Must Have | 2 |
| FR-03 | Support bin heights from 1 to 10 height units | Must Have | 2 |
| FR-04 | Generate baseplates matching drawer dimensions | Must Have | 3 |
| FR-05 | Subdivide baseplates exceeding print bed size | Must Have | 3 |
| FR-06 | Import and validate STL files up to 20MB | Must Have | 4 |
| FR-07 | Detect Gridfinity grid compatibility of imports | Should Have | 4 |
| FR-08 | Generate bins with internal dividers (1-6 per axis) | Should Have | 5 |
| FR-09 | Generate bins with finger scoops | Should Have | 5 |
| FR-10 | Generate bins with label tabs | Should Have | 5 |
| FR-11 | Generate bins with magnet holes | Should Have | 5 |
| FR-12 | Export ZIP with all STLs and BOM | Must Have | 6 |
| FR-13 | Generate BOM with quantities and estimates | Must Have | 6 |
| FR-14 | Include print instructions in export | Should Have | 6 |
| FR-15 | Provide built-in bin template library | Could Have | 6 |
| FR-16 | Support OpenSCAD-based advanced generation | Could Have | 7 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | STL generation must not block UI | Web Worker isolation |
| NFR-02 | Single bin generation completes in < 5 seconds | P95 latency |
| NFR-03 | Full drawer export (50 bins) completes in < 60 seconds | P95 latency |
| NFR-04 | Application loads in < 3 seconds on 4G connection | Initial bundle |
| NFR-05 | Generation features work offline (PWA) | After initial load |
| NFR-06 | Custom models persist across sessions | IndexedDB storage |
| NFR-07 | Export works on Chrome, Firefox, Safari, Edge | Cross-browser |
| NFR-08 | Generated STLs are valid/manifold meshes | 100% success rate |

---

## User Interface

> **Detailed Specifications:** The wireframes below show conceptual layouts. For complete interaction patterns, accessibility requirements, responsive behavior, and component specifications, see the [Design Requirements Document](./DRD.md).

### Export Modal Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  Export Drawer Package                                     [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Drawer: "Workshop Main Drawer"                                 │
│  Size: 10 x 8 grid units (420mm x 336mm)                       │
│  Bins: 24 total (12 unique configurations)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ INCLUDE IN EXPORT                                        │   │
│  │                                                          │   │
│  │ [✓] Bins (24 bins, 12 unique STLs)                      │   │
│  │ [✓] Baseplate (10x8, will be split into 4 sections)     │   │
│  │ [✓] Bill of Materials (CSV)                             │   │
│  │ [✓] Print Instructions (README)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BASEPLATE OPTIONS                                        │   │
│  │                                                          │   │
│  │ Style:    [Weighted ▼]                                  │   │
│  │ Magnets:  [✓] Include 6x2mm magnet holes                │   │
│  │ Screws:   [ ] Include M3 screw holes                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ESTIMATES                                                │   │
│  │                                                          │   │
│  │ Total Filament:  ~847m (estimated)                      │   │
│  │ Print Time:      ~42 hours (estimated)                  │   │
│  │ File Count:      17 STL files                           │   │
│  │ Download Size:   ~12 MB                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                              [Cancel]  [Export ZIP]             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Bin Inspector Extension Wireframe

```
┌─────────────────────────────────────────┐
│  BIN INSPECTOR                          │
├─────────────────────────────────────────┤
│                                         │
│  Size: 3 x 2 x 4                        │
│  Position: (2, 3) on Layer 1            │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  GENERATION OPTIONS                     │
│                                         │
│  Style         [Standard ▼]             │
│                                         │
│  ┌─ Dividers ─────────────────────┐    │
│  │ [✓] Enabled                    │    │
│  │ X Divisions: [2] Y Divisions: [2]   │
│  │ Style: [Full Height ▼]         │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌─ Scoop ────────────────────────┐    │
│  │ [✓] Enabled                    │    │
│  │ Depth: [──●────] 40%           │    │
│  │ Sides: [✓]Front [ ]Back        │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌─ Label Tab ────────────────────┐    │
│  │ [✓] Enabled                    │    │
│  │ Style: [Full Width ▼]          │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌─ Base ─────────────────────────┐    │
│  │ [✓] Magnet holes (6x2mm)       │    │
│  │ [ ] Screw holes (M3)           │    │
│  └────────────────────────────────┘    │
│                                         │
│  [Export STL]  [Apply to Similar]       │
│                                         │
└─────────────────────────────────────────┘
```

### Model Library Panel Wireframe

```
┌─────────────────────────────────────────┐
│  MODEL LIBRARY                    [+]   │
├─────────────────────────────────────────┤
│  [Search models...]              [⚙]    │
│                                         │
│  ▼ STANDARD BINS                        │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐              │
│  │   │ │   │ │ ┃ │ │ ╋ │              │
│  │   │ │___│ │ ┃ │ │ ╋ │              │
│  └───┘ └───┘ └───┘ └───┘              │
│  Plain  Scoop  2-Div  4-Div            │
│                                         │
│  ▼ SPECIALTY                            │
│  ┌───┐ ┌───┐ ┌───┐                     │
│  │ ○ │ │▭▭▭│ │ ⌂ │                     │
│  │ ○ │ │▭▭▭│ │   │                     │
│  └───┘ └───┘ └───┘                     │
│  Battery  SD Card  Bit Holder          │
│                                         │
│  ▼ MY UPLOADS (3)                       │
│  ┌───┐ ┌───┐ ┌───┐                     │
│  │ ? │ │ ? │ │ ? │                     │
│  │   │ │   │ │   │                     │
│  └───┘ └───┘ └───┘                     │
│  Custom1 Custom2 Custom3               │
│                                         │
│  [Upload Custom STL...]                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## Success Metrics

### Primary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Export Completion Rate | > 95% | Exports started vs. completed |
| Export Success Rate | > 99% | Completed without error |
| STL Validity Rate | 100% | Generated STLs pass mesh validation |
| Custom Import Success | > 80% | Uploads that validate successfully |

### Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to First Export | < 2 min | New user to first ZIP download |
| Average Export Time | < 30s | For typical drawer (20-50 bins) |
| Custom Model Uploads | > 10% of users | Users who upload at least one STL |
| Repeat Exports | > 50% | Users who export more than once |

### User Satisfaction

| Signal | Target |
|--------|--------|
| Feature requests for generation features | Decreasing trend |
| Support requests about STL compatibility | < 5% of exports |
| User feedback sentiment | Net positive |

---

## Constraints and Assumptions

### Constraints

1. **Browser-only** - All generation must happen client-side; no server processing
2. **Bundle size** - Core bundle must remain under 1MB gzip
3. **Offline support** - Generation must work offline after initial load
4. **No accounts** - System must work without user authentication
5. **Local storage** - Custom models stored locally, not in cloud

### Assumptions

1. Users have modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
2. Users understand basic 3D printing concepts
3. Users have printers capable of standard Gridfinity dimensions
4. Most users will use default generation settings
5. Custom model uploads will be relatively rare (< 20% of users)

### Dependencies

1. Gridfinity specification remains stable
2. JSCAD library continues to be maintained
3. Browser IndexedDB quotas remain sufficient (50MB+)
4. Three.js STL import/export remains functional

---

## Out of Scope

The following are explicitly **not** included in this PRD:

1. **Slicer integration** - No direct connection to slicer software
2. **Cloud model library** - No shared/community model repository
3. **Print monitoring** - No connection to printers/OctoPrint
4. **Model editing** - No CAD editing of uploaded STLs
5. **Non-Gridfinity systems** - Only Gridfinity-compatible generation
6. **Commercial licensing** - No paid features or subscriptions
7. **Mobile STL generation** - May be limited on mobile devices

---

## Rollout Plan

> **Technical Implementation:** Each phase maps to the [Architecture: Migration Path](./ARCHITECTURE.md#migration-path) with detailed technical tasks and code organization.

### Phase 1: Foundation (Internal)
- Infrastructure without user-visible changes
- Performance benchmarking
- Internal testing

### Phase 2: Beta - Basic Generation
- Feature flag: `enable_stl_export`
- Limited to standard bins only
- Feedback collection

### Phase 3: Beta - Baseplates
- Add baseplate generation
- Subdivision for large drawers
- Expanded testing

### Phase 4: Beta - Custom Import
- Upload functionality
- Validation feedback
- Storage management

### Phase 5: Beta - Full Features
- All bin customization options
- Complete export package
- Documentation

### Phase 6: General Availability
- Remove feature flags
- Marketing/announcement
- Monitor adoption

### Phase 7: Advanced Features
- OpenSCAD integration
- Power user features
- Based on feedback

---

## Open Questions

1. **Template licensing** - Can we bundle bin templates from community creators?
2. **File naming** - What naming convention is most useful for users?
3. **Print bed detection** - Should we try to detect user's printer/bed size?
4. **Magnet sourcing** - Should we link to magnet suppliers in BOM?
5. **Feedback mechanism** - How do users report generation issues?
6. **Analytics** - What generation events should we track (with consent)?

---

## Appendix: Competitive Analysis

### Existing Solutions

| Tool | Strengths | Weaknesses |
|------|-----------|------------|
| [Gridfinity Generator](https://gridfinity.perplexinglabs.com/) | Full parametric control | No layout planning |
| [GridfinityCreator](https://gridfinity.bouwens.co/) | STEP export, many options | No drawer context |
| [gridfinity.tools](https://gridfinity.tools/) | Simple interface | Limited customization |
| Manual OpenSCAD | Complete control | Steep learning curve |

### Our Differentiation

1. **Integrated workflow** - Layout → Generation in one tool
2. **Drawer-centric** - Sized to actual drawer, not abstract
3. **Complete package** - One ZIP with everything needed
4. **Visual verification** - See bins before generating
5. **No cloud dependency** - Works offline, data stays local

---

*Document created: 2025-01-14*
*Status: Draft PRD - For Review*
