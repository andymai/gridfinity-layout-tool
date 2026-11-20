import type { ReactElement } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { describe, it, expect, vi } from 'vitest';
import { InteractionPlane } from './InteractionPlane';

interface PlaneMeshProps {
  readonly onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}

function pressWith(button: number) {
  const onPointerDown = vi.fn();
  const element = InteractionPlane({
    binWidth: 84,
    binDepth: 42,
    onPointerDown,
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
  }) as ReactElement<PlaneMeshProps>;
  const stopPropagation = vi.fn();
  const event = {
    button,
    point: { x: 10, y: 20 },
    stopPropagation,
  } as unknown as ThreeEvent<PointerEvent>;
  element.props.onPointerDown(event);
  return { onPointerDown, stopPropagation, event };
}

describe('InteractionPlane', () => {
  it('forwards a left press with its world point', () => {
    const { onPointerDown, event } = pressWith(0);
    expect(onPointerDown).toHaveBeenCalledWith(10, 20, event);
  });

  it('forwards a middle press, which starts a pan', () => {
    const { onPointerDown, stopPropagation } = pressWith(1);
    expect(onPointerDown).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('leaves a right press to the context menu', () => {
    const { onPointerDown, stopPropagation } = pressWith(2);
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });
});
