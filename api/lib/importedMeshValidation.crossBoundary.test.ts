/**
 * Cross-boundary tests for the imported-mesh mirror.
 *
 * `api/lib/importedMeshValidation.ts` restates `importedMeshSchema` and the
 * item envelope by hand, because api/ cannot import from src/. A field the
 * client writes that the server does not know makes an honest design 400 on
 * every push; a bound only one side moves makes the server store a design the
 * client turns into a placeholder. Fixtures run through both sides and only the
 * verdicts are compared, with bounds read off the client.
 *
 * The server is deliberately stricter in places the schema leaves open (an
 * inline asset with no outline ring, unknown keys, outline points past the
 * size bound), so those cases are pinned in the server's own tests, not here.
 */
import { describe, expect, it } from 'vitest';

import { unwrap } from '../../src/core/result/index.js';
import { DEFAULT_BIN_PARAMS } from '../../src/features/bin-designer/constants/defaults.js';
import { DESIGNER_CONSTRAINTS } from '../../src/features/bin-designer/constants/gridfinity.js';
import { MAX_MESH_ASSET_TRIANGLES, encodeMeshData } from '../../src/shared/generation/meshAsset.js';
import type { MeshAsset } from '../../src/shared/generation/meshAsset.js';
import { meshAssetFile } from '../../src/shared/generation/meshRefs.js';
import { createDefaultEnvelope } from '../../src/shared/items/defaultEnvelope.js';
import {
  MAX_IMPORTED_MESH_DATA_LENGTH,
  MAX_IMPORTED_MESH_HEIGHT_UNITS,
  importedMeshSchema,
} from '../../src/shared/items/importedMesh/descriptor.js';
import type {
  AttachmentConfig,
  ImportedMeshStructure,
  ItemEnvelope,
} from '../../src/shared/types/item.js';
import { CONSTRAINTS } from './designerValidationConstants.js';
import {
  MAX_IMPORTED_MESH_HEIGHT_UNITS as API_MAX_IMPORTED_MESH_HEIGHT_UNITS,
  validateImportedMeshContent,
  validateImportedMeshEnvelope,
  validateImportedMeshStructure,
} from './importedMeshValidation.js';

type Json = Record<string, unknown>;

