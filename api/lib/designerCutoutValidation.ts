/** Cutout validation for shared bin designs: cutout config, shapes and their labels, group names, mesh assets. */

import { isNumber, inRange, isString, isObject } from './validationUtils.js';
import {
  CONSTRAINTS,
  VALID_LABEL_PLATE_ICONS,
  VALID_LABEL_PLATE_WIDTHS,
} from './designerValidationConstants.js';
import { HEX_COLOR_REGEX } from './designerColorValidation.js';
import { validateTextStyleOverride, LABEL_TEXT_MAX_LENGTH } from './designerTextValidation.js';

const VALID_CUTOUT_COLOR_SCOPES = ['floor', 'floorAndWalls'] as const;

export const VALID_CUTOUT_FILL_REFERENCES = ['rim', 'floor'] as const;

/**
 * Cross-boundary contract: MUST match `CUTOUT_LABEL_MODES` in
 * `src/features/bin-designer/types/cutout.ts`.
 */
export const VALID_CUTOUT_LABEL_MODES = ['engrave', 'socket'] as const;

/**
 * Global fill level for a cutout bin.
 *
 * `topOffset` reaches the generator as `wallHeight - topOffset`, so a
 * non-finite value propagates a NaN through every cutout's placement, and an
 * unbounded one is a cheap way to make a published design generate nothing.
 * `fillReference` only says which end the client re-anchors against, but it is
 * an enum on a public payload and cheaper to bound here than to reason about.
 */
export function validateCutoutConfig(value: unknown): string | null {
  if (!isObject(value)) return 'cutoutConfig must be an object';
  if (value.topOffset !== undefined) {
    if (!isNumber(value.topOffset) || !inRange(value.topOffset, 0, CONSTRAINTS.MAX_TOP_OFFSET_MM)) {
      return `cutoutConfig.topOffset must be between 0 and ${CONSTRAINTS.MAX_TOP_OFFSET_MM}`;
    }
  }
  if (
    value.fillReference !== undefined &&
    !VALID_CUTOUT_FILL_REFERENCES.includes(
      value.fillReference as (typeof VALID_CUTOUT_FILL_REFERENCES)[number]
    )
  ) {
    return `cutoutConfig.fillReference must be one of: ${VALID_CUTOUT_FILL_REFERENCES.join(', ')}`;
  }
  return null;
}

/**
 * Cutouts are otherwise passed through untyped (their geometry is regenerated
 * client-side), but the shadow-board color fields flow into exported 3MF
 * material colors, so an untrusted `color` / `colorScope` must be rejected here.
 */
