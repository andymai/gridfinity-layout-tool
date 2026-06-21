/**
 * Pure helpers for vertical stack-printing of baseplates: plan physical stacks
 * from piece groups, and translate/flip/replicate mesh buffers + interface sheets.
 */

import type { StackPrintParams } from '@/core/types';
import { STACK_PRINT_MAX_STACK_HEIGHT } from '@/core/types';
import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplateTiling } from '../types/tiling';
import { groupPiecesByFingerprint } from './pieceFingerprint';

/** Non-null mesh buffers (xyz-interleaved positions/normals, line-pair edges). */
export interface StackMeshArrays {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
}

/** One unique-piece group needing `quantity` copies for a single complete set. */
export interface StackGroup {
  readonly label: string;
  readonly quantity: number;
}

/** One physical print job: a single piece repeated `copies` times in a tower. */
export interface PhysicalStack {
  readonly label: string;
  readonly copies: number;
}

/**
 * Plan the physical stacks for a drawer. Each group needs `quantity` copies; a
 * group taller than `maxStackHeight` is split across several stacks (e.g. 18
 * copies, cap 8 -> 8 + 8 + 2). Groups/quantities at or below zero are skipped.
 * Returns one entry per physical tower to print.
 */
export function planPhysicalStacks(
  groups: readonly StackGroup[],
  maxStackHeight: number = STACK_PRINT_MAX_STACK_HEIGHT
): PhysicalStack[] {
  const cap = Number.isFinite(maxStackHeight) ? Math.max(1, Math.floor(maxStackHeight)) : 1;
  const stacks: PhysicalStack[] = [];

  for (const group of groups) {
    let remaining = Math.max(0, Math.floor(group.quantity));
    while (remaining > 0) {
      const copies = Math.min(cap, remaining);
      stacks.push({ label: group.label, copies });
      remaining -= copies;
    }
  }

  return stacks;
}

/**
 * How many flipped tiles fit in one stack on a printer `maxZmm` tall. A stack of
 * n tiles is `n*tileHeight + (n-1)*gap` tall; returns the largest n that fits,
 * clamped to ≥1 (one tile always fits — it already fits the bed footprint).
 */
export function stackHeightCap(maxZmm: number, tileHeightMm: number, gapMm: number): number {
  const gap = Math.max(0, gapMm);
  const stride = tileHeightMm + gap;
  if (!Number.isFinite(stride) || stride <= 0) return 1;
  return Math.max(1, Math.floor((maxZmm + gap) / stride));
}

/**
 * Whether a stack-print configuration actually yields stackable towers, and if
 * not, why — so the UI can explain it instead of silently producing single-plate
 * "towers". `cap` is the per-tower plate limit from {@link stackHeightCap}.
 */
export type StackPrintStatus =
  /** Stacking combines ≥2 plates into at least one tower. */
  | { readonly kind: 'ok' }
  /** A single plate is taller than the printer's build height — unprintable. */
  | { readonly kind: 'plateTooTall' }
  /** No repeated plate to stack (single unsplit plate, or an all-unique split). */
  | { readonly kind: 'singlePlate' }
  /** Build height (at this gap) fits only one plate per tower. */
  | { readonly kind: 'buildHeightCapped' };

/**
 * Classify a stack-print job. `plateTooTall` wins first (a plate that overflows
 * the build height can't print at all); then `singlePlate` when no group holds
 * two identical plates to combine; then `buildHeightCapped` when the height only
 * fits one plate per tower. Otherwise stacking produces a real tower.
 */
export function evaluateStackPrint(
  groups: readonly StackGroup[],
  cap: number,
  plateHeightMm: number,
  maxPrintHeightMm: number
): StackPrintStatus {
  if (
    Number.isFinite(plateHeightMm) &&
    Number.isFinite(maxPrintHeightMm) &&
    plateHeightMm > maxPrintHeightMm
  ) {
    return { kind: 'plateTooTall' };
  }
  const maxQuantity = groups.reduce((m, g) => Math.max(m, Math.floor(g.quantity)), 0);
  if (maxQuantity <= 1) return { kind: 'singlePlate' };
  const effectiveCap = Number.isFinite(cap) ? Math.max(1, Math.floor(cap)) : 1;
  if (effectiveCap <= 1) return { kind: 'buildHeightCapped' };
  return { kind: 'ok' };
}

/**
 * Derive the identical-piece groups a drawer needs. For a single (unsplit)
 * plate that's one group of quantity 1; for a split plate each fingerprint
 * group contributes its piece count, labelled by its first piece (e.g. "A1").
 *
 * `copies` duplicates the whole layout: every group's quantity is multiplied by
 * it, so a single-plate layout with copies=3 becomes one group of quantity 3.
 */
export function stackGroupsFromTiling(
  tiling: BaseplateTiling | null,
  params: BaseplateParams,
  copies = 1
): StackGroup[] {
  const n = Math.max(1, Math.floor(copies));
  if (!tiling || !tiling.isSplit) return [{ label: 'plate', quantity: n }];
  const groups = groupPiecesByFingerprint(tiling.pieces, params);
  const result: StackGroup[] = [];
  for (const group of groups.values()) {
    const label = tiling.pieces[group.indices[0]]?.label ?? 'piece';
    result.push({ label, quantity: group.indices.length * n });
  }
  return result;
}

/**
 * Z stride (mm) between successive copies in a stack: plate height plus the air
 * gap that lets the printed tower snap apart.
 */
export function stackStrideMm(plateHeightMm: number, stack: StackPrintParams): number {
  return plateHeightMm + Math.max(0, stack.gapMm);
}