async function importedAsset(): Promise<MeshAsset> {
  const positions = new Float32Array([0, 0, 0, 83, 0, 0, 0, 62, 0, 0, 0, 28]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return {
    name: 'parts_bin',
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 4,
    sizeMm: { x: 83, y: 62, z: 28 },
    outlines: [
      [
        { x: 0, y: 0 },
        { x: 83, y: 0 },
        { x: 83, y: 62 },
        { x: 0, y: 62 },
      ],
    ],
  };
}

const DEFAULT_ENVELOPE = createDefaultEnvelope(DEFAULT_BIN_PARAMS.featureColors);

// `Required` makes a field the client adds to either type fail to compile
// here until the fixture sets it, at which point the server has to take it.
const FULL_ATTACHMENT: Required<AttachmentConfig> = {
  ...DEFAULT_ENVELOPE.attachment,
  magnetCrushRibs: true,
  magnetChamfer: true,
};
const FULL_ENVELOPE: Required<ItemEnvelope> = {
  ...DEFAULT_ENVELOPE,
  width: 2,
  depth: 1.5,
  attachment: FULL_ATTACHMENT,
};

function fullStructure(asset: ImportedMeshStructure['asset']): Required<ImportedMeshStructure> {
  return {
    kind: 'importedMesh',
    heightUnits: 4,
    asset,
    volumeMm3: 51_000,
    sourceFileName: 'parts_bin.stl',
  };
}

function serverTakes(structure: unknown): boolean {
  return validateImportedMeshStructure(structure) === null;
}

describe('imported-mesh limits (cross-boundary mirror)', () => {
  it('caps the claimed height where the client does', () => {
    expect(API_MAX_IMPORTED_MESH_HEIGHT_UNITS).toBe(MAX_IMPORTED_MESH_HEIGHT_UNITS);
  });

  it('caps an inline asset where the client does', () => {
    expect(CONSTRAINTS.MAX_MESH_DATA_LENGTH).toBe(MAX_IMPORTED_MESH_DATA_LENGTH);
    expect(CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES).toBe(MAX_MESH_ASSET_TRIANGLES);
  });
});

describe('an imported design the client writes (cross-boundary mirror)', () => {
  it('passes with every envelope, attachment and structure field set, inline and as a ref', async () => {
    const asset = await importedAsset();
    const file = await meshAssetFile(asset);
    if (!file) throw new Error('fixture');

    for (const structure of [fullStructure(asset), fullStructure(file.ref)]) {
      expect(importedMeshSchema.safeParse(structure).success).toBe(true);
      const result = validateImportedMeshContent(
        { envelope: FULL_ENVELOPE, structure },
        { preBytes: JSON.stringify(structure).length, sizeLabel: 'imported mesh design' }
      );
      expect(result.ok).toBe(true);
    }
  });

  it.each([
    ['the smallest', DESIGNER_CONSTRAINTS.MIN_DIMENSION, true],
    ['the largest', DESIGNER_CONSTRAINTS.MAX_DIMENSION, true],
    [
      'one step past the largest',
      DESIGNER_CONSTRAINTS.MAX_DIMENSION + DESIGNER_CONSTRAINTS.DIMENSION_STEP,
      false,
    ],
    [
      'one step under the smallest',
      DESIGNER_CONSTRAINTS.MIN_DIMENSION - DESIGNER_CONSTRAINTS.DIMENSION_STEP,
      false,
    ],
  ])('takes a footprint claim at %s step only if the panel offers it', (_label, units, ok) => {
    const envelope = { ...DEFAULT_ENVELOPE, width: units, depth: units };
    expect(validateImportedMeshEnvelope(envelope) === null).toBe(ok);
  });
});

describe('imported-mesh structure validation (cross-boundary mirror)', () => {
  const fixtures = async (): Promise<(readonly [string, unknown])[]> => {
    const asset = await importedAsset();
    const file = await meshAssetFile(asset);
    if (!file) throw new Error('fixture');
    const ref = file.ref;
    const inline = (extra: Json): Json => fullStructure({ ...asset, ...extra });
    const asRef = (extra: Json): Json => fullStructure({ ...ref, ...extra });
    return [
      ['an inline asset', fullStructure(asset)],
      ['a ref', fullStructure(ref)],
      ['heightUnits at 1', { ...fullStructure(ref), heightUnits: 1 }],
      [
        'heightUnits at the cap',
        { ...fullStructure(ref), heightUnits: MAX_IMPORTED_MESH_HEIGHT_UNITS },
      ],
      [
        'heightUnits one past the cap',
        { ...fullStructure(ref), heightUnits: MAX_IMPORTED_MESH_HEIGHT_UNITS + 1 },
      ],
      ['heightUnits at 0', { ...fullStructure(ref), heightUnits: 0 }],
      ['fractional heightUnits', { ...fullStructure(ref), heightUnits: 2.5 }],
      ['no optional fields', { kind: 'importedMesh', heightUnits: 3, asset: ref }],
      ['a volume of 0', { ...fullStructure(ref), volumeMm3: 0 }],
      ['a file name at the cap', { ...fullStructure(ref), sourceFileName: 'x'.repeat(255) }],
      ['a file name past the cap', { ...fullStructure(ref), sourceFileName: 'x'.repeat(256) }],
      ['another kind', { ...fullStructure(ref), kind: 'assembly' }],
      ['no asset', { kind: 'importedMesh', heightUnits: 3 }],
      ['triangles at the cap', asRef({ triangleCount: MAX_MESH_ASSET_TRIANGLES })],
      ['triangles past the cap', asRef({ triangleCount: MAX_MESH_ASSET_TRIANGLES + 1 })],
      ['inline triangles past the cap', inline({ triangleCount: MAX_MESH_ASSET_TRIANGLES + 1 })],
      ['a name at 64 chars', asRef({ name: 'n'.repeat(64) })],
      ['a name at 65 chars', asRef({ name: 'n'.repeat(65) })],
      ['an empty name', asRef({ name: '' })],
      ['a size at the bound', asRef({ sizeMm: { x: 1000, y: 1, z: 1 } })],
      ['a size past the bound', asRef({ sizeMm: { x: 1000.5, y: 1, z: 1 } })],
      ['a size of 0', asRef({ sizeMm: { x: 0, y: 1, z: 1 } })],
      ['an uppercase hash', asRef({ hash: ref.hash.toUpperCase() })],
      ['a file of 0 bytes', asRef({ bytes: 0 })],
      ['data at the cap', inline({ data: 'A'.repeat(MAX_IMPORTED_MESH_DATA_LENGTH) })],
      ['data past the cap', inline({ data: 'A'.repeat(MAX_IMPORTED_MESH_DATA_LENGTH + 1) })],
      ['empty data', inline({ data: '' })],
    ];
  };

  it('exercises both verdicts, so agreement is not vacuous', async () => {
    const verdicts = (await fixtures()).map(
      ([, candidate]) => importedMeshSchema.safeParse(candidate).success
    );
    expect(verdicts).toContain(true);
    expect(verdicts).toContain(false);
  });

  it('agrees with the schema on every fixture', async () => {
    const disagreements = (await fixtures()).filter(
      ([, candidate]) => serverTakes(candidate) !== importedMeshSchema.safeParse(candidate).success
    );
    expect(disagreements.map(([label]) => label)).toEqual([]);
  });
});
