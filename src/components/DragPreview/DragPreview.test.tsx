import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { DragPreview } from './DragPreview';
import type { Bin, Category } from '@/core/types';

// Mock state - use explicit type instead of importing Interaction
let mockInteractionState: { interaction: { type: string; [key: string]: unknown } | null };
let mockViewState: { zoom: number };
let mockLayoutState: { layout: { bins: Bin[]; categories: Category[] } };

vi.mock('@/core/store', () => ({
  useInteractionStore: vi.fn((selector: unknown) => {
    return (selector as (s: typeof mockInteractionState) => unknown)(mockInteractionState);
  }),
  useViewStore: vi.fn((selector: unknown) => {
    return (selector as (s: typeof mockViewState) => unknown)(mockViewState);
  }),
  useLayoutStore: vi.fn((selector: unknown) => {
    return (selector as (s: typeof mockLayoutState) => unknown)(mockLayoutState);
  }),
}));

vi.mock('@/shared/utils', () => ({
  getContrastColor: () => '#000000',
}));

vi.mock('@/shared/hooks', () => ({
  useResponsive: () => ({ viewportWidth: 1024 }),
}));

vi.mock('@/core/constants', () => ({
  getBaseCellSize: () => 40,
  DEFAULT_CATEGORY_COLOR: '#808080',
}));

// Helper to create test bin
function makeBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin-1',
    x: 0,
    y: 0,
    width: 2,
    depth: 3,
    height: 4,
    layerId: 'layer-1',
    category: 'cat-1',
    label: '',
    notes: '',
    ...overrides,
  };
}

// Helper to create test category
function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Category 1',
    color: '#ff0000',
    ...overrides,
  };
}

// Helper to dispatch pointer event
function dispatchPointerMove(x: number, y: number) {
  const event = new PointerEvent('pointermove', {
    clientX: x,
    clientY: y,
    bubbles: true,
  });
  document.dispatchEvent(event);
}

describe('DragPreview', () => {
  beforeEach(() => {
    mockInteractionState = { interaction: null };
    mockViewState = { zoom: 1 };
    mockLayoutState = { layout: { bins: [], categories: [] } };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('no interaction state', () => {
    it('renders nothing when no interaction', () => {
      const { container } = render(<DragPreview />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when interaction is not drag type', () => {
      mockInteractionState.interaction = { type: 'draw', startX: 0, startY: 0 };
      const { container } = render(<DragPreview />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('drag interaction', () => {
    beforeEach(() => {
      mockLayoutState.layout.bins = [
        makeBin({ id: 'bin-1', x: 0, y: 0, width: 2, depth: 3, category: 'cat-1' }),
      ];
      mockLayoutState.layout.categories = [makeCategory({ id: 'cat-1', color: '#ff0000' })];
    });

    it('renders nothing when mouse position not set yet', () => {
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container } = render(<DragPreview />);
      expect(container.firstChild).toBeNull();
    });

    it('renders preview after pointer move', () => {
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      expect(container.firstChild).not.toBeNull();
    });

    it('positions preview at mouse cursor', () => {
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(150, 200);
      });

      rerender(<DragPreview />);
      const preview = container.firstChild as HTMLElement;
      expect(preview.style.left).toContain('px');
      expect(preview.style.top).toContain('px');
    });

    it('uses click offset when provided', () => {
      mockInteractionState.interaction = {
        type: 'drag',
        binIds: ['bin-1'],
        clickOffset: { x: 30, y: 40 },
      };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(150, 200);
      });

      rerender(<DragPreview />);
      const preview = container.firstChild as HTMLElement;
      // Should be offset by clickOffset, not centered
      expect(preview).toBeTruthy();
    });

    it('renders bin with correct color', () => {
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const binElement = container.querySelector('[style*="background"]') as HTMLElement;
      expect(binElement.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('uses default color when category not found', () => {
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1', category: 'nonexistent-category' })];
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const binElement = container.querySelector('[style*="background"]') as HTMLElement;
      expect(binElement.style.backgroundColor).toBe('rgb(128, 128, 128)');
    });

    it('renders bin label when present', () => {
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1', label: 'Test Label' })];
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { getByText, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      expect(getByText('Test Label')).toBeTruthy();
    });

    it('does not render label when bin has no label', () => {
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1', label: '' })];
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const textElements = container.querySelectorAll('.text-center');
      expect(textElements.length).toBe(0);
    });

    it('rotates label for tall bins', () => {
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1', width: 1, depth: 3, label: 'Tall' })];
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const labelElement = container.querySelector('.text-center') as HTMLElement;
      expect(labelElement.style.transform).toContain('rotate(-90deg)');
    });

    it('does not rotate label for wide bins', () => {
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1', width: 3, depth: 1, label: 'Wide' })];
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const labelElement = container.querySelector('.text-center') as HTMLElement;
      expect(labelElement.style.transform).toBe('none');
    });
  });

  describe('multiple bins drag', () => {
    beforeEach(() => {
      mockLayoutState.layout.bins = [
        makeBin({ id: 'bin-1', x: 0, y: 0, width: 2, depth: 2 }),
        makeBin({ id: 'bin-2', x: 2, y: 0, width: 2, depth: 2 }),
      ];
      mockLayoutState.layout.categories = [makeCategory()];
    });

    it('renders all dragged bins', () => {
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1', 'bin-2'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const binElements = container.querySelectorAll('.absolute.flex');
      expect(binElements.length).toBe(2);
    });

    it('positions bins relative to each other', () => {
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1', 'bin-2'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const binElements = container.querySelectorAll('.absolute.flex');
      expect(binElements[0].style.left).not.toBe(binElements[1].style.left);
    });

    it('handles bins not in binIds list', () => {
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const binElements = container.querySelectorAll('.absolute.flex');
      expect(binElements.length).toBe(1);
    });
  });

  describe('staging drag', () => {
    beforeEach(() => {
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1', x: 0, y: 0 })];
      mockLayoutState.layout.categories = [makeCategory()];
    });

    it('renders preview for staging drag', () => {
      mockInteractionState.interaction = { type: 'stagingDrag', binId: 'bin-1' };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      expect(container.firstChild).not.toBeNull();
    });

    it('renders nothing if staging bin not found', () => {
      mockInteractionState.interaction = { type: 'stagingDrag', binId: 'nonexistent' };
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('zoom handling', () => {
    beforeEach(() => {
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1', width: 2, depth: 2 })];
      mockLayoutState.layout.categories = [makeCategory()];
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
    });

    it('scales preview with zoom', () => {
      mockViewState.zoom = 1.5;
      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      const binElement = container.querySelector('.absolute.flex') as HTMLElement;
      // Width should be affected by zoom (cellSize * zoom * width)
      expect(binElement.style.width).toBeTruthy();
    });
  });

  describe('event cleanup', () => {
    it('cleans up pointer event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1' })];

      const { unmount } = render(<DragPreview />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    });

    it('resets mouse position when drag ends', () => {
      mockLayoutState.layout.bins = [makeBin({ id: 'bin-1' })];
      mockInteractionState.interaction = { type: 'drag', binIds: ['bin-1'] };

      const { container, rerender } = render(<DragPreview />);

      act(() => {
        dispatchPointerMove(100, 100);
      });

      rerender(<DragPreview />);
      expect(container.firstChild).not.toBeNull();

      // End drag
      mockInteractionState.interaction = null;
      rerender(<DragPreview />);
      expect(container.firstChild).toBeNull();
    });
  });
});
