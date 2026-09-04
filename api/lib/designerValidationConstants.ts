/**
 * Server-side numeric constraints for designer share payloads.
 *
 * These mirror the client `DESIGNER_CONSTRAINTS` in
 * `src/features/bin-designer/constants/gridfinity.ts` — keep in sync.
 * Extracted so both `designerValidation.ts` and the compartment validators
 * can share them without a circular import.
 */
export const CONSTRAINTS = {
  MIN_DIMENSION: 0.5,
  MAX_DIMENSION: 16,
  MIN_HEIGHT: 2,
  // A spacer is floorless, so the usable-cavity rationale behind MIN_HEIGHT
  // doesn't apply to it.
  MIN_SPACER_HEIGHT: 1,
  // A spacer keeps its walls, so its body must still clear the socket it
  // subtracts. 1u only does that at the 7mm default height unit; below 6mm a 1u
  // spacer asks for a zero or negative wall. Mirrors the client's
  // `MIN_BODY_WALL_MM` / `GRIDFINITY.SOCKET_HEIGHT`.
  MIN_BODY_WALL_MM: 1,
  SOCKET_HEIGHT: 5,
  DEFAULT_HEIGHT_UNIT_MM: 7,
  MAX_HEIGHT: 50,
  // Cutout fill level: how far the solid surface sits below the rim (mm). A
  // static bound for API payloads, matching MAX_LABEL_TAB_HEIGHT's reasoning
  // (ceiling 350 = MAX_HEIGHT * 7mm heightUnitMm), because heightUnitMm is
  // allowlisted but not range-checked. The client clamps to the actual wall
  // height; this only has to stop a NaN or an absurd number reaching the
  // generator, where it becomes `wallHeight - topOffset`.
  MAX_TOP_OFFSET_MM: 350,
  // Mirrors MAX_CUTOUT_LEAN_DEG in src/features/bin-designer/types/cutout.ts.
  // The client clamps at read time too; this stops a NaN or an absurd angle
  // reaching tan() in the generator's tool-extension math.
  MAX_CUTOUT_LEAN_DEG: 45,
  // Mirrors MAX_ARRAY_INSTANCES in src/features/bin-designer/types/cutout.ts.
  // A repeat expands to at most this many holes, so a label list longer than it
  // describes copies that do not exist. Bounded here so a direct HTTP POST
  // cannot smuggle an unbounded string array past the editor's own textarea.
  MAX_ARRAY_INSTANCES: 400,
  // Mirrors MAX_PARENT_GROUPS in src/features/bin-designer/types/cutout.ts.
  // Group ancestry is a path, so a cycle is unrepresentable and nothing breaks
  // past the cap; it is bounded here because a hand-authored payload is the one
  // route that never passes through the editor's own refusal.
  MAX_PARENT_GROUPS: 9,
  // Mirrors MAX_GROUP_NAME_LENGTH in the same file. Group names are editor
  // metadata that round-trip through sync, so they are length-bounded like
  // every other user-supplied string.
  MAX_GROUP_NAME_LENGTH: 60,
  // No client rule caps how many groups a design has (the bin's cutout array is
  // itself unbounded here), so this is a static ceiling whose only job is to
  // stop an unbounded map riding into storage.
  MAX_CUTOUT_GROUP_NAMES: 1000,
  MAX_DIVIDERS: 10,
  MIN_DIVIDER_THICKNESS: 0.8,
  MAX_DIVIDER_THICKNESS: 2.4,
  MIN_COMPARTMENT_GRID: 1,
  MAX_COMPARTMENT_GRID: 12,
  MIN_COMPARTMENT_THICKNESS: 0.4,
  MAX_COMPARTMENT_THICKNESS: 2.4,
  // Bento stash cap; mirrors DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES in
  // src/features/bin-designer/constants/gridfinity.ts (client refuses past it).
  MAX_STASH_ENTRIES: 36,
  MIN_LABEL_TAB_DEPTH: 8,
  // Deep enough for tuck-under ledges on wire bins; mirrors DESIGNER_CONSTRAINTS.
  MAX_LABEL_TAB_DEPTH: 50,
  MIN_LABEL_TAB_WIDTH: 10, // %
  MAX_LABEL_TAB_WIDTH: 100, // %
  // Label tab height is the Z of the shelf top above the cavity floor (mm).
  // Static bounds for API payloads — the client's UI uses a dynamic max
  // tied to the current bin's interior height. Floor (9) = MIN_LABEL_TAB_DEPTH + 1;
  // ceiling (350) = MAX_HEIGHT * 7mm (heightUnitMm).
  MIN_LABEL_TAB_HEIGHT: 9,
  MAX_LABEL_TAB_HEIGHT: 350,
  // Inset moves the tab inward from its anchor wall.
  MIN_LABEL_TAB_INSET: 0,
  MAX_LABEL_TAB_INSET: 100,
  // Swappable-label socket mode. Mirrors
  // `src/shared/constants/labelPlates.ts` — socket-mode tabs need extra
  // depth to host the 11.3mm pocket, and the fit offset rides on the total
  // pocket clearance so its bounds keep the clearance in [0.1, 0.8].
  MIN_LABEL_SOCKET_TAB_DEPTH: 14,
  LABEL_PLATE_FIT_OFFSET_MIN: -0.2,
  LABEL_PLATE_FIT_OFFSET_MAX: 0.5,
  MAGNET_MIN_DEPTH: 2.0,
  MAGNET_MAX_DEPTH: 4.0,
  // Exterior-wall collar — mirrors client
  // MIN/MAX_EXTRA_WALL_HEIGHT so a crafted share can't smuggle a runaway
  // wall height into the BREP worker.
  MIN_EXTRA_WALL_HEIGHT: 0,
  MAX_EXTRA_WALL_HEIGHT: 100,
  MAX_INSERTS: 20,
  MAX_INSERT_DIMENSION: 200,
  MAX_INSERT_DEPTH: 50,
  // Mirrors `MAX_LID_CUTOUTS` in `src/features/bin-designer/types/lid.ts`. Every
  // lid cutout is a boolean op against the plate, and nothing about a lid bounds
  // how many a payload can carry the way a cavity bounds the interior array.
  MAX_LID_CUTOUTS: 24,
  MAX_PAYLOAD_BYTES: 100_000, // 100KB max for designer shares
  // Mesh imprint assets (STL import). These mirror the client caps in
  // `src/shared/generation/meshAsset.ts` — keep in sync. Designs carrying
  // meshAssets get the raised payload cap; everything else keeps 100KB.
  MESH_MAX_PAYLOAD_BYTES: 2_000_000,
  MAX_MESH_ASSETS: 8,
  MAX_MESH_ASSET_TRIANGLES: 50_000,
  MAX_MESH_OUTLINE_POINTS: 4000,
  MAX_MESH_NAME_LENGTH: 64,
  // Compressed+base64 payload per asset. Typical 50k-tri assets land at
  // 200-500KB; this bounds a crafted blob without pinching real imports.
  MAX_MESH_DATA_LENGTH: 900_000,
  MAX_MESH_SIZE_MM: 1000,
  // Mask cells are half-bin resolution: 10 grid units × 2 = 20 cells per
  // side. Mirrors MAX_MASK_DIMENSION in `src/shared/utils/cellMask.ts`.
  MAX_MASK_DIMENSION: 20,
} as const;

