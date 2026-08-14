import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BentoWorkspaceHeader, type BentoWorkspaceHeaderProps } from './BentoWorkspaceHeader';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

function makeProps(overrides: Partial<BentoWorkspaceHeaderProps> = {}): BentoWorkspaceHeaderProps {
  return {
    cols: 4,
    rows: 3,
    drawnCount: 3,
    hasDrawnCompartments: false,
    onGridChange: vi.fn(),
    onClearAll: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    zoomPercent: 100,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFitToView: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('BentoWorkspaceHeader', () => {
  it('disables undo/redo until there is history', () => {
    const { rerender } = render(<BentoWorkspaceHeader {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'common.undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'common.redo' })).toBeDisabled();

    rerender(<BentoWorkspaceHeader {...makeProps({ canUndo: true, canRedo: true })} />);
    expect(screen.getByRole('button', { name: 'common.undo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'common.redo' })).toBeEnabled();
  });

  it('routes undo/redo clicks', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <BentoWorkspaceHeader {...makeProps({ canUndo: true, canRedo: true, onUndo, onRedo })} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'common.undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'common.redo' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('steps grid dimensions through onGridChange', () => {
    const onGridChange = vi.fn();
    render(<BentoWorkspaceHeader {...makeProps({ onGridChange })} />);

    const [colsUp] = screen.getAllByRole('button', { name: /increase/i });
    fireEvent.click(colsUp);

    expect(onGridChange).toHaveBeenCalledWith(5, 3);
  });

  it('zoom pill: percent shows, buttons and fit route', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFitToView = vi.fn();
    render(
      <BentoWorkspaceHeader
        {...makeProps({ zoomPercent: 150, onZoomIn, onZoomOut, onFitToView })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutoutEditor.zoomIn' }));
    fireEvent.click(screen.getByRole('button', { name: 'binDesigner.cutoutEditor.zoomOut' }));
    fireEvent.click(screen.getByText('150%'));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onFitToView).toHaveBeenCalledTimes(1);
  });

  it('shows Clear all only when something is drawn', () => {
    const onClearAll = vi.fn();
    const { rerender } = render(<BentoWorkspaceHeader {...makeProps({ onClearAll })} />);
    expect(screen.queryByText('binDesigner.bento.clearAll')).not.toBeInTheDocument();

    rerender(<BentoWorkspaceHeader {...makeProps({ hasDrawnCompartments: true, onClearAll })} />);
    fireEvent.click(screen.getByText('binDesigner.bento.clearAll'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('closes from Done', () => {
    const onClose = vi.fn();
    render(<BentoWorkspaceHeader {...makeProps({ onClose })} />);

    fireEvent.click(screen.getByText('common.done'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the workspace experimental without displacing the controls', () => {
    render(<BentoWorkspaceHeader {...makeProps({ canUndo: true })} />);

    expect(screen.getByText('common.experimental')).toBeInTheDocument();
    // The badge sits beside the title; everything else still renders.
    expect(screen.getByText('binDesigner.interior.bento.title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.undo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'common.done' })).toBeInTheDocument();
  });
});
