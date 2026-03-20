import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { use3DPreviewKeyboard } from '@/shared/hooks/use3DPreviewKeyboard';

// Helper to create keyboard event
function createKeyboardEvent(key: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

// Helper to dispatch keyboard event
function pressKey(
  key: string,
  target: EventTarget = document,
  options: Partial<KeyboardEventInit> = {}
) {
  const event = createKeyboardEvent(key, options);
  Object.defineProperty(event, 'target', { value: target, enumerable: true });
  document.dispatchEvent(event);
  return event;
}

describe('use3DPreviewKeyboard', () => {
  let mockTogglePreviewVisibility: Mock<() => void>;
  let mockTogglePreviewExpanded: Mock<() => void>;
  let mockSetPreviewExpanded: Mock<(expanded: boolean) => void>;
  let mockToggleExplodedView: Mock<() => void>;

  const defaultProps = () => ({
    isPreviewVisible: true,
    isPreviewExpanded: false,
    togglePreviewVisibility: mockTogglePreviewVisibility,
    togglePreviewExpanded: mockTogglePreviewExpanded,
    setPreviewExpanded: mockSetPreviewExpanded,
    toggleExplodedView: mockToggleExplodedView,
    isExplodedSupported: true,
  });

  beforeEach(() => {
    mockTogglePreviewVisibility = vi.fn();
    mockTogglePreviewExpanded = vi.fn();
    mockSetPreviewExpanded = vi.fn();
    mockToggleExplodedView = vi.fn();
  });

  describe('v key - toggle preview visibility', () => {
    it('toggles preview visibility when v is pressed', () => {
      renderHook(() => use3DPreviewKeyboard(defaultProps()));

      act(() => {
        const event = pressKey('v');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockTogglePreviewVisibility).toHaveBeenCalledTimes(1);
    });

    it('works when preview is hidden (special case)', () => {
      renderHook(() => use3DPreviewKeyboard({ ...defaultProps(), isPreviewVisible: false }));

      act(() => {
        pressKey('v');
      });

      expect(mockTogglePreviewVisibility).toHaveBeenCalledTimes(1);
    });
  });

  describe('Space key - toggle expand/collapse', () => {
    it('toggles expanded state when preview is visible', () => {
      renderHook(() => use3DPreviewKeyboard(defaultProps()));

      act(() => {
        const event = pressKey(' ');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockTogglePreviewExpanded).toHaveBeenCalledTimes(1);
    });

    it('does not toggle when preview is hidden', () => {
      renderHook(() => use3DPreviewKeyboard({ ...defaultProps(), isPreviewVisible: false }));

      act(() => {
        pressKey(' ');
      });

      expect(mockTogglePreviewExpanded).not.toHaveBeenCalled();
    });
  });

  describe('Escape key - close expanded view', () => {
    it('closes expanded view when preview is visible and expanded', () => {
      renderHook(() => use3DPreviewKeyboard({ ...defaultProps(), isPreviewExpanded: true }));

      act(() => {
        const event = pressKey('Escape');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockSetPreviewExpanded).toHaveBeenCalledWith(false);
    });

    it('does not close when preview is not expanded', () => {
      renderHook(() => use3DPreviewKeyboard(defaultProps()));

      act(() => {
        pressKey('Escape');
      });

      expect(mockSetPreviewExpanded).not.toHaveBeenCalled();
    });

    it('does not close when preview is hidden', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          ...defaultProps(),
          isPreviewVisible: false,
          isPreviewExpanded: true,
        })
      );

      act(() => {
        pressKey('Escape');
      });

      expect(mockSetPreviewExpanded).not.toHaveBeenCalled();
    });
  });

  describe('e key - toggle exploded view', () => {
    it('toggles exploded view when preview is visible and supported', () => {
      renderHook(() => use3DPreviewKeyboard(defaultProps()));

      act(() => {
        const event = pressKey('e');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockToggleExplodedView).toHaveBeenCalledTimes(1);
    });

    it('does not toggle when preview is hidden', () => {
      renderHook(() => use3DPreviewKeyboard({ ...defaultProps(), isPreviewVisible: false }));

      act(() => {
        pressKey('e');
      });

      expect(mockToggleExplodedView).not.toHaveBeenCalled();
    });

    it('does not toggle when exploded is not supported (mobile/single layer)', () => {
      renderHook(() => use3DPreviewKeyboard({ ...defaultProps(), isExplodedSupported: false }));

      act(() => {
        pressKey('e');
      });

      expect(mockToggleExplodedView).not.toHaveBeenCalled();
    });
  });

  describe('input field detection', () => {
    it('does not handle shortcuts when typing in INPUT element', () => {
      renderHook(() => use3DPreviewKeyboard(defaultProps()));

      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        pressKey('v', input);
        pressKey(' ', input);
        pressKey('e', input);
      });

      expect(mockTogglePreviewVisibility).not.toHaveBeenCalled();
      expect(mockTogglePreviewExpanded).not.toHaveBeenCalled();
      expect(mockToggleExplodedView).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('does not handle shortcuts when typing in TEXTAREA element', () => {
      renderHook(() => use3DPreviewKeyboard(defaultProps()));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      act(() => {
        pressKey('v', textarea);
        pressKey(' ', textarea);
      });

      expect(mockTogglePreviewVisibility).not.toHaveBeenCalled();
      expect(mockTogglePreviewExpanded).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('does not handle shortcuts in contentEditable elements', () => {
      renderHook(() => use3DPreviewKeyboard(defaultProps()));

      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      Object.defineProperty(div, 'isContentEditable', {
        value: true,
        writable: true,
      });
      document.body.appendChild(div);

      act(() => {
        pressKey('v', div);
        pressKey(' ', div);
      });

      expect(mockTogglePreviewVisibility).not.toHaveBeenCalled();
      expect(mockTogglePreviewExpanded).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });

    it('handles shortcuts normally when target is a regular element', () => {
      renderHook(() => use3DPreviewKeyboard(defaultProps()));

      const div = document.createElement('div');
      document.body.appendChild(div);

      act(() => {
        pressKey('v', div);
      });

      expect(mockTogglePreviewVisibility).toHaveBeenCalledTimes(1);

      document.body.removeChild(div);
    });
  });

  describe('event listener cleanup', () => {
    it('removes event listener on unmount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => use3DPreviewKeyboard(defaultProps()));

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('dependency updates', () => {
    it('updates handler when visibility changes', () => {
      const { rerender } = renderHook(
        ({ visible }) => use3DPreviewKeyboard({ ...defaultProps(), isPreviewVisible: visible }),
        { initialProps: { visible: true } }
      );

      act(() => {
        pressKey(' ');
      });

      expect(mockTogglePreviewExpanded).toHaveBeenCalledTimes(1);

      mockTogglePreviewExpanded.mockClear();

      rerender({ visible: false });

      act(() => {
        pressKey(' ');
      });

      expect(mockTogglePreviewExpanded).not.toHaveBeenCalled();
    });
  });
});
