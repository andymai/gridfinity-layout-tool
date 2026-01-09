import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Bin } from '../components/Grid/Bin';
import { useUIStore } from '../store/ui';
import { useLayoutStore } from '../store/layout';
import { createDefaultLayout } from '../constants';
import type { Bin as BinType, Category, Layer } from '../types';

// Mock useResponsive to simulate touch device
vi.mock('../hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    isTouchDevice: true,
    layoutMode: 'mobile' as const,
    viewportWidth: 375,
  }),
}));

// Mock navigator.vibrate
const vibrateMock = vi.fn();
Object.defineProperty(navigator, 'vibrate', {
  value: vibrateMock,
  writable: true,
});

describe('Mobile Touch Interactions', () => {
  let defaultLayout: ReturnType<typeof createDefaultLayout>;
  let testBin: BinType;
  let testCategory: Category;
  let testLayer: Layer;
  const mockStartDrag = vi.fn();
  const mockStartResize = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vibrateMock.mockClear();
    mockStartDrag.mockClear();
    mockStartResize.mockClear();

    defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout });
    useUIStore.setState({
      activeLayerId: defaultLayout.layers[0].id,
      selectedBinIds: [],
      activeCategoryId: defaultLayout.categories[0].id,
      zoom: 1,
      showOtherLayers: true,
      showLabels: true,
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      interaction: null,
      dropTarget: null,
      paintSize: null,
      activeMobilePanel: null,
      contextMenu: null,
      showIsometricPreview: true,
      isometricRotation: 0,
      hideLayersAbove: false,
      dimInactiveLayers: true,
      isPreviewExpanded: false,
    });

    testCategory = defaultLayout.categories[0];
    testLayer = defaultLayout.layers[0];
    testBin = {
      id: 'test-bin-1',
      x: 2,
      y: 2,
      width: 2,
      depth: 2,
      height: 3,
      layerId: testLayer.id,
      category: testCategory.id,
      label: 'Test Bin',
      notes: '',
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Long-press context menu', () => {
    it('shows context menu after 500ms long press', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');
      expect(binEl).not.toBeNull();

      // Start touch (pointer down)
      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Advance timer to just before threshold
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Context menu should not be shown yet
      expect(useUIStore.getState().contextMenu).toBeNull();

      // Advance past threshold
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Context menu should now be shown
      const contextMenu = useUIStore.getState().contextMenu;
      expect(contextMenu).not.toBeNull();
      expect(contextMenu?.binId).toBe(testBin.id);
    });

    it('triggers haptic feedback on long press', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');

      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Advance past long-press threshold
      act(() => {
        vi.advanceTimersByTime(550);
      });

      // Haptic feedback should have been triggered
      expect(vibrateMock).toHaveBeenCalledWith(50);
    });

    it('cancels long press on pointer move > 10px', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');

      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Move pointer more than 10px
      act(() => {
        fireEvent.pointerMove(binEl!, {
          clientX: 115,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Advance past long-press threshold
      act(() => {
        vi.advanceTimersByTime(550);
      });

      // Context menu should not appear (long press was cancelled)
      expect(useUIStore.getState().contextMenu).toBeNull();

      // Drag should have started instead
      expect(mockStartDrag).toHaveBeenCalledWith(testBin.id, 115, 100);
    });

    it('cancels long press on pointer up', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');

      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Release before threshold
      act(() => {
        vi.advanceTimersByTime(300);
        fireEvent.pointerUp(binEl!, { pointerId: 1 });
      });

      // Advance past threshold
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Context menu should not appear
      expect(useUIStore.getState().contextMenu).toBeNull();
    });
  });

  describe('Touch selection', () => {
    it('selects bin on pointer down (touch device)', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');

      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Bin should be selected immediately on touch
      expect(useUIStore.getState().selectedBinIds).toContain(testBin.id);
    });

    it('does not start drag immediately on touch (waits for move)', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');

      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Drag should not start until move
      expect(mockStartDrag).not.toHaveBeenCalled();
    });
  });

  describe('Touch drag', () => {
    it('starts drag after moving 10px on touch device', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');

      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Move less than 10px - should not start drag
      act(() => {
        fireEvent.pointerMove(binEl!, {
          clientX: 105,
          clientY: 100,
          pointerId: 1,
        });
      });

      expect(mockStartDrag).not.toHaveBeenCalled();

      // Move more than 10px total - should start drag
      act(() => {
        fireEvent.pointerMove(binEl!, {
          clientX: 115,
          clientY: 100,
          pointerId: 1,
        });
      });

      expect(mockStartDrag).toHaveBeenCalledWith(testBin.id, 115, 100);
    });

    it('does not start drag after long press triggers', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');

      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Wait for long press to trigger
      act(() => {
        vi.advanceTimersByTime(550);
      });

      // Context menu should be showing
      expect(useUIStore.getState().contextMenu).not.toBeNull();

      // Now move - should NOT start drag because long press already triggered
      act(() => {
        fireEvent.pointerMove(binEl!, {
          clientX: 115,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Drag should not have started
      expect(mockStartDrag).not.toHaveBeenCalled();
    });
  });

  describe('Resize handles', () => {
    it('resize handles have 44px touch targets', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={true}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      // Find resize handles by their aria-label
      const rightHandle = container.querySelector('[aria-label="Resize width"]');
      const bottomHandle = container.querySelector('[aria-label="Resize depth"]');
      const cornerHandle = container.querySelector('[aria-label="Resize width and depth"]');

      expect(rightHandle).not.toBeNull();
      expect(bottomHandle).not.toBeNull();
      expect(cornerHandle).not.toBeNull();

      // Check touch target sizes (44px minimum per Apple HIG)
      // These should be set to 44px in the component
      expect(rightHandle).toHaveStyle({ width: '44px' });
      expect(cornerHandle).toHaveStyle({ width: '44px', height: '44px' });
    });

    it('starts resize on handle pointer down', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={false}
          isSelected={true}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const cornerHandle = container.querySelector('[aria-label="Resize width and depth"]');

      act(() => {
        fireEvent.pointerDown(cornerHandle!, {
          button: 0,
          clientX: 200,
          clientY: 200,
          pointerId: 1,
        });
      });

      expect(mockStartResize).toHaveBeenCalledWith(testBin.id, 'se');
    });
  });

  describe('Ghost bins', () => {
    it('does not respond to touch events on ghost bins', () => {
      const { container } = render(
        <Bin
          bin={testBin}
          category={testCategory}
          layer={testLayer}
          drawer={{ width: 10, depth: 8 }}
          isGhost={true}
          isSelected={false}
          onStartDrag={mockStartDrag}
          onStartResize={mockStartResize}
        />
      );

      const binEl = container.querySelector('[data-bin-id]');

      act(() => {
        fireEvent.pointerDown(binEl!, {
          button: 0,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        });
      });

      // Should not select or start drag on ghost bin
      expect(useUIStore.getState().selectedBinIds).not.toContain(testBin.id);
      expect(mockStartDrag).not.toHaveBeenCalled();
    });
  });
});
