/**
 * Baseplate defaults, screw/floor geometry constants, and the persisted
 * baseplate-params migration. Split from core/constants so edits here do not
 * invalidate every consumer of the general constants module.
 */

import type {
  StoredBaseplateParams,
  PaddingAnchor,
  StackPrintParams,
  SplitOverride,
  ScrewHoleParams,
  FractionalEdge,
} from './types';
import {
  mm,
  gridUnits,
  STACK_PRINT_MIN_GAP_MM,
  STACK_PRINT_MAX_GAP_MM,
  STACK_PRINT_DEFAULT_GAP_MM,
  STACK_PRINT_MIN_COPIES,
  STACK_PRINT_MAX_COPIES,
} from './types';
import { CONNECTOR_FIT_OFFSET_MIN, CONNECTOR_FIT_OFFSET_MAX } from '@/shared/constants/connectors';
import { CONSTRAINTS } from './constants';

/**
 * Smallest drawer-fit margin (mm) that over-tile fills with a clipped grid
 * pocket. Below this the pocket walls are too thin/short to print, so that side
 * stays solid padding. Single source for the worker geometry
 * (`MIN_PRINTABLE_TILE_MM`) and the baseplate UI's per-side tiling feedback.
 */
export const OVER_TILE_MIN_MARGIN_MM = 8;

/**
 * Smallest padding band (mm) that can detach into its own printable rail. Below
 * this the rail is too thin to print usefully, so that side stays integral.
 * Reuses the over-tile threshold so the two "too small" cutoffs stay consistent.
 */
export const MARGIN_MIN_DETACH_MM = OVER_TILE_MIN_MARGIN_MM;

/**
 * Solid-floor thickness bounds + default (mm) for the baseplate `solidFloor`
 * option. The floor is added *below* the 5mm socket, so the plate grows by this
 * much while the pocket depth (bin seating) is unchanged. 0.8mm is the common
 * Gridfinity structural minimum for a sealed base; the range lets users trade
 * material/weight up to a chunky weighted plate. Shared by the baseplate UI
 * (slider bounds) and the worker geometry (`baseplateFloorDepth`).
 */
export const SOLID_FLOOR_DEFAULT_MM = 0.8;
export const SOLID_FLOOR_MIN_MM = 0.4;
export const SOLID_FLOOR_MAX_MM = 5;

/**
 * Mount-down screw hole bounds + defaults (mm). The plate is fastened to a
 * drawer bottom or bench through these, so the shaft hole is a CLEARANCE hole,
 * not a pilot hole: a thread biting the plastic would hold the plate off the
 * surface instead of pulling it down. 3.4mm is M3 clearance.
 */
export const SCREW_HOLE_DEFAULT_DIAMETER_MM = 3.4;
export const SCREW_HOLE_MIN_DIAMETER_MM = 2;
export const SCREW_HOLE_MAX_DIAMETER_MM = 8;

/**
 * Head recess defaults (mm), from kennetek's `standard.scad` so plates match the
 * wider ecosystem: countersink widens the shaft by 2×2.3mm, counterbore is a
 * flat ø5.5 × 3mm pocket for a socket-head cap.
 */
export const SCREW_COUNTERSINK_DEFAULT_DIAMETER_MM = 8;
export const SCREW_COUNTERBORE_DEFAULT_DIAMETER_MM = 5.5;
export const SCREW_COUNTERBORE_DEFAULT_DEPTH_MM = 3;
export const SCREW_HEAD_MIN_DIAMETER_MM = 3;
export const SCREW_HEAD_MAX_DIAMETER_MM = 16;

/**
 * Ceiling on the counterbore pocket depth (mm). A floor-sited screw buys a pad
 * of `depth + SCREW_PAD_MIN_RETAIN_MM`, so this is what keeps a deep pocket from
 * doubling the plate's printed height.
 */
export const SCREW_COUNTERBORE_MAX_DEPTH_MM = 6;

/**
 * Included angle of the countersink cone. 90° is the near-universal flat-head
 * standard, and it makes the cone depth exactly half the radial widening (see
 * `screwHeadRecessDepth`).
 */
export const SCREW_COUNTERSINK_INCLUDED_ANGLE_DEG = 90;

