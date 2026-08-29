import type { ColorZone, HoverableZone } from './featureColors';
import type { CompartmentConfig } from './compartments';
import type { InteriorCard } from './interior';
import type { HistoryEntry, SplitPieceMeshEntry } from './generation';
import type { AssemblyPartType } from '@/shared/types/assembly';
import type { OverhangHighlightSide } from './walls';
import type { MeasurePoint } from '@/features/bin-designer/utils/measure3d';

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
/** Rail categories of the designer panel; 'selection' is the contextual slot. */
export type DesignerCategory = 'selection' | 'shape' | 'interior' | 'features' | 'style' | 'print';

/**
 * What the contextual Selection page is pointed at. Compartment ids renumber
 * on every merge/split, so a held id can go stale the moment params move:
 * consumers must read through `resolveSelection`, which nulls anything the
 * current params no longer contain, rather than trusting the raw field.
 * Cutout selection arrives with 3D picking (B5).
 */
export type DesignerSelection =
  | { readonly kind: 'compartment'; readonly id: number }
  | { readonly kind: 'divider'; readonly key: string }
  | { readonly kind: 'labelTab'; readonly compartmentId: number }
  | null;

/** View mode for split bin preview: assembled (no gaps) or exploded (gaps between pieces). */
export type SplitViewMode = 'assembled' | 'exploded';

/**
 * Which part the cutout editor is drawing on.
 *
 * The two hosts differ in what a shape MEANS, not just where it lands, and they
 * are measured in different frames — which is why they are separate arrays rather
 * than one tagged list. See `@/shared/utils/lidCutoutPlan`.
 */
export type CutoutTarget = 'bin' | 'lid';

/** UI state for the designer page */
/** Which quantity the 3D measuring tool reports. */
export type MeasureMode = 'points' | 'thickness';

export interface MeasureState {
  /** Whether the tool owns pointer picks in the preview. */
  readonly active: boolean;
  readonly mode: MeasureMode;
  /**
   * Placed points, world mm. Empty, one (awaiting the second pick), or two.
   * A third pick starts a new measurement rather than growing the list.
   */
  readonly points: readonly MeasurePoint[];
}

export interface DesignerUIState {
  readonly activeCategory: DesignerCategory;
  /** Current contextual selection; plain UI state, never history-tracked. */
  readonly selection: DesignerSelection;
  /**
   * Category to restore when the selection clears. Set by the auto-switch into
   * the Selection page and consumed exactly once on deselect, so Esc lands the
   * user back where they were instead of on an arbitrary page.
   */
  readonly returnCategory: DesignerCategory | null;
  readonly exportDialogOpen: boolean;
  readonly designListOpen: boolean;
  /** Whether the version-history dialog is open. */
  readonly versionsOpen: boolean;
  readonly wireframeMode: boolean;
  /** Whether half-bin mode is enabled (0.5 grid unit increments for width/depth) */
  readonly halfGridMode: boolean;
  /** Whether the full-workspace cutout editor is open (desktop only) */
  readonly cutoutEditorOpen: boolean;
  /**
   * Which part the open cutout editor is drawing on: the bin's interior floor or
   * the lid's plate.
   *
   * Session state, never persisted — no `BinParams` field means no shift in
   * `communityParamsFingerprint`. It exists because every cutout action reads it
   * to pick which array to write (`cutoutOwner` in `cutoutSlice`), which is what
   * lets one editor serve both parts without a target argument threaded through
   * twenty action signatures.
   */
  readonly cutoutTarget: CutoutTarget;
  /** Whether the full-workspace bento editor is open (desktop only) */
  readonly bentoWorkspaceOpen: boolean;
  /**
   * The panel's interior-card PREFERENCE — read through `resolveInteriorCard`,
   * never raw. Bento and Grid Dividers are both `style: 'standard'`, so the
   * style alone cannot tell those two apart and this breaks the tie; every
   * other card IS a style, and the style wins.
   *
   * Seeded from `deriveInteriorCard` when a design loads and sticky thereafter:
   * `remapDividerOverrides` drops every override on a cell renumber, so a
   * continuously-derived card would flip to Grid Dividers the moment a bento's
   * walls were reset by a merge. Stickiness is why it must be resolved on the
   * way out — params can move under it (undo, reset, a refused style change)
   * without ever touching it. Never persisted — no `BinParams` field means no
   * shift in `communityParamsFingerprint`.
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
   * The 3D measuring tool (#3696). UI state, not params: a measurement is not
   * part of the design, so it stays out of the share payload and out of undo.
   *
   * The points are WORLD millimetres and survive a regeneration on purpose.
   * Dragging a divider and watching the number move is the workflow the tool
   * exists for, and silently re-snapping them to the new mesh would change
   * what was measured without saying so.
   */
  readonly measure: MeasureState;
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

  /**
   * Anchor of the Workshop selection, by node id — the part the inspector
   * edits and align targets. Always a member of `selectedAssemblyPartIds`
   * (null exactly when that list is empty). Cleared when the part (or an
   * ancestor) is removed; an id absent from the tree after an undo must be
   * treated as no selection.
   */
  readonly selectedAssemblyPartId: string | null;

  /**
   * Full Workshop selection in selection order. Write through
   * `setAssemblySelection` (store/helpers) so the anchor invariant holds;
   * ids are pruned wherever parts can vanish (remove, undo, template load).
   */
  readonly selectedAssemblyPartIds: readonly string[];

  /** Palette part type armed for click-to-place in the Workshop canvas. */
  readonly workshopPendingPartType: AssemblyPartType | null;

  /** Starting profile for an armed cutter (the palette's Hole vs Slot). */
  readonly workshopPendingCutterShape: 'circle' | 'slot' | null;
  /**
   * Number of parts in the Workshop copy clipboard. The snapshots themselves
   * live module-level in assemblyActions; this mirror exists so paste
   * affordances can react to a copy happening.
   */
  readonly workshopClipboardCount: number;
  /** Workshop placement grid pitch (mm); Alt always overrides to the 0.1mm fine grid. */
  readonly workshopSnapMm: number;
}

/** In-flight divider tilt used only for live preview (see `dividerTiltPreview`). */
export interface DividerTiltPreview {
  readonly key: string;
  readonly offsetStart: number;
  readonly offsetEnd: number;
  readonly rakeDeg: number;
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
