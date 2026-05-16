/**
 * Tests for the color-tool state machine on the designer store: tool
 * entry/exit, the two-step swap-zones flow, and history coalescing.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useDesignerStore, _resetPendingMeshCache } from '../designer';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '../../constants/defaults';

describe('color-tool slice', () => {
  beforeEach(() => {
    _resetPendingMeshCache();
    useDesignerStore.setState({
      ui: {
        ...useDesignerStore.getState().ui,
        colorTool: null,
        swapFirstZone: null,
        hoveredColorZone: null,
      },
      history: { past: [], future: [] },
      params: {
        ...useDesignerStore.getState().params,
        featureColors: {
          ...DEFAULT_FEATURE_COLOR_CONFIG,
          body: '#aaaaaa',
          base: '#bbbbbb',
          scoop: '#cccccc',
          dividers: '#dddddd',
          labelTab: '#eeeeee',
          lip: {
            frontLeft: '#111111',
            frontRight: '#222222',
            backRight: '#333333',
            backLeft: '#444444',
          },
        },
      },
    });
  });

  describe('updateFeatureColors.enabled', () => {
    it('clears an active color tool when multi-color is disabled', () => {
      useDesignerStore.getState().setColorTool('eyedropper');
      useDesignerStore.setState({
        ui: { ...useDesignerStore.getState().ui, hoveredColorZone: 'body' },
      });

      useDesignerStore.getState().updateFeatureColors({ enabled: false });

      const { ui } = useDesignerStore.getState();
      expect(ui.colorTool).toBeNull();
      expect(ui.swapFirstZone).toBeNull();
      expect(ui.hoveredColorZone).toBeNull();
    });

    it('leaves color-tool state untouched when enabling multi-color', () => {
      useDesignerStore.getState().setColorTool('eyedropper');
      useDesignerStore.getState().updateFeatureColors({ enabled: true });
      expect(useDesignerStore.getState().ui.colorTool).toBe('eyedropper');
    });
  });

  describe('setColorTool', () => {
    it('enters a tool', () => {
      useDesignerStore.getState().setColorTool('eyedropper');
      expect(useDesignerStore.getState().ui.colorTool).toBe('eyedropper');
    });

    it('clears swapFirstZone when entering a non-swap-pick-second tool', () => {
      useDesignerStore.setState({
        ui: { ...useDesignerStore.getState().ui, swapFirstZone: 'body' },
      });
      useDesignerStore.getState().setColorTool('eyedropper');
      expect(useDesignerStore.getState().ui.swapFirstZone).toBeNull();
    });

    it('clears hovered zone when exiting any tool', () => {
      useDesignerStore.setState({
        ui: {
          ...useDesignerStore.getState().ui,
          colorTool: 'eyedropper',
          hoveredColorZone: 'base',
        },
      });
      useDesignerStore.getState().setColorTool(null);
      expect(useDesignerStore.getState().ui.hoveredColorZone).toBeNull();
    });

    it('clears pickerOverlay when switching to a non-eyedropper tool', () => {
      // Eyedropper → swap transition: the floating picker from eyedropper
      // would otherwise sit over the swap banner. Picker only makes sense
      // in eyedropper mode.
      useDesignerStore.setState({
        ui: {
          ...useDesignerStore.getState().ui,
          colorTool: 'eyedropper',
          pickerOverlay: { zone: 'body', x: 100, y: 100 },
        },
      });
      useDesignerStore.getState().setColorTool('swap-pick-first');
      expect(useDesignerStore.getState().ui.pickerOverlay).toBeNull();
    });
  });

  describe('pickSwapZone', () => {
    it('first pick advances to swap-pick-second with the zone stored', () => {
      useDesignerStore.getState().setColorTool('swap-pick-first');
      const result = useDesignerStore.getState().pickSwapZone('body');

      expect(result).toBeNull();
      expect(useDesignerStore.getState().ui.colorTool).toBe('swap-pick-second');
      expect(useDesignerStore.getState().ui.swapFirstZone).toBe('body');
    });

    it('second pick swaps colors, exits tool, and returns the pair', () => {
      useDesignerStore.getState().setColorTool('swap-pick-first');
      useDesignerStore.getState().pickSwapZone('body');
      const result = useDesignerStore.getState().pickSwapZone('base');

      expect(result).toEqual({ first: 'body', second: 'base' });
      const { params, ui } = useDesignerStore.getState();
      expect(ui.colorTool).toBeNull();
      expect(ui.swapFirstZone).toBeNull();
      expect(params.featureColors.body).toBe('#bbbbbb');
      expect(params.featureColors.base).toBe('#aaaaaa');
    });

    it('mirrors the swapped color across all four corners when one zone is lip', () => {
      // body=#aaaaaa, lip corners=#111111/#222222/#333333/#444444 from seed.
      // Swap body ↔ a lip corner: lip should adopt #aaaaaa across all four
      // slots (mirror-on-write keeps the lip visually uniform), and body
      // takes whichever corner color was read as the canonical lip color.
      useDesignerStore.getState().setColorTool('swap-pick-first');
      useDesignerStore.getState().pickSwapZone('body');
      useDesignerStore.getState().pickSwapZone('lip:frontRight');

      const { params } = useDesignerStore.getState();
      expect(params.featureColors.body).toBe('#222222');
      expect(params.featureColors.lip.frontLeft).toBe('#aaaaaa');
      expect(params.featureColors.lip.frontRight).toBe('#aaaaaa');
      expect(params.featureColors.lip.backRight).toBe('#aaaaaa');
      expect(params.featureColors.lip.backLeft).toBe('#aaaaaa');
    });

    it('cancels when both picks are lip corners (visually one zone after rollback)', () => {
      useDesignerStore.getState().setColorTool('swap-pick-first');
      useDesignerStore.getState().pickSwapZone('lip:frontLeft');
      const result = useDesignerStore.getState().pickSwapZone('lip:backRight');

      expect(result).toBeNull();
      const state = useDesignerStore.getState();
      expect(state.ui.colorTool).toBeNull();
      expect(state.ui.swapFirstZone).toBeNull();
      expect(state.history.past).toHaveLength(0);
      // Lip colors unchanged
      expect(state.params.featureColors.lip.frontLeft).toBe('#111111');
      expect(state.params.featureColors.lip.backRight).toBe('#333333');
    });

    it('records one history entry per swap (single undo restores both zones)', () => {
      useDesignerStore.getState().setColorTool('swap-pick-first');
      useDesignerStore.getState().pickSwapZone('body');
      useDesignerStore.getState().pickSwapZone('scoop');

      expect(useDesignerStore.getState().history.past).toHaveLength(1);
      useDesignerStore.getState().undo();
      const { featureColors } = useDesignerStore.getState().params;
      expect(featureColors.body).toBe('#aaaaaa');
      expect(featureColors.scoop).toBe('#cccccc');
    });

    it('picking the same zone twice cancels without writing history', () => {
      useDesignerStore.getState().setColorTool('swap-pick-first');
      useDesignerStore.getState().pickSwapZone('body');
      const result = useDesignerStore.getState().pickSwapZone('body');

      expect(result).toBeNull();
      const state = useDesignerStore.getState();
      expect(state.ui.colorTool).toBeNull();
      expect(state.ui.swapFirstZone).toBeNull();
      expect(state.history.past).toHaveLength(0);
      expect(state.params.featureColors.body).toBe('#aaaaaa');
    });

    it('no-ops when no tool is active', () => {
      const result = useDesignerStore.getState().pickSwapZone('body');
      expect(result).toBeNull();
      expect(useDesignerStore.getState().ui.colorTool).toBeNull();
    });
  });
});
