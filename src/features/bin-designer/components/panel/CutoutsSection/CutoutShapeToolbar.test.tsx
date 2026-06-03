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

  it('renders pointer, rectangle, circle, and snap buttons', () => {
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );
    expect(screen.getByTitle('binDesigner.cutouts.pointerTool')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutouts.addRectangle')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutouts.addCircle')).toBeInTheDocument();
    expect(screen.getByTitle('binDesigner.cutouts.snapToGrid')).toBeInTheDocument();
  });

  it('pointer tool is active in idle mode', () => {
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );
    const pointerButton = screen.getByTitle('binDesigner.cutouts.pointerTool');
    expect(pointerButton).toHaveClass('bg-accent');
  });

  it('enters placing mode when clicking rectangle button', () => {
    const onSelectShape = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={onSelectShape}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addRectangle'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'placing', shape: 'rectangle' });
  });

  it('enters placing mode when clicking circle button', () => {
    const onSelectShape = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={onSelectShape}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addCircle'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'placing', shape: 'circle' });
  });

  it('enters placing mode when clicking polygon button', () => {
    const onSelectShape = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={onSelectShape}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addPolygon'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'placing', shape: 'polygon' });
  });

  it('enters placing mode when clicking slot button', () => {
    const onSelectShape = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={onSelectShape}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addSlot'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'placing', shape: 'slot' });
  });

  it('returns to idle mode when clicking pointer button', () => {
    const onSelectShape = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={placingRect}
        onSelectShape={onSelectShape}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.pointerTool'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'idle' });
  });

  it('deactivates placing mode when clicking active shape button', () => {
    const onSelectShape = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={placingRect}
        onSelectShape={onSelectShape}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addRectangle'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'idle' });
  });

  it('switches shape when clicking different shape while placing', () => {
    const onSelectShape = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={placingRect}
        onSelectShape={onSelectShape}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.addCircle'));
    expect(onSelectShape).toHaveBeenCalledWith({ type: 'placing', shape: 'circle' });
  });

  it('toggles snap when clicking snap button', () => {
    const onSnapToggle = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={onSnapToggle}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.snapToGrid'));
    expect(onSnapToggle).toHaveBeenCalledWith(false);
  });

  it('snap button shows active state when snap is enabled', () => {
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );
    const snapButton = screen.getByTitle('binDesigner.cutouts.snapToGrid');
    expect(snapButton).toHaveClass('bg-accent');
  });

  it('snap button shows inactive state when snap is disabled', () => {
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={false}
        onSnapToggle={vi.fn()}
      />
    );
    const snapButton = screen.getByTitle('binDesigner.cutouts.snapToGrid');
    expect(snapButton).toHaveClass('border');
    expect(snapButton).not.toHaveClass('bg-accent');
  });

  it('shows click-to-place hint when in placing mode', () => {
    render(
      <CutoutShapeToolbar
        mode={placingCircle}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );
    expect(screen.getByText('binDesigner.cutouts.dragToDraw')).toBeInTheDocument();
  });

  it('does not show click-to-place hint in idle mode', () => {
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );
    expect(screen.queryByText('binDesigner.cutouts.dragToDraw')).not.toBeInTheDocument();
  });

  it('renders Import SVG button when onImportSvg is provided', () => {
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
        onImportSvg={vi.fn()}
      />
    );
    expect(screen.getByTitle('binDesigner.cutouts.importSvg')).toBeInTheDocument();
  });

  it('does not render Import SVG button when onImportSvg is not provided', () => {
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
      />
    );
    expect(screen.queryByTitle('binDesigner.cutouts.importSvg')).not.toBeInTheDocument();
  });

  it('calls onImportSvg when Import SVG button is clicked', () => {
    const onImportSvg = vi.fn();
    render(
      <CutoutShapeToolbar
        mode={idleMode}
        onSelectShape={vi.fn()}
        snapEnabled={true}
        onSnapToggle={vi.fn()}
        onImportSvg={onImportSvg}
      />
    );

    fireEvent.click(screen.getByTitle('binDesigner.cutouts.importSvg'));
    expect(onImportSvg).toHaveBeenCalledOnce();
  });
});
