import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useLayoutStore, useLibraryStore, useSelectionStore } from '@/core/store';
import type { Layout, LayoutEntry } from '@/core/types';
import { binId, gridUnits, layoutId } from '@/core/types';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import type * as SharedHooks from '@/shared/hooks';
import type * as Storage from '@/core/storage';

vi.mock('@/shared/hooks', async (orig) => ({
  ...(await orig<typeof SharedHooks>()),
  useLayoutSwitcher: () => ({ switchLayout: vi.fn() }),
}));

const loadLayoutAsync = vi.fn((_id: string): Promise<Layout | null> => Promise.resolve(null));
vi.mock('@/core/storage', async (orig) => ({
  ...(await orig<typeof Storage>()),
  loadLayoutAsync: (id: string) => loadLayoutAsync(id),
}));

import { __resetForTests } from '../../find/findIndex';
import { PlacesFindList } from './PlacesFindList';

const ACTIVE = layoutId('kitchen');

function seed(): void {
  const layout = createTestLayout({ name: 'Kitchen drawer' });
  layout.bins = [
    createTestBin({ id: binId('b1'), layerId: layout.layers[0].id, label: 'M3 screws' }),
    createTestBin({
      id: binId('b2'),
      layerId: layout.layers[0].id,
      label: 'Spoons',
      x: gridUnits(2),
    }),
  ];
  useLayoutStore.setState({ activeLayoutId: ACTIVE, layout });
  useLibraryStore.setState({
    library: {
      version: '1.0',
      activeLayoutId: ACTIVE,
      settings: {},
      entries: [
        {
          id: ACTIVE,
          name: 'Kitchen drawer',
          modifiedAt: 1,
          createdAt: 1,
        } as unknown as LayoutEntry,
      ],
    },
  });
}

describe('PlacesFindList', () => {
  beforeEach(() => {
    resetAllStores();
    __resetForTests();
    loadLayoutAsync.mockClear();
    seed();
  });

  it('lists the bins that match, with where they sit', async () => {
    render(<PlacesFindList query="m3" onDone={vi.fn()} />);
    expect(await screen.findByText('M3 screws')).toBeInTheDocument();
    expect(screen.getByText(/Kitchen drawer ›/)).toBeInTheDocument();
    expect(screen.queryByText('Spoons')).not.toBeInTheDocument();
  });

  it('says so when nothing matches, once the stored layouts are searched', async () => {
    let release: (layout: Layout | null) => void = () => {};
    loadLayoutAsync.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { library } = useLibraryStore.getState();
    const stored = { ...library.entries[0], id: layoutId('garage'), name: 'Garage' };
    useLibraryStore.setState({ library: { ...library, entries: [...library.entries, stored] } });

    render(<PlacesFindList query="anchors" onDone={vi.fn()} />);
    expect(await screen.findByText('Searching your layouts…')).toBeInTheDocument();
    release(null);
    expect(await screen.findByText('No bins match “anchors”')).toBeInTheDocument();
  });

  it('renders nothing for an empty query', () => {
    const { container } = render(<PlacesFindList query="  " onDone={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('closes the sheet, then selects the bin', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const onDone = vi.fn();
    render(<PlacesFindList query="screws" onDone={onDone} />);
    fireEvent.click(await screen.findByText('M3 screws'));
    expect(onDone).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(useSelectionStore.getState().selectedBinIds).toEqual(['b1']));
  });
});
