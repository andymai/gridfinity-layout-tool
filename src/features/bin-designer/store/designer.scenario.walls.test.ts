import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';

describe('DesignerStore - wall cutout actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  describe('updateWalls', () => {
    it('enables walls feature master toggle', () => {
      const { updateWalls } = useDesignerStore.getState();
      updateWalls({ enabled: true });

      expect(useDesignerStore.getState().params.walls.enabled).toBe(true);
    });

    it('updates shape (u-shape → scoop → funnel)', () => {
      const { updateWalls } = useDesignerStore.getState();
      updateWalls({ shape: 'scoop' });
      expect(useDesignerStore.getState().params.walls.shape).toBe('scoop');

      updateWalls({ shape: 'funnel' });
      expect(useDesignerStore.getState().params.walls.shape).toBe('funnel');

      updateWalls({ shape: 'u-shape' });
      expect(useDesignerStore.getState().params.walls.shape).toBe('u-shape');
    });

    it('preserves unrelated wall fields on partial update', () => {
      const { updateWalls } = useDesignerStore.getState();
      updateWalls({ enabled: true, shape: 'scoop' });
      updateWalls({ width: 60 });

      const { walls } = useDesignerStore.getState().params;
      expect(walls.enabled).toBe(true);
      expect(walls.shape).toBe('scoop');
      expect(walls.width).toBe(60);
    });

    it('pushes history on update', () => {
      const { updateWalls } = useDesignerStore.getState();
      const beforeLen = useDesignerStore.getState().history.past.length;

      updateWalls({ enabled: true });

      expect(useDesignerStore.getState().history.past.length).toBe(beforeLen + 1);
    });
  });

  describe('updateWallSide', () => {
    it('enables a single default-off side independently', () => {
      // Default: front/back disabled, left/right enabled.
      const { updateWallSide } = useDesignerStore.getState();
      updateWallSide('front', { enabled: true });

      const { walls } = useDesignerStore.getState().params;
      expect(walls.front.enabled).toBe(true);
      expect(walls.back.enabled).toBe(false);
    });

    it('updates width/depth per side independently', () => {
      const { updateWallSide } = useDesignerStore.getState();
      updateWallSide('front', { enabled: true, width: 50, depth: 40 });
      updateWallSide('back', { enabled: true, width: 70, depth: 50 });

      const { walls } = useDesignerStore.getState().params;
      expect(walls.front.width).toBe(50);
      expect(walls.front.depth).toBe(40);
      expect(walls.back.width).toBe(70);
      expect(walls.back.depth).toBe(50);
    });

    it('updates alignment on a side without disturbing other sides', () => {
      const { updateWallSide } = useDesignerStore.getState();
      updateWallSide('left', { enabled: true, alignment: 'left' });
      updateWallSide('right', { enabled: true });

      const { walls } = useDesignerStore.getState().params;
      expect(walls.left.alignment).toBe('left');
      expect(walls.right.enabled).toBe(true);
    });

    it('can disable a previously enabled side', () => {
      const { updateWallSide } = useDesignerStore.getState();
      updateWallSide('front', { enabled: true });
      updateWallSide('front', { enabled: false });

      expect(useDesignerStore.getState().params.walls.front.enabled).toBe(false);
    });

    it('pushes history per side update', () => {
      const { updateWallSide } = useDesignerStore.getState();
      const start = useDesignerStore.getState().history.past.length;

      updateWallSide('front', { enabled: true });
      updateWallSide('back', { enabled: true });
      updateWallSide('left', { enabled: true });

      expect(useDesignerStore.getState().history.past.length).toBe(start + 3);
    });
  });

  describe('undo/redo for walls', () => {
    it('undo reverts a wall-side enable', () => {
      const { updateWallSide, undo } = useDesignerStore.getState();
      updateWallSide('front', { enabled: true });
      undo();

      expect(useDesignerStore.getState().params.walls.front.enabled).toBe(false);
    });

    it('redo restores a wall-side enable', () => {
      const { updateWallSide, undo, redo } = useDesignerStore.getState();
      updateWallSide('front', { enabled: true });
      undo();
      redo();

      expect(useDesignerStore.getState().params.walls.front.enabled).toBe(true);
    });

    it('undoes through a 4-sided toggle sequence', () => {
      // Default: front/back disabled, left/right enabled. Toggle each so
      // every step is an actual state change.
      const { updateWallSide, undo } = useDesignerStore.getState();
      updateWallSide('front', { enabled: true });
      updateWallSide('back', { enabled: true });
      updateWallSide('left', { enabled: false });
      updateWallSide('right', { enabled: false });

      undo();
      expect(useDesignerStore.getState().params.walls.right.enabled).toBe(true);
      undo();
      expect(useDesignerStore.getState().params.walls.left.enabled).toBe(true);
      undo();
      expect(useDesignerStore.getState().params.walls.back.enabled).toBe(false);
      undo();
      expect(useDesignerStore.getState().params.walls.front.enabled).toBe(false);
    });
  });

  describe('shape × side combinations', () => {
    it('switching shape to scoop preserves per-side state', () => {
      const { updateWalls, updateWallSide } = useDesignerStore.getState();
      updateWallSide('front', { enabled: true, width: 60 });
      updateWalls({ shape: 'scoop' });

      const { walls } = useDesignerStore.getState().params;
      expect(walls.shape).toBe('scoop');
      expect(walls.front.enabled).toBe(true);
      expect(walls.front.width).toBe(60);
    });

    it('switching shape to funnel preserves alignment', () => {
      const { updateWalls, updateWallSide } = useDesignerStore.getState();
      updateWallSide('front', { enabled: true, alignment: 'left' });
      updateWalls({ shape: 'funnel' });

      expect(useDesignerStore.getState().params.walls.front.alignment).toBe('left');
    });
  });
});
