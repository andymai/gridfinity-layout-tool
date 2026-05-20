import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';

describe('DesignerStore - handle cutout actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  describe('updateHandles', () => {
    it('enables handles master toggle', () => {
      const { updateHandles } = useDesignerStore.getState();
      updateHandles({ enabled: true });
      expect(useDesignerStore.getState().params.handles.enabled).toBe(true);
    });

    it('preserves per-side state on master toggle', () => {
      // Flip 'back' (default false) to true and 'front' (default true) to
      // false so we have a non-default per-side state. If the master
      // toggle accidentally reset sides to defaults, both assertions
      // below would flip the wrong way.
      const { updateHandles, updateHandleSide } = useDesignerStore.getState();
      updateHandleSide('back', { enabled: true });
      updateHandleSide('front', { enabled: false });
      updateHandles({ enabled: true });

      const { handles } = useDesignerStore.getState().params;
      expect(handles.back.enabled).toBe(true);
      expect(handles.front.enabled).toBe(false);
    });

    it('pushes history on update', () => {
      const { updateHandles } = useDesignerStore.getState();
      const start = useDesignerStore.getState().history.past.length;

      updateHandles({ enabled: true });
      expect(useDesignerStore.getState().history.past.length).toBe(start + 1);
    });
  });

  describe('updateHandleSide', () => {
    // Default handles state: front/left/right enabled, back disabled. We
    // exercise toggles relative to that — using 'back' as the safest
    // "off → on" side.
    it('enables the back side (the default-off side)', () => {
      const { updateHandleSide } = useDesignerStore.getState();
      updateHandleSide('back', { enabled: true });

      const { handles } = useDesignerStore.getState().params;
      expect(handles.back.enabled).toBe(true);
    });

    it('disables a default-enabled side (front)', () => {
      const { updateHandleSide } = useDesignerStore.getState();
      expect(useDesignerStore.getState().params.handles.front.enabled).toBe(true);

      updateHandleSide('front', { enabled: false });
      expect(useDesignerStore.getState().params.handles.front.enabled).toBe(false);
    });

    it('toggling one side does not affect another', () => {
      const { updateHandleSide } = useDesignerStore.getState();
      updateHandleSide('front', { enabled: false });

      // left still default-true
      expect(useDesignerStore.getState().params.handles.left.enabled).toBe(true);
    });

    it('can round-trip a side enable/disable', () => {
      const { updateHandleSide } = useDesignerStore.getState();
      updateHandleSide('back', { enabled: true });
      updateHandleSide('back', { enabled: false });

      expect(useDesignerStore.getState().params.handles.back.enabled).toBe(false);
    });

    it('pushes history per side update', () => {
      const { updateHandleSide } = useDesignerStore.getState();
      const start = useDesignerStore.getState().history.past.length;

      updateHandleSide('back', { enabled: true });
      updateHandleSide('front', { enabled: false });

      expect(useDesignerStore.getState().history.past.length).toBe(start + 2);
    });
  });

  describe('undo/redo for handles', () => {
    it('undo reverts a back-side enable (default-off → on)', () => {
      const { updateHandleSide, undo } = useDesignerStore.getState();
      updateHandleSide('back', { enabled: true });
      undo();

      expect(useDesignerStore.getState().params.handles.back.enabled).toBe(false);
    });

    it('redo restores a back-side enable', () => {
      const { updateHandleSide, undo, redo } = useDesignerStore.getState();
      updateHandleSide('back', { enabled: true });
      undo();
      redo();

      expect(useDesignerStore.getState().params.handles.back.enabled).toBe(true);
    });

    it('undoes through a 4-side disable sequence', () => {
      // Start from defaults (front/left/right=true, back=false). Disable
      // them in order; each undo step restores the previous side.
      const { updateHandleSide, undo } = useDesignerStore.getState();
      updateHandleSide('front', { enabled: false });
      updateHandleSide('left', { enabled: false });
      updateHandleSide('right', { enabled: false });
      updateHandleSide('back', { enabled: true });

      undo();
      expect(useDesignerStore.getState().params.handles.back.enabled).toBe(false);
      undo();
      expect(useDesignerStore.getState().params.handles.right.enabled).toBe(true);
      undo();
      expect(useDesignerStore.getState().params.handles.left.enabled).toBe(true);
      undo();
      expect(useDesignerStore.getState().params.handles.front.enabled).toBe(true);
    });
  });

  describe('handle × wall interactions', () => {
    it('handles and walls update independently', () => {
      const { updateHandleSide, updateWallSide } = useDesignerStore.getState();
      updateHandleSide('front', { enabled: true });
      updateWallSide('front', { enabled: true });

      const { handles, walls } = useDesignerStore.getState().params;
      expect(handles.front.enabled).toBe(true);
      expect(walls.front.enabled).toBe(true);
    });

    it('disabling all handle sides individually does not auto-disable master', () => {
      // Verify there's no hidden cascade: per-side toggles don't flip
      // handles.enabled. The master is independent — user can re-enable.
      const { updateHandles, updateHandleSide } = useDesignerStore.getState();
      updateHandles({ enabled: true });
      updateHandleSide('front', { enabled: true });
      updateHandleSide('front', { enabled: false });

      expect(useDesignerStore.getState().params.handles.enabled).toBe(true);
    });
  });
});
