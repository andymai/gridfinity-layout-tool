import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  validateDesignerShare: vi.fn(),
}));

vi.mock('./designerValidation.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    validateDesignerShare: mocks.validateDesignerShare,
  };
});

import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_REPORT_NOTE_MAX_LENGTH,
  COMMUNITY_REPORT_REASONS,
  COMMUNITY_TECHNIQUES,
  MAX_COMMUNITY_THUMBNAIL_BYTES,
  checkCommunityDescriptionPolicy,
  communityRequiresDescription,
  deriveCommunityTechniques,
  parseCommunityLineage,
  parseReportBody,
  validateCommunityPublish,
} from './communityValidation.js';

function webpBase64(payloadBytes = 6): string {
  return Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WEBP'),
    Buffer.alloc(payloadBytes),
  ]).toString('base64');
}

function glbBase64(payloadBytes = 8): string {
  return Buffer.concat([Buffer.from('glTF'), Buffer.alloc(payloadBytes)]).toString('base64');
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Socket Organizer',
    description: 'Holds 24 sockets.',
    authorName: 'Andy',
    category: 'tools',
    params: { width: 2, depth: 3 },
    thumbnails: [webpBase64()],
    glb: glbBase64(),
    ...overrides,
  };
}

function expectError(body: Record<string, unknown>, code: string): string {
  const result = validateCommunityPublish(body);
  expect(result.valid).toBe(false);
  if (result.valid) throw new Error('expected invalid');
  expect(result.error.code).toBe(code);
  return result.error.message;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateDesignerShare.mockImplementation((body: { params: Record<string, unknown> }) => ({
    valid: true,
    payload: { type: 'designer', version: 1, params: body.params },
  }));
});

