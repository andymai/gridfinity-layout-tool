import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HeightCrossSectionDiagram } from './HeightCrossSectionDiagram';
import type { Layer } from '@/core/types';

const makeLayers = (...heights: number[]): Layer[] =>
  heights.map((h, i) => ({
    id: `layer-${i + 1}`,
    name: `Layer ${i + 1}`,
    height: h,
  }));

const defaultProps = {
  hoveredLayerId: null,
  canAddLayer: true,
  editingLayerId: null,
  onLayerHover: vi.fn(),
  onAddLayer: vi.fn(),
  onReorder: vi.fn(),
  onNameChange: vi.fn(),
  onHeightChange: vi.fn(),
  onDeleteLayer: vi.fn(),
  onEditingStart: vi.fn(),
  onEditingEnd: vi.fn(),
  layerStats: {} as Record<string, { coverage: number; binCount: number }>,
};

describe('HeightCrossSectionDiagram', () => {
  it('renders content area', () => {
    const layers = makeLayers(3);
    render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    expect(screen.getByTestId('content-area')).toBeInTheDocument();
  });

  it('renders all layer segments with names and heights', () => {
    const layers = makeLayers(3, 2);
    render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
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
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={onLayerClick}
        {...defaultProps}
      />
    );

    const segment = container.querySelector('[data-layer-id="layer-2"]');
    expect(segment).toBeInTheDocument();
    fireEvent.click(segment as Element);

    expect(onLayerClick).toHaveBeenCalledWith('layer-2');
  });

  it('shows headroom when drawer has spare capacity', () => {
    const layers = makeLayers(3);
    render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    expect(screen.getByText(/7u headroom/)).toBeInTheDocument();
  });

  it('hides headroom when drawer is fully used', () => {
    const layers = makeLayers(5, 5);
    render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    expect(screen.queryByText(/headroom/i)).not.toBeInTheDocument();
  });

  it('renders segments as accessible buttons', () => {
    const layers = makeLayers(4, 3);
    render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(buttons[0]).toHaveAttribute('aria-label', 'Select Layer 1');
    expect(buttons[0].tagName).toBe('DIV');
  });

  it('activates layer on Enter key', () => {
    const onLayerClick = vi.fn();
    const layers = makeLayers(4);
    render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={onLayerClick}
        {...defaultProps}
      />
    );

    const button = screen.getAllByRole('button')[0];
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(onLayerClick).toHaveBeenCalledWith('layer-1');
  });

  it('scales diagram height dynamically based on segment count', () => {
    // Single layer, no headroom (height fills drawer) → compact
    const { container: c1 } = render(
      <HeightCrossSectionDiagram
        layers={makeLayers(10)}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );
    const singleH = parseInt(
      c1
        .querySelector('[data-testid="content-area"]')
        ?.getAttribute('style')
        ?.match(/height:\s*(\d+)/)?.[1] ?? '0'
    );

    // 3 layers + headroom = 4 segments → taller diagram
    const { container: c2 } = render(
      <HeightCrossSectionDiagram
        layers={makeLayers(2, 2, 2)}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );
    const multiH = parseInt(
      c2
        .querySelector('[data-testid="content-area"]')
        ?.getAttribute('style')
        ?.match(/height:\s*(\d+)/)?.[1] ?? '0'
    );

    // Single layer (1 segment, no headroom) should be compact
    expect(singleH).toBeGreaterThanOrEqual(48);
    expect(singleH).toBeLessThanOrEqual(100);

    // Multi-layer should be taller
    expect(multiH).toBeGreaterThan(singleH);
    expect(multiH).toBeLessThanOrEqual(240);
  });

  describe('hover interaction', () => {
    it('calls onLayerHover with layer id on mouseenter', () => {
      const onLayerHover = vi.fn();
      const layers = makeLayers(4, 3);
      const { container } = render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          hoveredLayerId={'layer-2'}
          onLayerHover={vi.fn()}
        />
      );

      const highlight = container.querySelector('[data-testid="hover-highlight"]');
      expect(highlight).toBeInTheDocument();
    });

    it('does not show hover highlight for active layer', () => {
      const layers = makeLayers(4, 3);
      const { container } = render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          hoveredLayerId={'layer-1'}
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          onEditingStart={onEditingStart}
        />
      );

      const button = screen.getAllByRole('button')[0];
      fireEvent.doubleClick(button);

      expect(onEditingStart).toHaveBeenCalledWith('layer-1');
    });

    it('shows name input when editing', () => {
      const layers = makeLayers(4);
      render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId="layer-1"
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('calls onNameChange when input value changes', () => {
      const onNameChange = vi.fn();
      const layers = makeLayers(4);
      render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={3}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      expect(screen.getByLabelText('Decrease Layer 1 height')).toBeDisabled();
    });

    it('shows delete button when multiple layers', () => {
      const layers = makeLayers(4, 3);
      render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      expect(screen.queryByLabelText(/Delete.*layer/)).not.toBeInTheDocument();
    });

    it('disables drag when editing', () => {
      const layers = makeLayers(4, 3);
      const { container } = render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          editingLayerId="layer-1"
        />
      );

      const editingSegment = container.querySelector('[data-layer-id="layer-1"]');
      expect(editingSegment).toHaveAttribute('draggable', 'false');
    });

    it('stops propagation on name input click', () => {
      const onLayerClick = vi.fn();
      const layers = makeLayers(4);
      render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={onLayerClick}
          {...defaultProps}
          editingLayerId="layer-1"
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.click(input);

      expect(onLayerClick).not.toHaveBeenCalled();
    });
  });

  describe('headroom click-to-add', () => {
    it('calls onAddLayer when headroom is clicked', () => {
      const onAddLayer = vi.fn();
      const layers = makeLayers(3);
      const { container } = render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          canAddLayer={true}
          onAddLayer={onAddLayer}
        />
      );

      const headroom = container.querySelector('[data-testid="headroom-area"]');
      expect(headroom).toBeInTheDocument();
      fireEvent.click(headroom as Element);

      expect(onAddLayer).toHaveBeenCalled();
    });
  });

  describe('tooltip with stats', () => {
    it('shows layer stats in tooltip when provided', () => {
      const { container } = render(
        <HeightCrossSectionDiagram
          layers={makeLayers(4)}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={makeLayers(4)}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
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
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
        />
      );

      const grips = container.querySelectorAll('[data-testid="grip-icon"]');
      expect(grips).toHaveLength(0);
    });
  });
});
