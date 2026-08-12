import type { ColorZone, HoverableZone } from './featureColors';
import type { CompartmentConfig } from './compartments';
import type { InteriorCard } from './interior';
import type { HistoryEntry, SplitPieceMeshEntry } from './generation';
import type { OverhangHighlightSide } from './walls';

/**
 * Eyedropper click anchor: which zone was hit and the viewport coords
 * where the picker should open. Kept in the store so every exit path
 * for `colorTool` (toolbar button, banner X, ESC, multi-color disable)
 * can clear it atomically — otherwise the picker risks floating after
 * the tool exits.
 */
export interface PickerOverlayState {
  readonly zone: ColorZone;
  readonly x: number;
  readonly y: number;
}

/**
 * Optional zone-editing mode overlaid on the 3D preview.
 *  - `'eyedropper'`: click any zone in the mesh to open its picker
 *  - `'swap-pick-first'` / `'swap-pick-second'`: two-step swap-zones flow
 *
 * Mutually exclusive — entering one tool clears any in-progress state from
 * another (so a half-done swap pick doesn't leak into eyedropper mode).
 */
export type ColorTool = 'eyedropper' | 'swap-pick-first' | 'swap-pick-second' | null;

/** Active tab in the parameter panel */
export type DesignerTab = 'dimensions' | 'base' | 'compartments' | 'walls' | 'style';

/** View mode for split bin preview: assembled (no gaps) or exploded (gaps between pieces). */
export type SplitViewMode = 'assembled' | 'exploded';

