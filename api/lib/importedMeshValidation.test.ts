import { describe, expect, it } from 'vitest';
import { CONSTRAINTS } from './designerValidationConstants.js';
import {
  MAX_IMPORTED_MESH_HEIGHT_UNITS,
  MAX_SOURCE_FILE_NAME_LENGTH,
  validateImportedMeshContent,
} from './importedMeshValidation.js';

type Json = Record<string, unknown>;

const HASH = 'c'.repeat(64);

const ENVELOPE: Json = {
  width: 2,
  depth: 1.5,
  gridUnitMm: 42,
  heightUnitMm: 7,
  attachment: {
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    screwHoles: false,
    screwDiameter: 3,
  },
  featureColors: { enabled: false, body: '#3b82f6' },
};

const REF: Json = {
  name: 'bin',
  hash: HASH,
  triangleCount: 1200,
  sizeMm: { x: 83, y: 62, z: 28 },
  bytes: 40_000,
};

const INLINE: Json = {
  name: 'bin',
  data: 'QUFBQQ==',
  triangleCount: 1200,
  sizeMm: { x: 83, y: 62, z: 28 },
  outlines: [
    [
      { x: 0, y: 0 },
      { x: 83, y: 0 },
      { x: 83, y: 62 },
    ],
  ],
};

function structure(overrides: Json = {}): Json {
  return {
    kind: 'importedMesh',
    heightUnits: 4,
    asset: REF,
    volumeMm3: 51_000,
    sourceFileName: 'bin.stl',
    ...overrides,
  };
}

function check(
  content: { envelope?: unknown; structure?: unknown },
  preBytes = 2_000
): ReturnType<typeof validateImportedMeshContent> {
  return validateImportedMeshContent(
    { envelope: ENVELOPE, structure: structure(), ...content },
    { preBytes, sizeLabel: 'imported mesh design' }
  );
}

function errorOf(result: ReturnType<typeof validateImportedMeshContent>): string {
  if (result.ok) throw new Error('expected a rejection');
  expect(result.status).toBe(400);
  return result.error;
}

describe('validateImportedMeshContent', () => {
  it('takes a design of refs as it came, naming the file it needs', () => {
    const result = check({});

    expect(result).toEqual({
      ok: true,
      envelope: ENVELOPE,
      structure: structure(),
      meshHashes: [HASH],
    });
  });

  it('takes an inline asset, which names no file', () => {
    const result = check({ structure: structure({ asset: INLINE }) });

    expect(result.ok && result.meshHashes).toEqual([]);
  });

  it('takes the optional fields absent, and the optional attachment flags', () => {
    const { volumeMm3: _volume, sourceFileName: _file, ...bare } = structure();
    const envelope = {
      ...ENVELOPE,
      attachment: { ...(ENVELOPE.attachment as Json), magnetCrushRibs: true, magnetChamfer: false },
    };

    expect(check({ envelope, structure: bare }).ok).toBe(true);
  });

  it('gives an inline asset the mesh cap, and holds refs to the cap of a design without meshes', () => {
    const overMeshless = CONSTRAINTS.MAX_PAYLOAD_BYTES + 1;

    expect(check({ structure: structure({ asset: INLINE }) }, overMeshless).ok).toBe(true);
    expect(errorOf(check({}, overMeshless))).toContain('size limit');
    expect(
      errorOf(
        check({ structure: structure({ asset: INLINE }) }, CONSTRAINTS.MESH_MAX_PAYLOAD_BYTES + 1)
      )
    ).toContain('size limit');
  });

  it.each([
    ['envelope', { envelope: { ...ENVELOPE, extra: 1 } }, 'envelope has unknown key: extra'],
    [
      'attachment',
      { envelope: { ...ENVELOPE, attachment: { ...(ENVELOPE.attachment as Json), extra: 1 } } },
      'envelope.attachment has unknown key: extra',
    ],
    ['structure', { structure: structure({ extra: 1 }) }, 'structure has unknown key: extra'],
    [
      'ref',
      { structure: structure({ asset: { ...REF, extra: 1 } }) },
      'structure.asset has unknown key: extra',
    ],
    [
      'inline asset',
      { structure: structure({ asset: { ...INLINE, extra: 1 } }) },
      'structure.asset has unknown key: extra',
    ],
  ])('rejects an unknown key on the %s', (_where, content, message) => {
    expect(errorOf(check(content))).toBe(message);
  });

  it.each([0, MAX_IMPORTED_MESH_HEIGHT_UNITS + 1, 2.5, '4'])(
    'rejects a claimed height of %s units',
    (heightUnits) => {
      expect(errorOf(check({ structure: structure({ heightUnits }) }))).toContain(
        'structure.heightUnits'
      );
    }
  );

  it.each([
    ['width', CONSTRAINTS.MAX_DIMENSION + 0.5],
    ['depth', CONSTRAINTS.MIN_DIMENSION - 0.5],
  ])('rejects a claimed %s of %s units', (axis, value) => {
    expect(errorOf(check({ envelope: { ...ENVELOPE, [axis]: value } }))).toContain(axis);
  });

  it('rejects envelope units and attachment the other item kinds reject', () => {
    expect(errorOf(check({ envelope: { ...ENVELOPE, gridUnitMm: 5 } }))).toContain('units');
    const attachment = { ...(ENVELOPE.attachment as Json), magnetChamfer: 'yes' };
    expect(errorOf(check({ envelope: { ...ENVELOPE, attachment } }))).toContain('magnetChamfer');
    expect(errorOf(check({ envelope: { ...ENVELOPE, featureColors: 'red' } }))).toContain(
      'featureColors'
    );
  });

  it('rejects a structure of another kind', () => {
    expect(errorOf(check({ structure: structure({ kind: 'assembly' }) }))).toBe(
      'structure.kind must be importedMesh'
    );
  });

  it('rejects a volume that is not positive and an overlong file name', () => {
    expect(errorOf(check({ structure: structure({ volumeMm3: 0 }) }))).toContain('volumeMm3');
    const sourceFileName = 'x'.repeat(MAX_SOURCE_FILE_NAME_LENGTH + 1);
    expect(errorOf(check({ structure: structure({ sourceFileName }) }))).toContain(
      'sourceFileName'
    );
  });

  it('holds the asset to the bounds of a bin mesh asset', () => {
    expect(errorOf(check({ structure: structure({ asset: { ...REF, hash: 'nope' } }) }))).toBe(
      'structure.asset.hash must be a lowercase hex SHA-256'
    );
    expect(errorOf(check({ structure: structure({ asset: { ...INLINE, outlines: [] } }) }))).toBe(
      'structure.asset.outlines must be a non-empty array'
    );
    expect(
      errorOf(
        check({
          structure: structure({
            asset: { ...REF, triangleCount: CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES + 1 },
          }),
        })
      )
    ).toContain('structure.asset.triangleCount');
    expect(errorOf(check({ structure: structure({ asset: undefined }) }))).toBe(
      'structure.asset must be an object'
    );
  });
});
