// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok } from '@/core/result';
import { designId } from '@/core/types';
import type { SlantRowDesignSpec } from '@/shared/utils/slantRowDesign';
import { loadRegistry, upsertRegistryEntry } from '../store/customBinRegistry';
import { saveDesign } from '../storage';
import { ensureSlantRowDesign } from './slantRowDesign';

vi.mock('../storage', () => ({ saveDesign: vi.fn() }));
const mockSave = vi.mocked(saveDesign);

const spec: SlantRowDesignSpec = {
  name: 'Slanted 2×1×6 · 45°',
  width: 2,
  depth: 1,
  height: 6,
  slant: { angleDeg: 45, side: 'back' },
  gridUnitMm: 42,
  heightUnitMm: 7,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
};

const ref = (id: string, overrides: Record<string, unknown> = {}) => ({
  id: designId(id),
  name: id,
  width: 2,
  depth: 1,
  height: 6,
  updatedAt: '2026-10-18T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  mockSave.mockReset();
  mockSave.mockImplementation(async (input) =>
    ok({
      ...input,
      id: designId('new'),
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
    })
  );
});

describe('ensureSlantRowDesign', () => {
  it('reuses a saved design of the row size that leans its way', async () => {
    upsertRegistryEntry(ref('upright'));
    upsertRegistryEntry(ref('steeper', { slant: { config: { angleDeg: 50, side: 'back' } } }));
    upsertRegistryEntry(ref('pens', { slant: { config: { angleDeg: 45, side: 'back' } } }));
    expect(await ensureSlantRowDesign(spec)).toBe('pens');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("skips a design made in other units, which would print off the layout's grid", async () => {
    const back45 = { angleDeg: 45, side: 'back' };
    upsertRegistryEntry(ref('wide', { slant: { config: back45, gridUnitMm: 40 } }));
    upsertRegistryEntry(ref('tall', { slant: { config: back45, heightUnitMm: 6 } }));
    upsertRegistryEntry(ref('deep', { slant: { config: back45, gridUnitMmY: 21 } }));
    expect(await ensureSlantRowDesign(spec)).toBe('new');
    expect(await ensureSlantRowDesign({ ...spec, gridUnitMm: 40 })).toBe('wide');
  });

  it('skips a flat-base design, whose support reaches further than the row planned', async () => {
    upsertRegistryEntry(
      ref('flat', { socketless: true, slant: { config: { angleDeg: 45, side: 'back' } } })
    );
    expect(await ensureSlantRowDesign(spec)).toBe('new');
  });

  it('saves a new slanted design without a lip, and registers its slant at once', async () => {
    upsertRegistryEntry(
      ref('supported', { slant: { config: { angleDeg: 45, side: 'back', endSupport: true } } })
    );
    expect(await ensureSlantRowDesign(spec)).toBe('new');
    const params = mockSave.mock.calls[0][0].params;
    expect(params).toMatchObject({ width: 2, depth: 1, height: 6, slant: spec.slant });
    expect(params?.base.stackingLip).toBe(false);
    expect(loadRegistry().find((r) => r.id === 'new')?.slant).toEqual({ config: spec.slant });
  });

  it('gives up when the design cannot be saved', async () => {
    mockSave.mockResolvedValueOnce({ ok: false, error: new Error('full') } as never);
    expect(await ensureSlantRowDesign(spec)).toBeNull();
  });
});
