/**
 * Backward-compat migration for persisted bin designs.
 *
 * Everything that coerces an older saved shape into the current `BinParams`
 * lives here — wall/lid/color/param migration plus the style-defaults
 * extraction that mirrors it. `defaults.ts` stays pure data; this module
 * imports those defaults to backfill, never the other way around.
 */

import type {
  BinParams,
  CutoutConfig,
  DividerPieceConfig,
  HandleConfig,
  SlotConfig,
  WallPatternConfig,
  WallPatternSides,
  WallPatternType,
  FloorPatternConfig,
  Cutout,
  HandleCutoutShape,
  WallConfig,
} from '../types';
import {
  CUTOUT_FILL_REFERENCES,
  DEFAULT_PATTERN_SCALE,
  PATTERN_WEB_THICKNESS_MAX,
  PATTERN_WEB_THICKNESS_MIN,
} from '../types';
import { referencedGroupIds } from '../utils/cutoutHierarchy';
import type { FeatureColorConfig } from '../types/featureColors';
import type { SlideConfig, SlideRailMount } from '../types/slide';
import { DEFAULT_SLIDE_CONFIG, SLIDE_RAIL_MOUNTS } from '../types/slide';
import type { BaseConfig } from '../types/base';
import { DEFAULT_DETACHABLE_PIN_DIAMETER_MM, DETACHABLE_PIN_DIAMETERS_MM } from '../types/base';
import {
  DEFAULT_LID_CONFIG,
  LID_EXTRA_HEIGHT_MIN_MM,
  LID_EXTRA_HEIGHT_MAX_MM,
  LID_TOP_THICKNESS_MIN_MM,
  LID_TOP_THICKNESS_MAX_MM,
} from '../types/lid';
import type { LidConfig } from '../types/lid';
import { DEFAULT_TEXT_STYLE_DEFAULTS } from '../types/text';
import type { TextStyleDefaults } from '../types/text';
import { MAX_CUTOUT_TOP_OFFSET_MM } from '../utils/cutoutFill';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_CUTOUT_CONFIG,
  DEFAULT_DIVIDER_PIECE_CONFIG,
  DEFAULT_HANDLE_CONFIG,
  DEFAULT_SLOT_CONFIG,
  DEFAULT_SPLIT_CONNECTOR_CONFIG,
  DISABLED_WALL_CUTOUT,
  VALID_WALL_PATTERNS,
  VALID_FLOOR_PATTERNS,
  DEFAULT_FLOOR_PATTERN_CONFIG,
  VALID_HANDLE_SHAPES,
} from './defaults';
import { clampNumber } from './paramMigrationHelpers';
import {
  migrateWalls,
  migrateClickRails,
  migrateClickRailCoverage,
  migrateExtraWallHeightMm,
} from './paramMigrationWalls';
import type { LegacyWallConfig, LegacyWallPatternConfig } from './paramMigrationWalls';
import {
  migrateAttachment,
  migrateRetentionMagnet,
  migrateTray,
  migrateGrip,
  migrateHinge,
  migrateSlide,
  migrateTrayBottom,
} from './paramMigrationLid';
import { migrateFeatureColors } from './paramMigrationColors';
import type { LegacyFeatureColorInput } from './paramMigrationColors';
import {
  migrateCutout,
  normalizeGroupChains,
  migrateCutoutGroupNames,
  shareGroupArrays,
  migrateLidCutouts,
  migrateKnifeRest,
} from './paramMigrationCutouts';
import type { LegacyCutoutFields } from './paramMigrationCutouts';
import { migrateSurfaceText, migrateWallLabelSlots } from './paramMigrationText';
import { migrateBentoCompartmentFields } from './paramMigrationCompartments';
export { migrateWalls } from './paramMigrationWalls';
export type { LegacyWallConfig } from './paramMigrationWalls';

