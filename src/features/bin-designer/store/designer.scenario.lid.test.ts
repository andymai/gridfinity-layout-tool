import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import {
  shouldGenerateLid,
  checkLidCompatibility,
  hasLidBlocker,
} from '@/features/bin-designer/utils/lidCompatibility';
import { DEFAULT_LID_CONFIG } from '@/features/bin-designer/types/lid';

describe('DesignerStore - lid actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  describe('updateLid', () => {
    it('enables lid with single partial update', () => {
      const { updateLid } = useDesignerStore.getState();
      updateLid({ enabled: true });

      const { params } = useDesignerStore.getState();
      expect(params.lid.enabled).toBe(true);
      // Other fields preserved
      expect(params.lid.stackableTop).toBe(DEFAULT_LID_CONFIG.stackableTop);
      expect(params.lid.magnetHoles).toBe(DEFAULT_LID_CONFIG.magnetHoles);
    });

    it('preserves unrelated lid fields on partial update', () => {
      const { updateLid } = useDesignerStore.getState();
      updateLid({ enabled: true, magnetHoles: true });
      updateLid({ stackableTop: true });

      const { params } = useDesignerStore.getState();
      expect(params.lid.enabled).toBe(true);
      expect(params.lid.magnetHoles).toBe(true);
      expect(params.lid.stackableTop).toBe(true);
    });

    it('clickRails is replaced wholesale, not deep-merged', () => {
      // Set a distinctive initial state, then replace with a different
      // object. If updateLid deep-merged, sides from the first update
      // would survive into the second. They must not — replacement
      // semantics matter so the user-visible toggles match the state.
      const { updateLid } = useDesignerStore.getState();
      updateLid({
        clickRails: { front: true, back: true, left: true, right: false },
      });
      updateLid({
        clickRails: { front: false, back: true, left: false, right: true },
      });

      const { params } = useDesignerStore.getState();
      expect(params.lid.clickRails).toEqual({
        front: false,
        back: true,
        left: false,
        right: true,
      });
    });

    it('updates clickRailCoverage independently', () => {
      const { updateLid } = useDesignerStore.getState();
      updateLid({ clickRailCoverage: 75 });

      expect(useDesignerStore.getState().params.lid.clickRailCoverage).toBe(75);
    });

    it('pushes history on each update', () => {
      const { updateLid } = useDesignerStore.getState();
      const initialHistoryLen = useDesignerStore.getState().history.past.length;

      updateLid({ enabled: true });
      updateLid({ magnetHoles: true });

      expect(useDesignerStore.getState().history.past.length).toBe(initialHistoryLen + 2);
    });

    it('clears future history on update after undo', () => {
      const { updateLid, undo } = useDesignerStore.getState();
      updateLid({ enabled: true });
      undo();
      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      updateLid({ magnetHoles: true });
      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });
  });

  describe('undo/redo for lid', () => {
    it('undo reverts lid update', () => {
      const { updateLid, undo } = useDesignerStore.getState();
      updateLid({ enabled: true });
      expect(useDesignerStore.getState().params.lid.enabled).toBe(true);

      undo();
      expect(useDesignerStore.getState().params.lid.enabled).toBe(false);
    });

    it('redo restores lid update', () => {
      const { updateLid, undo, redo } = useDesignerStore.getState();
      updateLid({ enabled: true });
      undo();
      redo();

      expect(useDesignerStore.getState().params.lid.enabled).toBe(true);
    });

    it('handles deep lid state changes through undo stack', () => {
      const { updateLid, undo } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateLid({ magnetHoles: true });
      updateLid({ stackableTop: true });
      updateLid({ clickRailCoverage: 100 });

      // Walk back through stack
      undo();
      expect(useDesignerStore.getState().params.lid.clickRailCoverage).toBe(
        DEFAULT_LID_CONFIG.clickRailCoverage
      );

      undo();
      expect(useDesignerStore.getState().params.lid.stackableTop).toBe(false);

      undo();
      expect(useDesignerStore.getState().params.lid.magnetHoles).toBe(false);

      undo();
      expect(useDesignerStore.getState().params.lid.enabled).toBe(false);
    });
  });

  describe('compatibility checks', () => {
    it('shouldGenerateLid is false when lid disabled', () => {
      const { params } = useDesignerStore.getState();
      expect(shouldGenerateLid(params)).toBe(false);
    });

    it('shouldGenerateLid is true when lid enabled on default bin', () => {
      const { updateLid } = useDesignerStore.getState();
      updateLid({ enabled: true });
      expect(shouldGenerateLid(useDesignerStore.getState().params)).toBe(true);
    });

    it('shouldGenerateLid is false when stacking lip is disabled', () => {
      const { updateLid, updateBase } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateBase({ stackingLip: false });

      expect(shouldGenerateLid(useDesignerStore.getState().params)).toBe(false);
    });

    it('shouldGenerateLid short-circuits on stackingLip off (no issues, just gated)', () => {
      // shouldGenerateLid bypasses checkLidCompatibility when stackingLip is
      // off — it's a hard precondition, not a "compatibility" finding.
      const { updateLid, updateBase } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateBase({ stackingLip: false });

      expect(shouldGenerateLid(useDesignerStore.getState().params)).toBe(false);
    });

    it('checkLidCompatibility flags wall cutouts on all four sides as a blocker', () => {
      const { updateLid, updateWalls, updateWallSide } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateWalls({ enabled: true });
      updateWallSide('front', { enabled: true });
      updateWallSide('back', { enabled: true });
      updateWallSide('left', { enabled: true });
      updateWallSide('right', { enabled: true });

      const issues = checkLidCompatibility(useDesignerStore.getState().params);
      expect(issues.length).toBeGreaterThan(0);
      expect(hasLidBlocker(issues)).toBe(true);
    });

    it('checkLidCompatibility flags label tabs as a warning (back rail conflict)', () => {
      const { updateLid, updateLabel } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateLabel({ enabled: true });

      const issues = checkLidCompatibility(useDesignerStore.getState().params);
      expect(issues.some((i) => i.id === 'labelTabs')).toBe(true);
    });

    it('checkLidCompatibility flags wall pattern as a warning', () => {
      const { updateLid, updateWallPattern } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateWallPattern({ enabled: true });

      const issues = checkLidCompatibility(useDesignerStore.getState().params);
      expect(issues.some((i) => i.id === 'wallPattern')).toBe(true);
    });
  });

  describe('lid + bin param interactions', () => {
    it('toggling halfSockets does not affect lid config', () => {
      const { updateLid, updateBase } = useDesignerStore.getState();
      updateLid({ enabled: true, magnetHoles: true });

      const beforeLid = useDesignerStore.getState().params.lid;
      updateBase({ halfSockets: true });

      expect(useDesignerStore.getState().params.lid).toEqual(beforeLid);
    });

    it('changing wallThickness preserves lid config', () => {
      const { updateLid, setParam } = useDesignerStore.getState();
      updateLid({ enabled: true });

      const beforeLid = useDesignerStore.getState().params.lid;
      setParam('wallThickness', 1.6);

      expect(useDesignerStore.getState().params.lid).toEqual(beforeLid);
    });

    it('changing dimensions preserves lid config', () => {
      const { updateLid, setParams } = useDesignerStore.getState();
      updateLid({ enabled: true, magnetHoles: true });

      setParams({ width: 3, depth: 3 });
      expect(useDesignerStore.getState().params.lid.enabled).toBe(true);
      expect(useDesignerStore.getState().params.lid.magnetHoles).toBe(true);
    });
  });

  describe('clickRails edge cases', () => {
    it('all-false clickRails creates friction-fit configuration', () => {
      const { updateLid } = useDesignerStore.getState();
      updateLid({
        enabled: true,
        clickRails: { front: false, back: false, left: false, right: false },
      });

      const { params } = useDesignerStore.getState();
      expect(Object.values(params.lid.clickRails).every((v) => v === false)).toBe(true);
      // Should still pass compatibility check
      expect(shouldGenerateLid(params)).toBe(true);
    });

    it('toggling a single rail side via updateLid', () => {
      const { updateLid } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateLid({
        clickRails: {
          ...useDesignerStore.getState().params.lid.clickRails,
          back: false,
        },
      });

      const { clickRails } = useDesignerStore.getState().params.lid;
      expect(clickRails.front).toBe(true);
      expect(clickRails.back).toBe(false);
      expect(clickRails.left).toBe(true);
      expect(clickRails.right).toBe(true);
    });

    it('all valid coverage options can be set', () => {
      const { updateLid } = useDesignerStore.getState();
      for (const cov of [50, 75, 100] as const) {
        updateLid({ clickRailCoverage: cov });
        expect(useDesignerStore.getState().params.lid.clickRailCoverage).toBe(cov);
      }
    });
  });
});
