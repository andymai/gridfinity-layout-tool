import type { SaveStatus } from '@/shared/types/saveStatus';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { CellMask } from '@/shared/utils/cellMask';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import type { ItemEnvelope, ItemKind, ItemStructure } from '@/shared/types/item';
import type { ColorZone, HoverableZone, LipColorConfig, TopAccentConfig } from './featureColors';
import type { LidConfig } from './lid';
import type { TextStyleDefaults, TextStyleOverride, WallTextSide, TextAnchor } from './text';
import type {
  Cutout,
  CutoutArrayConfig,
  CutoutConfig,
  CutoutColorScope,
  GroupOp,
  CutoutToggleProperties,
  ReorderDirection,
} from './cutout';
import type { BaseConfig } from './base';
import type {
  CellRect,
  CompartmentColorScope,
  CompartmentConfig,
  ScoopConfig,
} from './compartments';
import type { InteriorCard } from './interior';
import type { LabelTabConfig } from './labelTabs';
import type { HandleConfig, HandleSide, HandleWallSide } from './handles';
import type {
  WallConfig,
  WallCutout,
  WallSide,
  OverhangConfig,
  OverhangHighlightSide,
  WallPatternConfig,
} from './walls';
import type { SlideConfig } from './slide';
import type { FloorPatternConfig } from './floor';
import type { BinParams, Insert } from './binParams';
import type {
  GenerationState,
  GenerationStatus,
  GenerationResult,
  WasmStatus,
  SplitPieceMeshEntry,
} from './generation';
import type { PerfSnapshot } from '@/shared/types/generation';
import type {
  DesignerHistory,
  DesignerUIState,
  DesignerTab,
  SplitViewMode,
  CutoutTarget,
  ColorTool,
  PickerOverlayState,
  DividerTiltPreview,
  ExportFileNameConfig,
} from './uiState';
import type { SavedDesign } from './savedDesign';
import type { CommunityDesignLineage } from '@/shared/types/community';

/** Complete designer store state */
export interface DesignerState {
  // Data
  params: BinParams;
  /** 'bin' (default) edits `params`; non-bin kinds edit `envelope` + `structure`. */
  itemKind: ItemKind;
  /** Envelope + structure for non-bin kinds (null when itemKind is 'bin'). */
  envelope: ItemEnvelope | null;
  structure: ItemStructure | null;
  generation: GenerationState;
  history: DesignerHistory;
  wasmStatus: WasmStatus;
  ui: DesignerUIState;
  /** Transaction nesting depth — when > 0, pushHistoryEntry is suppressed */
  transactionDepth: number;

  // Persistence
  currentDesignId: string | null;
  designName: string;
  /**
   * Remix lineage of the loaded design, lifted into live state (unlike
   * publishedId, which is read on demand at publish-open) so the remix
   * banner can render without an async storage read.
   */
  lineage: CommunityDesignLineage | null;
  saveStatus: SaveStatus;
  exportFileNameConfig: ExportFileNameConfig;
  pendingBinLink: string | null;
  /** True when we need to capture thumbnail after next successful generation */
  needsThumbnailUpdate: boolean;

  // Param actions
  setParam: <K extends keyof BinParams>(key: K, value: BinParams[K]) => void;
  setParams: (partial: Partial<BinParams>) => void;
  resetToDefaults: () => void;

  // Scoped updaters (merge partial into nested config, push history)
  updateBase: (partial: Partial<BaseConfig>) => void;
  updateLabel: (partial: Partial<LabelTabConfig>) => void;
  updateScoop: (partial: Partial<ScoopConfig>) => void;
  updateWalls: (partial: Partial<WallConfig>) => void;
  updateSlide: (partial: Partial<SlideConfig>) => void;
  updateOverhang: (partial: Partial<OverhangConfig>) => void;
  updateWallSide: (side: WallSide, partial: Partial<WallCutout>) => void;
  updateHandles: (partial: Partial<HandleConfig>) => void;
  updateHandleSide: (side: HandleWallSide, partial: Partial<HandleSide>) => void;
  updateFeatureColors: (patch: {
    enabled?: boolean;
    body?: string;
    lip?: Partial<LipColorConfig>;
    labelTab?: string;
    base?: string;
    scoop?: string;
    dividers?: string;
    text?: string;
    lid?: string;
    lidLip?: Partial<LipColorConfig>;
    topAccent?: Partial<TopAccentConfig>;
  }) => void;
  updateLid: (partial: Partial<LidConfig>) => void;

