import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from 'ioredis';
import {
  communityPrintPhotoBlobPath,
  countCommunityPrints,
  deleteCommunityPrint,
  listCommunityPrinterIds,
  readCommunityPrint,
  readCommunityPrints,
  summarizeCommunityPrints,
  syncCommunityPrintCount,
  writeCommunityPrint,
  type CommunityPrintRecord,
} from './communityPrintStore.js';

const DESIGN_ID = 'abc123def456';
const AUTHOR = 'a'.repeat(32);

interface PipelineCall {
  command: string;
  args: unknown[];
}

function createPipeline(execResults: Array<[Error | null, unknown]> = []) {
  const calls: PipelineCall[] = [];
  const pipeline = {
    calls,
    hgetall(key: string) {
      calls.push({ command: 'hgetall', args: [key] });
      return pipeline;
    },
    hset(key: string, value: unknown) {
      calls.push({ command: 'hset', args: [key, value] });
      return pipeline;
    },
    zadd(...args: unknown[]) {
      calls.push({ command: 'zadd', args });
      return pipeline;
    },
    zrem(key: string, member: string) {
      calls.push({ command: 'zrem', args: [key, member] });
      return pipeline;
    },
    del(key: string) {
      calls.push({ command: 'del', args: [key] });
      return pipeline;
    },
    srem(key: string, member: string) {
      calls.push({ command: 'srem', args: [key, member] });
      return pipeline;
    },
    exec: vi.fn(async () => execResults),
  };
  return pipeline;
}

function createRedis(pipeline: ReturnType<typeof createPipeline>) {
  const hset = vi.fn(async () => 1);
  const hgetall = vi.fn(async (): Promise<Record<string, string>> => ({}));
  const zcard = vi.fn(async () => 0);
  const zrevrange = vi.fn(async () => [] as string[]);
  const redis = { hset, hgetall, zcard, zrevrange, pipeline: vi.fn(() => pipeline) };
  return { redis: redis as unknown as Redis, hset, hgetall, zcard, zrevrange };
}

function print(overrides: Partial<CommunityPrintRecord> = {}): CommunityPrintRecord {
  return {
    designId: DESIGN_ID,
    authorPublicId: AUTHOR,
    authorName: 'Casey',
    photos: [],
    photoThumbs: [],
    material: 'pla',
    nozzleMm: 0.4,
    layerHeightMm: 0.2,
    printMinutes: 120,
    filamentGrams: null,
    printer: 'bambu-p1s',
    printerOther: '',
    fitVerdict: 'as-designed',
    note: '',
    rev: 1,
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TOKEN_SALT', 'test-salt');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('communityPrintPhotoBlobPath', () => {
  it('builds a salted, revision-stamped path', () => {
    expect(communityPrintPhotoBlobPath(DESIGN_ID, AUTHOR, 2, 1)).toMatch(
      new RegExp(`^community/prints/${DESIGN_ID}-${AUTHOR}-[a-f0-9]{16}-2-1\\.webp$`)
    );
  });

  it('gives a different secret per design so one path never reveals another', () => {
    const a = communityPrintPhotoBlobPath(DESIGN_ID, AUTHOR, 1, 0);
    const b = communityPrintPhotoBlobPath('zzz999yyy888', AUTHOR, 1, 0);
    expect(a.split('-')[2]).not.toBe(b.split('-')[2]);
  });

  it('refuses to derive a path without TOKEN_SALT', () => {
    vi.stubEnv('TOKEN_SALT', '');
    expect(() => communityPrintPhotoBlobPath(DESIGN_ID, AUTHOR, 1, 0)).toThrow('TOKEN_SALT');
  });
});

describe('writeCommunityPrint', () => {
  it('serializes every field onto the print hash', async () => {
    const { redis, hset } = createRedis(createPipeline());

    await writeCommunityPrint(
      redis,
      print({ photos: ['https://blob.example/p0.webp'], filamentGrams: 18.5, note: 'snug' })
    );

    expect(hset).toHaveBeenCalledWith(
      `community:print:${DESIGN_ID}:${AUTHOR}`,
      expect.objectContaining({
        designId: DESIGN_ID,
        authorPublicId: AUTHOR,
        photos: '["https://blob.example/p0.webp"]',
        material: 'pla',
        filamentGrams: '18.5',
        note: 'snug',
        status: 'live',
      })
    );
  });

  it('writes an absent filament reading as empty, not "null"', async () => {
    const { redis, hset } = createRedis(createPipeline());

    await writeCommunityPrint(redis, print({ filamentGrams: null }));

    expect(hset).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ filamentGrams: '' })
    );
  });
});

