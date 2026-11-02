import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layout } from '@/core/types';
import { err, ok, storageMeshMissing } from '@/core/result';
import { deliverExport } from '@/shared/exportDestination/deliverExport';
import { exportLayoutJSONWithDesigns } from './ShareService';
import { downloadLayoutAsFile } from './utils';

vi.mock('@/shared/exportDestination/deliverExport', () => ({
  deliverExport: vi.fn(() => Promise.resolve()),
}));
vi.mock('./ShareService', () => ({
  exportLayoutJSONWithDesigns: vi.fn(() => Promise.resolve(ok('{"name":"My Drawer"}'))),
}));

const layout = { name: 'My Drawer' } as Layout;

describe('downloadLayoutAsFile', () => {
  beforeEach(() => {
    vi.mocked(deliverExport).mockClear();
  });

  it('hands the layout JSON to the export destination', async () => {
    await downloadLayoutAsFile(layout);

    expect(deliverExport).toHaveBeenCalledTimes(1);
    const [blob, name] = vi.mocked(deliverExport).mock.calls[0];
    expect(name).toBe('my-drawer.json');
    expect(await blob.text()).toBe('{"name":"My Drawer"}');
  });

  it('keeps a caller-supplied file name', async () => {
    await downloadLayoutAsFile(layout, 'kitchen.json');

    expect(vi.mocked(deliverExport).mock.calls[0][1]).toBe('kitchen.json');
  });

  it('saves nothing and returns the error when a linked mesh is missing', async () => {
    const missing = err(storageMeshMissing('gone'));
    vi.mocked(exportLayoutJSONWithDesigns).mockResolvedValueOnce(missing);

    expect(await downloadLayoutAsFile(layout)).toBe(missing);
    expect(deliverExport).not.toHaveBeenCalled();
  });
});
