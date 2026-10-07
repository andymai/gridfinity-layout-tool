/**
 * Tests for the cloud share API client.
 * All functions return Result<T, ApiError> for type-safe error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createShare, updateShare, fetchShare, deleteShare, reportShare } from '@/core/api/share';
import { expectOk, expectErr } from '@/test/testUtils';
import { getUserMessage, ok } from '@/core/result';
import type { Layout, DesignId } from '@/core/types';
import { gridUnits, heightUnits, mm, categoryId, layerId, binId, designId } from '@/core/types';
import {
  registerDesignStorePort,
  resetDesignStorePort,
  type DesignStorePort,
  type LoadedDesignData,
} from '@/core/storage/designStorePort';

const mockLayout: Layout = {
  version: '1.0',
  name: 'Test Layout',
  drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
  printBedSize: mm(256),
  gridUnitMm: mm(42),
  heightUnitMm: mm(7),
  categories: [{ id: categoryId('cat1'), name: 'Default', color: '#888888' }],
  layers: [{ id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) }],
  bins: [],
};

describe('createShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns Ok with share data on success', async () => {
    const mockResponse = {
      id: 'abc123xyz789',
      url: 'https://example.com/s/abc123xyz789',
      deleteToken: 'token123',
      permission: 'view',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await createShare('test-layout-id', mockLayout, 'view');

    const value = expectOk(result);
    expect(value.id).toBe('abc123xyz789');
    expect(value.deleteToken).toBe('token123');
  });

  describe('when the layout id is already taken by a share this device cannot manage', () => {
    const postedBody = (init: RequestInit | undefined): { layoutId: string; permission: string } =>
      JSON.parse(init?.body as string) as { layoutId: string; permission: string };

    const conflict = {
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          error: 'A share with this ID already exists.',
          code: 'VALIDATION_ERROR',
        }),
    } as Response;

    const postedIds = (): string[] =>
      vi.mocked(fetch).mock.calls.map(([, init]) => postedBody(init).layoutId);

    it('re-shares under a fresh share id', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(conflict)
        .mockImplementationOnce((_input, init) => {
          const { layoutId, permission } = postedBody(init);
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                id: layoutId,
                url: `/l/${layoutId}`,
                deleteToken: 't',
                permission,
              }),
          } as Response);
        });

      const value = expectOk(await createShare('stranded0001', mockLayout, 'edit'));

      const [first, second] = postedIds();
      expect(first).toBe('stranded0001');
      expect(second).toMatch(/^[a-zA-Z0-9]{12}$/);
      expect(second).not.toBe(first);
      expect(value.id).toBe(second);
      expect(value.deleteToken).toBe('t');
    });

    it('gives up after one fresh id rather than looping', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(conflict).mockResolvedValueOnce(conflict);

      const error = expectErr(await createShare('stranded0001', mockLayout, 'view'));

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(error.code).toBe('API_VALIDATION_ERROR');
    });
  });

  it('returns Err with ApiRateLimitedError on rate limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Too many requests',
          code: 'RATE_LIMITED',
          retryAfter: 3600,
        }),
    } as Response);

    const result = await createShare('test-layout-id', mockLayout, 'view');

    const error = expectErr(result);
    expect(error.code).toBe('API_RATE_LIMITED');
    expect(error.kind).toBe('ApiError');
    if ('retryAfter' in error) {
      expect(error.retryAfter).toBe(3600);
    }
  });

  it('returns Err with ApiNetworkError on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await createShare('test-layout-id', mockLayout, 'view');

    const error = expectErr(result);
    expect(error.code).toBe('API_NETWORK_ERROR');
    expect(error.kind).toBe('ApiError');
  });

  it('returns Err with ApiSizeLimitError on size limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Layout too large',
          code: 'SIZE_LIMIT',
        }),
    } as Response);

    const result = await createShare('test-layout-id', mockLayout, 'view');

    expect(expectErr(result).code).toBe('API_SIZE_LIMIT');
  });

  it('returns Err with ApiBinLimitError on bin limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Too many bins',
          code: 'BIN_LIMIT',
        }),
    } as Response);

    const result = await createShare('test-layout-id', mockLayout, 'view');

    expect(expectErr(result).code).toBe('API_BIN_LIMIT');
  });

  it('provides user-friendly message via getUserMessage', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Layout too large',
          code: 'SIZE_LIMIT',
        }),
    } as Response);

    const result = await createShare('test-layout-id', mockLayout, 'view');

    const error = expectErr(result);
    const message = getUserMessage(error);
    expect(message).toBeTruthy();
    expect(message).toContain('500KB');
  });
});

describe('updateShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns Ok on success', async () => {
    const mockResponse = {
      id: 'abc123xyz789',
      url: 'https://example.com/s/abc123xyz789',
      permission: 'edit',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await updateShare('abc123xyz789', 'token123', mockLayout, 'edit');

    const value = expectOk(result);
    expect(value.id).toBe('abc123xyz789');
  });

  it('returns Err with ApiUnauthorizedError on unauthorized', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Invalid token',
          code: 'UNAUTHORIZED',
        }),
    } as Response);

    const result = await updateShare('abc123xyz789', 'wrong-token', mockLayout, 'edit');

    expect(expectErr(result).code).toBe('API_UNAUTHORIZED');
  });

  it('returns Err with ApiNotFoundError on not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Share not found',
          code: 'NOT_FOUND',
        }),
    } as Response);

    const result = await updateShare('nonexistent', 'token', mockLayout, 'edit');

    expect(expectErr(result).code).toBe('API_NOT_FOUND');
  });
});

describe('linked designs travelling with a share', () => {
  const layoutLinking = (...ids: DesignId[]): Layout => ({
    ...mockLayout,
    bins: ids.map((id, i) => ({
      id: binId(`bin-${i}`),
      layerId: layerId('layer1'),
      x: gridUnits(i * 2),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
      height: heightUnits(3),
      category: categoryId('cat1'),
      label: '',
      notes: '',
      linkedDesignId: id,
    })),
  });

  const assembly: LoadedDesignData = {
    id: designId('design_asm'),
    name: 'Pliers Rack',
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
      parts: [],
    },
  };

  const installDesigns = (designs: readonly LoadedDesignData[]): void => {
    const byId = new Map(designs.map((d) => [d.id, d]));
    const port: DesignStorePort = {
      loadDesign: async (id) => {
        const design = byId.get(id);
        if (!design) throw new Error(`unexpected load of ${id}`);
        return ok(design);
      },
      saveDesign: () => Promise.reject(new Error('unused')),
      upsertRegistryEntry: () => Promise.reject(new Error('unused')),
      registryEdgeFields: async () => ({}),
    };
    registerDesignStorePort(port);
  };

  const postedLinkedDesigns = (): unknown => {
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    return (JSON.parse(init?.body as string) as { linkedDesigns: unknown }).linkedDesigns;
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({ id: 'abc123xyz789', url: '/l/x', deleteToken: 't', permission: 'view' }),
    } as Response);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDesignStorePort();
  });

  it('sends an assembly entry with its kind, envelope and structure', async () => {
    installDesigns([assembly]);

    expectOk(await createShare('abc123xyz789', layoutLinking(assembly.id), 'view'));

    expect(postedLinkedDesigns()).toEqual([
      {
        id: assembly.id,
        name: assembly.name,
        kind: 'assembly',
        envelope: assembly.envelope,
        structure: assembly.structure,
      },
    ]);
  });

  it('sends an assembly entry on update too', async () => {
    installDesigns([assembly]);

    expectOk(await updateShare('abc123xyz789', 't', layoutLinking(assembly.id), 'view'));

    expect(postedLinkedDesigns()).toEqual([expect.objectContaining({ kind: 'assembly' })]);
  });

  it('skips a design over the budget without starving the ones after it', async () => {
    const huge: LoadedDesignData = {
      id: designId('design_huge'),
      name: 'Huge',
      params: { meshAssets: { m: { data: 'x'.repeat(600 * 1024) } } },
    };
    const small: LoadedDesignData = { id: designId('design_small'), name: 'Small', params: {} };
    installDesigns([huge, assembly, small]);

    expectOk(
      await createShare('abc123xyz789', layoutLinking(huge.id, assembly.id, small.id), 'view')
    );

    expect(postedLinkedDesigns()).toEqual([
      expect.objectContaining({ id: assembly.id }),
      expect.objectContaining({ id: small.id }),
    ]);
  });
});

describe('linked designs over the server per-design cap', () => {
  const layoutLinking = (...ids: DesignId[]): Layout => ({
    ...mockLayout,
    bins: ids.map((id, i) => ({
      id: binId(`bin-${i}`),
      layerId: layerId('layer1'),
      x: gridUnits(i * 2),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
      height: heightUnits(3),
      category: categoryId('cat1'),
      label: '',
      notes: '',
      linkedDesignId: id,
    })),
  });

  const installDesigns = (designs: readonly LoadedDesignData[]): void => {
    const byId = new Map(designs.map((d) => [d.id, d]));
    registerDesignStorePort({
      loadDesign: async (id) => {
        const design = byId.get(id);
        if (!design) throw new Error(`unexpected load of ${id}`);
        return ok(design);
      },
      saveDesign: () => Promise.reject(new Error('unused')),
      upsertRegistryEntry: () => Promise.reject(new Error('unused')),
      registryEdgeFields: async () => ({}),
    });
  };

  const postedIds = (): unknown => {
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const body = JSON.parse(init?.body as string) as { linkedDesigns: { id: string }[] };
    return body.linkedDesigns.map((d) => d.id);
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({ id: 'abc123xyz789', url: '/l/x', deleteToken: 't', permission: 'view' }),
    } as Response);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDesignStorePort();
  });

  const small: LoadedDesignData = { id: designId('design_small'), name: 'Small', params: {} };

  it('skips an assembly over 100 KB and keeps the designs after it', async () => {
    const bigAssembly: LoadedDesignData = {
      id: designId('design_big_asm'),
      name: 'Big rack',
      kind: 'assembly',
      envelope: {},
      structure: { kind: 'assembly', outline: 'x'.repeat(110 * 1024) },
    };
    installDesigns([bigAssembly, small]);

    expectOk(await createShare('abc123xyz789', layoutLinking(bigAssembly.id, small.id), 'view'));

    expect(postedIds()).toEqual([small.id]);
  });

  it('skips a bin over 100 KB that carries no meshes', async () => {
    const bigBin: LoadedDesignData = {
      id: designId('design_big_bin'),
      name: 'Big bin',
      params: { notes: 'x'.repeat(110 * 1024) },
    };
    installDesigns([bigBin, small]);

    expectOk(await createShare('abc123xyz789', layoutLinking(bigBin.id, small.id), 'view'));

    expect(postedIds()).toEqual([small.id]);
  });

  it('keeps a bin over 100 KB whose size comes from its meshes', async () => {
    const meshBin: LoadedDesignData = {
      id: designId('design_mesh_bin'),
      name: 'Mesh bin',
      params: { meshAssets: { m: { data: 'x'.repeat(110 * 1024) } } },
    };
    installDesigns([meshBin, small]);

    expectOk(await createShare('abc123xyz789', layoutLinking(meshBin.id, small.id), 'view'));

    expect(postedIds()).toEqual([meshBin.id, small.id]);
  });
});

describe('fetchShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns Ok with layout and metadata on success', async () => {
    const mockResponse = {
      layout: mockLayout,
      metadata: {
        permission: 'view',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastUpdatedAt: '2024-01-02T00:00:00.000Z',
        authorName: 'Test Author',
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await fetchShare('abc123xyz789');

    const value = expectOk(result);
    expect(value.layout.name).toBe('Test Layout');
    expect(value.metadata.authorName).toBe('Test Author');
  });

  it('returns Err with ApiNotFoundError on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Share not found',
          code: 'NOT_FOUND',
        }),
    } as Response);

    const result = await fetchShare('nonexistent');

    expect(expectErr(result).code).toBe('API_NOT_FOUND');
  });

  it('returns Err with ApiExpiredError on expired share', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Share expired',
          code: 'EXPIRED',
        }),
    } as Response);

    const result = await fetchShare('expired123');

    expect(expectErr(result).code).toBe('API_EXPIRED');
  });
});

describe('deleteShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns Ok on successful delete', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Deleted' }),
    } as Response);

    const result = await deleteShare('abc123xyz789', 'token123');

    const value = expectOk(result);
    expect(value.success).toBe(true);
  });

  it('returns Err with ApiUnauthorizedError on invalid token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Invalid token',
          code: 'UNAUTHORIZED',
        }),
    } as Response);

    const result = await deleteShare('abc123xyz789', 'wrong-token');

    expect(expectErr(result).code).toBe('API_UNAUTHORIZED');
  });
});

describe('reportShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns Ok on successful report', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Report submitted' }),
    } as Response);

    const result = await reportShare('abc123xyz789', 'Offensive content');

    const value = expectOk(result);
    expect(value.success).toBe(true);
  });

  it('returns Err with ApiNotFoundError when share not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Share not found',
          code: 'NOT_FOUND',
        }),
    } as Response);

    const result = await reportShare('nonexistent');

    expect(expectErr(result).code).toBe('API_NOT_FOUND');
  });
});

describe('API error mapping', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps CONTENT_BLOCKED to ApiContentBlockedError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Content blocked',
          code: 'CONTENT_BLOCKED',
        }),
    } as Response);

    const result = await createShare('test-layout-id', mockLayout, 'view');

    expect(expectErr(result).code).toBe('API_CONTENT_BLOCKED');
  });

  it('maps INVALID_PERMISSION to ApiValidationError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Invalid permission',
          code: 'INVALID_PERMISSION',
        }),
    } as Response);

    const result = await createShare('test-layout-id', mockLayout, 'invalid' as 'view');

    const error = expectErr(result);
    // INVALID_PERMISSION is mapped to validation error
    expect(error.code).toBe('API_VALIDATION_ERROR');
  });

  it('maps VALIDATION_ERROR to ApiValidationError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Invalid layout structure',
          code: 'VALIDATION_ERROR',
        }),
    } as Response);

    const result = await createShare('test-layout-id', mockLayout, 'view');

    expect(expectErr(result).code).toBe('API_VALIDATION_ERROR');
  });

  it('errors have timestamp for debugging', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Too many requests',
          code: 'RATE_LIMITED',
        }),
    } as Response);

    const beforeTime = Date.now();
    const result = await createShare('test-layout-id', mockLayout, 'view');
    const afterTime = Date.now();

    const error = expectErr(result);
    expect(error.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(error.timestamp).toBeLessThanOrEqual(afterTime);
  });
});