export function validateCutouts(value: unknown): string | null {
  if (!Array.isArray(value)) return 'cutouts must be an array';
  for (let i = 0; i < value.length; i++) {
    const c: unknown = value[i];
    if (!isObject(c)) return `cutouts[${i}] must be an object`;
    // Hex-only (no legacy slot IDs): this is a new field with no migration path,
    // and the color flows straight into 3MF material colors.
    if (c.color !== undefined && !(typeof c.color === 'string' && HEX_COLOR_REGEX.test(c.color))) {
      return `cutouts[${i}].color must be a hex color`;
    }
    if (
      c.colorScope !== undefined &&
      !VALID_CUTOUT_COLOR_SCOPES.includes(
        c.colorScope as (typeof VALID_CUTOUT_COLOR_SCOPES)[number]
      )
    ) {
      return `cutouts[${i}].colorScope must be one of: ${VALID_CUTOUT_COLOR_SCOPES.join(', ')}`;
    }
    if (c.textStyle !== undefined) {
      const styleErr = validateTextStyleOverride(c.textStyle, `cutouts[${i}].textStyle`);
      if (styleErr) return styleErr;
    }
    // Lean feeds tan() in the generator's tool-extension math, so a NaN or an
    // absurd angle must stop here (same reasoning as cutoutConfig.topOffset).
    if (
      c.leanDeg !== undefined &&
      !(
        typeof c.leanDeg === 'number' &&
        Number.isFinite(c.leanDeg) &&
        Math.abs(c.leanDeg) <= CONSTRAINTS.MAX_CUTOUT_LEAN_DEG
      )
    ) {
      return `cutouts[${i}].leanDeg must be a number within ±${CONSTRAINTS.MAX_CUTOUT_LEAN_DEG}`;
    }
    // Socket fields drive geometry the client regenerates, but `labelIcon`
    // also selects a silhouette by name, so it is checked against the same
    // allowlist the compartment icons use rather than trusted as a string.
    if (
      c.labelMode !== undefined &&
      !VALID_CUTOUT_LABEL_MODES.includes(c.labelMode as (typeof VALID_CUTOUT_LABEL_MODES)[number])
    ) {
      return `cutouts[${i}].labelMode must be one of: ${VALID_CUTOUT_LABEL_MODES.join(', ')}`;
    }
    if (
      c.labelPlateWidthU !== undefined &&
      !VALID_LABEL_PLATE_WIDTHS.includes(c.labelPlateWidthU as number)
    ) {
      return `cutouts[${i}].labelPlateWidthU must be one of: ${VALID_LABEL_PLATE_WIDTHS.join(', ')}`;
    }
    if (c.labelIcon !== undefined && !VALID_LABEL_PLATE_ICONS.includes(c.labelIcon as string)) {
      return `cutouts[${i}].labelIcon is not a known plate icon`;
    }
    // Group ancestry. Entries are ids the client mints, so they are checked for
    // shape and count only; the client reconciles members that disagree and
    // strips a boolean group used as a container at load. An unbounded array
    // would still ride into storage, which is what this bounds.
    if (c.parentGroups !== undefined) {
      if (!Array.isArray(c.parentGroups)) return `cutouts[${i}].parentGroups must be an array`;
      if (c.parentGroups.length > CONSTRAINTS.MAX_PARENT_GROUPS) {
        return `cutouts[${i}].parentGroups must have at most ${CONSTRAINTS.MAX_PARENT_GROUPS} entries`;
      }
      for (let k = 0; k < c.parentGroups.length; k++) {
        const entry = (c.parentGroups as unknown[])[k];
        if (!isString(entry) || entry.length === 0 || entry.length > 64) {
          return `cutouts[${i}].parentGroups[${k}] must be a non-empty string (max 64 chars)`;
        }
      }
    }
    // Per-copy repeat labels. Every entry is engraved text, so this is bounded
    // the way `label.rowTexts` is: a repeat cannot exceed MAX_ARRAY_INSTANCES
    // copies, and each caption is one line of the same length the editor caps.
    const array = c.array;
    if (isObject(array) && array.labels !== undefined) {
      if (!Array.isArray(array.labels)) {
        return `cutouts[${i}].array.labels must be an array`;
      }
      if (array.labels.length > CONSTRAINTS.MAX_ARRAY_INSTANCES) {
        return `cutouts[${i}].array.labels length must not exceed ${CONSTRAINTS.MAX_ARRAY_INSTANCES}`;
      }
      for (let k = 0; k < array.labels.length; k++) {
        const entry = array.labels[k] as unknown;
        if (!isString(entry)) {
          return `cutouts[${i}].array.labels[${k}] must be a string`;
        }
        if (entry.length > LABEL_TEXT_MAX_LENGTH) {
          return `cutouts[${i}].array.labels[${k}] must not exceed ${LABEL_TEXT_MAX_LENGTH} characters`;
        }
      }
    }
  }
  return null;
}

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

// eslint-disable-next-line no-control-regex -- reject control chars in user-supplied asset names/ids
const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f]/;

const ALLOWED_MESH_ASSET_KEYS = new Set(['name', 'data', 'triangleCount', 'sizeMm', 'outlines']);

/**
 * Display names for cutout groups. Keyed by group id, so both halves are
 * user-reachable strings and both are bounded; the client GCs entries whose
 * group is gone, but a crafted payload can carry any keys it likes.
 */
export function validateCutoutGroupNames(value: unknown): string | null {
  if (value === undefined) return null;
  if (!isObject(value)) return 'cutoutGroupNames must be an object';
  const entries = Object.entries(value);
  if (entries.length > CONSTRAINTS.MAX_CUTOUT_GROUP_NAMES) {
    return `cutoutGroupNames must have at most ${CONSTRAINTS.MAX_CUTOUT_GROUP_NAMES} entries`;
  }
  for (const [id, name] of entries) {
    if (id.length === 0 || id.length > 64 || CONTROL_CHARS_REGEX.test(id)) {
      return 'cutoutGroupNames keys must be clean strings (max 64 chars)';
    }
    if (!isString(name) || name.length > CONSTRAINTS.MAX_GROUP_NAME_LENGTH) {
      return `cutoutGroupNames.${id} must be a string (max ${CONSTRAINTS.MAX_GROUP_NAME_LENGTH} chars)`;
    }
    if (CONTROL_CHARS_REGEX.test(name)) {
      return `cutoutGroupNames.${id} must not contain control characters`;
    }
  }
  return null;
}

/**
 * Validate the mesh imprint asset map (STL imports). The mesh geometry itself
 * is regenerated client-side from the compressed data, but a crafted blob
 * could smuggle megabytes of junk or orphan references, so structure, caps,
 * and cutout cross-references are all enforced here.
 */