/**
 * Clamp a persisted `extraHeightMm` into its valid range. Non-numeric or
 * legacy-absent values default to 0 (the standard lid); out-of-range values
 * are clamped so a corrupt/hand-edited design can't feed a runaway height
 * into the lid cavity geometry.
 */
function migrateExtraHeightMm(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_LID_CONFIG.extraHeightMm;
  }
  return Math.min(LID_EXTRA_HEIGHT_MAX_MM, Math.max(LID_EXTRA_HEIGHT_MIN_MM, raw));
}

/**
 * Clamp the sliding-lid config.
 *
 * Every design saved before the mode existed falls back to
 * {@link DEFAULT_LID_SLIDE_CONFIG} wholesale, which is safe in a way the other
 * lid sub-objects are not: no such design can carry `attachment: 'slide'`, so
 * nothing reads these values and no published geometry moves. That is also why
 * the defaults here are chosen for a good first experience rather than for
 * byte-identity — there is nothing to be identical to.
 */

/** Legacy fields that may appear in saved designs from older versions. */
interface LegacyFields {
  dividers?: { x: number; y: number; thickness: number };
  eco?: {
    honeycombWall?: {
      enabled?: boolean;
      mode?: string;
    };
  };
  walls?: WallConfig | LegacyWallConfig;
}

/**
 * Input type for migrateParams — current params plus known legacy fields.
 *
 * `wallPattern` and `featureColors` are re-declared (via `Omit`, not a plain
 * intersection) against their permissive legacy shapes: `Partial<BinParams>`
 * alone would force every field to already match the CURRENT strict config,
 * which defeats the point of a migration input.
 */
type MigrateParamsInput = Omit<Partial<BinParams>, 'wallPattern' | 'featureColors'> &
  LegacyFields & {
    wallPattern?: WallPatternConfig | LegacyWallPatternConfig;
    featureColors?: FeatureColorConfig | LegacyFeatureColorInput;
  };

/**
 * Populate missing bin parameters with default values.
 * Handles backward compatibility for old designs:
 * - scoop was boolean in earlier versions
 * - dividers (DividerConfig) migrates to compartments (CompartmentConfig)
 *
 * @param params - Partial bin parameters to migrate; any fields not provided will be filled from `DEFAULT_BIN_PARAMS`.
 * @returns A complete `BinParams` object with unspecified fields taken from `DEFAULT_BIN_PARAMS`.
 */
