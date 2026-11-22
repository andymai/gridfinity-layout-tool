import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CutoutLibraryItem } from '@/features/bin-designer/library/libraryTypes';
import { DRAG_START_PX, useLibraryRowDrag } from './useLibraryRowDrag';

const item = { id: 'clib_1', name: 'Wrench' } as CutoutLibraryItem;

function pressEvent(init: Partial<ReactPointerEvent<HTMLElement>> = {}) {
  return {
    button: 0,
    pointerType: 'mouse',
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    currentTarget: document.createElement('button'),
    ...init,
  } as ReactPointerEvent<HTMLElement>;
}

function fire(
  type: 'pointermove' | 'pointerup' | 'pointercancel',
  x = 100,
  pointerId = 1,
  buttons = type === 'pointermove' ? 1 : 0
) {
  act(() => {
    window.dispatchEvent(new PointerEvent(type, { pointerId, clientX: x, clientY: 100, buttons }));
  });
}

function setup() {
  const onStart = vi.fn();
  const onEnd = vi.fn();
  const hook = renderHook(() => useLibraryRowDrag(onStart, onEnd));
  return { onStart, onEnd, hook, drag: () => hook.result.current };
}

describe('useLibraryRowDrag', () => {
  it('starts a drag once the press moves far enough, and ends it on release', () => {
    const { onStart, onEnd, drag } = setup();
    drag().press(item, pressEvent());

    fire('pointermove', 100 + DRAG_START_PX - 1);
    expect(onStart).not.toHaveBeenCalled();
    fire('pointermove', 100 + DRAG_START_PX);
    fire('pointermove', 140);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(item, 1);

    fire('pointerup', 140);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('swallows the one click that a drag makes, and no later one', () => {
    vi.useFakeTimers();
    try {
      const { drag } = setup();
      drag().press(item, pressEvent());
      fire('pointermove', 120);
      fire('pointerup', 120);
      expect(drag().takeClick()).toBe(true);
      expect(drag().takeClick()).toBe(false);

      drag().press(item, pressEvent());
      fire('pointermove', 120);
      fire('pointerup', 120);
      vi.runAllTimers();
      expect(drag().takeClick()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a press that does not move to the click', () => {
    const { onStart, onEnd, drag } = setup();
    drag().press(item, pressEvent());
    fire('pointerup');
    expect(onStart).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(drag().takeClick()).toBe(false);
  });

  it('ends the drag when the browser cancels the pointer', () => {
    const { onEnd, drag } = setup();
    drag().press(item, pressEvent());
    fire('pointermove', 130);
    fire('pointercancel', 130);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores touch, other buttons and other pointers', () => {
    const { onStart, drag } = setup();
    drag().press(item, pressEvent({ pointerType: 'touch' }));
    fire('pointermove', 150);
    drag().press(item, pressEvent({ button: 2 }));
    fire('pointermove', 150);
    expect(onStart).not.toHaveBeenCalled();

    drag().press(item, pressEvent());
    fire('pointermove', 150, 2);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('ends a drag whose release the window missed, with no click to swallow', () => {
    const { onEnd, drag } = setup();
    drag().press(item, pressEvent());
    fire('pointermove', 130);
    fire('pointermove', 140, 1, 0);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(drag().takeClick()).toBe(false);
  });

  it('ends the drag when the window loses focus', () => {
    const { onEnd, drag } = setup();
    drag().press(item, pressEvent());
    fire('pointermove', 130);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('frees a pen press captured by an element inside the row', () => {
    const { drag } = setup();
    const row = document.createElement('button');
    const label = document.createElement('span');
    row.append(label);
    label.hasPointerCapture = () => true;
    const release = vi.spyOn(label, 'releasePointerCapture');
    drag().press(item, pressEvent({ pointerType: 'pen', currentTarget: row, target: label }));
    expect(release).toHaveBeenCalledWith(1);
  });

  it('stops listening when the panel goes away mid-press', () => {
    const { onStart, hook, drag } = setup();
    drag().press(item, pressEvent());
    hook.unmount();
    fire('pointermove', 150);
    expect(onStart).not.toHaveBeenCalled();
  });
});
