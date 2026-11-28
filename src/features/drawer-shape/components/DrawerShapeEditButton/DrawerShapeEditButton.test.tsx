import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useLayoutStore, useToastStore } from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { _resetUndoCaptureState } from '@/core/cqrs';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits, heightUnits } from '@/core/types';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { DrawerShapeEditButton } from './DrawerShapeEditButton';

// The history store toasts an undo through the static translator.
vi.mock('@/i18n', async () => ({
  ...(await import('@/test/mocks/i18nEcho')),
  getStaticTranslation: (key: string) => key,
}));

const CORNER_BIN = binId('corner');
const MIDDLE_BIN = binId('middle');

function binLayer(id: typeof CORNER_BIN): string | undefined {
  return useLayoutStore.getState().layout.bins.find((b) => b.id === id)?.layerId;
}

function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: 'drawerShape.edit' }));
}

describe('DrawerShapeEditButton', () => {
  beforeEach(() => {
    resetAllStores();
    _resetUndoCaptureState();
    useLayoutStore.setState({
      layout: createTestLayout({
        drawer: { width: gridUnits(4), depth: gridUnits(4), height: heightUnits(12) },
        bins: [
          createTestBin({ id: CORNER_BIN, x: gridUnits(0), y: gridUnits(0) }),
          createTestBin({ id: MIDDLE_BIN, x: gridUnits(2), y: gridUnits(2) }),
        ],
      }),
    });
  });

  it('opens a menu of the corner cuts and the pen, without the cell editor', () => {
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        drawer: {
          ...s.layout.drawer,
          outline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 168, y: 0 },
              { x: 168, y: 168 },
              { x: 0, y: 168 },
            ],
          },
        },
      },
    }));
    render(<DrawerShapeEditButton />);
    const trigger = screen.getByRole('button', { name: 'drawerShape.edit' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    openMenu();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'drawerShape.corners.open',
      'drawerShape.penOpen',
    ]);
  });

  it('opens the corner cuts dialog from the menu', () => {
    render(<DrawerShapeEditButton />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'drawerShape.corners.open' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'drawerShape.corners.title' })).toBeInTheDocument();
  });

  it('opens the pen dialog from the menu', () => {
    render(<DrawerShapeEditButton />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'drawerShape.penOpen' }));
    expect(screen.getByRole('dialog', { name: 'drawerShape.penTitle' })).toBeInTheDocument();
  });

  it('stays shut and says why while a reason disables it', () => {
    render(<DrawerShapeEditButton disabledReason="Turn sync on" />);
    const trigger = screen.getByRole('button', { name: 'drawerShape.edit' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAccessibleDescription('Turn sync on');

    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // The button edits the layout's drawer, so a notch has to stash the bins it
  // cuts off and tell the user, and one undo has to take both back: the same
  // flow the Layout tab runs.
  it('stashes the bins a notch cuts off, says so, and undoes as one step', () => {
    render(<DrawerShapeEditButton />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'drawerShape.corners.open' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'drawerShape.corners.frontLeft' }), {
      target: { value: 'notch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));

    const outline = useLayoutStore.getState().layout.drawer.outline;
    expect(outline?.authoring?.corners?.bl.kind).toBe('notch');
    expect(binLayer(CORNER_BIN)).toBe(STAGING_ID);
    expect(binLayer(MIDDLE_BIN)).not.toBe(STAGING_ID);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain(
      'toast.binsDisplacedByShape_one'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => useHistoryStore.getState().undo());

    expect(useLayoutStore.getState().layout.drawer.outline).toBeUndefined();
    expect(binLayer(CORNER_BIN)).not.toBe(STAGING_ID);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('undo.undid');
  });
});