export function migrateParams(params: MigrateParamsInput): BinParams {
  // Migrate old boolean scoop format to ScoopConfig
  let scoopConfig = DEFAULT_BIN_PARAMS.scoop;
  if (params.scoop !== undefined) {
    if (typeof params.scoop === 'boolean') {
      // Legacy format: boolean → ScoopConfig
      scoopConfig = { ...DEFAULT_BIN_PARAMS.scoop, enabled: params.scoop };
    } else {
      scoopConfig = { ...DEFAULT_BIN_PARAMS.scoop, ...params.scoop };
    }
    // Strip removed allRows field from old saved designs
    const { allRows: _, ...cleanScoop } = scoopConfig as typeof scoopConfig & { allRows?: unknown };
    scoopConfig = cleanScoop;
  }

  // Migrate old DividerConfig to CompartmentConfig
  let compartmentsConfig = DEFAULT_BIN_PARAMS.compartments;
  if (params.compartments !== undefined) {
    compartmentsConfig = migrateBentoCompartmentFields({
      ...DEFAULT_BIN_PARAMS.compartments,
      ...params.compartments,
    });
  } else if (params.dividers !== undefined) {
    // Legacy format: DividerConfig → CompartmentConfig
    const { x, y, thickness } = params.dividers;
    const cols = x + 1;
    const rows = y + 1;
    const cells: number[] = [];
    for (let i = 0; i < rows * cols; i++) {
      cells.push(i);
    }
    compartmentsConfig = { cols, rows, thickness, cells };
  }

  // Migrate old number-based WallConfig to WallCutout format
  const wallsConfig = migrateWalls(params.walls, DEFAULT_BIN_PARAMS.walls, DISABLED_WALL_CUTOUT);

  // Migrate legacy base.solid=true → style='solid'
  const mergedBase = { ...DEFAULT_BIN_PARAMS.base, ...(params.base ?? {}) };
  // Backfilled ONLY for a design that actually uses the lid base. `params` is
  // hashed wholesale by `communityParamsFingerprint`, so backfilling this
  // unconditionally would shift every existing design's fingerprint and break
  // the community duplicate guard against already-published records.
  // Absent, never `false` — a stored `false` would shift the fingerprint of a
  // design that has no tray just as an always-present default would.
  if (mergedBase.tile !== true) {
    delete (mergedBase as { tile?: boolean }).tile;
  }
  // A stored pin diameter from the 5mm era meets pin holes now cut at a fixed
  // 3mm, so the printed parts are unassemblable and the server validator
  // rejects the design outright on re-publish. Snap anything off the current
  // list to the default; absent stays absent, per the fingerprint note above.
  if (
    mergedBase.feetPinDiameter !== undefined &&
    !(DETACHABLE_PIN_DIAMETERS_MM as readonly number[]).includes(mergedBase.feetPinDiameter)
  ) {
    mergedBase.feetPinDiameter = DEFAULT_DETACHABLE_PIN_DIAMETER_MM;
  }
  const baseConfig: BaseConfig =
    mergedBase.style === 'lid'
      ? { ...mergedBase, trayBottom: migrateTrayBottom(mergedBase.trayBottom) }
      : mergedBase;
  let style = params.style ?? DEFAULT_BIN_PARAMS.style;
  if (baseConfig.solid && style !== 'solid') {
    style = 'solid';
  }

  // Backfill slot config and divider pieces
  const slotConfig: SlotConfig = {
    ...DEFAULT_SLOT_CONFIG,
    ...((params.slotConfig as Partial<SlotConfig> | undefined) ?? {}),
    x: {
      ...DEFAULT_SLOT_CONFIG.x,
      ...(params.slotConfig?.x as Partial<SlotConfig['x']> | undefined),
    },
    y: {
      ...DEFAULT_SLOT_CONFIG.y,
      ...(params.slotConfig?.y as Partial<SlotConfig['y']> | undefined),
    },
  };

  const dividerPieces: DividerPieceConfig = {
    ...DEFAULT_DIVIDER_PIECE_CONFIG,
    ...((params.dividerPieces as Partial<DividerPieceConfig> | undefined) ?? {}),
  };

  // Migrate wallPattern config, handling 3 cases:
  // Fresh object each time — avoid returning shared DEFAULT_WALL_PATTERN_CONFIG reference.
  // `wallPatternRaw` stays in the permissive legacy shape until the coercion
  // block below rebuilds a properly-typed `WallPatternConfig` from it — a
  // crafted/legacy save can carry any value in `dividers`/`sides`/`pattern`.
  let wallPatternRaw: WallPatternConfig | LegacyWallPatternConfig = {
    enabled: false,
    pattern: 'honeycomb',
    scale: DEFAULT_PATTERN_SCALE,
    dividers: false,
  };
  if (params.wallPattern !== undefined) {
    wallPatternRaw = { ...wallPatternRaw, ...params.wallPattern };
  } else if (params.eco !== undefined) {
    const honeycombWall = params.eco.honeycombWall;
    if (honeycombWall) {
      wallPatternRaw = {
        enabled:
          typeof honeycombWall.enabled === 'boolean'
            ? honeycombWall.enabled
            : typeof honeycombWall.mode === 'string'
              ? honeycombWall.mode !== 'none'
              : false,
        pattern: 'honeycomb',
        scale: DEFAULT_PATTERN_SCALE,
        dividers: false,
      };
    }
  }
  // Coerce an unknown/removed pattern back to a valid member, and clamp a
  // crafted or out-of-range scale into [0, 1] so persisted data stays honest.
  const rawScale = wallPatternRaw.scale;
  const rawWeb = wallPatternRaw.webThickness;
  const rawPattern = wallPatternRaw.pattern;
  const rawSides = wallPatternRaw.sides as Partial<WallPatternSides> | undefined;
  const wallPatternConfig: WallPatternConfig = {
    enabled: wallPatternRaw.enabled ?? false,
    pattern:
      typeof rawPattern === 'string' && VALID_WALL_PATTERNS.has(rawPattern as WallPatternType)
        ? (rawPattern as WallPatternType)
        : 'honeycomb',
    scale:
      typeof rawScale === 'number' && Number.isFinite(rawScale)
        ? Math.min(1, Math.max(0, rawScale))
        : DEFAULT_PATTERN_SCALE,
    // Absent stays absent: a backfilled default would shift the fingerprint of
    // every design that never touched the strut control.
    ...(typeof rawWeb === 'number' && Number.isFinite(rawWeb)
      ? {
          webThickness: Math.min(
            PATTERN_WEB_THICKNESS_MAX,
            Math.max(PATTERN_WEB_THICKNESS_MIN, rawWeb)
          ),
        }
      : {}),
    dividers: wallPatternRaw.dividers === true,
    // Absent on every design saved, which patterned all four
    // walls — so a missing side reads as ON, not off.
    sides: {
      left: rawSides?.left !== false,
      right: rawSides?.right !== false,
      front: rawSides?.front !== false,
      back: rawSides?.back !== false,
    },
  };

  // Floor pattern — absent on every design saved before the feature.
  // Same coercion contract as the wall pattern: unknown members fall back to
  // the default and a crafted scale is clamped into [0, 1].
  const floorPatternConfig: FloorPatternConfig = (() => {
    const raw: Partial<FloorPatternConfig> = params.floorPattern ?? {};
    const rawScale = raw.scale;
    return {
      enabled: raw.enabled === true,
      pattern:
        raw.pattern !== undefined && VALID_FLOOR_PATTERNS.has(raw.pattern)
          ? raw.pattern
          : DEFAULT_FLOOR_PATTERN_CONFIG.pattern,
      scale:
        typeof rawScale === 'number' && Number.isFinite(rawScale)
          ? Math.min(1, Math.max(0, rawScale))
          : DEFAULT_PATTERN_SCALE,
    };
  })();

  // Migrate cutoutConfig and handle legacy per-cutout topOffset
  const rawCutoutConfig = (params.cutoutConfig as Partial<CutoutConfig> | undefined) ?? {};
  const rawFillReference = rawCutoutConfig.fillReference;
  const cutoutConfig: CutoutConfig = {
    ...DEFAULT_CUTOUT_CONFIG,
    ...rawCutoutConfig,
    // Coerce an unknown reference back to the default, the same way the handle
    // shape below does. The declared type is a claim about trusted data, so the
    // runtime check still matters: every load path (share, sync, localStorage)
    // lands here, and this is where a value the type no longer allows stops.
    fillReference:
      rawFillReference !== undefined && CUTOUT_FILL_REFERENCES.includes(rawFillReference)
        ? rawFillReference
        : DEFAULT_CUTOUT_CONFIG.fillReference,
    // The server bounds this on publish, but nothing bounds a design already
    // in localStorage or arriving over sync, and those never touch that path.
    // A string reaches the generator as `wallHeight - topOffset` = NaN, which
    // drops every cutout silently, and breaks the slider on the way. Clamped
    // only against zero and a sane ceiling: the wall height is not known here,
    // and the control and `cutoutFillHeightMm` both clamp against the real one.
    topOffset: clampNumber(
      rawCutoutConfig.topOffset,
      0,
      MAX_CUTOUT_TOP_OFFSET_MM,
      DEFAULT_CUTOUT_CONFIG.topOffset
    ),
  };

  // Migrate handle config (v2: ledges → holes)
  // Strip legacy ledge fields (depth, filletRadius) to prevent storage pollution
  const rawHandles = (params.handles ?? {}) as Record<string, unknown>;
  const { depth: _legacyDepth, filletRadius: _legacyFillet, ...cleanHandles } = rawHandles;
  const handlesConfig: HandleConfig = {
    ...DEFAULT_HANDLE_CONFIG,
    ...(cleanHandles as Partial<HandleConfig>),
    // Coerce removed/unknown shapes (e.g. the retired 'u-shape') back to the
    // default so old saves don't carry a value the type no longer allows.
    shape: VALID_HANDLE_SHAPES.includes(cleanHandles.shape as HandleCutoutShape)
      ? (cleanHandles.shape as HandleCutoutShape)
      : DEFAULT_HANDLE_CONFIG.shape,
    front: { ...DEFAULT_HANDLE_CONFIG.front, ...((rawHandles.front as object | undefined) ?? {}) },
    back: { ...DEFAULT_HANDLE_CONFIG.back, ...((rawHandles.back as object | undefined) ?? {}) },
    left: { ...DEFAULT_HANDLE_CONFIG.left, ...((rawHandles.left as object | undefined) ?? {}) },
    right: { ...DEFAULT_HANDLE_CONFIG.right, ...((rawHandles.right as object | undefined) ?? {}) },
  };

  // Remove legacy and already-handled fields from spread
  const {
    dividers: _legacyDividers,
    eco: _legacyEco,
    handles: _handlesHandled,
    slide: _slideHandled,
    ...rest
  } = params as Record<string, unknown>;

  // Designs predating the sliding tray have no `slide` at all, and one saved
  // mid-feature may be missing individual fields; both re-complete from the
  // default rather than reaching the generator half-formed.
  const slideConfig: SlideConfig = {
    ...DEFAULT_SLIDE_CONFIG,
    ...((params.slide as Partial<SlideConfig> | undefined) ?? {}),
    railMount: SLIDE_RAIL_MOUNTS.includes(
      (params.slide as Partial<SlideConfig> | undefined)?.railMount as SlideRailMount
    )
      ? ((params.slide as Partial<SlideConfig>).railMount as SlideRailMount)
      : DEFAULT_SLIDE_CONFIG.railMount,
  };

  // Wall top (height units × mm/unit, plus any exterior-wall collar), matching
  // the top-accent slider cap in the Colors panel. Used to clamp a persisted
  // band on load. `Number.isFinite` guards reject NaN from crafted/corrupt data
  // (a bare `typeof === 'number'` lets NaN through and would poison the clamp).
  const finiteNum = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const heightUnits = finiteNum(params.height, DEFAULT_BIN_PARAMS.height);
  const heightUnitMm = finiteNum(params.heightUnitMm, DEFAULT_BIN_PARAMS.heightUnitMm);
  // Use the SAME normalized collar the returned params carry (clamped to
  // [MIN, MAX]) so the accent cap can't exceed the bin's real post-migration
  // wall top when a persisted collar is out of range.
  const wallHeightMm = Math.max(
    1,
    heightUnits * heightUnitMm + migrateExtraWallHeightMm(params.extraWallHeightMm)
  );

  // A mesh cutout without its asset can't generate anything — drop orphans
  // (crafted/corrupt designs) instead of erroring downstream; symmetrically,
  // drop assets no cutout references so they can't ride along via `...rest`
  // and bloat the design forever.
  const migratedCutouts = shareGroupArrays(
    normalizeGroupChains(
      (params.cutouts ?? DEFAULT_BIN_PARAMS.cutouts).map((c) =>
        migrateCutout(c as Cutout & LegacyCutoutFields)
      )
    )
  ).filter(
    (c) =>
      c.shape !== 'mesh' || (c.meshId !== undefined && params.meshAssets?.[c.meshId] !== undefined)
  );
  // Hoisted out of the `lid` block below so the group-name sweep can see BOTH
  // cutout arrays — one name map serves the bin and its lid.
  const migratedLidCutouts = migrateLidCutouts(
    (params.lid as { cutouts?: unknown } | undefined)?.cutouts
  );
  const referencedMeshIds = new Set(
    migratedCutouts.filter((c) => c.shape === 'mesh').map((c) => c.meshId)
  );
  const migratedMeshAssets = params.meshAssets
    ? Object.fromEntries(
        Object.entries(params.meshAssets).filter(([id]) => referencedMeshIds.has(id))
      )
    : undefined;

  return {
    ...DEFAULT_BIN_PARAMS,
    ...rest,
    style,
    base: baseConfig,
    compartments: compartmentsConfig,
    scoop: scoopConfig,
    label: { ...DEFAULT_BIN_PARAMS.label, ...(params.label ?? {}) },
    walls: wallsConfig,
    slide: slideConfig,
    handles: handlesConfig,
    slotConfig,
    dividerPieces,
    inserts: params.inserts ?? DEFAULT_BIN_PARAMS.inserts,
    cutouts: migratedCutouts,
    ...(migratedMeshAssets && Object.keys(migratedMeshAssets).length > 0
      ? { meshAssets: migratedMeshAssets }
      : { meshAssets: undefined }),
    cutoutGroupNames: migrateCutoutGroupNames(
      params.cutoutGroupNames,
      referencedGroupIds(migratedCutouts, migratedLidCutouts ?? [])
    ),
    cutoutConfig,
    wallPattern: wallPatternConfig,
    floorPattern: floorPatternConfig,
    featureColors: migrateFeatureColors(params.featureColors, wallHeightMm),
    lid: (() => {
      // Strip locked-down legacy fields (`fit`, `wallThickness`,
      // `topThickness`) from persisted designs — they're hardcoded in
      // `lidConstants.ts` now and re-spreading them would put unknown
      // properties back onto the typed config.
      const raw = (params.lid as Record<string, unknown> | undefined) ?? {};
      const {
        fit: _legacyFit,
        wallThickness: _legacyWall,
        topThickness: _legacyTop,
        attachment: rawAttachment,
        clickRails: rawClickRails,
        clickRailCoverage: rawCoverage,
        extraHeightMm: rawExtraHeight,
        topThicknessMm: rawTopThickness,
        retentionMagnet: rawRetentionMagnet,
        tray: rawTray,
        grip: rawGrip,
        relieveInterior: rawRelieveInterior,
        slide: rawSlide,
        hinge: rawHinge,
        cutouts: _rawLidCutouts,
        ...stored
      } = raw;
      // Rails migrate first — `attachment` derives from them for legacy
      // designs that predate the mode field.
      const clickRails = migrateClickRails(rawClickRails);
      return {
        ...DEFAULT_LID_CONFIG,
        ...(stored as Partial<LidConfig>),
        // `clickRails` evolved from boolean → per-side object. Always
        // route through the migrator so the field is the right shape
        // regardless of how it was persisted.
        clickRails,
        clickRailCoverage: migrateClickRailCoverage(rawCoverage),
        // Retention mode. Legacy designs infer it from their rails.
        attachment: migrateAttachment(rawAttachment, clickRails),
        // Clamp the mm cavity boost so a corrupt design can't blow up the lid.
        extraHeightMm: migrateExtraHeightMm(rawExtraHeight),
        // Older designs have no floor-plate knob — they fall back to the
        // 0.8mm baseline and so regenerate byte-identically.
        topThicknessMm: clampNumber(
          rawTopThickness,
          LID_TOP_THICKNESS_MIN_MM,
          LID_TOP_THICKNESS_MAX_MM,
          DEFAULT_LID_CONFIG.topThicknessMm
        ),
        // Dedicated magnet + tray configs — clamped so a hand-edited share
        // can't drive runaway pocket/recess geometry.
        retentionMagnet: migrateRetentionMagnet(rawRetentionMagnet),
        tray: migrateTray(rawTray),
        grip: migrateGrip(rawGrip),
        // Absent means the design predates the interior relief, and it
        // must keep the geometry it was published with. Only an explicit
        // `true` opts in, which is what a design created after the flag stores.
        // NOT left to the `DEFAULT_LID_CONFIG` spread above: that defaults it
        // on, which is right for a new design and wrong for every old one.
        relieveInterior: rawRelieveInterior === true,
        slide: migrateSlide(rawSlide),
        hinge: migrateHinge(rawHinge),
        // Spread `undefined` deliberately: the key is present-but-undefined here,
        // which `stableStringify` and `JSON.stringify` both drop.
        cutouts: migratedLidCutouts,
      };
    })(),
    ...(params.splitConnectors !== undefined
      ? { splitConnectors: { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, ...params.splitConnectors } }
      : {}),
    textDefaults: {
      ...DEFAULT_TEXT_STYLE_DEFAULTS,
      ...((params as { textDefaults?: Partial<TextStyleDefaults> }).textDefaults ?? {}),
    },
    // `...rest` carried the raw value through; this overrides it with the
    // normalized form (or strips it entirely when empty/invalid).
    surfaceText: migrateSurfaceText(params.surfaceText),
    // Same contract as surfaceText: normalized or stripped, never raw.
    knifeRest: migrateKnifeRest(params.knifeRest),
    wallLabelSlots: migrateWallLabelSlots(params.wallLabelSlots),
    // Clamp the exterior-wall collar so a corrupt design can't drive a runaway
    // box/lip height. `...rest` carried the raw value through; this overrides it.
    extraWallHeightMm: migrateExtraWallHeightMm(
      (rest as Record<string, unknown>).extraWallHeightMm
    ),
  };
}