describe('validateCommunityPublish', () => {
  it('accepts a valid publish body and returns the sanitized payload', () => {
    const result = validateCommunityPublish(validBody({ name: '  Socket Organizer  ' }));
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.payload.name).toBe('Socket Organizer');
    expect(result.payload.description).toBe('Holds 24 sockets.');
    expect(result.payload.authorName).toBe('Andy');
    expect(result.payload.category).toBe('tools');
    expect(result.payload.params).toEqual({ width: 2, depth: 3 });
    expect(result.payload.techniques).toEqual([]);
    expect(result.payload.thumbnails).toEqual([webpBase64()]);
    expect(result.payload.glb).toBe(glbBase64());
  });

  const assemblyBody = (over: Record<string, unknown> = {}): Record<string, unknown> =>
    validBody({
      params: undefined,
      kind: 'assembly',
      envelope: {
        width: 2,
        depth: 2,
        gridUnitMm: 42,
        heightUnitMm: 7,
        attachment: {
          magnetHoles: false,
          magnetDiameter: 6.5,
          magnetDepth: 2.4,
          screwHoles: false,
          screwDiameter: 3,
        },
        featureColors: { enabled: false },
      },
      structure: {
        kind: 'assembly',
        schemaVersion: 1,
        base: { floorThickness: 2 },
        mirrorAxis: 'x',
        parts: [
          {
            id: 'p1',
            type: 'post',
            params: { diameter: 8, height: 40, taperDeg: 0, tipChamfer: 1 },
            transform: { x: 20, y: 20, seatZ: 0, rotZDeg: 0 },
            children: [],
          },
        ],
      },
      heightUnits: 7,
      ...over,
    });

  it('accepts a Workshop assembly publish and tags it workshop', () => {
    const result = validateCommunityPublish(assemblyBody());
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.payload.kind).toBe('assembly');
    expect(result.payload.params).toBeUndefined();
    expect(result.payload.envelope).toMatchObject({ width: 2, depth: 2 });
    expect(result.payload.structure).toMatchObject({ kind: 'assembly' });
    expect(result.payload.heightUnits).toBe(7);
    expect(result.payload.techniques).toEqual(['workshop']);
  });

  it('rejects an assembly with an invalid structure or envelope', () => {
    expectError(
      assemblyBody({ structure: { kind: 'assembly', schemaVersion: 2 } }),
      'INVALID_PARAMS'
    );
    expectError(assemblyBody({ envelope: { width: 500 } }), 'INVALID_PARAMS');
  });

  it('derives heightUnits from the part tree, ignoring any client value', () => {
    // 40mm post + 5mm socket + 2mm floor = 47mm -> 7 units of 7mm.
    const result = validateCommunityPublish(assemblyBody({ heightUnits: 2 }));
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.payload.heightUnits).toBe(7);
  });

  it('drops unknown keys and unsafe id characters from the stored content', () => {
    const body = assemblyBody();
    const structure = body.structure as Record<string, unknown>;
    structure.extra = 'smuggled';
    const part = (structure.parts as Record<string, unknown>[])[0];
    part.id = 'p1<script>';
    part.note = 'also smuggled';
    const result = validateCommunityPublish(body);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    const stored = result.payload.structure as {
      extra?: unknown;
      parts: Array<{ id: string; note?: unknown }>;
    };
    expect(stored.extra).toBeUndefined();
    expect(stored.parts[0].note).toBeUndefined();
    expect(stored.parts[0].id).toBe('p1_script_');
  });

  it('rejects a non-object body', () => {
    expectError(null as unknown as Record<string, unknown>, 'INVALID_PAYLOAD');
  });

  it('rejects a missing, empty, or overlong name', () => {
    expectError(validBody({ name: undefined }), 'INVALID_NAME');
    expectError(validBody({ name: '   ' }), 'INVALID_NAME');
    expectError(validBody({ name: 'x'.repeat(COMMUNITY_NAME_MAX_LENGTH + 1) }), 'INVALID_NAME');
  });

  it('rejects low-effort names with specific codes (B2)', () => {
    expectError(validBody({ name: 'ab' }), 'NAME_TOO_SHORT');
    expectError(validBody({ name: 'Untitled Bin' }), 'NAME_PLACEHOLDER');
    expectError(validBody({ name: '  untitled  ' }), 'NAME_PLACEHOLDER');
    expectError(validBody({ name: '1234' }), 'NAME_LOW_EFFORT');
    expectError(validBody({ name: 'aaaa' }), 'NAME_LOW_EFFORT');
  });

  it('accepts a descriptive name in a non-Latin script', () => {
    expect(validateCommunityPublish(validBody({ name: '工具盒' })).valid).toBe(true);
  });

  it('caps description length before the policy runs', () => {
    expectError(
      validBody({ description: 'x'.repeat(COMMUNITY_DESCRIPTION_MAX_LENGTH + 1) }),
      'INVALID_DESCRIPTION'
    );
  });

  it('rejects an absent description, and defaults it to empty once relaxed', () => {
    expectError(validBody({ description: undefined }), 'DESCRIPTION_REQUIRED');

    process.env.COMMUNITY_REQUIRE_DESCRIPTION = 'false';
    const result = validateCommunityPublish(validBody({ description: undefined }));
    delete process.env.COMMUNITY_REQUIRE_DESCRIPTION;
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.payload.description).toBe('');
  });

  it('rejects a missing or empty authorName', () => {
    expectError(validBody({ authorName: undefined }), 'INVALID_AUTHOR_NAME');
    expectError(validBody({ authorName: ' ' }), 'INVALID_AUTHOR_NAME');
  });

  it('content-blocks filtered name, description, and authorName', () => {
    expectError(validBody({ name: 'visit https://spam.example' }), 'CONTENT_BLOCKED');
    expectError(validBody({ description: 'you should kys now' }), 'CONTENT_BLOCKED');
    expectError(validBody({ authorName: 'kys' }), 'CONTENT_BLOCKED');
  });

  it('content-blocks engraved text nested in the sanitized params', () => {
    const body = validBody({ params: { surfaceText: [{ text: 'kys' }] } });
    expectError(body, 'CONTENT_BLOCKED');
  });

  // These fields are printed to a moderator's TTY by the community-admin CLI.
  // trim() only reaches the ends, and the content filter normalizes Unicode
  // tricks but not raw ESC/CR, so an interior control byte survived to storage.
  describe('control characters in display fields', () => {
    it('strips an escape sequence from the name', () => {
      const result = validateCommunityPublish(validBody({ name: 'Screw\x1b[2J Tray' }));
      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payload.name).not.toContain('\x1b');
      expect(result.payload.name).toBe('Screw[2J Tray');
    });

    it('strips a carriage return from the authorName', () => {
      const result = validateCommunityPublish(validBody({ authorName: 'Andy\rFAKE' }));
      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payload.authorName).toBe('AndyFAKE');
    });

    it('strips C1 control bytes too', () => {
      const result = validateCommunityPublish(validBody({ authorName: 'An\x9bdy' }));
      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payload.authorName).toBe('Andy');
    });

    it('rejects an authorName that is nothing but control characters', () => {
      expectError(validBody({ authorName: '\x1b\x07\x00' }), 'INVALID_AUTHOR_NAME');
    });
  });

  it('rejects unknown categories and accepts every preset', () => {
    expectError(validBody({ category: 'gardening' }), 'INVALID_CATEGORY');
    expectError(validBody({ category: undefined }), 'INVALID_CATEGORY');
    for (const category of COMMUNITY_CATEGORIES) {
      expect(validateCommunityPublish(validBody({ category })).valid).toBe(true);
    }
  });

  it('rejects non-object params before calling the designer validator', () => {
    expectError(validBody({ params: 'nope' }), 'MISSING_PARAMS');
    expect(mocks.validateDesignerShare).not.toHaveBeenCalled();
  });

  it('passes the designer payload with envelope-inclusive sizeBytes', () => {
    const body = validBody();
    validateCommunityPublish(body);

    const [payload, sizeBytes] = mocks.validateDesignerShare.mock.calls[0] as [
      { type: string; version: number; params: Record<string, unknown> },
      number,
    ];
    expect(payload).toEqual({ type: 'designer', version: 1, params: body.params });
    expect(sizeBytes).toBe(
      Buffer.byteLength(
        JSON.stringify({
          name: body.name,
          description: body.description,
          category: body.category,
          type: 'designer',
          version: 1,
          params: body.params,
        }),
        'utf8'
      )
    );
  });

  it('passes designer validation failures through untouched', () => {
    mocks.validateDesignerShare.mockReturnValue({
      valid: false,
      error: { code: 'INVALID_PARAMS', message: 'params.width must be a number' },
    });
    const message = expectError(validBody(), 'INVALID_PARAMS');
    expect(message).toBe('params.width must be a number');
  });

  it('persists the sanitized params from the validator, not the raw input', () => {
    mocks.validateDesignerShare.mockReturnValue({
      valid: true,
      payload: { type: 'designer', version: 1, params: { width: 2 } },
    });
    const result = validateCommunityPublish(validBody({ params: { width: 2, __proto__junk: 1 } }));
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.payload.params).toEqual({ width: 2 });
  });

  it('requires 1-3 thumbnails', () => {
    expectError(validBody({ thumbnails: undefined }), 'INVALID_THUMBNAILS');
    expectError(validBody({ thumbnails: [] }), 'INVALID_THUMBNAILS');
    expectError(
      validBody({ thumbnails: [webpBase64(), webpBase64(), webpBase64(), webpBase64()] }),
      'INVALID_THUMBNAILS'
    );
    expect(
      validateCommunityPublish(
        validBody({ thumbnails: [webpBase64(), webpBase64(1), webpBase64(2)] })
      ).valid
    ).toBe(true);
  });

  it('accepts image/webp data URLs and strips the prefix', () => {
    const result = validateCommunityPublish(
      validBody({ thumbnails: [`data:image/webp;base64,${webpBase64()}`] })
    );
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.payload.thumbnails).toEqual([webpBase64()]);
  });

  it('rejects non-webp data URLs, invalid base64, and wrong magic bytes', () => {
    expectError(validBody({ thumbnails: ['data:image/png;base64,AAAA'] }), 'INVALID_THUMBNAILS');
    expectError(validBody({ thumbnails: ['not base64!!'] }), 'INVALID_THUMBNAILS');
    expectError(
      validBody({ thumbnails: [Buffer.from('not a webp at all').toString('base64')] }),
      'INVALID_THUMBNAILS'
    );
  });

  it('rejects thumbnails over the decoded byte cap', () => {
    const oversize = webpBase64(MAX_COMMUNITY_THUMBNAIL_BYTES);
    const message = expectError(validBody({ thumbnails: [oversize] }), 'INVALID_THUMBNAILS');
    expect(message).toContain('decoded bytes');
  });

  it('rejects a missing GLB, invalid base64, and wrong magic bytes', () => {
    expectError(validBody({ glb: undefined }), 'INVALID_GLB');
    expectError(validBody({ glb: 'not base64!!' }), 'INVALID_GLB');
    expectError(validBody({ glb: Buffer.from('STLBINARY000').toString('base64') }), 'INVALID_GLB');
  });

  it('rejects a GLB over the decoded byte cap', () => {
    const oversize = glbBase64(2_000_000);
    const message = expectError(validBody({ glb: oversize }), 'INVALID_GLB');
    expect(message).toContain('decoded bytes');
  });
});

