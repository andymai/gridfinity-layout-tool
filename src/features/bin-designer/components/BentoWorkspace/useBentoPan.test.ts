import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { useBentoPan, type BentoPanApi } from './useBentoPan';

function mount(zoom = 2) {
  const setCameraCenter = vi.fn();
  let api: BentoPanApi | null = null;
  function Harness() {
    api = useBentoPan(setCameraCenter, zoom);
    return createElement('div');
  }
  render(createElement(Harness));
  const current = (): BentoPanApi => {
    if (!api) throw new Error('hook not mounted');
    return api;
  };
  return {
    setCameraCenter,
    get api() {
      return current();
    },
    pointerDown(button: number, clientX = 0, clientY = 0): boolean {
      let handled = false;
      act(() => {
        handled = current().onPointerDown({
          button,
          clientX,
          clientY,
          preventDefault: () => undefined,
        } as unknown as React.PointerEvent);
      });
      return handled;
    },
    move(clientX: number, clientY: number) {
      act(() => {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY }));
      });
    },
    up() {
      act(() => {
        window.dispatchEvent(new PointerEvent('pointerup', {}));
      });
    },
  };
}

const applyLastUpdate = (
  setCameraCenter: ReturnType<typeof vi.fn>,
  prev: { x: number; y: number }
): { x: number; y: number } => {
  const updater = setCameraCenter.mock.calls.at(-1)?.[0] as (p: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  return updater(prev);
};

describe('useBentoPan', () => {
  beforeEach(() => {
    cleanup();
  });

  it('middle-button drag pans the camera by screen-delta over zoom, Y inverted', () => {
    const h = mount(2);
    expect(h.pointerDown(1, 100, 100)).toBe(true);
    expect(h.api.isPanning).toBe(true);
    h.move(110, 80);

    // dx +10px, dy -20px at zoom 2 → camera x -5mm, y +(-(-20))/2 = -10 … sign:
    // camera moves opposite the drag in x, with y up: x -= dx/z, y += dy/z.
    expect(applyLastUpdate(h.setCameraCenter, { x: 50, y: 50 })).toEqual({ x: 45, y: 40 });

    h.up();
    expect(h.api.isPanning).toBe(false);
  });

  it('left-button pans only while Space is held', () => {
    const h = mount(1);
    expect(h.pointerDown(0)).toBe(false);

    fireEvent.keyDown(window, { code: 'Space' });
    expect(h.api.spaceHeld).toBe(true);
    expect(h.pointerDown(0, 10, 10)).toBe(true);
    h.up();

    fireEvent.keyUp(window, { code: 'Space' });
    expect(h.api.spaceHeld).toBe(false);
    expect(h.pointerDown(0)).toBe(false);
  });

  it('ignores Space typed into an editable element', () => {
    const h = mount(1);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { code: 'Space' });

    expect(h.api.spaceHeld).toBe(false);
    input.remove();
  });

  it('window blur releases a held Space (missed keyup safety)', () => {
    const h = mount(1);
    fireEvent.keyDown(window, { code: 'Space' });
    expect(h.api.spaceHeld).toBe(true);

    fireEvent.blur(window);

    expect(h.api.spaceHeld).toBe(false);
  });
});
