import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { use3DPreviewKeyboard } from '@/hooks/use3DPreviewKeyboard';
import type { SceneHandle } from '@/components/Grid/IsometricPreview/Scene';

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
  let mockSceneRef: React.RefObject<SceneHandle | null>;
  let mockTogglePreviewVisibility: Mock<() => void>;
  let mockTogglePreviewExpanded: Mock<() => void>;
  let mockSetPreviewExpanded: Mock<(expanded: boolean) => void>;
  let mockResetView: Mock<() => void>;
  let mockSetPreset: Mock<SceneHandle['setPreset']>;

  beforeEach(() => {
    // Create mock functions with proper types
    mockTogglePreviewVisibility = vi.fn();
    mockTogglePreviewExpanded = vi.fn();
    mockSetPreviewExpanded = vi.fn();
    mockResetView = vi.fn();
    mockSetPreset = vi.fn();

    // Create mock scene ref
    mockSceneRef = {
      current: {
        resetView: mockResetView,
        setPreset: mockSetPreset,
      },
    };
  });

  describe('v key - toggle preview visibility', () => {
    it('toggles preview visibility when v is pressed', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        const event = pressKey('v');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockTogglePreviewVisibility).toHaveBeenCalledTimes(1);
    });

    it('works when preview is hidden (special case)', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: false,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        pressKey('v');
      });

      expect(mockTogglePreviewVisibility).toHaveBeenCalledTimes(1);
    });
  });

  describe('Space key - toggle expand/collapse', () => {
    it('toggles expanded state when preview is visible', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        const event = pressKey(' ');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockTogglePreviewExpanded).toHaveBeenCalledTimes(1);
    });

    it('does not toggle when preview is hidden', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: false,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        pressKey(' ');
      });

      expect(mockTogglePreviewExpanded).not.toHaveBeenCalled();
    });
  });

  describe('Escape key - close expanded view', () => {
    it('closes expanded view when preview is visible and expanded', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: true,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        const event = pressKey('Escape');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockSetPreviewExpanded).toHaveBeenCalledWith(false);
    });

    it('does not close when preview is not expanded', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        pressKey('Escape');
      });

      expect(mockSetPreviewExpanded).not.toHaveBeenCalled();
    });

    it('does not close when preview is hidden', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: false,
          isPreviewExpanded: true,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        pressKey('Escape');
      });

      expect(mockSetPreviewExpanded).not.toHaveBeenCalled();
    });
  });

  describe('1-3 keys - camera presets', () => {
    it('sets isometric preset on 1 key', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        const event = pressKey('1');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockSetPreset).toHaveBeenCalledWith('isometric');
    });

    it('sets front preset on 2 key', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        const event = pressKey('2');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockSetPreset).toHaveBeenCalledWith('front');
    });

    it('sets side preset on 3 key', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        const event = pressKey('3');
        expect(event.defaultPrevented).toBe(true);
      });

      expect(mockSetPreset).toHaveBeenCalledWith('side');
    });

    it('does not handle 4 key (no top preset)', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        const event = pressKey('4');
        // Key 4 is not handled, so default is not prevented
        expect(event.defaultPrevented).toBe(false);
      });

      // No preset should be set for key 4
      expect(mockSetPreset).not.toHaveBeenCalled();
    });

    it('does not set presets when preview is hidden', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: false,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        pressKey('1');
        pressKey('2');
        pressKey('3');
        pressKey('4');
      });

      expect(mockSetPreset).not.toHaveBeenCalled();
    });

    it('handles null scene ref gracefully for presets', () => {
      const nullSceneRef = { current: null };

      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: nullSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      act(() => {
        pressKey('1');
      });

      // Should not throw error
      expect(mockSetPreset).not.toHaveBeenCalled();
    });
  });

  describe('input field detection', () => {
    it('does not handle shortcuts when typing in INPUT element', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        pressKey('v', input);
        pressKey(' ', input);
        pressKey('1', input);
      });

      // v key should work even in input (it's a special case - only for toggle visibility)
      // Actually, looking at the code, it checks the target BEFORE handling any key
      // So v key should also be blocked in input fields
      expect(mockTogglePreviewVisibility).not.toHaveBeenCalled();
      expect(mockTogglePreviewExpanded).not.toHaveBeenCalled();
      expect(mockSetPreset).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('does not handle shortcuts when typing in TEXTAREA element', () => {
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

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
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      // Manually set isContentEditable since jsdom doesn't fully support it
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
      renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

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

      const { unmount } = renderHook(() =>
        use3DPreviewKeyboard({
          sceneRef: mockSceneRef,
          isPreviewVisible: true,
          isPreviewExpanded: false,
          togglePreviewVisibility: mockTogglePreviewVisibility,
          togglePreviewExpanded: mockTogglePreviewExpanded,
          setPreviewExpanded: mockSetPreviewExpanded,
        })
      );

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
        ({ visible }) =>
          use3DPreviewKeyboard({
            sceneRef: mockSceneRef,
            isPreviewVisible: visible,
            isPreviewExpanded: false,
            togglePreviewVisibility: mockTogglePreviewVisibility,
            togglePreviewExpanded: mockTogglePreviewExpanded,
            setPreviewExpanded: mockSetPreviewExpanded,
          }),
        { initialProps: { visible: true } }
      );

      act(() => {
        pressKey('1');
      });

      expect(mockSetPreset).toHaveBeenCalledTimes(1);

      mockSetPreset.mockClear();

      rerender({ visible: false });

      act(() => {
        pressKey('1');
      });

      expect(mockSetPreset).not.toHaveBeenCalled();
    });
  });
});