/** UI state for the designer page */
export interface DesignerUIState {
  readonly activeTab: DesignerTab;
  readonly exportDialogOpen: boolean;
  readonly designListOpen: boolean;
  readonly wireframeMode: boolean;
  /** Whether half-bin mode is enabled (0.5 grid unit increments for width/depth) */
  readonly halfGridMode: boolean;
  /** Whether the full-workspace cutout editor is open (desktop only) */
  readonly cutoutEditorOpen: boolean;
  /** Whether the full-workspace bento editor is open (desktop only) */
  readonly bentoWorkspaceOpen: boolean;
  /**
   * Which interior card the panel shows as selected. Bento and Grid Dividers
   * are both `style: 'standard'`, so the style alone cannot tell them apart.
   *
   * Seeded from `deriveInteriorCard` when a design loads and sticky thereafter:
   * `remapDividerOverrides` drops every override on a cell renumber, so a
   * continuously-derived card would flip to Grid Dividers the moment a bento's
   * walls were reset by a merge. Never persisted — no `BinParams` field means
   * no shift in `communityParamsFingerprint`.
   */
  readonly interiorCard: InteriorCard;
  /** Preview compartments during drag-to-merge/split (shown as ghost in 3D view) */
  readonly previewCompartments: CompartmentConfig | null;
  /** Preview selection info for 3D ghost overlay */
  readonly previewSelection: {
    readonly action: 'merge' | 'split';
    readonly minCol: number;
    readonly maxCol: number;
    readonly minRow: number;
    readonly maxRow: number;
  } | null;
  /** View mode for split preview overlay (assembled=no gaps, exploded=gaps between pieces) */
  readonly splitViewMode: SplitViewMode;
  /** Per-piece mesh data for split bin preview (populated when exploded mode is active) */
  readonly splitPieceMeshes: readonly SplitPieceMeshEntry[];
  /** Currently hovered color zone in the panel (for 3D preview glow feedback) */
  readonly hoveredColorZone: HoverableZone | null;
  /** Overhang control hovered/focused in the panel → 3D wall highlight. Transient. */
  readonly hoveredOverhangSide: OverhangHighlightSide | null;
  /**
   * Active color tool overlay. `'eyedropper'` lets the user click a zone in
   * the 3D preview to recolor it; `'swap-pick-first'` and `'swap-pick-second'`
   * drive the two-step swap-zones flow. `null` = no tool active.
   * Each tool gates pointer behavior in PreviewCanvas and shows a banner.
   */
  readonly colorTool: ColorTool;
  /**
   * First zone picked in the swap flow (set during `'swap-pick-second'`).
   * Captured at pick time; the second pick triggers the swap transaction.
   */
  readonly swapFirstZone: ColorZone | null;
  /**
   * Anchor + zone for the eyedropper's click-anchored picker. Lives in
   * the store so any path that clears `colorTool` also clears it (no
   * orphaned picker after a toolbar toggle or multi-color disable).
   */
  readonly pickerOverlay: PickerOverlayState | null;
  /**
   * Whether the Custom-shape editor section is expanded. Tracks the toggle
   * independently of the mask because the store auto-clears fully-filled
   * masks to undefined (fast path) — we can't infer "editor should be open"
   * from `params.cellMask` alone when the user hasn't painted anything yet.
   */
  readonly shapeEditorOpen: boolean;
  /**
   * Key of the divider currently open in the Diagonal-dividers inspector,
   * or null when the panel is showing the modified-list view. Format is
   * `"{compartmentA}-{compartmentB}"` (canonical pair). The hook derives
   * the actual row from this lazily, so a stale key after a grid mutation
   * harmlessly falls back to list mode.
   */
  readonly selectedDividerKey: string | null;
  /**
   * Key of the divider being hovered (either in the list or on the 2D
   * canvas). Same format as `selectedDividerKey`. Drives the bidirectional
   * highlight between list rows, canvas divider lines, and adjacent
   * compartment fills.
   */
  readonly hoveredDividerKey: string | null;
  /**
   * Transient divider tilt being dragged in the inspector, mirrored to the 2D
   * canvas for a live preview. Never persisted and never pushed to undo — the
   * real `DividerOverride` is committed on pointer release. Null when no drag
   * is in flight.
   */
  readonly dividerTiltPreview: DividerTiltPreview | null;
  /**
   * Compartment currently hovered (or selected) in the 2D grid editor, by
   * compartment id. Drives the 3D `CompartmentDimensions` overlay so the
   * preview shows that one compartment's cavity dimensions on demand. Null
   * when nothing is hovered (the 3D view stays uncluttered at rest).
   */
  readonly hoveredCompartmentId: number | null;
  /**
   * Whether the compartment grid is picking a compartment to label rather than
   * editing dividers.
   *
   * Store state rather than the grid's own `useState` so the panel's label-text
   * list can turn it on ("pick on grid") — the two live in different panel
   * sections and have no common React ancestor short of the whole panel.
   */
  readonly compartmentLabelMode: boolean;
  /**
   * Compartment the label list has focused, by id. Set by a grid click and by
   * the list's own navigation, so both stay pointed at the same row. Null falls
   * back to the first compartment in reading order.
   */
  readonly labelFocusCompartmentId: number | null;
  /**
   * Drawn compartment selected in the Bento workspace, by compartment id.
   * IDs renumber on every mutation (gotcha #6): actions return the
   * post-normalization id and the workspace re-selects from that return
   * value; consumers must treat an id that is no longer drawn as null.
   */
  readonly selectedBentoCompartmentId: number | null;
}

/** In-flight divider tilt used only for live preview (see `dividerTiltPreview`). */
export interface DividerTiltPreview {
  readonly key: string;
  readonly offsetStart: number;
  readonly offsetEnd: number;
}

/** Undo/redo history for bin parameters with optional mesh cache */
export interface DesignerHistory {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
}

// Export File Name Types

/** File naming style for exports */
export type FileNameStyle = 'descriptive' | 'compact' | 'custom';

/** Export file format for the primary bin download */
export type ExportFileFormat = 'stl' | 'step' | '3mf';

/** Export filename configuration stored per design */
export interface ExportFileNameConfig {
  /** Which naming mode to use */
  readonly style: FileNameStyle;
  /** User-provided filename (without extension) for 'custom' mode */
  readonly customName: string;
  /** Export file format. Optional for backward compat with saved designs pre-format selection. */
  readonly format?: ExportFileFormat;
}

// Storage Types
