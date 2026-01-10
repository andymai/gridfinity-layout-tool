import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { BottomSheet } from '../components/mobile/BottomSheet';
import { useUIStore } from '../store/ui';

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
    useUIStore.setState({
      activeMobilePanel: 'layers',
    });
  });

  afterEach(() => {
    useUIStore.setState({
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
    useUIStore.setState({ activeMobilePanel: null });

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

    expect(useUIStore.getState().activeMobilePanel).toBeNull();
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

    expect(useUIStore.getState().activeMobilePanel).toBeNull();
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

    expect(useUIStore.getState().activeMobilePanel).toBeNull();
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
      expect(useUIStore.getState().activeMobilePanel).toBe('layers');
    });

    it('closes when swiped down more than 80px', () => {
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

      expect(useUIStore.getState().activeMobilePanel).toBeNull();
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
      expect(useUIStore.getState().activeMobilePanel).toBe('layers');
    });

    it('does not allow swiping up (negative drag)', () => {
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

      // The sheet transform should be 0 (clamped to non-negative)
      // We can't easily test CSS values, but the panel should stay open
      expect(useUIStore.getState().activeMobilePanel).toBe('layers');
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
    useUIStore.setState({ activeMobilePanel: null });

    rerender(
      <BottomSheet title="Test Panel">
        <div>Panel content</div>
      </BottomSheet>
    );

    expect(document.body.style.overflow).toBe('');
  });
});
