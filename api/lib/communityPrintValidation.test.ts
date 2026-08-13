import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_PRINT_MAX_PHOTOS,
  COMMUNITY_PRINT_NOTE_MAX_LENGTH,
  COMMUNITY_PRINT_PHOTO_MAX_BYTES,
  COMMUNITY_PRINT_THUMB_MAX_BYTES,
  communityPrintsEnabled,
  hasPrintSubstance,
  readWebpDimensions,
  validateCommunityPrint,
} from './communityPrintValidation.js';

/**
 * Synthetic WebP headers. The validator only ever decodes the first 48 bytes
 * to read the canvas size, so a correct header plus filler exercises exactly
 * the code path a real upload would, without checking a binary into the repo.
 * The three container variants are the ones a browser canvas actually emits:
 * VP8 for lossy, VP8L for lossless, VP8X once there is an alpha channel.
 */
function riff(format: string, body: Buffer, fillerBytes = 0): Buffer {
  const filler = Buffer.alloc(fillerBytes, 0x42);
  const payload = Buffer.concat([Buffer.from(format, 'latin1'), body, filler]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(payload.length + 4, 4);
  return Buffer.concat([header, Buffer.from('WEBP', 'latin1'), payload]);
}

function lossyWebp(width: number, height: number, fillerBytes = 0): Buffer {
  const body = Buffer.alloc(14);
  body.writeUInt32LE(10, 0); // chunk size
  body.writeUInt8(0x9d, 7);
  body.writeUInt8(0x01, 8);
  body.writeUInt8(0x2a, 9);
  body.writeUInt16LE(width, 10);
  body.writeUInt16LE(height, 12);
  return riff('VP8 ', body, fillerBytes);
}

function losslessWebp(width: number, height: number): Buffer {
  const body = Buffer.alloc(9);
  body.writeUInt32LE(5, 0);
  body.writeUInt8(0x2f, 4);
  body.writeUInt32LE((width - 1) | ((height - 1) << 14), 5);
  return riff('VP8L', body);
}

function extendedWebp(width: number, height: number): Buffer {
  const body = Buffer.alloc(14);
  body.writeUInt32LE(10, 0);
  body.writeUIntLE(width - 1, 8, 3);
  body.writeUIntLE(height - 1, 11, 3);
  return riff('VP8X', body);
}

function photo(buffer: Buffer): string {
  return buffer.toString('base64');
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authorName: 'Casey',
    material: 'pla',
    nozzleMm: 0.4,
    layerHeightMm: 0.2,
    printMinutes: 124,
    printer: 'bambu-p1s',
    fitVerdict: 'as-designed',
    // The substance floor: a verdict alone is a bare vote, so every valid body
    // carries a photo or a note.
    note: 'Printed fine.',
    ...overrides,
  };
}

describe('readWebpDimensions', () => {
  it('reads a lossy VP8 canvas size', () => {
    expect(readWebpDimensions(lossyWebp(900, 1101))).toEqual({ width: 900, height: 1101 });
  });

  it('reads a lossless VP8L canvas size', () => {
    expect(readWebpDimensions(losslessWebp(321, 197))).toEqual({ width: 321, height: 197 });
  });

  it('reads an extended VP8X canvas size', () => {
    expect(readWebpDimensions(extendedWebp(640, 480))).toEqual({ width: 640, height: 480 });
  });

  it('rejects a buffer that is not RIFF/WEBP framed', () => {
    expect(readWebpDimensions(Buffer.alloc(32, 0x00))).toBeNull();
  });

  it('rejects a lossy frame whose sync code is wrong', () => {
    const corrupt = lossyWebp(100, 100);
    corrupt.writeUInt8(0x00, 23);
    expect(readWebpDimensions(corrupt)).toBeNull();
  });

  it('rejects an unknown container format', () => {
    expect(readWebpDimensions(riff('JUNK', Buffer.alloc(20)))).toBeNull();
  });
});

describe('communityPrintsEnabled', () => {
  it('is off unless the env var is exactly "true"', () => {
    const original = process.env.COMMUNITY_PRINTS_ENABLED;
    try {
      delete process.env.COMMUNITY_PRINTS_ENABLED;
      expect(communityPrintsEnabled()).toBe(false);
      process.env.COMMUNITY_PRINTS_ENABLED = '1';
      expect(communityPrintsEnabled()).toBe(false);
      process.env.COMMUNITY_PRINTS_ENABLED = 'TRUE';
      expect(communityPrintsEnabled()).toBe(false);
      process.env.COMMUNITY_PRINTS_ENABLED = 'true';
      expect(communityPrintsEnabled()).toBe(true);
    } finally {
      if (original === undefined) delete process.env.COMMUNITY_PRINTS_ENABLED;
      else process.env.COMMUNITY_PRINTS_ENABLED = original;
    }
  });
});

