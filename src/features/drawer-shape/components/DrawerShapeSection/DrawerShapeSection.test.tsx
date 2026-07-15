import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import type { DrawerOutline } from '@/core/types';
import { DrawerShapeSection } from './DrawerShapeSection';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const mockSetDrawerOutline = vi.fn(() => ({ ok: true, value: undefined }));
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ setDrawerOutline: mockSetDrawerOutline }),
}));

const U = 42;
const L_OUTLINE: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

describe('DrawerShapeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('shows the toggle unchecked for rectangular drawers', () => {
    render(<DrawerShapeSection />);
    expect(screen.getByRole('checkbox', { name: 'drawerShape.toggle' })).not.toBeChecked();
  });

  it('opens the editor when toggling on', () => {
    render(<DrawerShapeSection />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'drawerShape.toggle' }));
    expect(screen.getByText('drawerShape.editor.title')).toBeInTheDocument();
  });

  it('offers corner cuts even with no outline drawn', () => {
    render(<DrawerShapeSection />);
    expect(screen.getByRole('button', { name: 'drawerShape.corners.open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'drawerShape.edit' })).not.toBeInTheDocument();
  });

  it('offers editing the shape once an outline exists', () => {
    useLayoutStore.setState((s) => ({
      layout: { ...s.layout, drawer: { ...s.layout.drawer, outline: L_OUTLINE } },
    }));
    render(<DrawerShapeSection />);
    expect(screen.getByRole('button', { name: 'drawerShape.edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'drawerShape.corners.open' })).toBeInTheDocument();
  });

  it('gives the mobile variant a 44px action touch target', () => {
    render(<DrawerShapeSection variant="mobile" />);
    expect(screen.getByRole('button', { name: 'drawerShape.corners.open' })).toHaveClass('h-11');
  });

  it('keeps the compact action height on desktop', () => {
    render(<DrawerShapeSection />);
    expect(screen.getByRole('button', { name: 'drawerShape.corners.open' })).toHaveClass('h-8');
  });

  it('confirms before resetting an existing shape', () => {
    useLayoutStore.setState((s) => ({
      layout: { ...s.layout, drawer: { ...s.layout.drawer, outline: L_OUTLINE } },
    }));
    render(<DrawerShapeSection />);
    const toggle = screen.getByRole('checkbox', { name: 'drawerShape.toggle' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(screen.getByText('drawerShape.resetConfirmTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.resetConfirm' }));
    expect(mockSetDrawerOutline).toHaveBeenCalledWith(null);
  });
});