describe('communityRequiresDescription (config flag)', () => {
  afterEach(() => {
    delete process.env.COMMUNITY_REQUIRE_DESCRIPTION;
  });

  it('defaults ON when the flag is unset', () => {
    expect(communityRequiresDescription()).toBe(true);
  });

  it('is only relaxed by the literal string "false"', () => {
    process.env.COMMUNITY_REQUIRE_DESCRIPTION = 'false';
    expect(communityRequiresDescription()).toBe(false);
    process.env.COMMUNITY_REQUIRE_DESCRIPTION = 'true';
    expect(communityRequiresDescription()).toBe(true);
    process.env.COMMUNITY_REQUIRE_DESCRIPTION = '0';
    expect(communityRequiresDescription()).toBe(true);
  });
});

describe('checkCommunityDescriptionPolicy', () => {
  afterEach(() => {
    delete process.env.COMMUNITY_REQUIRE_DESCRIPTION;
  });

  it('passes a description that says what the design is for', () => {
    expect(checkCommunityDescriptionPolicy('Holds 14 AA cells upright')).toBeNull();
  });

  it('names the specific problem so the client can route it', () => {
    expect(checkCommunityDescriptionPolicy('')?.code).toBe('DESCRIPTION_REQUIRED');
    expect(checkCommunityDescriptionPolicy('Bit holder')?.code).toBe('DESCRIPTION_TOO_SHORT');
    expect(checkCommunityDescriptionPolicy('aaaaaaaaaaaaaa')?.code).toBe('DESCRIPTION_LOW_EFFORT');
  });

  it('accepts anything once the policy is relaxed', () => {
    process.env.COMMUNITY_REQUIRE_DESCRIPTION = 'false';
    expect(checkCommunityDescriptionPolicy('')).toBeNull();
    expect(checkCommunityDescriptionPolicy('aaaaaaaaaaaaaa')).toBeNull();
  });
});

