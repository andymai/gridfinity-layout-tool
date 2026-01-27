# Changelog

All notable changes to the Gridfinity Layout Tool are documented here.

This project follows a continuous deployment model. For guidance on maintaining this changelog, see [CHANGELOG_STYLE_GUIDE.md](./CHANGELOG_STYLE_GUIDE.md).

---

## [2026-01-26]

### Added

- **Default Categories Preference** - Save category colors and names as defaults for new layouts ([#415](../../pull/415))
- **Smart Layer Height Expansion** - Drawer height auto-expands when adding a new layer ([#416](../../pull/416))
- **TSV/CSV Export Consolidation** - Bins with identical dimensions and labels are grouped in exports ([#413](../../pull/413))

### Changed

- Removed the Reddit discussion link from the header ([#417](../../pull/417))
- Updated feature README files with architecture diagrams ([#414](../../pull/414))

---

## [2026-01-25]

### Added

- **Command Palette Actions** - Event listeners for command execution ([#404](../../pull/404))
- **Print List Footer Redesign** - Improved visual hierarchy for filament estimates ([#410](../../pull/410))

### Fixed

- **i18n Interpolation Audit** - Fixed mismatched translation variables and added a checker script ([#405](../../pull/405))
- Improved feedback when placing bins in blocked zones ([#411](../../pull/411))
- Missing interpolation in print modal translations ([#399](../../pull/399), [#401](../../pull/401))

---

## [2026-01-24]

### Added

- **Command Palette** - Press `⌘K` / `Ctrl+K` to access actions. Includes frecency ranking, fuzzy search, and keyboard hints ([#385](../../pull/385), [#387](../../pull/387), [#392](../../pull/392))
- **Intelligent Layout Naming** - Smart name suggestions based on drawer dimensions and categories ([#394](../../pull/394))
- **Layout Manager Grid View** - Visual grid with thumbnails ([#395](../../pull/395))

### Performance

- Increased undo history from 50 to 100 states ([#383](../../pull/383))

### Fixed

- Modal z-index issues resolved using portals ([#386](../../pull/386))

---

## [2026-01-23]

### Added

- **Smart Rotation** - Bins rotate based on available space ([#384](../../pull/384))
- **Bin Swap** - Bins swap places on collision instead of going to stash
- **Resizable Stash Panel** - Drag to resize with max-height constraint ([#379](../../pull/379))
- **Smart Bin Clustering** - Stash organizes bins by size ([#381](../../pull/381))

### Fixed

- Elevated z-index on hovered/selected stash bins ([#380](../../pull/380))

---

## [2026-01-22]

### Added

- **Finger Scoops** - Wall cutouts in Bin Designer for easier access ([#359](../../pull/359))
- **Category Quick Actions** - Streamlined editing with auto-save ([#376](../../pull/376))

### Fixed

- Finger scoop geometry orientation ([#377](../../pull/377))
- Color picker overlap with other UI elements ([#378](../../pull/378))
- Language selector dropdown rendering ([#374](../../pull/374))

---

## [2026-01-21]

### Added

- **6 Language Translations** - English, German, Spanish, French, Dutch, and Portuguese (Brazil) ([#362](../../pull/362))
- **i18n Infrastructure** - Locale detection, persistence, and language switcher ([#366](../../pull/366))
- **Localized SEO** - Meta tags update based on language ([#372](../../pull/372))

### Fixed

- Bin palette instruction text clarified ([#375](../../pull/375))
- E2E tests updated for i18n labels ([#373](../../pull/373))

---

## [2026-01-20]

**Highlights:** Parametric bin generator with real-time 3D preview and STL export.

### Added

- **Bin Designer** - Design custom Gridfinity bins in the browser:
  - Parametric controls for width, depth, height, walls, and bases ([#306](../../pull/306))
  - Real-time 3D preview with orbit controls ([#307](../../pull/307))
  - Bin styles: solid, dividers, and compartment grids ([#308](../../pull/308))
  - STL export with print time and filament estimates ([#309](../../pull/309))
  - Correct Gridfinity spec dimensions and tolerances ([#310](../../pull/310))
  - Rounded geometry with fillets ([#310](../../pull/310))
  - Stacking lip and magnet/screw hole options ([#335](../../pull/335), [#336](../../pull/336))
  - Compartment grid editor with visual cell merging ([#338](../../pull/338), [#348](../../pull/348))
  - Half-bin socket support for 0.5-unit bases ([#342](../../pull/342))
  - Lite floor mode for material savings ([#346](../../pull/346))
  - Editable export filenames ([#352](../../pull/352))
  - Revert button for mesh generation errors ([#369](../../pull/369))

- **Tool Switcher** - Segmented control to switch between Layout Tool and Bin Designer ([#339](../../pull/339))

### Performance

- Mesh caching and on-demand rendering ([#346](../../pull/346))
- Web Worker bridge for geometry generation ([#305](../../pull/305))

### Fixed

- Geometry corrections, Z-up orbit controls, and UX polish across many PRs

---

## [2026-01-18]

### Changed

Focused on technical debt and code organization across 20+ PRs:

- **Feature-based Directory Structure** - Reorganized to `features/grid-editor/`, `features/bin-designer/` architecture ([#193](../../pull/193)-[#207](../../pull/207))
- **Core Infrastructure Layer** - Extracted stores, storage, and types into `src/core/` ([#189](../../pull/189))
- **Shared Utilities** - Consolidated cross-cutting concerns into `src/shared/` ([#190](../../pull/190))
- **Module Boundary Checker** - Tooling to prevent cross-feature imports ([#262](../../pull/262))

### Removed

- Over 2,000 lines of dead code and deprecated re-exports ([#209](../../pull/209), [#253](../../pull/253), [#271](../../pull/271))

---

## [2026-01-17]

### Changed

- **Result<T, E> Type System** - Migrated from exceptions to explicit Result types for error handling ([#111](../../pull/111)-[#127](../../pull/127))

### Fixed

- Noisy toast notifications when a bookmarked layout was deleted ([#115](../../pull/115))
- Layer rename bottom sheet title ([#116](../../pull/116))

---

## [2026-01-16]

### Added

- **Labs Feature Flags** - Toggle experimental features in Settings > Labs ([#129](../../pull/129))
- **Collaborative Editing** (Labs) - Real-time collaboration via Liveblocks ([#130](../../pull/130)-[#137](../../pull/137))
  - Presence awareness with cursor labels
  - Selection rings showing what others have selected
  - Operation ghosts for resize/drag previews
  - Smooth cursor movement

### Performance

- Lazy-loaded Liveblocks to reduce main bundle by 62KB ([#138](../../pull/138))

---

## [2026-01-15]

### Changed

- **IndexedDB Storage** - Migrated from localStorage for larger storage capacity and better performance. Layouts are automatically migrated. ([#106](../../pull/106))

### Removed

- **Collection Feature** - Removed PartyKit-based collections due to sync issues; focusing on Liveblocks instead ([#105](../../pull/105))

---

## [2026-01-14]

### Added

- **ML Telemetry System** - Anonymous usage patterns for training bin prediction models (with consent via PostHog):
  - Edit patterns and workflows
  - Label embeddings (bucketed, not raw text)
  - Drawer purpose inference
  - Quality feedback signals
    ([#220](../../pull/220)-[#251](../../pull/251))

### Changed

- Expanded PostHog integration with error tracking and engagement milestones ([#291](../../pull/291)-[#295](../../pull/295))

---

## [2026-01-13]

### Added

- **Inspiration Gallery** - Pre-made layouts for common use cases ([#236](../../pull/236))
- **Settings Modal** - Moved sidebar settings into a modal ([#237](../../pull/237))

### Changed

- Inspiration layouts split into theme-based files ([#240](../../pull/240))

---

## [2026-01-12]

### Added

- **Improved Print View** - Dynamic grid sizing, header controls, and better page utilization ([#107](../../pull/107), [#108](../../pull/108))

### Performance

- Lazy-loaded BinListModal saves 61KB from main bundle ([#301](../../pull/301))
- Optimized pre-commit test execution ([#298](../../pull/298))

### Fixed

- Circular dependency warnings in build ([#297](../../pull/297))
- API TypeScript errors for Vercel deployments ([#299](../../pull/299), [#300](../../pull/300))

---

## [2026-01-11]

### Added

- **Mobile Bin List** - Card-based layout optimized for touch ([#66](../../pull/66))
- **Mobile Layers Panel** - Tabbed UI matching desktop ([#67](../../pull/67))
- **Row/Column Hover Highlight** - Hover axis labels to highlight rows/columns ([#64](../../pull/64))
- **Semantic Test IDs** - Data attributes for E2E testing ([#68](../../pull/68))

### Fixed

- Resize handles z-index clipping ([#63](../../pull/63))
- PNG favicon for Google search results ([#69](../../pull/69))
- Categories panel CLS on initial load ([#70](../../pull/70), [#71](../../pull/71))

---

## [2026-01-10]

### Added

- **PostHog Analytics** - Pageview and session tracking ([#72](../../pull/72), [#73](../../pull/73))
- **Alt+Drag Duplicate** - Hold Alt while dragging to duplicate bins ([#75](../../pull/75))
- **Grid Stepper Controls** - Mobile-friendly increment/decrement for dimensions ([#78](../../pull/78))
- **Expandable Stash** - Stash panel can expand/collapse ([#221](../../pull/221))

### Fixed

- Paint mode exit when clicking off-grid or selecting a bin ([#24](../../pull/24))

---

## [2026-01-09]

### Added

- **Cloud Sharing** - Share layouts via link using Vercel Blob storage ([#21](../../pull/21))
  - Rate limiting: 10 shares/hour, 100 reads/hour
  - Validation: 500KB max, 2500 bins max
  - Instant preview without saving
  - Mobile feature parity ([#27](../../pull/27), [#38](../../pull/38))

### Security

- Timing-safe token comparison and prototype pollution protection ([#312](../../pull/312))
- Offensive content filtering for custom properties ([#312](../../pull/312))

---

## [2026-01-08]

### Added

- **Half-Bin Mode** - Place bins with 0.5-unit precision for drawers that don't align with the grid ([#6](../../pull/6))
  - Crosshair markers show half-grid positions
  - Smart snapping and preview rendering
  - Keyboard nudging respects half-bin increments

- **Multi-Layout Library** - Manage multiple drawer layouts ([#9](../../pull/9), [#11](../../pull/11))
  - Thumbnails for visual identification
  - Search and overflow menu
  - Quick switching between layouts
  - Bookmarkable URLs for each layout

- **Layout Manager Modal** - Tabbed interface with grid view and improved scrolling ([#17](../../pull/17), [#46](../../pull/46))

### Fixed

- Fractional drawer dimensions ([#53](../../pull/53), [#54](../../pull/54))
- Staging area context menu ([#58](../../pull/58))

---

## [2026-01-07]

Initial release.

### Added

- **Grid Editor** - Drag-and-drop bin placement on a configurable grid
- **3D Isometric Preview** - View layout from any angle with lighting and depth sorting
  - Layer visibility toggles
  - Camera presets and keyboard navigation
  - Selection highlighting with category-colored glow

- **Layers System** - Stack bins vertically with independent layer heights
- **Categories** - Color-code bins by type with customizable names
- **Stash** - Temporary holding area for displaced bins
- **Bin Inspector** - View and edit selected bin properties
- **Print List** - All bins with dimensions and filament estimates
- **Mobile & Tablet Support** - Responsive layouts with touch gestures
- **PWA** - Installable, works offline
- **Undo/Redo** - Up to 50 states of history
- **Keyboard Shortcuts** - WASD navigation, quick labels, and more

### Technical Foundation

- React 19 + TypeScript 5.9 + Vite 7
- Zustand for state management with Immer
- Tailwind CSS 4 for styling
- Three.js for 3D preview
- Test coverage with Vitest + Playwright

---

_For contribution guidelines, see [CLAUDE.md](./CLAUDE.md). For maintaining this changelog, see [CHANGELOG_STYLE_GUIDE.md](./CHANGELOG_STYLE_GUIDE.md)._
