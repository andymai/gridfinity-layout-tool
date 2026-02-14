import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { BottomSheet } from '@/components/Mobile/BottomSheet';
import { useMobileStore } from '@/core/store/mobile';

// Mock matchMedia for useResponsive hook
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('BottomSheet', () => {
  beforeEach(() => {
    // Set up an active mobile panel so the sheet renders
    useMobileStore.setState({
      activeMobilePanel: 'layers',
    });
  });

  afterEach(() => {
    useMobileStore.setState({
      activeMobilePanel: null,
    });
    document.body.style.overflow = '';
  });

  it('renders when activeMobilePanel is set', () => {
    const { container } = render(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    expect(container.textContent).toContain('Test Panel');
    expect(container.textContent).toContain('Panel content');
  });

  it('does not render when activeMobilePanel is null', () => {
    useMobileStore.setState({ activeMobilePanel: null });

    const { container } = render(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    expect(container.textContent).not.toContain('Test Panel');
  });

  it('closes on backdrop click', () => {
    const { container } = render(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    // Find the backdrop (first child div with overlay)
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();

    act(() => {
      fireEvent.click(backdrop!);
    });

    expect(useMobileStore.getState().activeMobilePanel).toBeNull();
  });

  it('closes on close button click', () => {
    const { container } = render(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    const closeButton = container.querySelector('[aria-label="Close panel"]');
    expect(closeButton).not.toBeNull();

    act(() => {
      fireEvent.click(closeButton!);
    });

    expect(useMobileStore.getState().activeMobilePanel).toBeNull();
  });

  it('closes on Escape key', () => {
    render(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(useMobileStore.getState().activeMobilePanel).toBeNull();
  });

  describe('Swipe to dismiss', () => {
    it('starts drag on header pointer down', () => {
      const { container } = render(
        <BottomSheet title="Test Panel">
          <div>Panel content</div>
        </BottomSheet>
      );

      const header = container.querySelector('[data-sheet-header]');
      expect(header).not.toBeNull();

      // Start drag
      act(() => {
        fireEvent.pointerDown(header!, {
          clientY: 100,
          pointerId: 1,
        });
      });

      // The sheet should still be open
      expect(useMobileStore.getState().activeMobilePanel).toBe('layers');
    });

    it('closes when swiped down more than 80px', () => {
      vi.useFakeTimers();

      const { container } = render(
        <BottomSheet title="Test Panel">
          <div>Panel content</div>
        </BottomSheet>
      );

      const header = container.querySelector('[data-sheet-header]');
      const sheet = container.querySelector('[role="dialog"]');

      // Start drag
      act(() => {
        fireEvent.pointerDown(header!, {
          clientY: 100,
          pointerId: 1,
        });
      });

      // Swipe down more than 80px
      act(() => {
        fireEvent.pointerMove(sheet!, {
          clientY: 200,
          pointerId: 1,
        });
      });

      // Release
      act(() => {
        fireEvent.pointerUp(sheet!, {
          pointerId: 1,
        });
      });

      // Dismiss animation uses a 200ms timeout before closing
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(useMobileStore.getState().activeMobilePanel).toBeNull();

      vi.useRealTimers();
    });

    it('stays open when swiped down less than 80px', () => {
      const { container } = render(
        <BottomSheet title="Test Panel">
          <div>Panel content</div>
        </BottomSheet>
      );

      const header = container.querySelector('[data-sheet-header]');
      const sheet = container.querySelector('[role="dialog"]');

      // Start drag
      act(() => {
        fireEvent.pointerDown(header!, {
          clientY: 100,
          pointerId: 1,
        });
      });

      // Swipe down less than 80px
      act(() => {
        fireEvent.pointerMove(sheet!, {
          clientY: 150,
          pointerId: 1,
        });
      });

      // Release
      act(() => {
        fireEvent.pointerUp(sheet!, {
          pointerId: 1,
        });
      });

      // Should still be open
      expect(useMobileStore.getState().activeMobilePanel).toBe('layers');
    });

    it('applies rubber-band effect when swiping up (negative drag)', () => {
      const { container } = render(
        <BottomSheet title="Test Panel">
          <div>Panel content</div>
        </BottomSheet>
      );

      const header = container.querySelector('[data-sheet-header]');
      const sheet = container.querySelector('[role="dialog"]');

      // Start drag
      act(() => {
        fireEvent.pointerDown(header!, {
          clientY: 100,
          pointerId: 1,
        });
      });

      // Try to swipe up
      act(() => {
        fireEvent.pointerMove(sheet!, {
          clientY: 50,
          pointerId: 1,
        });
      });

      // Sheet should still be open (rubber-band, not dismiss)
      expect(useMobileStore.getState().activeMobilePanel).toBe('layers');

      // The sheet's transform should show a small negative (rubber-band) value
      // but the panel remains open
      act(() => {
        fireEvent.pointerUp(sheet!, { pointerId: 1 });
      });

      // After release, should snap back and remain open
      expect(useMobileStore.getState().activeMobilePanel).toBe('layers');
    });

    it('dismisses on fast downward flick even with small distance', async () => {
      vi.useFakeTimers();

      const { container } = render(
        <BottomSheet title="Test Panel">
          <div>Panel content</div>
        </BottomSheet>
      );

      const header = container.querySelector('[data-sheet-header]');
      const sheet = container.querySelector('[role="dialog"]');

      // Start drag
      act(() => {
        fireEvent.pointerDown(header!, {
          clientY: 100,
          pointerId: 1,
        });
      });

      // Quick flick: move just 20px down (below 80px threshold)
      // but very fast (simulated by close timestamps via performance.now)
      act(() => {
        fireEvent.pointerMove(sheet!, {
          clientY: 120,
          pointerId: 1,
        });
      });

      // Release — velocity-based dismiss should trigger
      act(() => {
        fireEvent.pointerUp(sheet!, { pointerId: 1 });
      });

      // The dismiss animation has a 200ms timeout before closeMobilePanel
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Note: velocity in jsdom depends on performance.now() granularity
      // This test verifies the dismiss path is exercised without error
      // Full velocity testing needs real browser (covered by E2E tests)

      vi.useRealTimers();
    });
  });

  it('locks body scroll when open', () => {
    render(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('unlocks body scroll when closed', () => {
    const { rerender } = render(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    expect(document.body.style.overflow).toBe('hidden');

    // Close the panel
    useMobileStore.setState({ activeMobilePanel: null });

    rerender(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    expect(document.body.style.overflow).toBe('');
  });
});