describe('deriveCommunityTechniques', () => {
  it('returns no techniques for default-shaped params', () => {
    expect(
      deriveCommunityTechniques({
        style: 'standard',
        compartments: { cols: 1, rows: 1, cells: [0] },
        walls: { enabled: false, left: { enabled: true } },
        scoop: { enabled: false },
        label: { enabled: false },
        lid: { enabled: false },
        handles: { enabled: false, front: { enabled: true } },
        wallPattern: { enabled: false },
        slotConfig: { x: { enabled: true }, y: { enabled: false } },
      })
    ).toEqual([]);
  });

  it('tags compartments on more than one distinct compartment id', () => {
    expect(deriveCommunityTechniques({ compartments: { cells: [0, 1, 2] } })).toEqual([
      'compartments',
    ]);
  });

  it('does not tag compartments when every cell shares one id', () => {
    expect(
      deriveCommunityTechniques({ compartments: { cols: 2, rows: 2, cells: [0, 0, 0, 0] } })
    ).toEqual([]);
  });

  it('keys wallCutouts and handles off the master enabled flag, not per-side flags', () => {
    expect(
      deriveCommunityTechniques({
        walls: { enabled: false, left: { enabled: true }, right: { enabled: true } },
        handles: { enabled: false, front: { enabled: true } },
      })
    ).toEqual([]);
    expect(deriveCommunityTechniques({ walls: { enabled: true } })).toEqual(['wallCutouts']);
    expect(deriveCommunityTechniques({ handles: { enabled: true } })).toEqual(['handles']);
  });

  it('keys slotted off style, not slotConfig', () => {
    expect(
      deriveCommunityTechniques({ style: 'standard', slotConfig: { x: { enabled: true } } })
    ).toEqual([]);
    expect(deriveCommunityTechniques({ style: 'slotted' })).toEqual(['slotted']);
  });

  it('tags scoop, labelTab, lid, and wallPattern on their enabled flags', () => {
    expect(deriveCommunityTechniques({ scoop: { enabled: true } })).toEqual(['scoop']);
    expect(deriveCommunityTechniques({ label: { enabled: true } })).toEqual(['labelTab']);
    expect(deriveCommunityTechniques({ lid: { enabled: true } })).toEqual(['lid']);
    expect(deriveCommunityTechniques({ wallPattern: { enabled: true } })).toEqual(['wallPattern']);
  });

  it('tags customShape only for a partial cell mask', () => {
    expect(deriveCommunityTechniques({ cellMask: { cols: 2, rows: 1, cells: [1, 1] } })).toEqual(
      []
    );
    expect(deriveCommunityTechniques({ cellMask: { cols: 2, rows: 1, cells: [1, 0] } })).toEqual([
      'customShape',
    ]);
    expect(deriveCommunityTechniques({})).toEqual([]);
  });

  it('emits techniques in the canonical union order', () => {
    const everything = deriveCommunityTechniques({
      style: 'slotted',
      compartments: { cells: [0, 1] },
      walls: { enabled: true },
      scoop: { enabled: true },
      label: { enabled: true },
      lid: { enabled: true },
      handles: { enabled: true },
      cellMask: { cols: 2, rows: 1, cells: [1, 0] },
      wallPattern: { enabled: true },
    });
    expect(everything).toEqual(COMMUNITY_TECHNIQUES.filter((t) => t !== 'workshop'));
  });
});

