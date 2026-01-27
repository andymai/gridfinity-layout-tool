# Changelog

All notable changes to the Gridfinity Layout Tool are documented here.

This project follows a continuous deployment model - changes ship as soon as they're ready. For guidance on maintaining this changelog, see [CHANGELOG_STYLE_GUIDE.md](./CHANGELOG_STYLE_GUIDE.md).

---

## [2026-01-26] - "The Polish Update"

### Added

- **Default Categories Preference** - Save your carefully curated category colors and names as defaults for new layouts. No more recreating "Tools," "Electronics," and "Tiny Screws That Will Definitely Get Lost" every time! ([#415](../../pull/415))
- **Smart Layer Height Expansion** - When adding a new layer, the drawer height now auto-expands to fit. Because math is hard when you're excited about organizing. ([#416](../../pull/416))
- **TSV/CSV Export Consolidation** - Bins with identical dimensions and labels are now grouped in exports. Your spreadsheet will thank you. ([#413](../../pull/413))

### Changed

- Removed the Reddit discussion link from the header - it served its purpose during early feedback gathering ([#417](../../pull/417))
- Updated feature README files with architecture diagrams for contributors ([#414](../../pull/414))

---

## [2026-01-25] - "The Accessibility & Reliability Update"

### Added

- **Command Palette Actions** - Added event listeners so commands actually _do_ something when selected. Oops. ([#404](../../pull/404))
- **Print List Footer Redesign** - Improved visual hierarchy so you can actually find the filament estimates ([#410](../../pull/410))

### Fixed

- **i18n Interpolation Audit** - Found and fixed all the places where translations had mismatched `{variables}`. Added a checker script so this won't happen again. ([#405](../../pull/405))
- Better feedback when trying to place bins in blocked zones - now you'll know _why_ it won't fit ([#411](../../pull/411))

### Internationalization

- Fixed missing interpolation in print modal translations ([#399](../../pull/399), [#401](../../pull/401))

---

## [2026-01-24] - "The Command Palette Update"

### Added

- **Command Palette** - Press `⌘K` (or `Ctrl+K`) to access any action instantly! Includes frecency ranking (it learns what you use most), fuzzy search, and keyboard hints. Finally, a way to discover all the features hiding in the UI. ([#385](../../pull/385), [#387](../../pull/387), [#392](../../pull/392))
- **Intelligent Layout Naming** - New layouts now get smart name suggestions based on your drawer dimensions and categories. "4x6 Electronics Drawer" beats "Untitled Layout 47" every time. ([#394](../../pull/394))
- **Layout Manager Grid View** - See your layouts as a visual grid with thumbnails instead of a boring list ([#395](../../pull/395))

### Performance

- Increased undo history from 50 to 100 states - for those of us who really like to experiment ([#383](../../pull/383))

### Fixed

- Modal z-index issues - modals now properly escape their parent stacking contexts using portals ([#386](../../pull/386))

---

## [2026-01-23] - "The UX Polish Update"

### Added

- **Smart Rotation** - Bins now rotate intelligently based on available space ([#384](../../pull/384))
- **Bin Swap** - When bins collide during drag, they swap places instead of one going to the stash
- **Resizable Stash Panel** - Drag the edge to resize, with a sensible max-height so it doesn't eat your grid ([#379](../../pull/379))
- **Smart Bin Clustering** - Stash automatically organizes bins by size for easier retrieval ([#381](../../pull/381))

### Fixed

- Elevated z-index on hovered/selected stash bins so they don't get clipped ([#380](../../pull/380))

---

## [2026-01-22] - "The Finger Scoops & Categories Update"

### Added

- **Finger Scoops** - The Bin Designer now supports finger scoops (wall cutouts) for easier bin access. Perfect for those tiny components you need to grab quickly! ([#359](../../pull/359))
- **Category Quick Actions** - Streamlined category editing with auto-save and inline actions ([#376](../../pull/376))

### Fixed

- Finger scoop geometry orientation - scoops now face the right direction ([#377](../../pull/377))
- Color picker no longer overlaps other UI elements ([#378](../../pull/378))
- Language selector dropdown rendering issues ([#374](../../pull/374))

---

## [2026-01-21] - "The Internationalization Update"

### Added

- **6 Language Translations** - Gridfinity Layout Tool is now available in:
  - English (en)
  - German (Deutsch)
  - Spanish (Espa??ol)
  - French (Fran??ais)
  - Dutch (Nederlands)
  - Portuguese - Brazil (Portugu??s)

  Huge thanks to the AI translation systems and any future human contributors who help refine these! ([#362](../../pull/362))

- **i18n Infrastructure** - Added locale detection, persistence, and a language switcher. The app remembers your preference. ([#366](../../pull/366))
- **Localized SEO** - Meta tags update based on your language for better international discoverability ([#372](../../pull/372))

### Fixed

- Bin palette instruction text clarified to avoid click confusion ([#375](../../pull/375))
- E2E tests updated for new i18n labels ([#373](../../pull/373))

---

## [2026-01-20] - "The Bin Designer Update"

**Highlights:**

- Complete parametric bin generator
- Real-time 3D preview
- STL export for 3D printing
- Half-bin socket support

### Added

- **Bin Designer** - Design custom Gridfinity bins right in your browser! This was a massive undertaking spanning multiple PRs:
  - Parametric controls for width, depth, height, walls, and bases ([#306](../../pull/306))
  - Real-time 3D preview with orbit controls ([#307](../../pull/307))
  - Bin styles: solid, dividers, and compartment grids ([#308](../../pull/308))
  - STL export with print time and filament estimates ([#309](../../pull/309))
  - Correct Gridfinity spec dimensions and tolerances ([#310](../../pull/310))
  - Rounded geometry with proper fillets ([#310](../../pull/310))
  - Stacking lip and magnet/screw hole options ([#335](../../pull/335), [#336](../../pull/336))
  - Compartment grid editor with visual cell merging ([#338](../../pull/338), [#348](../../pull/348))
  - Half-bin socket support for 0.5-unit bases ([#342](../../pull/342))
  - Lite floor mode for material savings ([#346](../../pull/346))
  - Editable export filenames ([#352](../../pull/352))
  - Revert button for mesh generation errors ([#369](../../pull/369))

- **Tool Switcher** - Segmented control in the header to switch between Layout Tool and Bin Designer ([#339](../../pull/339))

### Performance

- Mesh caching and on-demand rendering for smooth interaction ([#346](../../pull/346))
- Web Worker bridge for geometry generation ([#305](../../pull/305))

### Fixed

- Numerous geometry corrections, Z-up orbit controls, and UX polish across many PRs

---

## [2026-01-18] - "The Architecture Cleanup"

### Changed

This release was all about paying down technical debt and setting up for future features. Over 20 PRs focused on code organization:

- **Feature-based Directory Structure** - Reorganized from type-based (`components/`, `hooks/`) to feature-based (`features/grid-editor/`, `features/bin-designer/`) architecture ([#193](../../pull/193)-[#207](../../pull/207))
- **Core Infrastructure Layer** - Extracted stores, storage, and types into `src/core/` ([#189](../../pull/189))
- **Shared Utilities** - Consolidated cross-cutting concerns into `src/shared/` ([#190](../../pull/190))
- **Module Boundary Checker** - Added tooling to prevent cross-feature imports ([#262](../../pull/262))

### Removed

- Over 2,000 lines of dead code and deprecated re-exports ([#209](../../pull/209), [#253](../../pull/253), [#271](../../pull/271))

---

## [2026-01-17] - "The Result Type Migration"

### Changed

- **Result<T, E> Type System** - Migrated from exceptions to explicit Result types for error handling. This makes error states visible in the type system and prevents "undefined is not an object" surprises. ([#111](../../pull/111)-[#127](../../pull/127))

### Fixed

- Noisy toast notifications when a bookmarked layout was deleted ([#115](../../pull/115))
- Layer rename bottom sheet title ([#116](../../pull/116))

---

## [2026-01-16] - "The Labs & Collaboration Update"

### Added

- **Labs Feature Flags** - Experimental features can now be toggled in Settings > Labs. Try things before they're fully baked! ([#129](../../pull/129))
- **Collaborative Editing** (Labs) - Real-time collaboration powered by Liveblocks! See other users' cursors, selections, and changes live. ([#130](../../pull/130)-[#137](../../pull/137))
  - Presence awareness with cursor labels
  - Selection rings showing what others have selected
  - Operation ghosts for resize/drag previews
  - Smooth pixel-perfect cursor movement

### Performance

- Lazy-loaded Liveblocks to reduce main bundle by 62KB ([#138](../../pull/138))

---

## [2026-01-15] - "The Storage Migration"

### Changed

- **IndexedDB Storage** - Migrated from localStorage to IndexedDB for layout storage. This removes the ~5MB storage limit and improves performance for large layouts. Your layouts are automatically migrated. ([#106](../../pull/106))

### Removed

- **Collection Feature** - Removed the PartyKit-based collection feature. It was causing too many sync issues and we're focusing on Liveblocks for collaboration instead. ([#105](../../pull/105))

---

## [2026-01-14] - "The ML Telemetry Update"

### Added

- **ML Telemetry System** - Anonymous usage patterns for training bin prediction models. We're collecting (with consent via PostHog):
  - Edit patterns and workflows
  - Label embeddings (bucketed, not raw text)
  - Drawer purpose inference
  - Quality feedback signals

  The goal? Future AI that suggests bin layouts based on what you're organizing. ([#220](../../pull/220)-[#251](../../pull/251))

### Changed

- Expanded PostHog integration with error tracking and engagement milestones ([#291](../../pull/291)-[#295](../../pull/295))

---

## [2026-01-13] - "The Inspiration Gallery Update"

### Added

- **Inspiration Gallery** - Browse pre-made layouts for common use cases: electronics workbench, sewing supplies, LEGO organization, and more! One click to load them into your workspace. ([#236](../../pull/236))
- **Settings Modal** - Moved sidebar settings into a proper modal for cleaner UI ([#237](../../pull/237))

### Changed

- Inspiration layouts split into theme-based files for easier maintenance ([#240](../../pull/240))

---

## [2026-01-12] - "The Print & Performance Update"

### Added

- **Improved Print View** - Dynamic grid sizing, header controls, and better page utilization ([#107](../../pull/107), [#108](../../pull/108))

### Performance

- Lazy-loaded BinListModal saves 61KB from main bundle ([#301](../../pull/301))
- Optimized pre-commit test execution for faster feedback ([#298](../../pull/298))

### Fixed

- Circular dependency warnings in build ([#297](../../pull/297))
- API TypeScript errors for Vercel deployments ([#299](../../pull/299), [#300](../../pull/300))

---

## [2026-01-11] - "The Mobile & Accessibility Update"

### Added

- **Mobile Bin List Redesign** - Card-based layout optimized for touch ([#66](../../pull/66))
- **Mobile Layers Panel** - Tabbed UI matching desktop functionality ([#67](../../pull/67))
- **Row/Column Hover Highlight** - Hover over axis labels to highlight entire rows/columns ([#64](../../pull/64))
- **Semantic Test IDs** - Data attributes for robust E2E testing ([#68](../../pull/68))

### Fixed

- Resize handles z-index - handles no longer get clipped by neighboring bins ([#63](../../pull/63))
- PNG favicon for Google search results ([#69](../../pull/69))
- Categories panel CLS on initial load ([#70](../../pull/70), [#71](../../pull/71))

---

## [2026-01-10] - "The Analytics & Stash Update"

### Added

- **PostHog Analytics** - Pageview and session tracking with privacy-first approach ([#72](../../pull/72), [#73](../../pull/73))
- **Alt+Drag Duplicate** - Hold Alt while dragging to duplicate bins ([#75](../../pull/75))
- **Grid Stepper Controls** - Mobile-friendly increment/decrement for grid dimensions ([#78](../../pull/78))
- **Expandable Stash** - Stash panel can now expand/collapse ([#221](../../pull/221))

### Fixed

- Exit paint mode properly when clicking off-grid or selecting a bin ([#24](../../pull/24))

---

## [2026-01-09] - "The Cloud Sharing Update"

### Added

- **Cloud Sharing** - Share layouts via link using Vercel Blob storage! Recipients can view, and optionally save to their library. ([#21](../../pull/21))
  - Rate limiting: 10 shares/hour, 100 reads/hour
  - Validation: 500KB max, 2500 bins max
  - Instant preview without saving
  - Mobile feature parity ([#27](../../pull/27), [#38](../../pull/38))

### Security

- Timing-safe token comparison and prototype pollution protection ([#312](../../pull/312))
- Offensive content filtering for custom properties ([#312](../../pull/312))

---

## [2026-01-08] - "The Half-Bin & Multi-Layout Update"

### Added

- **Half-Bin Mode** - Place bins with 0.5-unit precision! Perfect for those drawers that don't align perfectly with the Gridfinity grid. Toggle it in Grid Settings. ([#6](../../pull/6))
  - Crosshair markers show half-grid positions
  - Smart snapping and preview rendering
  - Keyboard nudging respects half-bin increments

- **Multi-Layout Library** - Manage multiple drawer layouts in one place! ([#9](../../pull/9), [#11](../../pull/11))
  - Thumbnails for visual identification
  - Search and overflow menu
  - Quick switching between layouts
  - Bookmarkable URLs for each layout

- **Layout Manager Modal** - Redesigned with tabbed interface, grid view, and better scrolling ([#17](../../pull/17), [#46](../../pull/46))

### Fixed

- Fractional drawer dimensions now work correctly ([#53](../../pull/53), [#54](../../pull/54))
- Staging area context menu ([#58](../../pull/58))

---

## [2026-01-07] - "The Foundation"

The day it all began! Initial release of Gridfinity Layout Tool.

### Added

- **Grid Editor** - Drag-and-drop bin placement on a configurable grid
- **3D Isometric Preview** - See your layout from any angle with proper lighting and depth sorting
  - Layer visibility toggles
  - Camera presets and keyboard navigation
  - Selection highlighting with category-colored glow

- **Layers System** - Stack bins vertically with independent layer heights
- **Categories** - Color-code bins by type with customizable names
- **Stash (Staging Area)** - Temporary holding area for bins, auto-used when bins are displaced
- **Bin Inspector** - View and edit selected bin properties
- **Print List** - See all bins with dimensions and filament estimates
- **Mobile & Tablet Support** - Responsive layouts with touch gestures
- **PWA** - Installable, works offline
- **Undo/Redo** - Up to 50 states of history
- **Keyboard Shortcuts** - WASD navigation, quick labels, and more

### Technical Foundation

- React 19 + TypeScript 5.9 + Vite 7
- Zustand for state management with Immer
- Tailwind CSS 4 for styling
- Three.js for 3D preview
- Comprehensive test coverage (Vitest + Playwright)

---

## Pre-History

This project evolved from a personal tool into an open-source release. The initial commit represents months of private development and iteration.

---

_For contribution guidelines, see [CLAUDE.md](./CLAUDE.md). For maintaining this changelog, see [CHANGELOG_STYLE_GUIDE.md](./CHANGELOG_STYLE_GUIDE.md)._
