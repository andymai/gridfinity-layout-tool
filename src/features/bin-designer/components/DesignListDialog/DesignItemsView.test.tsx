// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { designId } from '@/core/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { SavedDesign } from '@/features/bin-designer/types';
import { DesignItemsView } from './DesignItemsView';

const designs: SavedDesign[] = [
  {
    id: designId('design-1'),
    name: 'Tool Holder',
    params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2 },
    thumbnail: null,
    exportFileNameConfig: null,
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-22T12:00:00.000Z',
  },
  {
    id: designId('design-2'),
    name: 'Screw Bin',
    params: { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 6 },
    thumbnail: null,
    exportFileNameConfig: null,
    createdAt: '2026-01-19T08:00:00.000Z',
    updatedAt: '2026-01-21T15:00:00.000Z',
  },
];

function baseProps() {
  return {
    rows: designs.map((design) => ({ design, depth: 0 as const, childCount: 0 })),
    expandedIds: new Set<string>(),
    onToggleExpand: vi.fn(),
    currentDesignId: 'design-1' as string | null,
    focusedIndex: 0,
    selectionActive: false,
    isSelected: () => false,
    onLoad: vi.fn(),
    onPlaceInLayout: vi.fn(),
    onDownloadJSON: vi.fn(),
    onRename: vi.fn(),
    onEditTags: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onFocus: vi.fn(),
    onToggleSelect: vi.fn(),
    registerItemRef: vi.fn(),
  };
}

describe('DesignItemsView', () => {
  it('renders every design in grid variant', () => {
    render(
      <div>
        <DesignItemsView variant="grid" {...baseProps()} />
      </div>
    );
    expect(screen.getByText('Tool Holder')).toBeInTheDocument();
    expect(screen.getByText('Screw Bin')).toBeInTheDocument();
  });

  it('renders list items inside a list wrapper', () => {
    const { container } = render(
      <ul>
        <DesignItemsView variant="list" {...baseProps()} />
      </ul>
    );
    expect(container.querySelectorAll('li').length).toBe(designs.length);
  });

  it('calls onLoad with the clicked design', () => {
    const props = baseProps();
    render(
      <div>
        <DesignItemsView variant="grid" {...props} />
      </div>
    );
    fireEvent.click(screen.getByText('Screw Bin'));
    expect(props.onLoad).toHaveBeenCalledWith(designs[1]);
  });

  it('wires Place in layout for a bin design', async () => {
    const props = baseProps();
    render(
      <div>
        <DesignItemsView
          variant="grid"
          {...props}
          rows={[{ design: designs[1], depth: 0, childCount: 0 }]}
        />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /place in layout/i }));
    expect(props.onPlaceInLayout).toHaveBeenCalledWith(designs[1]);
  });

  it('omits Place in layout for a non-placeable kind', async () => {
    const toolRack: SavedDesign = {
      id: designId('design-3'),
      name: 'Wrench Rack',
      kind: 'toolRack',
      thumbnail: null,
      exportFileNameConfig: null,
      createdAt: '2026-01-20T10:00:00.000Z',
      updatedAt: '2026-01-22T12:00:00.000Z',
    };
    render(
      <div>
        <DesignItemsView
          variant="grid"
          {...baseProps()}
          rows={[{ design: toolRack, depth: 0, childCount: 0 }]}
        />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /more actions/i }));
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: /place in layout/i })).not.toBeInTheDocument();
  });

  it('registers a DOM ref for each rendered item', () => {
    const props = baseProps();
    render(
      <div>
        <DesignItemsView variant="grid" {...props} />
      </div>
    );
    const registeredIds = props.registerItemRef.mock.calls
      .filter(([, el]) => el !== null)
      .map(([id]) => id);
    expect(registeredIds).toEqual(expect.arrayContaining(['design-1', 'design-2']));
  });
});