/**
 * Plastic kept below a head recess when a screw falls back to the pocket floor
 * and has to carry its own pad. The pad is sized `recessDepth + this`, because a
 * 2.3mm countersink cannot be recessed into a 0.8mm floor: the head would stand
 * proud and lift any bin seated in that cell.
 */
export const SCREW_PAD_MIN_RETAIN_MM = 0.8;

/**
 * Screws placed per split piece, so no printed piece is left unfastened. Four
 * corners is the default and the useful floor; the max is the size of the anchor
 * list (four corners plus four edge midpoints), because anchors are never reused
 * and a higher count would otherwise stack holes on one spot.
 */
export const SCREWS_PER_PIECE_DEFAULT = 4;
export const SCREWS_PER_PIECE_MIN = 1;
export const SCREWS_PER_PIECE_MAX = 8;

/** Default baseplate parameters: no magnets, no padding */
export const DEFAULT_BASEPLATE_PARAMS: StoredBaseplateParams = {
  magnetHoles: false,
  magnetDiameter: mm(6.5),
  magnetDepth: mm(2),
  paddingLeft: mm(0),
  paddingRight: mm(0),
  paddingFront: mm(0),
  paddingBack: mm(0),
  lightweight: true,
  solidFloor: false,
  solidFloorThickness: mm(SOLID_FLOOR_DEFAULT_MM),
} as const;

/**
 * Migrate old baseplateParams to current shape.
 * Returns DEFAULT_BASEPLATE_PARAMS if the stored data lacks paddingLeft,
 * preserving magnet settings when possible.
 */