/**
 * Standard swappable-label plate widths in pitch units. Mirrors
 * `LABEL_PLATE_WIDTHS_U` in `src/shared/constants/labelPlates.ts`. Shared
 * here so `designerCompartmentValidation.ts` can validate the
 * per-compartment `labelPlateWidths` overrides without a circular import.
 */
export const VALID_LABEL_PLATE_WIDTHS: readonly number[] = [1, 2, 3];

/**
 * Mirrors `LABEL_PLATE_ICONS` in `src/shared/constants/labelPlates.ts` without
 * a circular import. The allowlist for a compartment's `labelIcons` entries
 * and for a cutout's `labelIcon`.
 *
 * A short list here does not fail safe: an icon the designer offers and this
 * omits makes the whole design 400 on sync, so every addition there needs one
 * here. `designerValidation.test.ts` asserts the two agree.
 */
export const VALID_LABEL_PLATE_ICONS: readonly string[] = [
  'bolt',
  'screw',
  'woodScrew',
  'nut',
  'washer',
  'nail',
  'hexSocketCap',
  'setScrew',
  'selfTapping',
  'threadedRod',
  'splitPin',
  'lockWasher',
  'wingNut',
  'squareNut',
  'threadedInsert',
  'eyeBolt',
  'thumbScrew',
  'standoff',
  'drillBit',
  'hexKey',
  'tap',
  'countersink',
  'utilityBlade',
  'spring',
  'oRing',
  'bearing',
  'magnet',
  'zipTie',
  'sawBlade',
  'file',
  'endMill',
  'clip',
  'screwdriverBit',
  'teaspoon',
  'tablespoon',
  'fork',
  'knife',
  'spatula',
  'whisk',
  'tongs',
  'ladle',
  'chopsticks',
  'bottleOpener',
  'peeler',
  'rollingPin',
];

/**
 * Sliding-tray bounds. Mirrors `SLIDE_CONSTRAINTS` in
 * `src/features/bin-designer/types/slide.ts` — keep in sync, or valid client
 * payloads 400 on sync.
 *
 * These are the numbers a crafted share could otherwise use to drive runaway
 * BREP: the rail and tray dimensions feed the generator directly.
 */
export const SLIDE_CONSTRAINTS = {
  MIN_TRAY_WIDTH_UNITS: 0.5,
  MAX_TRAY_WIDTH_UNITS: 16,
  MIN_TRAY_DEPTH_MM: 3,
  MAX_TRAY_DEPTH_MM: 140,
  MIN_TRAY_WALL_MM: 0.4,
  MAX_TRAY_WALL_MM: 2.4,
  MIN_RAIL_DROP_MM: 0,
  MAX_RAIL_DROP_MM: 140,
  MIN_RAIL_PROTRUSION_MM: 0.8,
  MAX_RAIL_PROTRUSION_MM: 6,
  MIN_RAIL_THICKNESS_MM: 0.8,
  MAX_RAIL_THICKNESS_MM: 6,
  MIN_CLEARANCE_MM: 0.1,
  MAX_CLEARANCE_MM: 2,
} as const;

/** Mirrors `SLIDE_RAIL_MOUNTS` in `src/features/bin-designer/types/slide.ts`. */
export const VALID_SLIDE_RAIL_MOUNTS: readonly string[] = ['interior', 'rim'];
