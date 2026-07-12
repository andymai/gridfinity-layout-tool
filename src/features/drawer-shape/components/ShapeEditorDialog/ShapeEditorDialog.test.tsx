import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLayoutStore } from '@/core/store';
import { resetAllStores, createTestBin } from '@/test/testUtils';
import { gridUnits } from '@/core/types';
import { ShapeEditorDialog } from './ShapeEditorDialog';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

const mockSetDrawerOutline = vi.fn(() => ({ ok: true, value: undefined }));
vi.mock('@/shared/contexts/MutationsContext', () => ({
  useMutations: () => ({ setDrawerOutline: mockSetDrawerOutline }),
}));

function setDrawer(width: number, depth: number) {
  useLayoutStore.setState((s) => ({
    layout: {
      ...s.layout,
      drawer: { ...s.layout.drawer, width: gridUnits(width), depth: gridUnits(depth) },
    },
  }));
}

function cellByIndex(index: number): Element {
  const el = document.querySelector(`[data-cell-index="${index}"]`);
  if (el === null) throw new Error(`cell ${index} not found`);
  return el;
}

describe('ShapeEditorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it('renders one gridcell per drawer cell, all filled by default', () => {
    setDrawer(3, 2);
    render(<ShapeEditorDialog open onClose={() => {}} />);
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(6);
    expect(cells.every((c) => c.getAttribute('aria-selected') === 'true')).toBe(true);
  });

  it('paints a cell out and applies the resulting outline', () => {
    setDrawer(2, 2);
    const onClose = vi.fn();
    render(<ShapeEditorDialog open onClose={onClose} />);
    // Notch out the top-right cell: row 1, col 1 → index 3.
    const cell = cellByIndex(3);
    fireEvent.pointerDown(cell);
    fireEvent.pointerUp(cell);
    expect(cellByIndex(3).getAttribute('aria-selected')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.editor.apply' }));
    expect(mockSetDrawerOutline).toHaveBeenCalledTimes(1);
    const outline = mockSetDrawerOutline.mock.calls[0][0] as {
      vertices: { x: number; y: number }[];
      authoring?: { kind: string };
    };
    expect(outline.vertices).toHaveLength(6);
    expect(outline.authoring).toEqual({ kind: 'cells' });
    expect(onClose).toHaveBeenCalled();
  });

  it('disables apply for an empty shape', () => {
    setDrawer(1, 1);
    render(<ShapeEditorDialog open onClose={() => {}} />);
    const cell = cellByIndex(0);
    fireEvent.pointerDown(cell);
    fireEvent.pointerUp(cell);
    expect(screen.getByText('drawerShape.editor.invalidEmpty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'drawerShape.editor.apply' })).toBeDisabled();
  });

  it('trace seeds the grid from bin footprints', () => {
    setDrawer(2, 1);
    useLayoutStore.setState((s) => ({
      layout: {
        ...s.layout,
        bins: [createTestBin({ id: 'a', x: 0, y: 0, width: 1, depth: 1 })],
      },
    }));
    render(<ShapeEditorDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'drawerShape.trace' }));
    const cells = screen.getAllByRole('gridcell');
    expect(cells[0].getAttribute('aria-selected')).toBe('true');
    expect(cells[1].getAttribute('aria-selected')).toBe('false');
  });
});
