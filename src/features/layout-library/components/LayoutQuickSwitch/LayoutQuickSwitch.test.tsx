// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as Storage from '@/core/storage';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import type * as SharedHooks from '@/shared/hooks';

const switchLayout = vi.fn().mockResolvedValue({ ok: true, value: undefined });
const createNewLayout = vi.fn().mockResolvedValue({ ok: true, value: undefined });

// Mutable so a single test can simulate shared-preview mode (active layout not
// in the library).
let mockActiveId = 'l1';
const mockCurrentLayout = { name: 'Shared Layout' };

const entries = [
  { id: 'l1', name: 'Kitchen Drawer', preview: {} },
  { id: 'l2', name: 'Garage Bench', preview: {} },
];
const folders: Array<{
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  modifiedAt: number;
}> = [];

vi.mock('@/shared/hooks', async (orig) => ({
  ...(await orig<typeof SharedHooks>()),
  useLayoutSwitcher: () => ({
    activeLayoutId: mockActiveId,
    library: { entries, folders },
    switchLayout,
    createNewLayout,
  }),
}));

vi.mock('@/core/store', () => ({
  useLayoutStore: (selector: (s: { layout: typeof mockCurrentLayout }) => unknown) =>
    selector({ layout: mockCurrentLayout }),
}));

vi.mock('@/core/storage', async (orig) => ({
  ...(await orig<typeof Storage>()),
  computePreview: () => ({}),
}));

vi.mock('@/shell/LayoutThumbnail', () => ({
  LayoutThumbnail: () => <div data-testid="thumb" />,
}));

import { LayoutQuickSwitch } from './LayoutQuickSwitch';

beforeEach(() => {
  vi.clearAllMocks();
  mockActiveId = 'l1';
});

describe('LayoutQuickSwitch', () => {
  it('renders a trigger labelled with the active layout', () => {
    render(<LayoutQuickSwitch onManage={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Kitchen Drawer/i })).toBeInTheDocument();
  });

  it('opens the dropdown and lists every layout', () => {
    render(<LayoutQuickSwitch onManage={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /switch layout/i }));
    expect(screen.getByRole('menuitem', { name: /Kitchen Drawer/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Garage Bench/i })).toBeInTheDocument();
  });

  // Wiring guard: the menu role advertises arrow traversal, so the shared
  // keyboard hook must stay attached.
  it('focuses the first item on open and traverses with the arrow keys', async () => {
    render(<LayoutQuickSwitch onManage={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /switch layout/i }));

    const items = screen.getAllByRole('menuitem');
    await waitFor(() => expect(items[0]).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
  });

  it('groups filed layouts under their folder path, unfiled first', () => {
    entries.push({ id: 'l3', name: 'Top drawer', preview: {}, folderId: 'folder_2_desk' } as never);
    folders.push(
      { id: 'folder_1_study', name: 'Study', parentId: null, createdAt: 1, modifiedAt: 1 },
      { id: 'folder_2_desk', name: 'Desk', parentId: 'folder_1_study', createdAt: 1, modifiedAt: 1 }
    );
    render(<LayoutQuickSwitch onManage={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Switch layout/ }));
    const group = screen.getByRole('group', { name: 'Study / Desk' });
    expect(within(group).getByRole('menuitem', { name: /Top drawer/ })).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(items.indexOf('Kitchen Drawer')).toBeLessThan(
      items.findIndex((t) => t?.includes('Top drawer'))
    );
    entries.pop();
    folders.length = 0;
  });

  it('switches to a different layout on click', () => {
    render(<LayoutQuickSwitch onManage={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /switch layout/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Garage Bench/i }));
    expect(switchLayout).toHaveBeenCalledWith('l2');
  });

  it('does not switch when the active layout is clicked', () => {
    render(<LayoutQuickSwitch onManage={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /switch layout/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Kitchen Drawer/i }));
    expect(switchLayout).not.toHaveBeenCalled();
  });

  it('creates a new layout', () => {
    render(<LayoutQuickSwitch onManage={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /switch layout/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /new layout/i }));
    expect(createNewLayout).toHaveBeenCalled();
  });

  it('labels the trigger from the live layout store when the active layout is not in the library (shared preview)', () => {
    mockActiveId = '__shared_preview__';
    render(<LayoutQuickSwitch onManage={vi.fn()} />);
    // Falls back to the store layout name, not entries[0] ("Kitchen Drawer").
    expect(screen.getByRole('button', { name: /Shared Layout/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /switch layout.*Kitchen Drawer/i })).toBeNull();
  });

  it('opens management via onManage', () => {
    const onManage = vi.fn();
    render(<LayoutQuickSwitch onManage={onManage} />);
    fireEvent.click(screen.getByRole('button', { name: /switch layout/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /manage layouts/i }));
    expect(onManage).toHaveBeenCalled();
  });
});
