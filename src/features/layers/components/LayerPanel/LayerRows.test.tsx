import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LayerRows } from './LayerRows';
import type { Layer } from '@/core/types';
import { heightUnits, layerId } from '@/core/types';

const makeLayers = (...heights: number[]): Layer[] =>
  heights.map((h, i) => ({
    id: layerId(`layer-${i + 1}`),
    name: `Layer ${i + 1}`,
    height: heightUnits(h),
  }));

const defaultProps = {
  hoveredLayerId: null,
  editingLayerId: null,
  onLayerHover: vi.fn(),
  onReorder: vi.fn(),
  onNameChange: vi.fn(),
  onHeightChange: vi.fn(),
  onDeleteLayer: vi.fn(),
  onEditingStart: vi.fn(),
  onEditingEnd: vi.fn(),
  layerStats: {} as Record<string, { coverage: number; binCount: number }>,
};

describe('LayerRows', () => {
  it('renders content area', () => {
    const layers = makeLayers(3);
    render(
      <LayerRows
        layers={layers}
        activeLayerId={layerId('layer-1')}
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    expect(screen.getByTestId('content-area')).toBeInTheDocument();
  });

  it('renders all layer segments with names and heights', () => {
    const layers = makeLayers(3, 2);
    render(
      <LayerRows
        layers={layers}
        activeLayerId={layerId('layer-1')}
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    expect(screen.getAllByText('Layer 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Layer 2').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onLayerClick when segment is clicked', () => {
    const onLayerClick = vi.fn();
    const layers = makeLayers(3, 2);
    const { container } = render(
      <LayerRows
        layers={layers}
        activeLayerId={layerId('layer-1')}
        onLayerClick={onLayerClick}
        {...defaultProps}
      />
    );

    const segment = container.querySelector('[data-layer-id="layer-2"]');
    expect(segment).toBeInTheDocument();
    fireEvent.click(segment as Element);

    expect(onLayerClick).toHaveBeenCalledWith('layer-2');
  });

  it('renders segments as accessible buttons', () => {
    const layers = makeLayers(4, 3);
    render(
      <LayerRows
        layers={layers}
        activeLayerId={layerId('layer-1')}
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    const layerButton = screen.getByRole('button', { name: 'Select Layer 1' });
    expect(layerButton).toBeInTheDocument();
    expect(layerButton.tagName).toBe('DIV');
    // At least 2 layer segments rendered as buttons
    expect(screen.getByRole('button', { name: 'Select Layer 2' })).toBeInTheDocument();
  });

  it('marks only the active row as pressed', () => {
    render(
      <LayerRows
        layers={makeLayers(3, 3)}
        activeLayerId={layerId('layer-2')}
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );
    expect(screen.getByRole('button', { name: 'Select Layer 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Select Layer 1' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('activates layer on Enter key', () => {
    const onLayerClick = vi.fn();
    const layers = makeLayers(4);
    render(
      <LayerRows
        layers={layers}
        activeLayerId={layerId('layer-1')}
        onLayerClick={onLayerClick}
        {...defaultProps}
      />
    );

    const button = screen.getByRole('button', { name: 'Select Layer 1' });
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(onLayerClick).toHaveBeenCalledWith('layer-1');
  });

  it('gives every layer the same row, whatever its height', () => {
    render(
      <LayerRows
        layers={makeLayers(2, 9, 4)}
        activeLayerId={layerId('layer-1')}
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );
    const rows = screen
      .getByTestId('content-area')
      .querySelectorAll<HTMLElement>('[data-layer-id]');
    expect(rows).toHaveLength(3);
    expect(new Set([...rows].map((r) => r.style.height))).toEqual(new Set(['32px']));
  });

  it('shows each layer’s bin count and labels its height as the new-bin default', () => {
    render(
      <LayerRows
        layers={makeLayers(3, 4)}
        activeLayerId={layerId('layer-1')}
        onLayerClick={vi.fn()}
        {...defaultProps}
        layerStats={{
          'layer-1': { coverage: 50, binCount: 7 },
          'layer-2': { coverage: 10, binCount: 2 },
        }}
      />
    );
    expect(screen.getByText('7 bins')).toBeInTheDocument();
    expect(screen.getByText('2 bins')).toBeInTheDocument();
    expect(screen.getByText('4u')).toHaveAttribute(
      'title',
      'Height for new bins placed on this layer'
    );
  });

  describe('hover interaction', () => {
    it('calls onLayerHover with layer id on mouseenter', () => {
      const onLayerHover = vi.fn();
      const layers = makeLayers(4, 3);
      const { container } = render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          hoveredLayerId={null}
          onLayerHover={onLayerHover}
        />
      );

      const segment = container.querySelector('[data-layer-id="layer-2"]');
      expect(segment).toBeInTheDocument();
      fireEvent.mouseEnter(segment as Element);

      expect(onLayerHover).toHaveBeenCalledWith('layer-2');
    });

    it('calls onLayerHover with null on mouseleave', () => {
      const onLayerHover = vi.fn();
      const layers = makeLayers(4, 3);
      const { container } = render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          hoveredLayerId={null}
          onLayerHover={onLayerHover}
        />
      );

      const segment = container.querySelector('[data-layer-id="layer-2"]');
      expect(segment).toBeInTheDocument();
      fireEvent.mouseLeave(segment as Element);

      expect(onLayerHover).toHaveBeenCalledWith(null);
    });

    it('shows hover highlight for hovered non-active layer', () => {
      const layers = makeLayers(4, 3);
      const { container } = render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          hoveredLayerId={layerId('layer-2')}
          onLayerHover={vi.fn()}
        />
      );

      const highlight = container.querySelector('[data-testid="hover-highlight"]');
      expect(highlight).toBeInTheDocument();
    });

    it('does not show hover highlight for active layer', () => {
      const layers = makeLayers(4, 3);
      const { container } = render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          hoveredLayerId={layerId('layer-1')}
          onLayerHover={vi.fn()}
        />
      );

      const highlight = container.querySelector('[data-testid="hover-highlight"]');
      expect(highlight).not.toBeInTheDocument();
    });
  });

  describe('inline editing controls', () => {
    it('calls onEditingStart on double-click', () => {
      const onEditingStart = vi.fn();
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          onEditingStart={onEditingStart}
        />
      );

      const button = screen.getByRole('button', { name: 'Select Layer 1' });
      fireEvent.doubleClick(button);

      expect(onEditingStart).toHaveBeenCalledWith('layer-1');
    });

    it('shows name input when editing', () => {
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId={layerId('layer-1')}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('calls onNameChange when input value changes', () => {
      const onNameChange = vi.fn();
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId={layerId('layer-1')}
          onNameChange={onNameChange}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Name' } });

      expect(onNameChange).toHaveBeenCalledWith('layer-1', 'New Name');
    });

    it('calls onEditingEnd on blur', () => {
      const onEditingEnd = vi.fn();
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId={layerId('layer-1')}
          onEditingEnd={onEditingEnd}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.blur(input);

      expect(onEditingEnd).toHaveBeenCalled();
    });

    it('calls onEditingEnd on Enter key', () => {
      const onEditingEnd = vi.fn();
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId={layerId('layer-1')}
          onEditingEnd={onEditingEnd}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onEditingEnd).toHaveBeenCalled();
    });

    it('shows height stepper on active segment', () => {
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      expect(screen.getByLabelText('Decrease Layer 1 height')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase Layer 1 height')).toBeInTheDocument();
    });

    it('debounces rapid stepper clicks into a single onHeightChange call', () => {
      vi.useFakeTimers();
      const onHeightChange = vi.fn();
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          onHeightChange={onHeightChange}
        />
      );

      // Click increase 3 times rapidly — should NOT fire immediately
      fireEvent.click(screen.getByLabelText('Increase Layer 1 height'));
      fireEvent.click(screen.getByLabelText('Increase Layer 1 height'));
      fireEvent.click(screen.getByLabelText('Increase Layer 1 height'));
      expect(onHeightChange).not.toHaveBeenCalled();

      // After debounce delay, fires once with accumulated delta
      act(() => vi.advanceTimersByTime(500));
      expect(onHeightChange).toHaveBeenCalledTimes(1);
      expect(onHeightChange).toHaveBeenCalledWith('layer-1', 3);

      vi.useRealTimers();
    });

    it('shows preview height immediately while debouncing', () => {
      vi.useFakeTimers();
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      // Initial height display shows 4u
      expect(screen.getByTitle('Height for new bins placed on this layer')).toHaveTextContent('4u');

      fireEvent.click(screen.getByLabelText('Increase Layer 1 height'));
      // Preview updates immediately to 5u
      expect(screen.getByTitle('Height for new bins placed on this layer')).toHaveTextContent('5u');

      vi.useRealTimers();
    });

    it('disables decrease button at minimum layer height', () => {
      const layers = makeLayers(2);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      expect(screen.getByLabelText('Decrease Layer 1 height')).toBeDisabled();
    });

    it('shows delete button when multiple layers', () => {
      const layers = makeLayers(4, 3);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      expect(screen.getByLabelText('Delete Layer 1 layer')).toBeInTheDocument();
    });

    it('calls onDeleteLayer when delete button clicked', () => {
      const onDeleteLayer = vi.fn();
      const layers = makeLayers(4, 3);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          onDeleteLayer={onDeleteLayer}
        />
      );

      fireEvent.click(screen.getByLabelText('Delete Layer 1 layer'));

      expect(onDeleteLayer).toHaveBeenCalledWith('layer-1');
    });

    it('hides delete button for single layer', () => {
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      expect(screen.queryByLabelText(/Delete.*layer/)).not.toBeInTheDocument();
    });

    it('disables drag when editing', () => {
      const layers = makeLayers(4, 3);
      const { container } = render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId={layerId('layer-1')}
        />
      );

      const editingSegment = container.querySelector('[data-layer-id="layer-1"]');
      expect(editingSegment).toHaveAttribute('draggable', 'false');
    });

    it('stops propagation on name input click', () => {
      const onLayerClick = vi.fn();
      const layers = makeLayers(4);
      render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={onLayerClick}
          {...defaultProps}
          editingLayerId={layerId('layer-1')}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.click(input);

      expect(onLayerClick).not.toHaveBeenCalled();
    });
  });

  describe('tooltip with stats', () => {
    it('shows layer stats in tooltip when provided', () => {
      const { container } = render(
        <LayerRows
          layers={makeLayers(4)}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          layerStats={{ 'layer-1': { coverage: 75, binCount: 12 } }}
        />
      );

      const segment = container.querySelector('[data-layer-id="layer-1"]');
      const title = segment?.getAttribute('title') ?? '';
      expect(title).toContain('75%');
      expect(title).toContain('12 bins');
    });

    it('shows only layer name in tooltip when no stats', () => {
      const { container } = render(
        <LayerRows
          layers={makeLayers(4)}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
          layerStats={{}}
        />
      );

      const segment = container.querySelector('[data-layer-id="layer-1"]');
      expect(segment?.getAttribute('title')).toBe('Layer 1');
    });
  });

  describe('grip icon', () => {
    it('shows grip icon when multiple layers exist', () => {
      const layers = makeLayers(4, 3);
      const { container } = render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      const grips = container.querySelectorAll('[data-testid="grip-icon"]');
      expect(grips.length).toBeGreaterThanOrEqual(1);
    });

    it('hides grip icon for single layer', () => {
      const layers = makeLayers(4);
      const { container } = render(
        <LayerRows
          layers={layers}
          activeLayerId={layerId('layer-1')}
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      const grips = container.querySelectorAll('[data-testid="grip-icon"]');
      expect(grips).toHaveLength(0);
    });
  });
});
