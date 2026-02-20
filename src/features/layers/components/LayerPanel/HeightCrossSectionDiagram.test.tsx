import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  onLayerHover: vi.fn(),
  onLayerDoubleClick: vi.fn(),
  onAddLayer: vi.fn(),
  onReorder: vi.fn(),
  layerStats: {} as Record<string, { coverage: number; binCount: number }>,
};

describe('HeightCrossSectionDiagram', () => {
  it('renders an SVG with role="img" and accessible label', () => {
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

    const svg = screen.getByRole('img');
    expect(svg.tagName).toBe('svg');
    expect(svg).toHaveAttribute('aria-label', 'Cross-section');
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

    // Layer names appear in both <text> and <title> elements
    expect(screen.getAllByText('Layer 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Layer 2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('3u')).toBeInTheDocument();
    expect(screen.getByText('2u')).toBeInTheDocument();
  });

  it('calls onLayerClick when a segment is clicked', () => {
    const onLayerClick = vi.fn();
    const layers = makeLayers(3, 2);
    render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={onLayerClick}
        {...defaultProps}
      />
    );

    // Click the visible <text> element (not the <title>)
    const layer2Elements = screen.getAllByText('Layer 2');
    fireEvent.click(layer2Elements[0]);

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

    // Unused = 10 - 3 = 7u
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

  it('renders layer segments as accessible buttons', () => {
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

    // SVG <g> segments have role="button" with aria-labels
    const svgButtons = container.querySelectorAll('svg [role="button"]');
    expect(svgButtons).toHaveLength(2);
    expect(svgButtons[0]).toHaveAttribute('aria-label', 'Select Layer 1');
    expect(svgButtons[1]).toHaveAttribute('aria-label', 'Select Layer 2');
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

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(onLayerClick).toHaveBeenCalledWith('layer-1');
  });

  it('defines clip path and headroom hatch in SVG defs', () => {
    const layers = makeLayers(3);
    const { container } = render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    expect(container.querySelector('[id^="cross-section-clip-"]')).toBeInTheDocument();
    expect(container.querySelector('[id^="cross-section-hatch-"]')).toBeInTheDocument();
  });

  it('scales height dynamically based on drawer height', () => {
    const layers = makeLayers(3);

    // Small drawer: 6u * 10px = 60px → clamped to 80px min
    const { container: small } = render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={6}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );
    const smallSvg = small.querySelector('svg');
    // 80px diagram + 2×8px padding = 96px
    expect(smallSvg).toHaveAttribute('height', '96');

    // Large drawer: 25u * 10px = 250px → clamped to 200px + 16px padding = 216px
    const { container: large } = render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={25}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );
    const largeSvg = large.querySelector('svg');
    expect(largeSvg).toHaveAttribute('height', '216');
  });

  it('renders ruler boundary labels at tick marks', () => {
    // Two layers: 4u + 3u = 7u in a 10u drawer
    // Boundaries: 0, 3, 7, 10
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

    const rulerTexts = container.querySelectorAll('g[aria-hidden="true"] text');
    const labels = Array.from(rulerTexts).map((el) => el.textContent);

    expect(labels).toContain('0');
    expect(labels).toContain('3');
    expect(labels).toContain('7');
    expect(labels).toContain('10');
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
      expect(segment).toBeTruthy();
      fireEvent.mouseEnter(segment!);

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
      fireEvent.mouseLeave(segment!);

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

  describe('double-click interaction', () => {
    it('calls onLayerDoubleClick when segment is double-clicked', () => {
      const onLayerDoubleClick = vi.fn();
      const layers = makeLayers(4);
      render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          onLayerDoubleClick={onLayerDoubleClick}
        />
      );

      const layer1Elements = screen.getAllByText('Layer 1');
      fireEvent.doubleClick(layer1Elements[0]);

      expect(onLayerDoubleClick).toHaveBeenCalledWith('layer-1');
    });
  });

  describe('headroom click-to-add', () => {
    it('renders headroom area when there is spare capacity', () => {
      const layers = makeLayers(3);
      const { container } = render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          canAddLayer={true}
        />
      );

      expect(container.querySelector('[data-testid="headroom-area"]')).toBeInTheDocument();
    });

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
      fireEvent.click(headroom!);

      expect(onAddLayer).toHaveBeenCalled();
    });
  });

  describe('tooltip with stats', () => {
    it('shows layer stats in tooltip when provided', () => {
      const layers = makeLayers(4);
      const { container } = render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          layerStats={{ 'layer-1': { coverage: 75, binCount: 12 } }}
        />
      );

      const title = container.querySelector('[data-layer-id="layer-1"] title');
      expect(title?.textContent).toContain('75%');
      expect(title?.textContent).toContain('12 bins');
    });

    it('shows only layer name in tooltip when no stats', () => {
      const layers = makeLayers(4);
      const { container } = render(
        <HeightCrossSectionDiagram
          layers={layers}
          drawerHeight={10}
          activeLayerId="layer-1"
          onLayerClick={vi.fn()}
          {...defaultProps}
          layerStats={{}}
        />
      );

      const title = container.querySelector('[data-layer-id="layer-1"] title');
      expect(title?.textContent).toBe('Layer 1');
    });
  });

  it('renders with full width via container div', () => {
    const layers = makeLayers(3);
    const { container } = render(
      <HeightCrossSectionDiagram
        layers={layers}
        drawerHeight={10}
        activeLayerId="layer-1"
        onLayerClick={vi.fn()}
        {...defaultProps}
      />
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.tagName).toBe('DIV');
    expect(wrapper).toHaveClass('w-full');

    const svg = wrapper?.querySelector('svg');
    expect(svg).toHaveAttribute('width', '100%');
  });
});