describe('readCommunityPrint', () => {
  it('round-trips a written record', async () => {
    const { redis, hgetall } = createRedis(createPipeline());
    hgetall.mockResolvedValue({
      designId: DESIGN_ID,
      authorPublicId: AUTHOR,
      authorName: 'Casey',
      photos: '["https://blob.example/p0.webp"]',
      material: 'petg',
      nozzleMm: '0.6',
      layerHeightMm: '0.28',
      printMinutes: '95',
      filamentGrams: '22',
      printer: 'other',
      printerOther: 'Toolchanger',
      fitVerdict: 'adjusted',
      note: 'scaled 2%',
      rev: '3',
      createdAt: '1000',
      updatedAt: '2000',
      status: 'live',
    });

    expect(await readCommunityPrint(redis, DESIGN_ID, AUTHOR)).toEqual(
      print({
        photos: ['https://blob.example/p0.webp'],
        // Normalised to the photo count on read: a record written before the
        // field still satisfies the same-length invariant, so a reader can
        // index one array from the other without checking.
        photoThumbs: [''],
        material: 'petg',
        nozzleMm: 0.6,
        layerHeightMm: 0.28,
        printMinutes: 95,
        filamentGrams: 22,
        printer: 'other',
        printerOther: 'Toolchanger',
        fitVerdict: 'adjusted',
        note: 'scaled 2%',
        rev: 3,
        updatedAt: 2000,
      })
    );
  });

  // The hash stores everything as a string and `Number('')` is 0, so an
  // unreported measurement would come back as a measured zero and join the
  // modes and medians.
  it('reads every unreported setting back as absent, not zero', async () => {
    const { redis, hgetall } = createRedis(createPipeline());
    hgetall.mockResolvedValue({
      designId: DESIGN_ID,
      authorPublicId: AUTHOR,
      authorName: 'Casey',
      photos: '["https://blob.example/p0.webp"]',
      material: '',
      nozzleMm: '',
      layerHeightMm: '',
      printMinutes: '',
      filamentGrams: '',
      printer: '',
      printerOther: '',
      fitVerdict: 'as-designed',
      note: 'snug',
      rev: '1',
      createdAt: '1000',
      updatedAt: '1000',
      status: 'live',
    });

    expect(await readCommunityPrint(redis, DESIGN_ID, AUTHOR)).toMatchObject({
      material: null,
      nozzleMm: null,
      layerHeightMm: null,
      printMinutes: null,
      filamentGrams: null,
      printer: null,
    });
  });

  it('still rejects a material that is present but unrecognised', async () => {
    const { redis, hgetall } = createRedis(createPipeline());
    hgetall.mockResolvedValue({
      designId: DESIGN_ID,
      authorPublicId: AUTHOR,
      material: 'unobtanium',
      fitVerdict: 'as-designed',
      status: 'live',
    });

    // Malformed rather than defaultable: coercing it would feed a fabricated
    // value into the aggregate. '' is the separate case of "did not say".
    expect(await readCommunityPrint(redis, DESIGN_ID, AUTHOR)).toBeNull();
  });

  it('returns null for a missing hash', async () => {
    const { redis } = createRedis(createPipeline());
    expect(await readCommunityPrint(redis, DESIGN_ID, AUTHOR)).toBeNull();
  });

  it('reads an empty filament field back as null rather than 0', async () => {
    const { redis, hgetall } = createRedis(createPipeline());
    hgetall.mockResolvedValue({
      designId: DESIGN_ID,
      authorPublicId: AUTHOR,
      material: 'pla',
      fitVerdict: 'as-designed',
      filamentGrams: '',
      status: 'live',
    });

    const record = await readCommunityPrint(redis, DESIGN_ID, AUTHOR);
    expect(record?.filamentGrams).toBeNull();
  });

  it.each([
    ['material', { material: 'resin' }],
    ['fitVerdict', { fitVerdict: 'great' }],
    ['status', { status: 'weird' }],
  ])('rejects a record whose %s no longer parses', async (_field, override) => {
    const { redis, hgetall } = createRedis(createPipeline());
    hgetall.mockResolvedValue({
      designId: DESIGN_ID,
      authorPublicId: AUTHOR,
      material: 'pla',
      fitVerdict: 'as-designed',
      status: 'live',
      ...override,
    });

    // Coercing to a default would feed a fabricated value into the summary.
    expect(await readCommunityPrint(redis, DESIGN_ID, AUTHOR)).toBeNull();
  });
});