export function validateMeshAssets(value: unknown, cutouts: unknown): string | null {
  const meshCutoutIds: { index: number; meshId: unknown }[] = [];
  if (Array.isArray(cutouts)) {
    for (let i = 0; i < cutouts.length; i++) {
      const c: unknown = cutouts[i];
      if (isObject(c) && c.shape === 'mesh') meshCutoutIds.push({ index: i, meshId: c.meshId });
    }
  }

  if (value === undefined) {
    return meshCutoutIds.length > 0
      ? `cutouts[${meshCutoutIds[0].index}] has shape 'mesh' but meshAssets is missing`
      : null;
  }
  if (!isObject(value)) return 'meshAssets must be an object';

  const entries = Object.entries(value);
  if (entries.length > CONSTRAINTS.MAX_MESH_ASSETS) {
    return `max ${CONSTRAINTS.MAX_MESH_ASSETS} mesh assets`;
  }
  for (const [id, assetRaw] of entries) {
    if (id.length === 0 || id.length > 64 || CONTROL_CHARS_REGEX.test(id)) {
      return 'meshAssets keys must be non-empty strings (max 64 chars)';
    }
    if (!isObject(assetRaw)) return `meshAssets.${id} must be an object`;
    for (const key of Object.keys(assetRaw)) {
      if (!ALLOWED_MESH_ASSET_KEYS.has(key)) return `meshAssets.${id} has unknown key: ${key}`;
    }
    const a = assetRaw;
    if (
      !isString(a.name) ||
      a.name.length === 0 ||
      a.name.length > CONSTRAINTS.MAX_MESH_NAME_LENGTH ||
      CONTROL_CHARS_REGEX.test(a.name)
    ) {
      return `meshAssets.${id}.name must be a clean string (max ${CONSTRAINTS.MAX_MESH_NAME_LENGTH} chars)`;
    }
    if (
      !isString(a.data) ||
      a.data.length === 0 ||
      a.data.length > CONSTRAINTS.MAX_MESH_DATA_LENGTH ||
      !BASE64_REGEX.test(a.data)
    ) {
      return `meshAssets.${id}.data must be base64 (max ${CONSTRAINTS.MAX_MESH_DATA_LENGTH} chars)`;
    }
    if (
      !isNumber(a.triangleCount) ||
      !Number.isInteger(a.triangleCount) ||
      !inRange(a.triangleCount, 1, CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES)
    ) {
      return `meshAssets.${id}.triangleCount must be an integer in [1, ${CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES}]`;
    }
    if (!isObject(a.sizeMm)) return `meshAssets.${id}.sizeMm must be an object`;
    for (const axis of ['x', 'y', 'z'] as const) {
      const v = a.sizeMm[axis];
      if (!isNumber(v) || v <= 0 || v > CONSTRAINTS.MAX_MESH_SIZE_MM) {
        return `meshAssets.${id}.sizeMm.${axis} must be in (0, ${CONSTRAINTS.MAX_MESH_SIZE_MM}]`;
      }
    }
    if (!Array.isArray(a.outlines) || a.outlines.length === 0) {
      return `meshAssets.${id}.outlines must be a non-empty array`;
    }
    let totalPoints = 0;
    for (const ring of a.outlines) {
      if (!Array.isArray(ring) || ring.length < 3) {
        return `meshAssets.${id}.outlines rings need at least 3 points`;
      }
      totalPoints += ring.length;
      for (const point of ring) {
        if (
          !isObject(point) ||
          !isNumber(point.x) ||
          !isNumber(point.y) ||
          Math.abs(point.x) > CONSTRAINTS.MAX_MESH_SIZE_MM ||
          Math.abs(point.y) > CONSTRAINTS.MAX_MESH_SIZE_MM
        ) {
          return `meshAssets.${id}.outlines points must be finite {x, y} within ±${CONSTRAINTS.MAX_MESH_SIZE_MM}mm`;
        }
      }
    }
    if (totalPoints > CONSTRAINTS.MAX_MESH_OUTLINE_POINTS) {
      return `meshAssets.${id}.outlines exceed ${CONSTRAINTS.MAX_MESH_OUTLINE_POINTS} total points`;
    }
  }

  for (const { index, meshId } of meshCutoutIds) {
    if (!isString(meshId) || !(meshId in value)) {
      return `cutouts[${index}].meshId must reference an entry in meshAssets`;
    }
  }

  // Reverse check: every stored asset must be referenced by a mesh cutout.
  // The client GCs assets when their last reference is deleted, so a legit
  // payload never carries orphans — but a crafted one could use them to claim
  // the raised mesh payload cap while shipping no mesh functionality at all.
  const referencedIds = new Set(meshCutoutIds.map((c) => c.meshId));
  for (const [id] of entries) {
    if (!referencedIds.has(id)) {
      return `meshAssets.${id} is not referenced by any mesh cutout`;
    }
  }
  return null;
}
