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
    expect(screen.getByRole('switch', { name: 'drawerShape.toggle' })).not.toBeChecked();
  });

  it('opens the editor when toggling on', () => {
    render(<DrawerShapeSection />);
    fireEvent.click(screen.getByRole('switch', { name: 'drawerShape.toggle' }));
    expect(screen.getByText('drawerShape.editor.title')).toBeInTheDocument();
  });

  it('confirms before resetting an existing shape', () => {
    useLayoutStore.setState((s) => ({
      layout: { ...s.layout, drawer: { ...s.layout.drawer, outline: L_OUTLINE } },
    }));
    render(<DrawerShapeSection />);
    const toggle = screen.getByRole('switch', { name: 'drawerShape.toggle' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(screen.getByText('drawerShape.resetConfirmTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.resetConfirm' }));
    expect(mockSetDrawerOutline).toHaveBeenCalledWith(null);
  });
});
