import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PenControls } from './PenControls';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function renderControls(overrides: Partial<Parameters<typeof PenControls>[0]> = {}) {
  const props = {
    snap: 0.5 as const,
    onSnapChange: vi.fn(),
    lone: null,
    widthMm: 420,
    depthMm: 336,
    onCoordChange: vi.fn(),
    selectedCount: 0,
    filletValue: 0,
    maxFillet: 84,
    onFilletChange: vi.fn(),
    onFilletStep: vi.fn(),
    canDelete: false,
    onDelete: vi.fn(),
    canUndo: false,
    onUndo: vi.fn(),
    viewMoved: false,
    onResetView: vi.fn(),
    onImport: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  return { ...render(<PenControls {...props} />), props };
}

describe('PenControls', () => {
  // The rounding control acts on the selection, so its label has to say so or
  // it reads as a setting for the whole shape.
  it('labels the rounding control by what it will act on', () => {
    const { unmount } = renderControls();
    expect(screen.getByLabelText('drawerShape.penFillet')).toBeInTheDocument();
    unmount();

    renderControls({ selectedCount: 2 });
    expect(screen.getByLabelText('drawerShape.penFilletSelected')).toBeInTheDocument();
  });

  it('reports a mixed radius rather than showing one corner as the truth', () => {
    renderControls({ selectedCount: 2, filletValue: null });
    expect(screen.getByText('drawerShape.penFilletMixed')).toBeInTheDocument();
    expect(screen.getByLabelText('drawerShape.penFilletSelected')).toHaveValue(0);
  });

  // Outline coords carry 0.01mm precision; the radius field must not re-round a
  // typed decimal down to 1dp on display (#3090). At 1dp this reads 2.6.
  it('displays a radius to two decimals so typed decimals survive', () => {
    renderControls({ filletValue: 2.55 });
    expect(screen.getByLabelText('drawerShape.penFillet')).toHaveValue(2.55);
  });

  it('shows the coordinate fields only for a single selected corner', () => {
    const { unmount } = renderControls();
    expect(screen.queryByText(/^drawerShape\.penCorner/)).not.toBeInTheDocument();
    unmount();

    renderControls({ lone: { index: 2, x: 100, y: 50 } });
    expect(screen.getByText('drawerShape.penCorner')).toBeInTheDocument();
  });

  it('triggers an import', () => {
    const { props } = renderControls();
    fireEvent.click(screen.getByText('drawerShape.penImport'));
    expect(props.onImport).toHaveBeenCalledTimes(1);
  });

  it('offers the view reset only once the view has moved', () => {
    const { unmount } = renderControls();
    expect(screen.queryByText('drawerShape.penResetView')).not.toBeInTheDocument();
    unmount();

    renderControls({ viewMoved: true });
    expect(screen.getByText('drawerShape.penResetView')).toBeInTheDocument();
  });

  it('disables delete and undo until they can do something', () => {
    renderControls();
    expect(screen.getByText('drawerShape.penDeletePoint')).toBeDisabled();
    expect(screen.getByText('common.undo')).toBeDisabled();
  });
});
