// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { prepareRead } from './reads';

const id = 'a1b2c3d4-0000-4000-8000-000000000001';
const layout = {
  version: '1.0',
  name: 'Desk drawer',
  drawer: { width: 4, depth: 3, height: 12 },
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [{ id: 'cat1', name: 'Screws', color: '#f87171' }],
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  bins: [
    {
      id: 'b1',
      layerId: 'layer1',
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      category: 'cat1',
      label: 'M3 screws',
      notes: 'private note',
    },
  ],
};
const library = {
  version: '1.0',
  activeLayoutId: id,
  settings: {},
  entries: [
    {
      id,
      name: 'Desk drawer',
      createdAt: 1,
      modifiedAt: 2,
      preview: { drawerWidth: 4, drawerDepth: 3, drawerHeight: 12, binCount: 1, layerCount: 1 },
    },
  ],
};

describe('a read in the docs', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('gridfinity-library-v1', JSON.stringify(library));
    localStorage.setItem(`gridfinity-layout-${id}`, JSON.stringify(layout));
  });

  it('reads the open layout and shows what Allow would send, without its notes', async () => {
    const call = await prepareRead({ id: 'c', name: 'read_my_layout', input: {} });
    expect(call).toMatchObject({ title: 'Your layout “Desk drawer”', unavailable: false });
    expect(call.preview).toContain('"M3 screws"');
    expect(JSON.stringify(call.data)).not.toContain('private note');
  });

  it('marks a read that it cannot run as unavailable', async () => {
    expect((await prepareRead({ id: 'c', name: 'delete_everything', input: {} })).unavailable).toBe(
      true
    );
    expect(
      (await prepareRead({ id: 'c', name: 'read_my_layout', input: { x: 1 } })).unavailable
    ).toBe(true);
  });
});