describe('readCommunityPrints', () => {
  it('preserves position when one record is missing', async () => {
    const pipeline = createPipeline([
      [
        null,
        {
          designId: DESIGN_ID,
          authorPublicId: AUTHOR,
          material: 'pla',
          fitVerdict: 'as-designed',
          status: 'live',
        },
      ],
      [null, {}],
    ]);
    const { redis } = createRedis(pipeline);

    const records = await readCommunityPrints(redis, DESIGN_ID, [AUTHOR, 'b'.repeat(32)]);

    expect(records).toHaveLength(2);
    expect(records[0]?.authorPublicId).toBe(AUTHOR);
    expect(records[1]).toBeNull();
  });

  it('short-circuits on an empty id list', async () => {
    const pipeline = createPipeline();
    const { redis } = createRedis(pipeline);

    expect(await readCommunityPrints(redis, DESIGN_ID, [])).toEqual([]);
    expect(pipeline.exec).not.toHaveBeenCalled();
  });

  it('throws when the pipeline loses the connection', async () => {
    const pipeline = createPipeline();
    pipeline.exec.mockResolvedValue(null as unknown as Array<[Error | null, unknown]>);
    const { redis } = createRedis(pipeline);

    await expect(readCommunityPrints(redis, DESIGN_ID, [AUTHOR])).rejects.toThrow(
      'redis connection lost'
    );
  });
});

describe('listCommunityPrinterIds', () => {
  it('pages newest-first from the per-design zset', async () => {
    const { redis, zrevrange } = createRedis(createPipeline());

    await listCommunityPrinterIds(redis, DESIGN_ID, 24, 24);

    expect(zrevrange).toHaveBeenCalledWith(`community:prints:${DESIGN_ID}`, 24, 47);
  });
});

describe('syncCommunityPrintCount', () => {
  it('recomputes from ZCARD and mirrors onto the card hash and index', async () => {
    const pipeline = createPipeline();
    const { redis, zcard } = createRedis(pipeline);
    zcard.mockResolvedValue(7);

    expect(await syncCommunityPrintCount(redis, DESIGN_ID)).toBe(7);
    expect(pipeline.calls).toEqual([
      { command: 'hset', args: [`community:design:${DESIGN_ID}`, { prints: '7' }] },
      // XX so a print can never re-add a moderated design to the gallery index.
      { command: 'zadd', args: ['community:index:prints', 'XX', 7, DESIGN_ID] },
    ]);
  });

  it('throws when an index command reports an error', async () => {
    const pipeline = createPipeline([
      [null, 1],
      [new Error('WRONGTYPE'), null],
    ]);
    const { redis } = createRedis(pipeline);

    await expect(syncCommunityPrintCount(redis, DESIGN_ID)).rejects.toThrow('WRONGTYPE');
  });
});

describe('deleteCommunityPrint', () => {
  it('drops the hash, the zset membership, and the reverse index together', async () => {
    const pipeline = createPipeline();
    const { redis } = createRedis(pipeline);

    await deleteCommunityPrint(redis, DESIGN_ID, AUTHOR, 'user-1');

    expect(pipeline.calls).toEqual([
      { command: 'del', args: [`community:print:${DESIGN_ID}:${AUTHOR}`] },
      { command: 'zrem', args: [`community:prints:${DESIGN_ID}`, AUTHOR] },
      { command: 'srem', args: ['community:printed:user-1', DESIGN_ID] },
    ]);
  });
});

describe('countCommunityPrints', () => {
  it('reads the distinct-printer cardinality', async () => {
    const { redis, zcard } = createRedis(createPipeline());
    zcard.mockResolvedValue(3);

    expect(await countCommunityPrints(redis, DESIGN_ID)).toBe(3);
    expect(zcard).toHaveBeenCalledWith(`community:prints:${DESIGN_ID}`);
  });
});