describe('parseCommunityLineage', () => {
  const LINEAGE = {
    parentId: 'parentAAAAAA',
    rootId: 'rootBBBBBBBB',
    parentName: 'Parent Bin',
    parentAuthorName: 'Ada',
    rootAuthorName: 'Root Author',
  };

  it('accepts a missing lineage as null', () => {
    expect(parseCommunityLineage(undefined)).toEqual({ ok: true, lineage: null });
    expect(parseCommunityLineage(null)).toEqual({ ok: true, lineage: null });
  });

  it('parses a well-formed lineage envelope', () => {
    expect(parseCommunityLineage(LINEAGE)).toEqual({ ok: true, lineage: LINEAGE });
  });

  it('rejects malformed ids, names, and non-objects', () => {
    expect(parseCommunityLineage('nope').ok).toBe(false);
    expect(parseCommunityLineage({ ...LINEAGE, parentId: 'short' }).ok).toBe(false);
    expect(parseCommunityLineage({ ...LINEAGE, rootId: 42 }).ok).toBe(false);
    expect(parseCommunityLineage({ ...LINEAGE, parentName: '' }).ok).toBe(false);
    expect(parseCommunityLineage({ ...LINEAGE, parentAuthorName: 'x'.repeat(33) }).ok).toBe(false);
    expect(parseCommunityLineage({ ...LINEAGE, rootAuthorName: undefined }).ok).toBe(false);
  });

  it('rejects blocked content in snapshot names', () => {
    expect(parseCommunityLineage({ ...LINEAGE, parentName: 'cool <script name' }).ok).toBe(false);
  });
});

describe('parseReportBody', () => {
  it('accepts a valid reason with no note', () => {
    expect(parseReportBody({ reason: 'spam' })).toEqual({ ok: true, reason: 'spam', note: '' });
  });

  it('treats a null note as absent', () => {
    expect(parseReportBody({ reason: 'spam', note: null })).toEqual({
      ok: true,
      reason: 'spam',
      note: '',
    });
  });

  it('rejects an unknown reason with the enumerating message', () => {
    const parsed = parseReportBody({ reason: 'other' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.status).toBe(400);
    expect(parsed.message).toContain('inappropriate');
  });

  it('rejects a non-string note', () => {
    expect(parseReportBody({ reason: 'spam', note: 42 }).ok).toBe(false);
  });

  it('truncates an over-length note instead of rejecting it', () => {
    const parsed = parseReportBody({
      reason: 'spam',
      note: 'the lid does not fit the bin. '.repeat(30),
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.note).toHaveLength(COMMUNITY_REPORT_NOTE_MAX_LENGTH);
  });

  it('returns CONTENT_BLOCKED for a filtered note', () => {
    const parsed = parseReportBody({ reason: 'spam', note: 'visit https://spam.example now' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe('CONTENT_BLOCKED');
  });
});

describe('report reason union', () => {
  it('matches the detail view radio options and the exhaustiveness registry', () => {
    // Mirrors scripts/check-union-exhaustiveness.sh's CommunityReportReason
    // entry; update both together.
    expect(COMMUNITY_REPORT_REASONS).toEqual(['inappropriate', 'spam', 'broken', 'stolen']);
    expect(COMMUNITY_REPORT_NOTE_MAX_LENGTH).toBe(500);
  });
});