describe('validateCommunityPrint', () => {
  it('accepts a minimal photo-less report', () => {
    const result = validateCommunityPrint(validBody());
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload).toMatchObject({
      authorName: 'Casey',
      material: 'pla',
      nozzleMm: 0.4,
      layerHeightMm: 0.2,
      printMinutes: 124,
      printer: 'bambu-p1s',
      fitVerdict: 'as-designed',
      filamentGrams: null,
      note: 'Printed fine.',
      photos: [],
    });
  });

  describe('optional settings', () => {
    it.each(['material', 'nozzleMm', 'layerHeightMm', 'printMinutes', 'printer'])(
      'accepts a report with no %s',
      (field) => {
        const body = Object.fromEntries(
          Object.entries(validBody()).filter(([key]) => key !== field)
        );
        expect(validateCommunityPrint(body).valid).toBe(true);
      }
    );

    it('records every omitted setting as absent, never as a zero', () => {
      const result = validateCommunityPrint({
        authorName: 'Casey',
        fitVerdict: 'as-designed',
        note: 'Printed fine.',
      });
      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payload).toMatchObject({
        material: null,
        nozzleMm: null,
        layerHeightMm: null,
        printMinutes: null,
        filamentGrams: null,
        printer: null,
      });
    });

    it('still rejects a setting that is present but out of range', () => {
      const result = validateCommunityPrint(validBody({ nozzleMm: 99 }));
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.error.code).toBe('INVALID_SETTINGS');
    });

    it('still rejects an unknown printer id', () => {
      const result = validateCommunityPrint(validBody({ printer: 'not-a-printer' }));
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.error.code).toBe('INVALID_PRINTER');
    });
  });

  // The floor itself lives in the handler, which is the only place that knows
  // what is already stored. The validator accepts a bare payload.
  it('accepts a payload with neither a photo nor a note', () => {
    expect(validateCommunityPrint(validBody({ note: '' })).valid).toBe(true);
  });

  it('rejects a non-object body', () => {
    const result = validateCommunityPrint('nope');
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_PAYLOAD');
  });

  it('rejects an unknown material', () => {
    const result = validateCommunityPrint(validBody({ material: 'resin' }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_MATERIAL');
  });

  it('rejects an unknown fit verdict', () => {
    const result = validateCommunityPrint(validBody({ fitVerdict: 'perfect' }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_FIT_VERDICT');
  });

  it.each([
    ['nozzleMm', 0.05],
    ['nozzleMm', 3],
    ['layerHeightMm', 0.001],
    ['layerHeightMm', 2],
    ['printMinutes', 0],
    ['printMinutes', 20_000],
  ])('rejects %s out of range (%s)', (field, value) => {
    const result = validateCommunityPrint(validBody({ [field]: value }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_SETTINGS');
  });

  it('rejects a non-finite numeric setting', () => {
    const result = validateCommunityPrint(validBody({ printMinutes: Number.NaN }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_SETTINGS');
  });

  it('treats an omitted filamentGrams as absent rather than zero', () => {
    const result = validateCommunityPrint(validBody({ filamentGrams: null }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.filamentGrams).toBeNull();
  });

  it('keeps a reported filamentGrams', () => {
    const result = validateCommunityPrint(validBody({ filamentGrams: 18.5 }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.filamentGrams).toBe(18.5);
  });

  it('rejects an unknown printer id', () => {
    const result = validateCommunityPrint(validBody({ printer: 'my-cool-printer' }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_PRINTER');
  });

  it('requires printerOther when the printer is "other"', () => {
    const result = validateCommunityPrint(validBody({ printer: 'other' }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_PRINTER');
  });

  it('accepts the "other" escape hatch with free text', () => {
    const result = validateCommunityPrint(
      validBody({ printer: 'other', printerOther: '  Toolchanger build  ' })
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.printerOther).toBe('Toolchanger build');
  });

  it('drops printerOther when a curated printer is selected', () => {
    const result = validateCommunityPrint(
      validBody({ printer: 'prusa-mk4', printerOther: 'sneaky text' })
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.printerOther).toBe('');
  });

  it('rejects an over-long printerOther', () => {
    const result = validateCommunityPrint(
      validBody({ printer: 'other', printerOther: 'x'.repeat(41) })
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_PRINTER');
  });

  it('rejects a missing author name', () => {
    const result = validateCommunityPrint(validBody({ authorName: undefined }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_AUTHOR_NAME');
  });

  it('trims and keeps the note', () => {
    const result = validateCommunityPrint(validBody({ note: '  had to scale 2 percent  ' }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.note).toBe('had to scale 2 percent');
  });

  it('rejects an over-long note', () => {
    const result = validateCommunityPrint(
      validBody({ note: 'x'.repeat(COMMUNITY_PRINT_NOTE_MAX_LENGTH + 1) })
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_NOTE');
  });

  it('accepts a new photo upload', () => {
    const result = validateCommunityPrint(validBody({ photos: [photo(lossyWebp(1200, 900))] }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.photos).toEqual([
      { kind: 'new', base64: photo(lossyWebp(1200, 900)), thumbBase64: null },
    ]);
  });

  it('accepts a data-URL prefixed photo', () => {
    const base64 = photo(lossyWebp(800, 600));
    const result = validateCommunityPrint(
      validBody({ photos: [`data:image/webp;base64,${base64}`] })
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.photos).toEqual([{ kind: 'new', base64, thumbBase64: null }]);
  });

  it('classifies an https entry as a keep instruction', () => {
    const url = 'https://blob.example/community/prints/abc.webp';
    const result = validateCommunityPrint(validBody({ photos: [url] }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.photos).toEqual([{ kind: 'keep', url }]);
  });

  it('accepts a browsing-sized copy attached to its upload', () => {
    const base64 = photo(lossyWebp(1200, 900));
    const thumb = photo(lossyWebp(400, 300));
    const result = validateCommunityPrint(validBody({ photos: [{ photo: base64, thumb }] }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.photos).toEqual([{ kind: 'new', base64, thumbBase64: thumb }]);
  });

  it('accepts an upload whose copy is absent', () => {
    // A browser that could not encode one still gets to post the print.
    const base64 = photo(lossyWebp(1200, 900));
    for (const thumb of [null, undefined]) {
      const result = validateCommunityPrint(validBody({ photos: [{ photo: base64, thumb }] }));
      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payload.photos).toEqual([{ kind: 'new', base64, thumbBase64: null }]);
    }
  });

  it('rejects a copy that is not actually small', () => {
    // Without the dimension check the field is just a second full-size upload
    // slot, which defeats the entire point of having it.
    const result = validateCommunityPrint(
      validBody({
        photos: [{ photo: photo(lossyWebp(1200, 900)), thumb: photo(lossyWebp(1200, 900)) }],
      })
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.message).toContain('photos[0].thumb');
  });

  it('rejects a copy that is not a WebP', () => {
    const result = validateCommunityPrint(
      validBody({ photos: [{ photo: photo(lossyWebp(1200, 900)), thumb: 'bm90LWEtd2VicA==' }] })
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a copy over its byte ceiling', () => {
    const fat = photo(lossyWebp(400, 300, COMMUNITY_PRINT_THUMB_MAX_BYTES + 1_000));
    const result = validateCommunityPrint(
      validBody({ photos: [{ photo: photo(lossyWebp(1200, 900)), thumb: fat }] })
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.message).toContain(String(COMMUNITY_PRINT_THUMB_MAX_BYTES));
  });

  it('rejects a copy hung off a keep entry', () => {
    // The server already holds the copy for a kept photo; accepting a
    // client-supplied one would let a caller point a card at any blob.
    const url = 'https://blob.example/a.webp';
    const result = validateCommunityPrint(
      validBody({ photos: [{ photo: url, thumb: photo(lossyWebp(400, 300)) }] })
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.photos).toEqual([{ kind: 'keep', url }]);
  });

  it('preserves the order of mixed keep and new entries', () => {
    const url = 'https://blob.example/a.webp';
    const base64 = photo(lossyWebp(400, 400));
    const result = validateCommunityPrint(validBody({ photos: [url, base64] }));
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.payload.photos).toEqual([
      { kind: 'keep', url },
      { kind: 'new', base64, thumbBase64: null },
    ]);
  });

  it('rejects a photo over the pixel cap even when its bytes are small', () => {
    const result = validateCommunityPrint(validBody({ photos: [photo(lossyWebp(1201, 800))] }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_PHOTOS');
    expect(result.error.message).toContain('longest edge');
  });

  it('rejects a photo over the byte cap', () => {
    const oversize = lossyWebp(800, 600, COMMUNITY_PRINT_PHOTO_MAX_BYTES + 1);
    const result = validateCommunityPrint(validBody({ photos: [photo(oversize)] }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_PHOTOS');
    expect(result.error.message).toContain('decoded bytes');
  });

  it('rejects a non-WebP payload', () => {
    const result = validateCommunityPrint(
      validBody({ photos: [Buffer.from('not an image at all, just text').toString('base64')] })
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_PHOTOS');
  });

  it('rejects more photos than the cap allows', () => {
    const photos = Array.from({ length: COMMUNITY_PRINT_MAX_PHOTOS + 1 }, () =>
      photo(lossyWebp(200, 200))
    );
    const result = validateCommunityPrint(validBody({ photos }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.message).toContain(`at most ${COMMUNITY_PRINT_MAX_PHOTOS}`);
  });

  it('rejects a non-array photos field', () => {
    const result = validateCommunityPrint(validBody({ photos: 'one-photo' }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error.code).toBe('INVALID_PHOTOS');
  });
});

describe('hasPrintSubstance', () => {
  it('is false for a verdict with no photo and no note', () => {
    expect(hasPrintSubstance(0, '')).toBe(false);
  });

  it('treats a whitespace-only note as no note', () => {
    expect(hasPrintSubstance(0, '   ')).toBe(false);
  });

  it('is true for a photo alone', () => {
    expect(hasPrintSubstance(1, '')).toBe(true);
  });

  it('is true for a note alone', () => {
    expect(hasPrintSubstance(0, 'Printed fine.')).toBe(true);
  });
});
