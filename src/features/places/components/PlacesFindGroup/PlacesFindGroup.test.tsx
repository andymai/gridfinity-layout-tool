import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Command } from 'cmdk';
import { useLayoutStore, useLibraryStore, useSelectionStore } from '@/core/store';
import type { Layout, LayoutEntry } from '@/core/types';
import { binId, gridUnits, layoutId } from '@/core/types';
import { commandPaletteFilter } from '@/shared/utils/commandPaletteFilter';
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
import { PlacesFindGroup } from './PlacesFindGroup';

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

function renderGroup(query: string, onDone = vi.fn()) {
  return render(
    <Command filter={commandPaletteFilter}>
      <Command.Input value={query} onValueChange={() => {}} />
      <Command.List>
        <Command.Empty>No results</Command.Empty>
        <PlacesFindGroup query={query} onDone={onDone} />
      </Command.List>
    </Command>
  );
}

describe('PlacesFindGroup', () => {
  beforeAll(() => {
    // cmdk scrolls the first registered item into view, which jsdom lacks.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    resetAllStores();
    __resetForTests();
    seed();
  });

  it('lists the bins that match, with the layout and layer they sit on', async () => {
    renderGroup('m3');
    expect(await screen.findByText('M3 screws')).toBeInTheDocument();
    expect(screen.getByText(/Kitchen drawer ›/)).toBeInTheDocument();
    expect(screen.queryByText('Spoons')).not.toBeInTheDocument();
  });

  it('keeps its results as the query grows past the first letter', async () => {
    const { rerender } = renderGroup('m');
    expect(await screen.findByText('M3 screws')).toBeInTheDocument();
    rerender(
      <Command filter={commandPaletteFilter}>
        <Command.Input value="m3" onValueChange={() => {}} />
        <Command.List>
          <Command.Empty>No results</Command.Empty>
          <PlacesFindGroup query="m3" onDone={vi.fn()} />
        </Command.List>
      </Command>
    );
    expect(await screen.findByText('M3 screws')).toBeInTheDocument();
    expect(document.querySelector('[cmdk-empty]')).toBeNull();
  });

  it('holds off "No results" until the stored layouts have been searched', async () => {
    let release: (layout: Layout | null) => void = () => {};
    loadLayoutAsync.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const { library } = useLibraryStore.getState();
    const stored = { ...library.entries[0], id: layoutId('garage'), name: 'Garage' };
    useLibraryStore.setState({ library: { ...library, entries: [...library.entries, stored] } });

    renderGroup('anchors');
    expect(await screen.findByText('Searching your layouts…')).toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();

    release(null);
    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.queryByText('Searching your layouts…')).not.toBeInTheDocument();
  });

  it('renders nothing for an empty query', () => {
    const { container } = renderGroup('  ');
    expect(container.querySelector('[cmdk-group]')).toBeNull();
  });

  it('closes the palette and selects the bin when a result is chosen', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const onDone = vi.fn();
    renderGroup('screws', onDone);
    fireEvent.click(await screen.findByText('M3 screws'));
    expect(onDone).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(useSelectionStore.getState().selectedBinIds).toEqual(['b1']));
  });
});
