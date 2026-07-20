/**
 * Imported-mesh bin — descriptor (schema/defaults/migration/labels), the
 * worker- and UI-safe half of this item kind. No React, no OCCT.
 *
 * Designs of this kind are only ever created by the STL import flow, so
 * `defaults()` returns a documented degenerate placeholder: it exists to keep
 * the descriptor contract total (and schema-valid), not to seed a usable
 * design — `newDesign('importedMesh')` is never offered in the UI.
 */
import { z } from 'zod';
import { MAX_MESH_ASSET_TRIANGLES, MAX_MESH_OUTLINE_POINTS } from '@/shared/generation/meshAsset';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { ItemTypeDescriptor } from '@/shared/items/registry';
import type { ImportedMeshStructure, ItemEnvelope } from '@/shared/types/item';

export const MAX_IMPORTED_MESH_HEIGHT_UNITS = 20;

/** Sanity ceiling for the base64 payload of one asset (mirrors server cap). */
export const MAX_IMPORTED_MESH_DATA_LENGTH = 900_000;

const MAX_MESH_NAME_LENGTH = 64;
const MAX_MESH_SIZE_MM = 1000;

const outlinePointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const sizeMmSchema = z.object({
  x: z.number().positive().max(MAX_MESH_SIZE_MM),
  y: z.number().positive().max(MAX_MESH_SIZE_MM),
  z: z.number().positive().max(MAX_MESH_SIZE_MM),
});

const meshAssetSchema: z.ZodType<MeshAsset> = z.object({
  name: z.string().min(1).max(MAX_MESH_NAME_LENGTH),
  data: z.string().min(1).max(MAX_IMPORTED_MESH_DATA_LENGTH),
  triangleCount: z.number().int().min(1).max(MAX_MESH_ASSET_TRIANGLES),
  sizeMm: sizeMmSchema,
  outlines: z
    .array(z.array(outlinePointSchema))
    .refine((rings) => rings.reduce((n, ring) => n + ring.length, 0) <= MAX_MESH_OUTLINE_POINTS, {
      message: 'outline point budget exceeded',
    }),
});

export const importedMeshSchema: z.ZodType<ImportedMeshStructure> = z.object({
  kind: z.literal('importedMesh'),
  heightUnits: z.number().int().min(1).max(MAX_IMPORTED_MESH_HEIGHT_UNITS),
  asset: meshAssetSchema,
  volumeMm3: z.number().positive().optional(),
  sourceFileName: z.string().max(255).optional(),
});

/**
 * Schema-valid degenerate placeholder (a single 1mm triangle payload). Never
 * reachable through the UI; only returned when persisted data is unreadable,
 * in which case the preview renders an (intentionally) obviously-broken sliver
 * rather than crashing the designer.
 */
const PLACEHOLDER_STRUCTURE: ImportedMeshStructure = {
  kind: 'importedMesh',
  heightUnits: 1,
  asset: {
    name: 'invalid',
    // Not a decodable GMA1 payload on purpose — decodeMeshData rejects it
    // gracefully and the preview stays empty.
    data: 'invalid',
    triangleCount: 1,
    sizeMm: { x: 1, y: 1, z: 1 },
    outlines: [],
  },
};

function migrateImportedMesh(raw: unknown): ImportedMeshStructure {
  const merged = {
    ...(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}),
    kind: 'importedMesh' as const,
  };
  const parsed = importedMeshSchema.safeParse(merged);
  return parsed.success ? parsed.data : PLACEHOLDER_STRUCTURE;
}

function sanitizeFileStem(name: string): string {
  const stem = name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return stem.slice(0, 48);
}

export const importedMeshDescriptor: ItemTypeDescriptor<ImportedMeshStructure> = {
  kind: 'importedMesh',
  schema: importedMeshSchema,
  defaults: () => ({
    ...PLACEHOLDER_STRUCTURE,
    asset: { ...PLACEHOLDER_STRUCTURE.asset, sizeMm: { ...PLACEHOLDER_STRUCTURE.asset.sizeMm } },
  }),
  migrate: (raw: unknown, _envelope: ItemEnvelope) => migrateImportedMesh(raw),
  labelKey: 'binDesigner.itemKind.importedMesh',
  descriptionKey: 'binDesigner.itemKind.importedMesh.description',
  exportFileName: (envelope, structure) =>
    sanitizeFileStem(structure.asset.name) || `imported_bin_${envelope.width}x${envelope.depth}`,
};
