import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok } from '@/core/result';
import { designId } from '@/core/types';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import { THUMBNAIL_VERSION } from '../types';
import type { SavedDesign } from '../types';
import { regenerateThumbnail } from '../utils/thumbnailRegenerator';
import { updateDesignThumbnail } from '../storage/DesignerStorage';
import { upsertRegistryEntry } from '../store/customBinRegistry';
import type * as CustomBinRegistry from '../store/customBinRegistry';
import { useThumbnailRegeneration } from './useThumbnailRegeneration';

vi.mock('../utils/thumbnailRegenerator', () => ({ regenerateThumbnail: vi.fn() }));
vi.mock('../storage/DesignerStorage', () => ({ updateDesignThumbnail: vi.fn() }));
vi.mock('./useDesignThumbnail', () => ({ updateThumbnailCache: vi.fn() }));
vi.mock('../store/customBinRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof CustomBinRegistry>();
  return { ...actual, upsertRegistryEntry: vi.fn() };
});

const listed: SavedDesign = {
  id: designId('d1'),
  name: 'Pens',
  params: { ...DEFAULT_BIN_PARAMS },
  thumbnail: null,
  exportFileNameConfig: null,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
};

describe('useThumbnailRegeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(regenerateThumbnail).mockResolvedValue('data:image/webp;base64,FAKE');
  });

  // A save or sync pull can land while the thumbnail renders; the write keeps
  // its params, so the registry must too.
  it('registers the design the thumbnail write returns, not the params listed before it', async () => {
    const slant = { angleDeg: 40, side: 'back' as const, endSupport: true };
    vi.mocked(updateDesignThumbnail).mockResolvedValue(
      ok({
        ...listed,
        params: { ...DEFAULT_BIN_PARAMS, width: 3, slant },
        thumbnail: 'data:image/webp;base64,FAKE',
        thumbnailVersion: THUMBNAIL_VERSION,
        updatedAt: '2026-10-19T00:00:00.000Z',
      })
    );
    const onUpdated = vi.fn();

    renderHook(() => useThumbnailRegeneration([listed], onUpdated));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith('d1', 'data:image/webp;base64,FAKE');
    });
    expect(upsertRegistryEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', width: 3, slant: { config: slant } })
    );
  });
});
