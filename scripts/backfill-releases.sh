#!/bin/bash
# One-time script to backfill GitHub releases from existing CHANGELOG.md entries.
# Creates git tags and GitHub releases for each date entry (v1.1.0 through v1.19.0).
#
# Usage: ./scripts/backfill-releases.sh [--dry-run]
# Requires: gh CLI authenticated with repo access

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE ==="
fi

REPO="andymai/gridfinity-layout-tool"

# Each entry: "version date commit"
# Versions v1.1.0 through v1.19.0 (19 changelog dates)
entries=(
  "1.1.0  2026-01-07 948f454de2bffc04b10dbf1306bc509f94dbde13"
  "1.2.0  2026-01-08 c2f31bf072e808041867d4b9ce033c47ccb18a08"
  "1.3.0  2026-01-09 4b23666287b6d497431bb6d2072442e5e254fba9"
  "1.4.0  2026-01-10 68807f27f0433b32d306084b7e9e9f7c5aa5c27a"
  "1.5.0  2026-01-11 3d6241a23f495df20a76da77849ca2f0ec9108f0"
  "1.6.0  2026-01-12 31d25629ef62d576d87660b38a481d942b08ea4e"
  "1.7.0  2026-01-13 d38c66138a78e1b36adc71efcde3e10679558696"
  "1.8.0  2026-01-14 4d71d57fba4a9d56e925661025232beea6387542"
  "1.9.0  2026-01-15 258fc612923ec6971a5b7a8df871681284af9c90"
  "1.10.0 2026-01-16 784c7ebb5746ab4c7c825d037e8853cfaa901713"
  "1.11.0 2026-01-17 95f1bc1903a88e409f5fb8a0100b55d2e8a567f0"
  "1.12.0 2026-01-18 e06ae0de4f5b8b1d750981a63254d76b53a720b7"
  "1.13.0 2026-01-20 814c8f63c4a0cde57c5bfca373283c3116c73293"
  "1.14.0 2026-01-21 7aced94f4430279eccb7198afc26137a0b90ba3f"
  "1.15.0 2026-01-22 50d6088b68692c818593d5491e6fdc75c5d09bce"
  "1.16.0 2026-01-23 ef9ed255e654e162f3a4a34b740139638f49a4ab"
  "1.17.0 2026-01-24 7a6230372e0a18b3d9d17ebe3c3236e129b4623d"
  "1.18.0 2026-01-25 3725675abbbd41b8fc86ad094065881fd8252153"
  "1.19.0 2026-01-26 386d15d219d2e7c5edfcf28b16c91cc27f48a09a"
)

# Release notes for each version (heredocs below)
declare -A notes

notes["1.1.0"]="Initial release.

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
- Test coverage with Vitest + Playwright"

notes["1.2.0"]="### Added

- **Half-Bin Mode** - Place bins with 0.5-unit precision for drawers that don't align with the grid (#6)
  - Crosshair markers show half-grid positions
  - Smart snapping and preview rendering
  - Keyboard nudging respects half-bin increments
