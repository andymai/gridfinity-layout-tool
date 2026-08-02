import { describe, it, expect, vi, beforeEach } from 'vitest';

const listDesigns = vi.fn();
vi.mock('@/features/bin-designer/storage/DesignerStorage', () => ({
  listDesigns: () => listDesigns(),
}));

import { findLocalDesignByPublishedId } from './findLocalDesignByPublishedId';

describe('findLocalDesignByPublishedId', () => {
  beforeEach(() => {
    listDesigns.mockReset();
  });

  it('returns the design whose publishedId matches', async () => {
    const match = { id: 'design_2', name: 'B', publishedId: 'Pub123456789' };
    listDesigns.mockResolvedValue({
      ok: true,
      value: [
        { id: 'design_1', name: 'A' },
        match,
        { id: 'design_3', name: 'C', publishedId: null },
      ],
    });
    await expect(findLocalDesignByPublishedId('Pub123456789')).resolves.toEqual(match);
  });

  it('returns null when no design carries the id', async () => {
    listDesigns.mockResolvedValue({ ok: true, value: [{ id: 'design_1', name: 'A' }] });
    await expect(findLocalDesignByPublishedId('Pub123456789')).resolves.toBeNull();
  });

  it('returns null when storage fails', async () => {
    listDesigns.mockResolvedValue({ ok: false, error: { code: 'x', message: 'fail' } });
    await expect(findLocalDesignByPublishedId('Pub123456789')).resolves.toBeNull();
  });
});