  // History actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Persistence actions
  setCurrentDesignId: (id: string | null) => void;
  setDesignName: (name: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setExportFileNameConfig: (config: ExportFileNameConfig) => void;
  setPendingBinLink: (binId: string | null) => void;
  clearPendingBinLink: () => void;
  setNeedsThumbnailUpdate: (needed: boolean) => void;
  newDesign: (kind?: ItemKind) => void;
  loadDesign: (design: SavedDesign) => void;

  // Non-bin item actions (no-ops when itemKind is 'bin')
  updateStructure: (partial: Partial<ItemStructure>) => void;
  updateEnvelope: (partial: Partial<ItemEnvelope>) => void;

  // Compartment actions
  /** Regenerate a uniform grid. Carries labels by position where they fit and
   *  returns the count of labels that couldn't be preserved. */
  setCompartmentGrid: (cols: number, rows: number) => number;
  mergeCells: (cellIndices: readonly number[]) => void;
  splitCompartment: (compartmentId: number) => void;
  resetCompartments: () => void;
  setCompartmentText: (compartmentId: number, text: string) => void;
  /** Caption for a full-width label tab, keyed by the row hosting it. */
  setLabelRowText: (row: number, text: string) => void;
  /** Drop every caption in one history entry, so one undo restores them all. */
  clearLabelText: (scope: 'compartment' | 'row') => void;
  setCompartmentPlateWidth: (compartmentId: number, widthU: number | null) => void;
  /** Set a compartment's swappable-plate hardware icon (null = none). */
  setCompartmentPlateIcon: (compartmentId: number, icon: LabelPlateIconId | null) => void;
  /** Shadow-box colour for one compartment; null clears it. */
  setCompartmentColor: (compartmentId: number, color: string | null) => void;
  /** Which surfaces that compartment's colour paints. */
  setCompartmentColorScope: (compartmentId: number, scope: CompartmentColorScope) => void;
  /** Set the global interior divider height in mm, or 'auto' for full height. */
  setCompartmentDividerHeight: (height: number | 'auto') => void;

  // Bento workspace actions (additive draw model over the compartment grid).
  // Mutating actions return the affected compartment's POST-normalization id
  // (ids renumber on every mutation) or null when the op was invalid.
  drawBentoCompartment: (rect: CellRect) => number | null;
  moveBentoCompartment: (id: number, dCol: number, dRow: number) => number | null;
  resizeBentoCompartment: (id: number, target: CellRect) => number | null;
  duplicateBentoCompartment: (id: number, target: CellRect) => number | null;
  removeBentoCompartment: (id: number) => boolean;
  stashBentoCompartment: (id: number) => boolean;
  placeBentoStashEntry: (index: number, rect: CellRect) => number | null;
  removeBentoStashEntry: (index: number) => boolean;
  /** Preserve-and-stash grid resize; null when the size pre-flight rejects. */
  setBentoGridPreserving: (
    cols: number,
    rows: number
  ) => { stashedCount: number; droppedCount: number } | null;
  clearBentoCompartments: () => void;

  // Angled-divider override actions
  setDividerOverride: (
    compartmentA: number,
    compartmentB: number,
    offsetStart: number,
    offsetEnd: number
  ) => void;
  removeDividerOverride: (compartmentA: number, compartmentB: number) => void;
  clearDividerOverrides: () => void;

  // Text style actions (engraved text on label tabs and cutouts)
  setTextDefaults: (partial: Partial<TextStyleDefaults>) => void;
  setLabelTabTextStyle: (overrides: TextStyleOverride | null) => void;

  // Surface text actions (lid top + outer walls)
  setLidText: (text: string) => void;
  setWallText: (side: WallTextSide, text: string) => void;
  /** Remove text from every wall in one history entry (drops per-wall styles too). */
  clearWallText: () => void;
  setSurfaceTextStyle: (overrides: TextStyleOverride | null) => void;
  /** Anchor for every surface, written onto the shared surface style. */
  setSurfaceTextAnchor: (anchor: TextAnchor) => void;
  setLidTextStyle: (overrides: TextStyleOverride | null) => void;
  setWallTextStyle: (side: WallTextSide, overrides: TextStyleOverride | null) => void;

  // Wall pattern actions
  updateWallPattern: (partial: Partial<WallPatternConfig>) => void;
  updateFloorPattern: (partial: Partial<FloorPatternConfig>) => void;

  // Cutout configuration actions
  updateCutoutConfig: (partial: Partial<CutoutConfig>) => void;

  // Insert actions
  addInsert: (insert: Insert) => void;
  removeInsert: (id: string) => void;
  updateInsert: (id: string, updates: Partial<Insert>) => void;
  clearInserts: () => void;

  // Custom bin shape
  setCellMask: (mask: CellMask | undefined) => void;

  // Cutout actions
  /** Returns whether the cutout landed — false when the lid is at its cap. */
  addCutout: (cutout: Cutout) => boolean;
  addMeshCutout: (cutout: Cutout, asset: MeshAsset) => void;
  removeCutout: (id: string) => void;
  updateCutout: (id: string, updates: Partial<Cutout>) => void;
  clearCutouts: () => void;
  duplicateCutouts: (cutoutIds: readonly string[]) => void;
  groupCutouts: (cutoutIds: readonly string[], op?: GroupOp) => void;
  ungroupCutouts: (cutoutIds: readonly string[]) => void;
  /**
   * Drag-and-drop reparent: move `ids` onto `targetId`'s group (creating one
   * when the target is loose), or out of any group when `targetId` is null.
   * Unlike `groupCutouts` the destination always wins.
   */
  reparentCutouts: (ids: readonly string[], targetId: string | null) => void;
  setGroupOp: (groupId: string, op: GroupOp) => void;

  // Transaction + batch cutout actions
  startTransaction: () => void;
  commitTransaction: () => void;
  updateCutoutsBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  removeCutoutsBatch: (ids: readonly string[]) => void;
  /**
   * Collapse hand-placed duplicates into one parametric repeat: the master
   * takes `config` and the absorbed cutouts are removed, as ONE history entry
   * so a single undo puts every cutout back. Doing this through
   * `updateCutout` + `removeCutoutsBatch` would cost one entry per step and
   * leave a half-merged design reachable by undo.
   */
  /** Returns false when the guards declined, so callers can skip the toast. */
  mergeCutoutsIntoArray: (
    masterId: string,
    config: CutoutArrayConfig,
    absorbedIds: readonly string[]
  ) => boolean;

  // Consolidated cutout property + z-order actions
  setCutoutProperty: (ids: readonly string[], partial: CutoutToggleProperties) => void;
  /** Set/clear a cutout's shadow-board color. Writes to the whole group when any
   *  id is grouped; `color: null` clears it. Auto-enables multi-color output. */
  setCutoutColor: (
    ids: readonly string[],
    patch: { color?: string | null; colorScope?: CutoutColorScope }
  ) => void;
  reorderCutouts: (ids: readonly string[], direction: ReorderDirection) => void;
  /**
   * Drag-and-drop reorder: move `ids` directly above `targetId` in the stack,
   * or to the bottom when it is null. Moved shapes keep their relative order.
   */
  moveCutoutsAbove: (ids: readonly string[], targetId: string | null) => void;
  showAllCutouts: () => void;

  // Convenience wrappers (delegate to setCutoutProperty/reorderCutouts)
  lockCutouts: (ids: readonly string[]) => void;
  unlockCutouts: (ids: readonly string[]) => void;
  hideCutouts: (ids: readonly string[]) => void;
  showCutouts: (ids: readonly string[]) => void;
  bringForward: (ids: readonly string[]) => void;
  sendBackward: (ids: readonly string[]) => void;
  bringToFront: (ids: readonly string[]) => void;
  sendToBack: (ids: readonly string[]) => void;

  // Generation actions
  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationResult: (result: GenerationResult) => void;
  /** Apply a fast draft mesh from the preview kernel (renders, marks `isDraft`, skips history cache). */
  setDraftResult: (result: GenerationResult) => void;
  setWasmStatus: (status: WasmStatus) => void;
  pushPerfSnapshot: (snapshot: PerfSnapshot) => void;
  clearPerfHistory: () => void;

  // UI actions
  setActiveTab: (tab: DesignerTab) => void;
  setExportDialogOpen: (open: boolean) => void;
  setDesignListOpen: (open: boolean) => void;
  setWireframeMode: (enabled: boolean) => void;
  /**
   * Open or close the full-workspace cutout editor, and say which part it draws
   * on. Closing resets the target to the bin, so the sidebar's own cutout
   * controls can never be left pointed at the lid.
   */
  setCutoutEditorOpen: (open: boolean, target?: CutoutTarget) => void;
  setBentoWorkspaceOpen: (open: boolean) => void;
  setInteriorCard: (card: InteriorCard) => void;
  setShapeEditorOpen: (open: boolean) => void;
  setSplitViewMode: (mode: SplitViewMode) => void;
  setSplitPieceMeshes: (meshes: readonly SplitPieceMeshEntry[]) => void;
  setHoveredColorZone: (zone: HoverableZone | null) => void;
  setHoveredOverhangSide: (side: OverhangHighlightSide | null) => void;
  setSelectedDividerKey: (key: string | null) => void;
  setHoveredDividerKey: (key: string | null) => void;
  setDividerTiltPreview: (preview: DividerTiltPreview | null) => void;
  setHoveredCompartmentId: (id: number | null) => void;
  /** Switch the compartment grid between editing dividers and picking a label. */
  setCompartmentLabelMode: (on: boolean) => void;
  /** Point both the grid and the label-text list at the same compartment. */
  setLabelFocusCompartmentId: (id: number | null) => void;
  /** Select a drawn compartment in the Bento workspace (null clears). */
  setSelectedBentoCompartmentId: (id: number | null) => void;
  /** Enter a color tool overlay, or pass null to exit any active tool. */
  setColorTool: (tool: ColorTool) => void;
  /**
   * Anchor + zone for the eyedropper picker. Pass null to dismiss; the
   * picker is also auto-cleared when `setColorTool(null)` runs or when
   * multi-color gets disabled.
   */
  setPickerOverlay: (overlay: PickerOverlayState | null) => void;
  /**
   * Pick a zone in the active flow. Behavior depends on `ui.colorTool`:
   *  - `'swap-pick-first'`: store the zone and advance to `'swap-pick-second'`
   *  - `'swap-pick-second'`: swap colors between stored zone and this one,
   *    in a single undo entry, then exit the tool — returns the pair that
   *    was swapped so the caller can show a localized toast.
   *  - any other state: no-op (eyedropper opens the picker via UI, not state)
   */
  pickSwapZone: (zone: ColorZone) => { first: ColorZone; second: ColorZone } | null;
  setPreviewCompartments: (preview: CompartmentConfig | null) => void;
  setPreviewSelection: (
    selection: {
      action: 'merge' | 'split';
      minCol: number;
      maxCol: number;
      minRow: number;
      maxRow: number;
    } | null
  ) => void;
  toggleHalfGridMode: () => void;
}