- **Multi-Layout Library** - Manage multiple drawer layouts (#9, #11)
  - Thumbnails for visual identification
  - Search and overflow menu
  - Quick switching between layouts
  - Bookmarkable URLs for each layout
- **Layout Manager Modal** - Tabbed interface with grid view and improved scrolling (#17, #46)

### Fixed

- Fractional drawer dimensions (#53, #54)
- Staging area context menu (#58)"

notes["1.3.0"]="### Added

- **Cloud Sharing** - Share layouts via link using Vercel Blob storage (#21)
  - Rate limiting: 10 shares/hour, 100 reads/hour
  - Validation: 500KB max, 2500 bins max
  - Instant preview without saving
  - Mobile feature parity (#27, #38)

### Security

- Timing-safe token comparison and prototype pollution protection (#312)
- Offensive content filtering for custom properties (#312)"

notes["1.4.0"]="### Added

- **PostHog Analytics** - Pageview and session tracking (#72, #73)
- **Alt+Drag Duplicate** - Hold Alt while dragging to duplicate bins (#75)
- **Grid Stepper Controls** - Mobile-friendly increment/decrement for dimensions (#78)
- **Expandable Stash** - Stash panel can expand/collapse (#221)

### Fixed

- Paint mode exit when clicking off-grid or selecting a bin (#24)"

notes["1.5.0"]="### Added

- **Mobile Bin List** - Card-based layout optimized for touch (#66)
- **Mobile Layers Panel** - Tabbed UI matching desktop (#67)
- **Row/Column Hover Highlight** - Hover axis labels to highlight rows/columns (#64)
- **Semantic Test IDs** - Data attributes for E2E testing (#68)

### Fixed

- Resize handles z-index clipping (#63)
- PNG favicon for Google search results (#69)
- Categories panel CLS on initial load (#70, #71)"

notes["1.6.0"]="### Added

- **Improved Print View** - Dynamic grid sizing, header controls, and better page utilization (#107, #108)

### Performance

- Lazy-loaded BinListModal saves 61KB from main bundle (#301)
- Optimized pre-commit test execution (#298)

### Fixed

- Circular dependency warnings in build (#297)
- API TypeScript errors for Vercel deployments (#299, #300)"

notes["1.7.0"]="### Added

- **Inspiration Gallery** - Pre-made layouts for common use cases (#236)
- **Settings Modal** - Moved sidebar settings into a modal (#237)

### Changed

- Inspiration layouts split into theme-based files (#240)"

notes["1.8.0"]="### Added

- **ML Telemetry System** - Anonymous usage patterns for training bin prediction models (with consent via PostHog):
  - Edit patterns and workflows
  - Label embeddings (bucketed, not raw text)
  - Drawer purpose inference
  - Quality feedback signals
  (#220-#251)

### Changed

- Expanded PostHog integration with error tracking and engagement milestones (#291-#295)"

notes["1.9.0"]="### Changed

- **IndexedDB Storage** - Migrated from localStorage for larger storage capacity and better performance. Layouts are automatically migrated. (#106)

### Removed

- **Collection Feature** - Removed PartyKit-based collections due to sync issues; focusing on Liveblocks instead (#105)"

notes["1.10.0"]="### Added

- **Labs Feature Flags** - Toggle experimental features in Settings > Labs (#129)
- **Collaborative Editing** (Labs) - Real-time collaboration via Liveblocks (#130-#137)
  - Presence awareness with cursor labels
  - Selection rings showing what others have selected
  - Operation ghosts for resize/drag previews
  - Smooth cursor movement

### Performance

- Lazy-loaded Liveblocks to reduce main bundle by 62KB (#138)"

notes["1.11.0"]="### Changed

- **Result\<T, E\> Type System** - Migrated from exceptions to explicit Result types for error handling (#111-#127)

### Fixed

- Noisy toast notifications when a bookmarked layout was deleted (#115)
- Layer rename bottom sheet title (#116)"

notes["1.12.0"]="### Changed

Focused on technical debt and code organization across 20+ PRs:

- **Feature-based Directory Structure** - Reorganized to features/grid-editor/, features/bin-designer/ architecture (#193-#207)
- **Core Infrastructure Layer** - Extracted stores, storage, and types into src/core/ (#189)
- **Shared Utilities** - Consolidated cross-cutting concerns into src/shared/ (#190)
- **Module Boundary Checker** - Tooling to prevent cross-feature imports (#262)

### Removed

- Over 2,000 lines of dead code and deprecated re-exports (#209, #253, #271)"

notes["1.13.0"]="**Highlights:** Parametric bin generator with real-time 3D preview and STL export.

### Added

- **Bin Designer** - Design custom Gridfinity bins in the browser:
  - Parametric controls for width, depth, height, walls, and bases (#306)
  - Real-time 3D preview with orbit controls (#307)
  - Bin styles: solid, dividers, and compartment grids (#308)
  - STL export with print time and filament estimates (#309)
  - Correct Gridfinity spec dimensions and tolerances (#310)
  - Rounded geometry with fillets (#310)
  - Stacking lip and magnet/screw hole options (#335, #336)
  - Compartment grid editor with visual cell merging (#338, #348)
  - Half-bin socket support for 0.5-unit bases (#342)
  - Lite floor mode for material savings (#346)
  - Editable export filenames (#352)
  - Revert button for mesh generation errors (#369)
- **Tool Switcher** - Segmented control to switch between Layout Tool and Bin Designer (#339)

### Performance

- Mesh caching and on-demand rendering (#346)
- Web Worker bridge for geometry generation (#305)

### Fixed

- Geometry corrections, Z-up orbit controls, and UX polish across many PRs"

notes["1.14.0"]="### Added

- **6 Language Translations** - English, German, Spanish, French, Dutch, and Portuguese (Brazil) (#362)
- **i18n Infrastructure** - Locale detection, persistence, and language switcher (#366)
- **Localized SEO** - Meta tags update based on language (#372)

### Fixed

- Bin palette instruction text clarified (#375)
- E2E tests updated for i18n labels (#373)"

notes["1.15.0"]="### Added

- **Finger Scoops** - Wall cutouts in Bin Designer for easier access (#359)
- **Category Quick Actions** - Streamlined editing with auto-save (#376)

### Fixed

- Finger scoop geometry orientation (#377)
- Color picker overlap with other UI elements (#378)
- Language selector dropdown rendering (#374)"

notes["1.16.0"]="### Added

- **Smart Rotation** - Bins rotate based on available space (#384)
- **Bin Swap** - Bins swap places on collision instead of going to stash
- **Resizable Stash Panel** - Drag to resize with max-height constraint (#379)
- **Smart Bin Clustering** - Stash organizes bins by size (#381)

### Fixed

- Elevated z-index on hovered/selected stash bins (#380)"

notes["1.17.0"]="### Added

- **Command Palette** - Press ⌘K / Ctrl+K to access actions. Includes frecency ranking, fuzzy search, and keyboard hints (#385, #387, #392)
- **Intelligent Layout Naming** - Smart name suggestions based on drawer dimensions and categories (#394)
- **Layout Manager Grid View** - Visual grid with thumbnails (#395)

### Performance

- Increased undo history from 50 to 100 states (#383)

### Fixed

- Modal z-index issues resolved using portals (#386)"

notes["1.18.0"]="### Added

- **Command Palette Actions** - Event listeners for command execution (#404)
- **Print List Footer Redesign** - Improved visual hierarchy for filament estimates (#410)

### Fixed

- **i18n Interpolation Audit** - Fixed mismatched translation variables and added a checker script (#405)
- Improved feedback when placing bins in blocked zones (#411)
- Missing interpolation in print modal translations (#399, #401)"

notes["1.19.0"]="### Added

- **Default Categories Preference** - Save category colors and names as defaults for new layouts (#415)
- **Smart Layer Height Expansion** - Drawer height auto-expands when adding a new layer (#416)
- **TSV/CSV Export Consolidation** - Bins with identical dimensions and labels are grouped in exports (#413)

### Changed

- Removed the Reddit discussion link from the header (#417)
- Updated feature README files with architecture diagrams (#414)"

echo ""
echo "Creating ${#entries[@]} releases..."
echo ""

for entry in "${entries[@]}"; do
  read -r version date commit <<< "$entry"
  tag="v${version}"
  title="${tag} - ${date}"

  if $DRY_RUN; then
    echo "[DRY RUN] Would create tag ${tag} at ${commit:0:12} with title '${title}'"
    continue
  fi

  echo "Creating ${tag} (${date})..."

  # Create lightweight tag at the commit
  git tag "$tag" "$commit" 2>/dev/null || echo "  Tag ${tag} already exists, skipping tag creation"

  # Create GitHub release
  if gh release view "$tag" --repo "$REPO" >/dev/null 2>&1; then
    echo "  Release ${tag} already exists, skipping"
  elif ! gh release create "$tag" \
    --repo "$REPO" \
    --title "$title" \
    --notes "${notes[$version]}" \
    --target "$commit"; then
    echo "  Failed to create release ${tag}; see error above." >&2
  fi

  echo "  ✓ ${tag}"
done

echo ""
echo "Done! Push tags with: git push origin --tags"
