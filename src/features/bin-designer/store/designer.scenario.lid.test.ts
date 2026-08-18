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

  describe('surface text (lid text, #2695)', () => {
    it('setLidText writes surfaceText.lidText', () => {
      const { setLidText } = useDesignerStore.getState();
      setLidText('Cables');
      expect(useDesignerStore.getState().params.surfaceText?.lidText).toBe('Cables');
    });

    it('clamps to TEXT_MAX_LENGTH (50)', () => {
      const { setLidText } = useDesignerStore.getState();
      setLidText('x'.repeat(60));
      expect(useDesignerStore.getState().params.surfaceText?.lidText).toHaveLength(50);
    });

    it('clearing the text drops the surfaceText key entirely', () => {
      const { setLidText } = useDesignerStore.getState();
      setLidText('Cables');
      setLidText('');
      // Absent, not `{}` — pre-feature designs must serialize byte-identically.
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
    });

    it('whitespace-only text is treated as empty', () => {
      const { setLidText } = useDesignerStore.getState();
      setLidText('   ');
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
    });

    it('stores the trimmed value, so trailing whitespace never regenerates', () => {
      const { setLidText, undo } = useDesignerStore.getState();
      setLidText('Cables ');
      expect(useDesignerStore.getState().params.surfaceText?.lidText).toBe('Cables');
      // A later commit differing only in outer whitespace is a no-op.
      setLidText('  Cables');
      undo();
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
    });

    it('clearing the text preserves a style override', () => {
      const { setLidText, setSurfaceTextStyle } = useDesignerStore.getState();
      setLidText('Cables');
      setSurfaceTextStyle({ mode: 'emboss' });
      setLidText('');
      const { surfaceText } = useDesignerStore.getState().params;
      expect(surfaceText?.lidText).toBeUndefined();
      expect(surfaceText?.style).toEqual({ mode: 'emboss' });
    });

    it('setSurfaceTextStyle(null) clears the style but keeps the text', () => {
      const { setLidText, setSurfaceTextStyle } = useDesignerStore.getState();
      setLidText('Cables');
      setSurfaceTextStyle({ mode: 'through-cut' });
      setSurfaceTextStyle(null);
      const { surfaceText } = useDesignerStore.getState().params;
      expect(surfaceText?.style).toBeUndefined();
      expect(surfaceText?.lidText).toBe('Cables');
    });

    it('no-op guard: identical text does not push a history entry', () => {
      const { setLidText, undo } = useDesignerStore.getState();
      setLidText('Cables');
      // Idle-flush + blur commit the same value twice; the second write
      // must not create a second undo step.
      setLidText('Cables');
      undo();
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
    });

    it('undo reverts a text edit', () => {
      const { setLidText, undo } = useDesignerStore.getState();
      setLidText('Cables');
      setLidText('Chargers');
      undo();
      expect(useDesignerStore.getState().params.surfaceText?.lidText).toBe('Cables');
    });

    it('setWallText writes per-side strings and clears them independently', () => {
      const { setWallText } = useDesignerStore.getState();
      setWallText('front', 'Cables');
      setWallText('left', 'Chargers');
      expect(useDesignerStore.getState().params.surfaceText?.walls).toEqual({
        front: 'Cables',
        left: 'Chargers',
      });

      setWallText('front', '');
      expect(useDesignerStore.getState().params.surfaceText?.walls).toEqual({
        left: 'Chargers',
      });
      setWallText('left', '');
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
    });

    it('setWallText clamps to TEXT_MAX_LENGTH and no-ops on identical values', () => {
      const { setWallText, undo } = useDesignerStore.getState();
      setWallText('front', 'x'.repeat(60));
      expect(useDesignerStore.getState().params.surfaceText?.walls?.front).toHaveLength(50);
      setWallText('front', 'x'.repeat(60));
      undo();
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
    });

    it('setSurfaceTextAnchor writes the anchor onto the shared surface style', () => {
      const { setWallText, setSurfaceTextAnchor } = useDesignerStore.getState();
      setWallText('front', 'Cables');
      setSurfaceTextAnchor('top');
      expect(useDesignerStore.getState().params.surfaceText?.style?.anchor).toBe('top');
      setSurfaceTextAnchor('bottom-left');
      expect(useDesignerStore.getState().params.surfaceText?.style?.anchor).toBe('bottom-left');
      // Text survives the anchor churn.
      expect(useDesignerStore.getState().params.surfaceText?.walls?.front).toBe('Cables');
    });

    it('clearing the last wall text drops the walls key with it', () => {
      const { setWallText } = useDesignerStore.getState();
      setWallText('front', 'Cables');
      setWallText('front', '');
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
    });

    it('clearWallText removes every wall and its per-wall styles in one history entry', () => {
      const { setWallText, setWallTextStyle, clearWallText, undo } = useDesignerStore.getState();
      setWallText('front', 'Cables');
      setWallText('left', 'Chargers');
      setWallTextStyle('front', { mode: 'emboss' });

      clearWallText();
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();

      // A single undo restores the walls and their refinements together.
      undo();
      expect(useDesignerStore.getState().params.surfaceText?.walls).toEqual({
        front: 'Cables',
        left: 'Chargers',
      });
      expect(useDesignerStore.getState().params.surfaceText?.wallStyles?.front).toEqual({
        mode: 'emboss',
      });
    });

    it('clearWallText keeps lid text and shared style intact', () => {
      const { setWallText, setLidText, setSurfaceTextStyle, clearWallText } =
        useDesignerStore.getState();
      setWallText('front', 'Cables');
      setLidText('Lid');
      setSurfaceTextStyle({ mode: 'emboss' });

      clearWallText();
      const { surfaceText } = useDesignerStore.getState().params;
      expect(surfaceText?.walls).toBeUndefined();
      expect(surfaceText?.lidText).toBe('Lid');
      expect(surfaceText?.style).toEqual({ mode: 'emboss' });
    });

    it('clearWallText is a no-op when no wall text exists', () => {
      const { clearWallText, undo } = useDesignerStore.getState();
      clearWallText();
      // Nothing pushed, so undo falls through to the empty baseline.
      undo();
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
    });

    it('clearWallText drops per-wall styles even with no wall strings left', () => {
      const { clearWallText } = useDesignerStore.getState();
      // Reach the styles-without-strings state a programmatic caller can
      // produce, and check the guard still finds something to clear.
      useDesignerStore.setState((s) => ({
        params: { ...s.params, surfaceText: { wallStyles: { front: { mode: 'emboss' } } } },
      }));
      clearWallText();
      expect(useDesignerStore.getState().params.surfaceText).toBeUndefined();
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

    it('checkLidCompatibility flags full-width wall cutouts on all four sides as a blocker', () => {
      // Full-width is what makes it a blocker: at the default 70%
      // every wall keeps 30% of its lip, the rails segment around the windows,
      // and the design gets a lid — see the warning case below.
      const { updateLid, updateWalls, updateWallSide } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateWalls({ enabled: true });
      for (const side of ['front', 'back', 'left', 'right'] as const) {
        updateWallSide(side, { enabled: true, width: 100, depth: 50 });
      }

      const issues = checkLidCompatibility(useDesignerStore.getState().params);
      expect(issues.length).toBeGreaterThan(0);
      expect(hasLidBlocker(issues)).toBe(true);
    });

    it('checkLidCompatibility leaves partial cutouts on all four sides a warning', () => {
      const { updateLid, updateWalls, updateWallSide } = useDesignerStore.getState();
      updateLid({ enabled: true });
      updateWalls({ enabled: true });
      for (const side of ['front', 'back', 'left', 'right'] as const) {
        updateWallSide(side, { enabled: true, width: 70, depth: 50 });
      }

      const params = useDesignerStore.getState().params;
      expect(hasLidBlocker(checkLidCompatibility(params))).toBe(false);
      expect(shouldGenerateLid(params)).toBe(true);
    });

    it('checkLidCompatibility flags label tabs as a warning (back rail conflict)', () => {
      const { updateLid, updateLabel } = useDesignerStore.getState();
      // The warning describes the NOTCHING path. With's interior relief
      // on — the default for a new design — the shelf sits below the rail band
      // and there is no conflict to report.
      updateLid({ enabled: true, relieveInterior: false });
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
