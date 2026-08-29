import type { SaveStatus } from '@/shared/types/saveStatus';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { MeasurePoint } from '@/features/bin-designer/utils/measure3d';
import type { CellMask } from '@/shared/utils/cellMask';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import type { ItemEnvelope, ItemKind, ItemStructure } from '@/shared/types/item';
import type {
  AssemblyBase,
  AssemblyPartNode,
  AssemblyPartParams,
  AssemblyPartType,
  PartArray,
  PartTransform,
  PartLabel,
} from '@/shared/types/assembly';
import type { AccentBandConfig, ColorZone, HoverableZone, LipColorConfig } from './featureColors';
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
  DividerOverride,
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
import type { DesignVersionContent } from './designVersion';
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
  DesignerCategory,
  SplitViewMode,
  CutoutTarget,
  ColorTool,
  PickerOverlayState,
  MeasureMode,
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
    topAccent?: Partial<AccentBandConfig>;
    bottomAccent?: Partial<AccentBandConfig>;
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
  /**
   * Replace the working state with a stored version of the same design, as one
   * undoable step. Unlike {@link loadDesign} this keeps `currentDesignId` and
   * the undo history.
   */
  restoreVersion: (content: DesignVersionContent) => void;

  // Non-bin item actions (no-ops when itemKind is 'bin')
  updateStructure: (partial: Partial<ItemStructure>) => void;
  updateEnvelope: (partial: Partial<ItemEnvelope>) => void;

  // Workshop assembly actions (no-ops unless structure.kind is 'assembly')
  addAssemblyPart: (
    type: AssemblyPartType,
    parentId: string | null,
    transform?: Partial<PartTransform>,
    params?: Partial<AssemblyPartParams>
  ) => string | null;
  moveAssemblyPart: (id: string, transform: Partial<PartTransform>) => void;
  reparentAssemblyPart: (
    id: string,
    newParentId: string | null,
    transform?: Partial<PartTransform>
  ) => boolean;
  duplicateAssemblyPart: (id: string) => string | null;
  removeAssemblyPart: (id: string) => void;
  updateAssemblyPartParams: (id: string, params: Partial<AssemblyPartParams>) => void;
  setAssemblyPartArray: (id: string, array: PartArray | null) => void;
  setAssemblyPartLabel: (id: string, label: PartLabel | null) => void;
  setAssemblyPartMirror: (id: string, mirror: boolean) => void;
  setAssemblyMirrorAxis: (axis: 'x' | 'y') => void;
  alignAssemblySiblings: (id: string, axis: 'x' | 'y') => void;
  distributeAssemblySiblings: (id: string, axis: 'x' | 'y') => void;
  loadAssemblyTemplate: (parts: AssemblyPartNode[]) => boolean;
  updateAssemblyBase: (partial: Partial<AssemblyBase>) => void;

  // Workshop group operations — world-frame, acting on the top-level members
  // of the given selection (descendants of another member ride along)
  moveAssemblyPartsWorldTo: (
    targets: readonly { id: string; x: number; y: number; rotZDeg?: number }[]
  ) => void;
  nudgeAssemblyPartsWorld: (ids: readonly string[], dx: number, dy: number) => void;
  rotateAssemblyPartsWorld: (ids: readonly string[], deltaDeg: number) => void;
  alignAssemblyPartsWorld: (ids: readonly string[], axis: 'x' | 'y') => void;
  distributeAssemblyPartsWorld: (ids: readonly string[], axis: 'x' | 'y') => void;
  removeAssemblyParts: (ids: readonly string[]) => void;
  duplicateAssemblyParts: (
    ids: readonly string[],
    offsetMm?: number
  ) => { id: string; sourceId: string }[];
  copyAssemblyParts: (ids: readonly string[]) => number;
  pasteAssemblyParts: (at?: { x: number; y: number }) => string[];

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
  /** Fuse drawn compartments into one shape; null unless their union touches. */
  mergeBentoCompartments: (ids: readonly number[]) => number | null;
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
  /** Bento mode: leftover cells merge into one pocket per open area. */
  setBentoMergeBackground: (enabled: boolean) => void;

  // Angled-divider override actions
  setDividerOverride: (
    compartmentA: number,
    compartmentB: number,
    offsetStart: number,
    offsetEnd: number,
    rakeDeg?: number
  ) => void;
  setDividerOverrides: (overrides: readonly DividerOverride[]) => void;
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
  /**
   * Bind a selection into one group, resolved relative to `context` — the
   * groups the editor has been drilled into.
   *
   * With no `op`, a selection reaching only loose shapes forms a boolean group
   * (the pre-nesting behavior) and one reaching any group forms an arrange-only
   * container around it. An explicit `op` always means the Pathfinder path and
   * always produces a boolean group.
   */
  groupCutouts: (cutoutIds: readonly string[], op?: GroupOp, context?: readonly string[]) => void;
  /** Pull `cutoutIds` out of their own boolean group, leaving containers intact. */
  ungroupCutouts: (cutoutIds: readonly string[]) => void;
  /**
   * Move whole units (shape-list rows, as `unitTag`s) under `destGroupId`, or
   * to the top level when null.
   */
  moveUnitsIntoGroup: (tags: readonly string[], destGroupId: string | null) => void;
  /**
   * Dissolve one group, promoting its children to its level and leaving every
   * group nested inside it untouched. This is what Ungroup runs on a group row.
   */
  peelGroup: (groupId: string) => void;
  /** Rename a group; an empty name clears the entry back to a derived label. */
  setCutoutGroupName: (groupId: string, name: string) => void;
  /**
   * Drag-and-drop reparent: move `ids` onto `targetId`'s group (creating one
   * when the target is loose), or out of any group when `targetId` is null.
   * Unlike `groupCutouts` the destination always wins.
   */
  reparentCutouts: (ids: readonly string[], targetId: string | null) => void;
  setGroupOp: (groupId: string, op: GroupOp) => void;
  /**
   * Set or clear the repeat driving `cutoutId`, writing it to every member of
   * its group so a boolean result arrays as one unit.
   *
   * One shared config rather than a per-member one, for the same reason
   * `groupOp` and the cavity color are shared: the members describe one cavity,
   * and two members repeating differently would describe a pattern the boolean
   * cannot be built from. `undefined` removes the repeat.
   *
   * `context` is the level to resolve the unit AT, not the group to repeat —
   * pass a container's own level (`[]` for a top-level one) to repeat that
   * container, and passing the container's id instead would mean "inside it"
   * and land the write on whichever subgroup `cutoutId` belongs to. Omitted, it
   * resolves at the target's own level: a loose shape repeats alone, a boolean
   * member repeats its group.
   */
  setCutoutArray: (
    cutoutId: string,
    config: CutoutArrayConfig | undefined,
    context?: readonly string[]
  ) => void;

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
  setActiveCategory: (category: DesignerCategory) => void;
  setExportDialogOpen: (open: boolean) => void;
  setDesignListOpen: (open: boolean) => void;
  setVersionsOpen: (open: boolean) => void;
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
  setSelectedAssemblyPartId: (id: string | null) => void;
  /** Replace the Workshop multi-selection; `anchor` must be a member to win. */
  setSelectedAssemblyPartIds: (ids: readonly string[], anchor?: string | null) => void;
  /** Shift-click semantics: add the id, or drop it if already selected. */
  toggleAssemblyPartSelected: (id: string) => void;
  setWorkshopPendingPartType: (
    type: AssemblyPartType | null,
    cutterShape?: 'circle' | 'slot' | null
  ) => void;
  setWorkshopSnapMm: (snapMm: number) => void;
  /** Enter a color tool overlay, or pass null to exit any active tool. */
  setColorTool: (tool: ColorTool) => void;
  /**
   * Anchor + zone for the eyedropper picker. Pass null to dismiss; the
   * picker is also auto-cleared when `setColorTool(null)` runs or when
   * multi-color gets disabled.
   */
  setPickerOverlay: (overlay: PickerOverlayState | null) => void;
  /**
   * Turn the 3D measuring tool on or off. Turning it on clears any color tool:
   * both own pointer picks in the preview, and the overlay banner promise is
   * that only one tool is live at a time.
   */
  setMeasureActive: (active: boolean) => void;
  setMeasureMode: (mode: MeasureMode) => void;
  /** Place the next point. A pick past the second starts a fresh measurement. */
  addMeasurePoint: (point: MeasurePoint) => void;
  /** Record a whole measurement at once, which is what a thickness probe is. */
  setMeasurePoints: (points: readonly MeasurePoint[]) => void;
  clearMeasure: () => void;
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
