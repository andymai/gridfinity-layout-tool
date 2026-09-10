import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { Vector3 } from 'three';
import { DragCatchPlane, RotationCatchPlane } from './WorkshopCatchPlanes';
import { sceneToStore } from './workshopPlacement';

const local = { x: 5, y: 10 } as Vector3;

describe('DragCatchPlane', () => {
  it('spans well past the base and reports the floor surface under the pointer', () => {
    const onSurfaceMove = vi.fn();
    const { container } = render(
      <DragCatchPlane
        baseW={10}
        baseD={20}
        onSurfaceMove={onSurfaceMove}
        sceneFromWorld={() => local}
      />
    );
    const mesh = container.querySelector('mesh') as Element;
    expect(container.querySelector('planeGeometry')?.getAttribute('args')).toBe('40,80');

    fireEvent.pointerMove(mesh);

    expect(onSurfaceMove).toHaveBeenCalledWith({
      parentId: null,
      topZ: 0,
      x: sceneToStore(5, 10),
      y: sceneToStore(10, 20),
    });
  });
});

describe('RotationCatchPlane', () => {
  it('sits at the ring height and reports store coordinates', () => {
    const onRotateMove = vi.fn();
    const { container } = render(
      <RotationCatchPlane
        baseW={10}
        baseD={20}
        z={7}
        onRotateMove={onRotateMove}
        sceneFromWorld={() => local}
      />
    );
    const mesh = container.querySelector('mesh') as Element;
    expect(mesh.getAttribute('position')).toBe('0,0,7');

    fireEvent.pointerMove(mesh);

    expect(onRotateMove).toHaveBeenCalledWith({ x: sceneToStore(5, 10), y: sceneToStore(10, 20) });
  });
});