export function migrateBaseplateParams(stored: unknown): StoredBaseplateParams {
  if (!stored || typeof stored !== 'object') return DEFAULT_BASEPLATE_PARAMS;
  const obj = stored as Record<string, unknown>;
  // Current shape has paddingLeft — if missing, it's an old format
  if (typeof obj.paddingLeft !== 'number') {
    return {
      ...DEFAULT_BASEPLATE_PARAMS,
      magnetHoles: typeof obj.magnetHoles === 'boolean' ? obj.magnetHoles : false,
      magnetDiameter: mm(clampNumber(obj.magnetDiameter, 0.5, 20, 6.5)),
      magnetDepth: mm(clampNumber(obj.magnetDepth, 0.5, 10, 2)),
    };
  }
  // Validate and clamp all fields from persisted/imported data
  const stackPrint = migrateStackPrint(obj.stackPrint);
  const splitOverride = migrateSplitOverride(obj.splitOverride);
  const screwHoles = migrateScrewHoles(obj.screwHoles);
  const radii = obj.cornerRadii;
  const hasRadii =
    radii !== null &&
    typeof radii === 'object' &&
    typeof (radii as Record<string, unknown>).tl === 'number' &&
    typeof (radii as Record<string, unknown>).tr === 'number' &&
    typeof (radii as Record<string, unknown>).bl === 'number' &&
    typeof (radii as Record<string, unknown>).br === 'number';
  return {
    magnetHoles: typeof obj.magnetHoles === 'boolean' ? obj.magnetHoles : false,
    magnetDiameter: mm(clampNumber(obj.magnetDiameter, 0.5, 20, 6.5)),
    magnetDepth: mm(clampNumber(obj.magnetDepth, 0.5, 10, 2)),
    paddingLeft: mm(clampNumber(obj.paddingLeft, 0, 100, 0)),
    paddingRight: mm(clampNumber(obj.paddingRight, 0, 100, 0)),
    paddingFront: mm(clampNumber(obj.paddingFront, 0, 100, 0)),
    paddingBack: mm(clampNumber(obj.paddingBack, 0, 100, 0)),
    ...(isPaddingAnchor(obj.paddingAnchor) ? { paddingAnchor: obj.paddingAnchor } : {}),
    ...(typeof obj.overTile === 'boolean' ? { overTile: obj.overTile } : {}),
    ...(typeof obj.overTileHalfGrid === 'boolean'
      ? { overTileHalfGrid: obj.overTileHalfGrid }
      : {}),
    ...(typeof obj.overTileHalfGridSolidLeftover === 'boolean'
      ? { overTileHalfGridSolidLeftover: obj.overTileHalfGridSolidLeftover }
      : {}),
    ...(typeof obj.wholeCellsOnly === 'boolean' ? { wholeCellsOnly: obj.wholeCellsOnly } : {}),
    ...(typeof obj.connectorNubs === 'boolean' ? { connectorNubs: obj.connectorNubs } : {}),
    ...(typeof obj.invertDovetails === 'boolean' ? { invertDovetails: obj.invertDovetails } : {}),
    ...(typeof obj.preferIdenticalPieces === 'boolean'
      ? { preferIdenticalPieces: obj.preferIdenticalPieces }
      : {}),
    ...(obj.connectorStyle === 'dovetail' ||
    obj.connectorStyle === 'puzzle' ||
    obj.connectorStyle === 'dovetailKey' ||
    obj.connectorStyle === 'snapClip'
      ? { connectorStyle: obj.connectorStyle }
      : {}),
    ...(typeof obj.connectorSlotsAllEdges === 'boolean'
      ? { connectorSlotsAllEdges: obj.connectorSlotsAllEdges }
      : {}),
    ...(typeof obj.connectorFitOffset === 'number'
      ? {
          connectorFitOffset: clampNumber(
            obj.connectorFitOffset,
            CONNECTOR_FIT_OFFSET_MIN,
            CONNECTOR_FIT_OFFSET_MAX,
            0
          ),
        }
      : {}),
    ...(typeof obj.lightweight === 'boolean' ? { lightweight: obj.lightweight } : {}),
    ...(typeof obj.solidFloor === 'boolean' ? { solidFloor: obj.solidFloor } : {}),
    ...(typeof obj.solidFloorThickness === 'number'
      ? {
          solidFloorThickness: mm(
            clampNumber(
              obj.solidFloorThickness,
              SOLID_FLOOR_MIN_MM,
              SOLID_FLOOR_MAX_MM,
              SOLID_FLOOR_DEFAULT_MM
            )
          ),
        }
      : {}),
    ...(typeof obj.syncWithLayout === 'boolean' ? { syncWithLayout: obj.syncWithLayout } : {}),
    ...(typeof obj.baseplateWidth === 'number'
      ? {
          baseplateWidth: gridUnits(
            Math.min(CONSTRAINTS.GRID_MAX, Math.max(CONSTRAINTS.GRID_MIN, obj.baseplateWidth))
          ),
        }
      : {}),
    ...(typeof obj.baseplateDepth === 'number'
      ? {
          baseplateDepth: gridUnits(
            Math.min(CONSTRAINTS.GRID_MAX, Math.max(CONSTRAINTS.GRID_MIN, obj.baseplateDepth))
          ),
        }
      : {}),
    ...(typeof obj.cornerRadius === 'number'
      ? { cornerRadius: mm(clampNumber(obj.cornerRadius, 0, 200, 0)) }
      : {}),
    ...(hasRadii
      ? {
          cornerRadii: {
            tl: mm(clampNumber((radii as Record<string, unknown>).tl, 0, 200, 0)),
            tr: mm(clampNumber((radii as Record<string, unknown>).tr, 0, 200, 0)),
            bl: mm(clampNumber((radii as Record<string, unknown>).bl, 0, 200, 0)),
            br: mm(clampNumber((radii as Record<string, unknown>).br, 0, 200, 0)),
          },
        }
      : {}),
    ...(obj.detachMargins === true ? { detachMargins: true } : {}),
    // Only meaningful alongside detachMargins, but preserve the opt-in
    // independently so toggling detach off/on doesn't lose the connector intent.
    ...(obj.detachMarginConnector === true ? { detachMarginConnector: true } : {}),
    ...(stackPrint ? { stackPrint } : {}),
    ...(isFractionalEdge(obj.fractionalEdgeX) ? { fractionalEdgeX: obj.fractionalEdgeX } : {}),
    ...(isFractionalEdge(obj.fractionalEdgeY) ? { fractionalEdgeY: obj.fractionalEdgeY } : {}),
    ...(splitOverride ? { splitOverride } : {}),
    ...(screwHoles ? { screwHoles } : {}),
  };
}

