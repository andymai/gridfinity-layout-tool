// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('@/shared/hooks', async (orig) => ({
  ...(await orig<typeof SharedHooks>()),
  useLayoutSwitcher: () => ({
    activeLayoutId: mockActiveId,
    library: { entries },
    switchLayout,
    createNewLayout,
  }),
}));

vi.mock('@/core/store', () => ({
  useLayoutStore: (selector: (s: { layout: typeof mockCurrentLayout }) => unknown) =>
    selector({ layout: mockCurrentLayout }),
}));

vi.mock('@/core/storage', () => ({ computePreview: () => ({}) }));

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
