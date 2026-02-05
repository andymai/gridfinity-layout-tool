import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutoutShapeToolbar } from './CutoutShapeToolbar';
import type { InteractionMode } from './useCutoutInteraction';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

describe('CutoutShapeToolbar', () => {
  const idleMode: InteractionMode = { type: 'idle' };
  const placingRect: InteractionMode = { type: 'placing', shape: 'rectangle' };
  const placingCircle: InteractionMode = { type: 'placing', shape: 'circle' };

  it('renders rectangle and circle buttons', () => {
    render(<CutoutShapeToolbar mode={idleMode} onSelectShape={vi.fn()} />);
    expect(screen.getByTitle('binDesigner.cutouts.addRectangle')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutouts.addCircle')).toBeInTheDocument();
  });

  it('enters placing mode when clicking rectangle button', () => {
    const onSelectShape = vi.fn();
    render(<CutoutShapeToolbar mode={idleMode} onSelectShape={onSelectShape} />);

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addRectangle'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'placing', shape: 'rectangle' });
  });

  it('enters placing mode when clicking circle button', () => {
    const onSelectShape = vi.fn();
    render(<CutoutShapeToolbar mode={idleMode} onSelectShape={onSelectShape} />);

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addCircle'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'placing', shape: 'circle' });
  });

  it('deactivates placing mode when clicking active shape button', () => {
    const onSelectShape = vi.fn();
    render(<CutoutShapeToolbar mode={placingRect} onSelectShape={onSelectShape} />);

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addRectangle'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'idle' });
  });

  it('switches shape when clicking different shape while placing', () => {
    const onSelectShape = vi.fn();
    render(<CutoutShapeToolbar mode={placingRect} onSelectShape={onSelectShape} />);

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addCircle'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'placing', shape: 'circle' });
  });

  it('shows click-to-place hint when in placing mode', () => {
    render(<CutoutShapeToolbar mode={placingCircle} onSelectShape={vi.fn()} />);
    expect(screen.getByText('binDesigner.cutouts.clickToPlace')).toBeInTheDocument();
  });

  it('does not show click-to-place hint in idle mode', () => {
    render(<CutoutShapeToolbar mode={idleMode} onSelectShape={vi.fn()} />);
    expect(screen.queryByText('binDesigner.cutouts.clickToPlace')).not.toBeInTheDocument();
  });
});