function isFractionalEdge(value: unknown): value is FractionalEdge {
  return value === 'start' || value === 'end';
}

/**
 * Shape check only: whether the chunks still describe the current plate
 * (sum to its dims, cuts on cell boundaries) is `normalizeSplitOverride`'s
 * call at build time, which has the resolved dimensions this layer does not.
 */
function migrateSplitOverride(value: unknown): SplitOverride | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const o = value as Record<string, unknown>;
  const isChunkArray = (v: unknown): v is number[] =>
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((c) => typeof c === 'number' && Number.isFinite(c) && c > 0);
  if (!isChunkArray(o.cols) || !isChunkArray(o.rows)) return undefined;
  return { cols: o.cols.map(gridUnits), rows: o.rows.map(gridUnits) };
}

/** Validate + clamp persisted screw-hole params, or undefined if absent/invalid. */
function migrateScrewHoles(value: unknown): ScrewHoleParams | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const o = value as Record<string, unknown>;
  if (typeof o.enabled !== 'boolean') return undefined;
  if (o.headStyle !== 'countersink' && o.headStyle !== 'counterbore') return undefined;
  return {
    enabled: o.enabled,
    diameter: mm(
      clampNumber(
        o.diameter,
        SCREW_HOLE_MIN_DIAMETER_MM,
        SCREW_HOLE_MAX_DIAMETER_MM,
        SCREW_HOLE_DEFAULT_DIAMETER_MM
      )
    ),
    headStyle: o.headStyle,
    ...(typeof o.headDiameter === 'number' && Number.isFinite(o.headDiameter)
      ? {
          headDiameter: mm(
            clampNumber(
              o.headDiameter,
              SCREW_HEAD_MIN_DIAMETER_MM,
              SCREW_HEAD_MAX_DIAMETER_MM,
              SCREW_HEAD_MIN_DIAMETER_MM
            )
          ),
        }
      : {}),
    ...(typeof o.counterboreDepth === 'number' && Number.isFinite(o.counterboreDepth)
      ? {
          counterboreDepth: mm(
            clampNumber(
              o.counterboreDepth,
              0,
              SCREW_COUNTERBORE_MAX_DEPTH_MM,
              SCREW_COUNTERBORE_DEFAULT_DEPTH_MM
            )
          ),
        }
      : {}),
    ...(typeof o.screwsPerPiece === 'number' && Number.isFinite(o.screwsPerPiece)
      ? {
          screwsPerPiece: Math.round(
            clampNumber(
              o.screwsPerPiece,
              SCREWS_PER_PIECE_MIN,
              SCREWS_PER_PIECE_MAX,
              SCREWS_PER_PIECE_DEFAULT
            )
          ),
        }
      : {}),
  };
}

/** Validate + clamp a persisted stackPrint config, or undefined if absent/invalid. */
function migrateStackPrint(value: unknown): StackPrintParams | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const o = value as Record<string, unknown>;
  if (typeof o.enabled !== 'boolean') return undefined;
  return {
    enabled: o.enabled,
    gapMm: mm(
      clampNumber(
        o.gapMm,
        STACK_PRINT_MIN_GAP_MM,
        STACK_PRINT_MAX_GAP_MM,
        STACK_PRINT_DEFAULT_GAP_MM
      )
    ),
    ...(typeof o.copies === 'number' && Number.isFinite(o.copies)
      ? {
          copies: Math.round(
            clampNumber(
              o.copies,
              STACK_PRINT_MIN_COPIES,
              STACK_PRINT_MAX_COPIES,
              STACK_PRINT_MIN_COPIES
            )
          ),
        }
      : {}),
  };
}

/** Clamp a possibly-invalid value to [min, max], falling back to defaultVal if not a number. */
function clampNumber(value: unknown, min: number, max: number, defaultVal: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return defaultVal;
  return Math.min(max, Math.max(min, value));
}

const PADDING_ANCHOR_VALUES = new Set<string>([
  'tl',
  'tc',
  'tr',
  'ml',
  'c',
  'mr',
  'bl',
  'bc',
  'br',
  'custom',
]);

function isPaddingAnchor(value: unknown): value is PaddingAnchor {
  return typeof value === 'string' && PADDING_ANCHOR_VALUES.has(value);
}