describe('summarizeCommunityPrints', () => {
  it('reports zeros and nulls for an empty set', () => {
    expect(summarizeCommunityPrints([])).toEqual({
      count: 0,
      asDesigned: 0,
      adjusted: 0,
      didNotFit: 0,
      commonMaterial: null,
      commonLayerHeightMm: null,
      medianPrintMinutes: null,
      medianFilamentGrams: null,
    });
  });

  it('tallies each fit verdict separately', () => {
    const summary = summarizeCommunityPrints([
      print({ fitVerdict: 'as-designed' }),
      print({ fitVerdict: 'as-designed' }),
      print({ fitVerdict: 'adjusted' }),
      print({ fitVerdict: 'did-not-fit' }),
    ]);

    expect(summary).toMatchObject({ count: 4, asDesigned: 2, adjusted: 1, didNotFit: 1 });
  });

  it('excludes non-live prints from every figure', () => {
    const summary = summarizeCommunityPrints([
      print({ material: 'pla', status: 'live' }),
      print({ material: 'abs', status: 'hidden' }),
      print({ material: 'abs', status: 'removed' }),
    ]);

    expect(summary.count).toBe(1);
    expect(summary.commonMaterial).toBe('pla');
  });

  it('reports the modal material and layer height, not the mean', () => {
    const summary = summarizeCommunityPrints([
      print({ material: 'petg', layerHeightMm: 0.2 }),
      print({ material: 'petg', layerHeightMm: 0.2 }),
      print({ material: 'pla', layerHeightMm: 0.28 }),
    ]);

    expect(summary.commonMaterial).toBe('petg');
    expect(summary.commonLayerHeightMm).toBe(0.2);
  });

  it('resists a single outlier dragging the print time', () => {
    const summary = summarizeCommunityPrints([
      print({ printMinutes: 118 }),
      print({ printMinutes: 124 }),
      print({ printMinutes: 130 }),
      // Someone who printed twelve at once: an average would read ~11 hours.
      print({ printMinutes: 2400 }),
    ]);

    expect(summary.medianPrintMinutes).toBe(127);
  });

  it('averages the two middle values for an even sample', () => {
    const summary = summarizeCommunityPrints([
      print({ printMinutes: 100 }),
      print({ printMinutes: 140 }),
    ]);

    expect(summary.medianPrintMinutes).toBe(120);
  });

  // `modeOf` is generic over `T | null`, so an unreported value left in the
  // sample can win its own vote and typecheck while doing it. These guard the
  // filtering that keeps absences out of the ballot.
  describe('unreported settings', () => {
    it('never elects "unreported" as the common material', () => {
      const summary = summarizeCommunityPrints([
        print({ material: null }),
        print({ material: null }),
        print({ material: 'petg' }),
      ]);

      expect(summary.commonMaterial).toBe('petg');
    });

    it('never elects "unreported" as the common layer height', () => {
      const summary = summarizeCommunityPrints([
        print({ layerHeightMm: null }),
        print({ layerHeightMm: null }),
        print({ layerHeightMm: 0.28 }),
      ]);

      expect(summary.commonLayerHeightMm).toBe(0.28);
    });

    it('medians only the print times that were reported', () => {
      const summary = summarizeCommunityPrints([
        print({ printMinutes: null }),
        print({ printMinutes: 100 }),
        print({ printMinutes: 140 }),
      ]);

      // 120, not 100 — a null coerced to 0 would have taken the middle slot.
      expect(summary.medianPrintMinutes).toBe(120);
    });

    it('still counts a print that reported no settings at all', () => {
      const summary = summarizeCommunityPrints([
        print({ material: null, layerHeightMm: null, printMinutes: null, printer: null }),
      ]);

      expect(summary).toMatchObject({
        count: 1,
        asDesigned: 1,
        commonMaterial: null,
        commonLayerHeightMm: null,
        medianPrintMinutes: null,
      });
    });
  });

  it('ignores prints that reported no filament weight', () => {
    const summary = summarizeCommunityPrints([
      print({ filamentGrams: null }),
      print({ filamentGrams: 20 }),
      print({ filamentGrams: 30 }),
      print({ filamentGrams: 40 }),
    ]);

    // Median of the three that reported, not of four with a zero spliced in.
    expect(summary.medianFilamentGrams).toBe(30);
  });

  it('returns null filament when nobody reported one', () => {
    const summary = summarizeCommunityPrints([print({ filamentGrams: null })]);
    expect(summary.medianFilamentGrams).toBeNull();
  });
});
