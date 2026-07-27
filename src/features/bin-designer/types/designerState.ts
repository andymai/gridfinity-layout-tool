import type { SaveStatus } from '@/shared/types/saveStatus';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { CellMask } from '@/shared/utils/cellMask';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import type { ItemEnvelope, ItemKind, ItemStructure } from '@/shared/types/item';
import type { ColorZone, HoverableZone, LipColorConfig, TopAccentConfig } from './featureColors';
import type { LidConfig } from './lid';
import type {
  TextStyleDefaults,
  TextStyleOverride,
  WallTextSide,
  WallTextVerticalAlign,
} from './text';
import type {
  Cutout,
  CutoutConfig,
  CutoutColorScope,
  GroupOp,
  CutoutToggleProperties,
  ReorderDirection,
} from './cutout';
import type { BaseConfig } from './base';
import type { CompartmentConfig, ScoopConfig } from './compartments';
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
  ColorTool,
  PickerOverlayState,
  DividerTiltPreview,
  ExportFileNameConfig,
} from './uiState';
import type { SavedDesign } from './savedDesign';

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
   *  returns the count of labels that couldn't be preserved (#2337). */
  setCompartmentGrid: (cols: number, rows: number) => number;
  mergeCells: (cellIndices: readonly number[]) => void;
  splitCompartment: (compartmentId: number) => void;
  resetCompartments: () => void;
  setCompartmentText: (compartmentId: number, text: string) => void;
  /** Caption for a full-width label tab, keyed by the row hosting it (#2897). */
  setLabelRowText: (row: number, text: string) => void;
  setCompartmentPlateWidth: (compartmentId: number, widthU: number | null) => void;
  /** Set a compartment's swappable-plate hardware icon (null = none). */
  setCompartmentPlateIcon: (compartmentId: number, icon: LabelPlateIconId | null) => void;
  /** Set the global interior divider height in mm, or 'auto' for full height. */
  setCompartmentDividerHeight: (height: number | 'auto') => void;

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
  /** Remove text from every wall in one history entry (drops `wallAlign` too). */
  clearWallText: () => void;
  setWallTextAlign: (align: WallTextVerticalAlign) => void;
  setSurfaceTextStyle: (overrides: TextStyleOverride | null) => void;

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
  addCutout: (cutout: Cutout) => void;
  addMeshCutout: (cutout: Cutout, asset: MeshAsset) => void;
  removeCutout: (id: string) => void;
  updateCutout: (id: string, updates: Partial<Cutout>) => void;
  clearCutouts: () => void;
  duplicateCutouts: (cutoutIds: readonly string[]) => void;
  groupCutouts: (cutoutIds: readonly string[], op?: GroupOp) => void;
  ungroupCutouts: (cutoutIds: readonly string[]) => void;
  setGroupOp: (groupId: string, op: GroupOp) => void;

  // Transaction + batch cutout actions
  startTransaction: () => void;
  commitTransaction: () => void;
  updateCutoutsBatch: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  removeCutoutsBatch: (ids: readonly string[]) => void;

  // Consolidated cutout property + z-order actions
  setCutoutProperty: (ids: readonly string[], partial: CutoutToggleProperties) => void;
  /** Set/clear a cutout's shadow-board color. Writes to the whole group when any
   *  id is grouped; `color: null` clears it. Auto-enables multi-color output. */
  setCutoutColor: (
    ids: readonly string[],
    patch: { color?: string | null; colorScope?: CutoutColorScope }
  ) => void;
  reorderCutouts: (ids: readonly string[], direction: ReorderDirection) => void;
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
  setCutoutEditorOpen: (open: boolean) => void;
  setShapeEditorOpen: (open: boolean) => void;
  setSplitViewMode: (mode: SplitViewMode) => void;
  setSplitPieceMeshes: (meshes: readonly SplitPieceMeshEntry[]) => void;
  setHoveredColorZone: (zone: HoverableZone | null) => void;
  setHoveredOverhangSide: (side: OverhangHighlightSide | null) => void;
  setSelectedDividerKey: (key: string | null) => void;
  setHoveredDividerKey: (key: string | null) => void;
  setDividerTiltPreview: (preview: DividerTiltPreview | null) => void;
  setHoveredCompartmentId: (id: number | null) => void;
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