/**
 * Connector-free body-centre Y (mm) of a baseplate mesh in its own vertex frame.
 * The generator draws the slab centred at the origin then shifts it only by
 * `(paddingBack − paddingFront) / 2` — connector tongues, overTile, and
 * fractional edges never move the body centre — so this tracks the body, not the
 * bounding box (which a protruding tongue skews). Used to re-seat a flipped plate
 * onto the upright one below it without dragging the body off-axis.
 */
export function bodyCenterYMm(paddingFrontMm: number, paddingBackMm: number): number {
  return (paddingBackMm - paddingFrontMm) / 2;
}

/**
 * Build the meshes for one printed tower of `copies` plates. The bottom plate
 * stays upright (best bed adhesion, no overhang); every plate above it is
 * flipped upside down — community practice that minimizes overhangs while the
 * air gap lets the tower snap apart (see the baseplate README). All copies share
 * the same body footprint and the bottom sits at Z=0.
 *
 * `bodyCenterY` is the connector-free body centre of the plate (see
 * {@link bodyCenterYMm}). `flipMeshUpsideDown` negates Y about 0, landing a body
 * centred at `c` at `−c`; translating by `2c` seats the flipped body back onto
 * the upright one. The protruding dovetail/puzzle tongue then mirrors to the
 * opposite edge instead of dragging the body off-axis — the previous full-bbox
 * re-centring offset every plate by the tongue protrusion (~1.5mm), so the socket
 * grids never lined up and the tongue overhung the plate below.
 */
export function buildTowerLayers(
  base: StackMeshArrays,
  copies: number,
  strideMm: number,
  bodyCenterY = 0
): StackMeshArrays[] {
  const n = Math.max(1, Math.floor(copies));
  const b = meshBounds(base.vertices);
  const midZ = (b.minZ + b.maxZ) / 2;
  // Upright, floored to Z=0.
  const upright = translateMesh(base, 0, 0, -b.minZ);
  // Flipped about its own mid-plane, re-seated on the upright body, floored to Z=0.
  const flipped = translateMesh(flipMeshUpsideDown(base, midZ), 0, 2 * bodyCenterY, -b.minZ);
  const layers: StackMeshArrays[] = [];
  for (let i = 0; i < n; i++) {
    const src = i === 0 ? upright : flipped;
    layers.push(i === 0 ? src : translateMesh(src, 0, 0, i * strideMm));
  }
  return layers;
}

/** Translate a copy of the mesh buffers by (dx, dy, dz) (positions + edges). */
export function translateMesh(
  mesh: StackMeshArrays,
  dxMm: number,
  dyMm: number,
  dzMm: number
): StackMeshArrays {
  const vertices = new Float32Array(mesh.vertices);
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] += dxMm;
    vertices[i + 1] += dyMm;
    vertices[i + 2] += dzMm;
  }
  const edgeVertices = new Float32Array(mesh.edgeVertices);
  for (let i = 0; i < edgeVertices.length; i += 3) {
    edgeVertices[i] += dxMm;
    edgeVertices[i + 1] += dyMm;
    edgeVertices[i + 2] += dzMm;
  }
  return {
    vertices,
    normals: new Float32Array(mesh.normals),
    indices: new Uint32Array(mesh.indices),
    edgeVertices,
  };
}

/**
 * Flip the mesh upside down for printing — a 180° rotation about the X axis
 * through `pivotZMm` mapping (x,y,z) -> (x, 2*pivotZ - z) and negating the Y
 * component. This is a proper rotation (det = +1), so triangle winding and
 * normal orientation stay consistent — no index reversal needed. Shared by
 * export and the preview, which renders the printed (upside-down) orientation.
 */
export function flipMeshUpsideDown(mesh: StackMeshArrays, pivotZMm: number): StackMeshArrays {
  const vertices = new Float32Array(mesh.vertices);
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 1] = -vertices[i + 1];
    vertices[i + 2] = 2 * pivotZMm - vertices[i + 2];
  }
  const normals = new Float32Array(mesh.normals);
  for (let i = 0; i < normals.length; i += 3) {
    normals[i + 1] = -normals[i + 1];
    normals[i + 2] = -normals[i + 2];
  }
  const edgeVertices = new Float32Array(mesh.edgeVertices);
  for (let i = 0; i < edgeVertices.length; i += 3) {
    edgeVertices[i + 1] = -edgeVertices[i + 1];
    edgeVertices[i + 2] = 2 * pivotZMm - edgeVertices[i + 2];
  }
  return { vertices, normals, indices: new Uint32Array(mesh.indices), edgeVertices };
}

/** Concatenate several meshes into one buffer set, re-basing indices per mesh. */
export function concatMeshes(meshes: readonly StackMeshArrays[]): StackMeshArrays {
  let vLen = 0;
  let iLen = 0;
  let eLen = 0;
  for (const m of meshes) {
    vLen += m.vertices.length;
    iLen += m.indices.length;
    eLen += m.edgeVertices.length;
  }
  const vertices = new Float32Array(vLen);
  const normals = new Float32Array(vLen);
  const indices = new Uint32Array(iLen);
  const edgeVertices = new Float32Array(eLen);

  let vOff = 0;
  let iOff = 0;
  let eOff = 0;
  for (const m of meshes) {
    vertices.set(m.vertices, vOff);
    normals.set(m.normals, vOff);
    const baseVertex = vOff / 3;
    for (let k = 0; k < m.indices.length; k++) indices[iOff + k] = m.indices[k] + baseVertex;
    edgeVertices.set(m.edgeVertices, eOff);
    vOff += m.vertices.length;
    iOff += m.indices.length;
    eOff += m.edgeVertices.length;
  }

  return { vertices, normals, indices, edgeVertices };
}

/** Axis-aligned XY bounds + Z span of a mesh, from its vertex buffer. */
export function meshBounds(vertices: Float32Array): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}
