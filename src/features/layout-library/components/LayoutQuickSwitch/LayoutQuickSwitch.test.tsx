// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type * as SharedHooks from '@/shared/hooks';

const switchLayout = vi.fn().mockResolvedValue({ ok: true, value: undefined });
const createNewLayout = vi.fn().mockResolvedValue({ ok: true, value: undefined });

const entries = [
  { id: 'l1', name: 'Kitchen Drawer', preview: {} },
  { id: 'l2', name: 'Garage Bench', preview: {} },
];

vi.mock('@/shared/hooks', async (orig) => ({
  ...(await orig<typeof SharedHooks>()),
  useLayoutSwitcher: () => ({
    activeLayoutId: 'l1',
    library: { entries },
    switchLayout,
    createNewLayout,
  }),
}));

vi.mock('@/shell/LayoutThumbnail', () => ({
  LayoutThumbnail: () => <div data-testid="thumb" />,
}));

import { LayoutQuickSwitch } from './LayoutQuickSwitch';

beforeEach(() => vi.clearAllMocks());

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

  it('opens management via onManage', () => {
    const onManage = vi.fn();
    render(<LayoutQuickSwitch onManage={onManage} />);
    fireEvent.click(screen.getByRole('button', { name: /switch layout/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /manage layouts/i }));
    expect(onManage).toHaveBeenCalled();
  });
});
