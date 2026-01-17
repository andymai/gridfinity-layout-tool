import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PrintBin } from '../../components/Print/PrintBin';
import type { Bin, Category, Drawer } from '../../types';
import type { PrintViewSettings } from '../../store/settings';

const defaultSettings: PrintViewSettings = {
  showLabel: true,
  showSize: true,
  showHeight: true,
  showCategoryColor: true,
  showNotes: false,
  showCustomProperties: false,
};

const defaultCategory: Category = {
  id: 'cat-1',
  name: 'Test Category',
  color: '#3b82f6',
};

function createBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin-1',
    x: 0,
    y: 0,
    width: 2,
    depth: 2,
    height: 3,
    layerId: 'layer-1',
    category: 'cat-1',
    label: '',
    notes: '',
    ...overrides,
  };
}

function createDrawer(overrides: Partial<Drawer> = {}): Drawer {
  return {
    width: 10,
    depth: 8,
    height: 12,
    ...overrides,
  };
}

describe('PrintBin', () => {
  describe('grid positioning', () => {
    it('renders bin at correct position for integer drawer', () => {
      const bin = createBin({ x: 2, y: 3, width: 2, depth: 2 });
      const drawer = createDrawer({ width: 10, depth: 8 });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // y=3, depth=2 means top at y=5, CSS row = 8 - 5 + 1 = 4 (from bottom)
      // Actually: integerDepth - floor(y) = 8 - 3 = 5 for bottom row
      // topRow for y=5-0.001 → floor(4.999) = 4, row = 8 - 4 = 4
      expect(binElement?.getAttribute('style')).toContain('grid-column: 3 / span 2');
    });

    it('positions bin correctly with fractionalEdgeX=start', () => {
      const bin = createBin({ x: 1, y: 0, width: 2, depth: 1 });
      const drawer = createDrawer({
        width: 10.5,
        depth: 8,
        fractionalEdgeX: 'start',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // x=1 is >= 0.5 (fractional part), so CSS col = floor(1 - 0.5) + 2 = 2
      expect(binElement?.getAttribute('style')).toContain('grid-column: 2');
    });

    it('positions bin correctly with fractionalEdgeX=end', () => {
      const bin = createBin({ x: 9, y: 0, width: 1.5, depth: 1 });
      const drawer = createDrawer({
        width: 10.5,
        depth: 8,
        fractionalEdgeX: 'end',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // x=9, floor(9)+1 = 10
      expect(binElement?.getAttribute('style')).toContain('grid-column: 10');
    });

    it('positions bin correctly with fractionalEdgeY=start', () => {
      const bin = createBin({ x: 0, y: 1, width: 1, depth: 2 });
      const drawer = createDrawer({
        width: 10,
        depth: 8.5,
        fractionalEdgeY: 'start',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // y=1 >= 0.5 (fractional part), CSS row calculation uses fractionalEdgeY=start logic
    });

    it('positions bin correctly with fractionalEdgeY=end', () => {
      const bin = createBin({ x: 0, y: 7, width: 1, depth: 1.5 });
      const drawer = createDrawer({
        width: 10,
        depth: 8.5,
        fractionalEdgeY: 'end',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
    });

    it('positions bin in fractional row at bottom with fractionalEdgeY=start', () => {
      const bin = createBin({ x: 0, y: 0, width: 1, depth: 0.5 });
      const drawer = createDrawer({
        width: 10,
        depth: 8.5,
        fractionalEdgeY: 'start',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // y=0 < 0.5, should be in the fractional row at bottom (CSS row = gridRows = 9)
      expect(binElement?.getAttribute('style')).toContain('grid-row: 9');
    });

    it('positions bin in fractional column at left with fractionalEdgeX=start', () => {
      const bin = createBin({ x: 0, y: 0, width: 0.5, depth: 1 });
      const drawer = createDrawer({
        width: 10.5,
        depth: 8,
        fractionalEdgeX: 'start',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // x=0 < 0.5, should be in the fractional column at left (CSS col = 1)
      expect(binElement?.getAttribute('style')).toContain('grid-column: 1');
    });
  });

  describe('pixel dimensions and offsets', () => {
    it('calculates custom pixel width for fractional drawer with fractionalEdgeX=start', () => {
      const bin = createBin({ x: 0, y: 0, width: 1, depth: 1 });
      const drawer = createDrawer({
        width: 10.5,
        depth: 8,
        fractionalEdgeX: 'start',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // Bin at x=0 with width=1 is entirely in fractional column (0.5 wide)
      // Since bin.width > fractionalWidthPart, it spans into integer cells
    });

    it('calculates custom pixel height for fractional drawer with fractionalEdgeY=end', () => {
      const bin = createBin({ x: 0, y: 7, width: 1, depth: 1.5 });
      const drawer = createDrawer({
        width: 10,
        depth: 8.5,
        fractionalEdgeY: 'end',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // Bin extends into fractional row at top
    });

    it('applies correct offset for bin in integer area with fractionalEdgeX=start', () => {
      const bin = createBin({ x: 1.5, y: 0, width: 1, depth: 1 });
      const drawer = createDrawer({
        width: 10.5,
        depth: 8,
        fractionalEdgeX: 'start',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // x=1.5 is in integer area (>= 0.5), integerX = 1.5 - 0.5 = 1.0
      // offsetX = (1.0 - floor(1.0)) * (32 + 1) = 0
    });

    it('applies correct offset for bin with fractionalEdgeY=start in integer area', () => {
      const bin = createBin({ x: 0, y: 1, width: 1, depth: 1.5 });
      const drawer = createDrawer({
        width: 10,
        depth: 8.5,
        fractionalEdgeY: 'start',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
    });

    it('applies correct offset for bin entirely in fractional row at bottom', () => {
      const bin = createBin({ x: 0, y: 0.25, width: 1, depth: 0.25 });
      const drawer = createDrawer({
        width: 10,
        depth: 8.5,
        fractionalEdgeY: 'start',
      });

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement).toBeTruthy();
      // binEndY = 0.5, which equals fractionalDepthPart
      // offsetY = (0.5 - 0.5) / 0.5 * fractionalCellHeight = 0
    });
  });

  describe('label rendering', () => {
    it('renders label when showLabel is true and label fits', () => {
      const bin = createBin({ label: 'Test', width: 3, depth: 3 });
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showLabel: true }}
        />
      );

      expect(container.textContent).toContain('Test');
    });

    it('shows dimensions when label is too long to fit', () => {
      const bin = createBin({ label: 'This is a very long label that will not fit', width: 1, depth: 1 });
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showLabel: true }}
        />
      );

      // Should show dimensions instead of label
      expect(container.textContent).toContain('1×1');
    });

    it('rotates text for tall narrow bins', () => {
      const bin = createBin({ width: 1, depth: 3 }); // depth > width * 1.5
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const contentDiv = container.querySelector('.print-bin-content');
      expect(contentDiv?.getAttribute('style')).toContain('rotate(-90deg)');
    });

    it('does not rotate text for square bins', () => {
      const bin = createBin({ width: 2, depth: 2 });
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={defaultSettings}
        />
      );

      const contentDiv = container.querySelector('.print-bin-content');
      expect(contentDiv?.getAttribute('style')).not.toContain('rotate');
    });

    it('shows secondary text (dimensions) when label is primary and space permits', () => {
      const bin = createBin({ label: 'ABC', width: 4, depth: 4 });
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showLabel: true, showSize: true }}
        />
      );

      // Should show both label and dimensions
      expect(container.textContent).toContain('ABC');
      expect(container.textContent).toContain('4×4');
    });

    it('formats fractional dimensions correctly', () => {
      const bin = createBin({ width: 1.5, depth: 2.5 });
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showSize: true }}
        />
      );

      expect(container.textContent).toContain('1.5×2.5');
    });
  });

  describe('additional properties', () => {
    it('renders height when showHeight is true', () => {
      const bin = createBin({ height: 5 });
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showHeight: true }}
        />
      );

      expect(container.textContent).toContain('5u');
    });

    it('renders notes when showNotes is true', () => {
      const bin = createBin({ notes: 'Test notes', width: 3, depth: 3 });
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showNotes: true }}
        />
      );

      expect(container.textContent).toContain('Test notes');
    });

    it('renders custom properties when showCustomProperties is true', () => {
      const bin = createBin({
        width: 3,
        depth: 3,
        customProperties: { SKU: '12345' },
      });
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showCustomProperties: true }}
        />
      );

      expect(container.textContent).toContain('SKU: 12345');
    });
  });

  describe('color handling', () => {
    it('uses category color when showCategoryColor is true', () => {
      const bin = createBin();
      const drawer = createDrawer();
      const category = { ...defaultCategory, color: '#ff0000' };

      const { container } = render(
        <PrintBin
          bin={bin}
          category={category}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showCategoryColor: true }}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement?.getAttribute('style')).toContain('background-color: rgb(255, 0, 0)');
    });

    it('uses gray when showCategoryColor is false', () => {
      const bin = createBin();
      const drawer = createDrawer();

      const { container } = render(
        <PrintBin
          bin={bin}
          category={defaultCategory}
          drawer={drawer}
          cellSize={32}
          gap={1}
          settings={{ ...defaultSettings, showCategoryColor: false }}
        />
      );

      const binElement = container.querySelector('.print-bin');
      expect(binElement?.getAttribute('style')).toContain('background-color: rgb(229, 231, 235)');
    });
  });
});