/**
 * Per-design geometry keys that are NOT carried into a user's custom
 * "default for new bins". These describe a *specific* bin, not a reusable
 * style, so they reset to the factory baseline on every new design.
 *
 * Implemented as a denylist (rather than an allowlist of style keys) so
 * that future style parameters added to `BinParams` automatically flow
 * into saved user defaults without anyone remembering to update a list.
 *
 * `migrateParams()` backfills each of these from `DEFAULT_BIN_PARAMS` when a
 * stored partial is loaded, so stripping them is a safe reset-to-factory.
 */
export const STYLE_DEFAULT_OMIT_KEYS = [
  'cellMask',
  'compartments',
  'cutouts',
  // Surface text is a per-design label ("Cables"), not a reusable style —
  // carrying it into "default for new bins" would stamp one design's label
  // onto every subsequent design.
  'surfaceText',
  // Mesh imprint assets are per-design geometry AND large (100KB+ compressed
  // STL data) — carrying them into "default for new bins" would bloat every
  // subsequent design.
  'meshAssets',
  // A handle rest belongs to one block's knives, not to a reusable style.
  'knifeRest',
  'inserts',
  'handles',
  'walls',
  'overhang',
  // Per-design UI bookkeeping, not a reusable style: a manual edge choice on
  // one design must not carry into every new design and mute mismatch warnings.
  'fractionalEdgeManualX',
  'fractionalEdgeManualY',
] as const satisfies readonly (keyof BinParams)[];

/**
 * Extract the style/feature preferences from a full set of bin params,
 * dropping per-design geometry (see `STYLE_DEFAULT_OMIT_KEYS`). The result
 * is a partial suitable for persisting as the user's default for new bins;
 * `migrateParams()` re-completes it on load.
 */
export function extractStyleDefaults(params: BinParams): Partial<BinParams> {
  const omit = new Set<string>(STYLE_DEFAULT_OMIT_KEYS);
  return Object.fromEntries(Object.entries(params).filter(([key]) => !omit.has(key)));
}
