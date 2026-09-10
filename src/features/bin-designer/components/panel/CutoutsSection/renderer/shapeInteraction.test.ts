import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ThreeEvent } from '@react-three/fiber';
import {
  STROKE_SELECTED,
  pickStrokeColor,
  useShapeColors,
  useShapePointerHandlers,
} from './shapeInteraction';

function pointerEvent(init: { button?: number; shiftKey?: boolean; altKey?: boolean } = {}) {
  return {
    nativeEvent: { button: 0, shiftKey: false, altKey: false, ...init },
    point: { x: 12, y: 34 },
    stopPropagation: vi.fn(),
  } as unknown as ThreeEvent<PointerEvent>;
}

describe('useShapeColors', () => {
  it('darkens the bin colour by a fixed factor per role and memoises per colour', () => {
    const { result, rerender } = renderHook(({ c }: { c: string }) => useShapeColors(c), {
      initialProps: { c: '#ffffff' },
    });
    expect(result.current.cutFillColor.r).toBeCloseTo(0.7);
    expect(result.current.strokeDefault.r).toBeCloseTo(0.5);
    expect(result.current.strokeHover.r).toBeCloseTo(0.4);
    expect(result.current.strokeGrouped.r).toBeCloseTo(0.35);
    const first = result.current;
    rerender({ c: '#ffffff' });
    expect(result.current).toBe(first);
  });
});

describe('pickStrokeColor', () => {
  it('prefers selected, then hover, then grouped, then default', () => {
    const colors = renderHook(() => useShapeColors('#808080')).result.current;
    expect(pickStrokeColor({ isSelected: true, isHovered: true, isGrouped: true }, colors)).toBe(
      STROKE_SELECTED
    );
    expect(pickStrokeColor({ isSelected: false, isHovered: true, isGrouped: true }, colors)).toBe(
      colors.strokeHover
    );
    expect(pickStrokeColor({ isSelected: false, isHovered: false, isGrouped: true }, colors)).toBe(
      colors.strokeGrouped
    );
    expect(pickStrokeColor({ isSelected: false, isHovered: false, isGrouped: false }, colors)).toBe(
      colors.strokeDefault
    );
  });
});

describe('useShapePointerHandlers', () => {
  function setup(overrides: Partial<Parameters<typeof useShapePointerHandlers>[0]> = {}) {
    const onSelect = vi.fn();
    const onDragStart = vi.fn();
    const onDoubleClick = vi.fn();
    const hook = renderHook(() =>
      useShapePointerHandlers({
        cutoutId: 'c1',
        isSelected: false,
        onSelect,
        onDragStart,
        onDoubleClick,
        ...overrides,
      })
    );
    return { hook, onSelect, onDragStart, onDoubleClick };
  }

  it('selects and starts a drag on a plain left press', () => {
    const { hook, onSelect, onDragStart } = setup();
    const e = pointerEvent({ altKey: true });
    hook.result.current.handlePointerDown(e);
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('c1', false);
    expect(onDragStart).toHaveBeenCalledWith('c1', 12, 34, true);
  });

  it('adds to the selection without dragging on a shift press', () => {
    const { hook, onSelect, onDragStart } = setup();
    hook.result.current.handlePointerDown(pointerEvent({ shiftKey: true }));
    expect(onSelect).toHaveBeenCalledWith('c1', true);
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('ignores non-left buttons and lets picks through while disabled', () => {
    const { hook, onSelect } = setup({ disablePointerEvents: true });
    const right = pointerEvent({ button: 2 });
    hook.result.current.handlePointerDown(right);
    const left = pointerEvent();
    hook.result.current.handlePointerDown(left);
    expect(onSelect).not.toHaveBeenCalled();
    expect(left.stopPropagation).not.toHaveBeenCalled();
  });

  it('reports a double click by id', () => {
    const { hook, onDoubleClick } = setup();
    hook.result.current.handleDoubleClick(pointerEvent());
    expect(onDoubleClick).toHaveBeenCalledWith('c1');
  });

  it('tracks hover only while unselected', () => {
    const { hook } = setup();
    act(() => hook.result.current.handlePointerEnter());
    expect(hook.result.current.isHovered).toBe(true);
    act(() => hook.result.current.handlePointerLeave());
    expect(hook.result.current.isHovered).toBe(false);

    const selected = setup({ isSelected: true });
    act(() => selected.hook.result.current.handlePointerEnter());
    expect(selected.hook.result.current.isHovered).toBe(false);
  });
});
