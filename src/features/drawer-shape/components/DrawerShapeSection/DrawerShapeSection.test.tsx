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
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    expect(screen.getByRole('menuitem', { name: 'drawerShape.corners.open' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'drawerShape.edit' })).not.toBeInTheDocument();
  });

  it('offers editing the shape once an outline exists', () => {
    useLayoutStore.setState((s) => ({
      layout: { ...s.layout, drawer: { ...s.layout.drawer, outline: L_OUTLINE } },
    }));
    render(<DrawerShapeSection />);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    expect(screen.getByRole('menuitem', { name: 'drawerShape.edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'drawerShape.corners.open' })).toBeInTheDocument();
  });

  // The three authoring routes used to be three ghost text links stacked under
  // the row; they collapse into one trigger so the sidebar has a single visual
  // grammar for section actions.
  it('exposes exactly one action affordance on the row', () => {
    useLayoutStore.setState((s) => ({
      layout: { ...s.layout, drawer: { ...s.layout.drawer, outline: L_OUTLINE } },
    }));
    render(<DrawerShapeSection />);
    expect(screen.getByRole('button', { name: 'drawerShape.actions' })).toBeInTheDocument();
    for (const label of ['drawerShape.corners.open', 'drawerShape.penOpen', 'drawerShape.edit']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('opens the corner cuts dialog from the menu', () => {
    render(<DrawerShapeSection />);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'drawerShape.corners.open' }));
    expect(screen.getByText('drawerShape.corners.title')).toBeInTheDocument();
  });

  it('opens the pen dialog from the menu', () => {
    render(<DrawerShapeSection />);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'drawerShape.penOpen' }));
    expect(screen.getByText('drawerShape.penTitle')).toBeInTheDocument();
  });

  // The trigger sits inside the row; a click on it must not reach the row's
  // checkbox overlay and toggle the shape off.
  it('does not toggle the row when the menu is opened', () => {
    useLayoutStore.setState((s) => ({
      layout: { ...s.layout, drawer: { ...s.layout.drawer, outline: L_OUTLINE } },
    }));
    render(<DrawerShapeSection />);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.actions' }));
    expect(screen.queryByText('drawerShape.resetConfirmTitle')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'drawerShape.toggle' })).toBeChecked();
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
