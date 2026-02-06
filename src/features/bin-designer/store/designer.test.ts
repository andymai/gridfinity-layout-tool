import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore, _resetPendingMeshCache } from './designer';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '../constants';

describe('useDesignerStore', () => {
  beforeEach(() => {
    _resetPendingMeshCache();
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      generation: { status: 'idle', mesh: null, progress: 0, epoch: 0 },
      history: { past: [], future: [] },
      wasmStatus: 'unloaded',
      ui: {
        activeTab: 'dimensions',
        exportDialogOpen: false,
        designListOpen: false,
        wireframeMode: false,
        halfBinMode: false,
      },
    });
  });

  describe('setParam', () => {
    it('should update a single param', () => {
      useDesignerStore.getState().setParam('width', 4);
      expect(useDesignerStore.getState().params.width).toBe(4);
    });

    it('should push current state to history as HistoryEntry', () => {
      useDesignerStore.getState().setParam('width', 4);
      const past = useDesignerStore.getState().history.past;
      expect(past).toHaveLength(1);
      expect(past[0].params.width).toBe(2); // original default
      expect(past[0].mesh).toBeNull(); // no mesh cached yet
    });

    it('should clear future on new change', () => {
      useDesignerStore.getState().setParam('width', 4);
      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      useDesignerStore.getState().setParam('depth', 3);
      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });

    it('should increment epoch on param change', () => {
      const before = useDesignerStore.getState().generation.epoch;
      useDesignerStore.getState().setParam('width', 4);
      expect(useDesignerStore.getState().generation.epoch).toBe(before + 1);
    });
  });

  describe('setParams', () => {
    it('should update multiple params', () => {
      useDesignerStore.getState().setParams({ width: 3, depth: 4, height: 6 });
      const { params } = useDesignerStore.getState();
      expect(params.width).toBe(3);
      expect(params.depth).toBe(4);
      expect(params.height).toBe(6);
    });

    it('should push history once for batch update', () => {
      useDesignerStore.getState().setParams({ width: 3, depth: 4 });
      expect(useDesignerStore.getState().history.past).toHaveLength(1);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset params to defaults', () => {
      useDesignerStore.getState().setParam('width', 5);
      useDesignerStore.getState().setParam('height', 10);
      useDesignerStore.getState().resetToDefaults();
      expect(useDesignerStore.getState().params).toEqual(DEFAULT_BIN_PARAMS);
    });

    it('should push history before reset', () => {
      useDesignerStore.getState().setParam('width', 5);
      useDesignerStore.getState().resetToDefaults();
      expect(useDesignerStore.getState().history.past.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('undo/redo', () => {
    it('should undo a change', () => {
      useDesignerStore.getState().setParam('width', 5);
      expect(useDesignerStore.getState().params.width).toBe(5);

      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().params.width).toBe(2); // default
    });

    it('should redo an undone change', () => {
      useDesignerStore.getState().setParam('width', 5);
      useDesignerStore.getState().undo();
      useDesignerStore.getState().redo();
      expect(useDesignerStore.getState().params.width).toBe(5);
    });

    it('should not undo when history is empty', () => {
      const before = useDesignerStore.getState().params;
      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().params).toEqual(before);
    });

    it('should not redo when future is empty', () => {
      useDesignerStore.getState().setParam('width', 5);
      const before = useDesignerStore.getState().params;
      useDesignerStore.getState().redo();
      expect(useDesignerStore.getState().params).toEqual(before);
    });

    it('should support multiple undo steps', () => {
      useDesignerStore.getState().setParam('width', 3);
      useDesignerStore.getState().setParam('width', 4);
      useDesignerStore.getState().setParam('width', 5);

      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().params.width).toBe(4);

      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().params.width).toBe(3);

      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().params.width).toBe(2); // default
    });

    it('should cap history at max entries', () => {
      for (let i = 0; i < 55; i++) {
        useDesignerStore.getState().setParam('width', (i % 6) + 0.5);
      }
      expect(useDesignerStore.getState().history.past.length).toBeLessThanOrEqual(
        DESIGNER_CONSTRAINTS.MAX_HISTORY
      );
    });

    it('should restore cached mesh on undo without epoch change', () => {
      // Simulate a generation result
      const verts = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const norms = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
      const idxs = new Uint32Array([0, 1, 2]);
      useDesignerStore.getState().setGenerationResult({
        vertices: verts,
        normals: norms,
        indices: idxs,
        error: null,
        timingMs: 100,
      });

      const epochBefore = useDesignerStore.getState().generation.epoch;
      // Make a change (pushes current state with cached mesh)
      useDesignerStore.getState().setParam('width', 5);
      const epochAfterChange = useDesignerStore.getState().generation.epoch;
      expect(epochAfterChange).toBe(epochBefore + 1);

      // Undo should restore the cached mesh and NOT increment epoch
      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().generation.epoch).toBe(epochAfterChange);
      expect(useDesignerStore.getState().generation.mesh?.vertices).toBe(verts);
      expect(useDesignerStore.getState().generation.status).toBe('complete');
    });

    it('should increment epoch on undo without cached mesh', () => {
      // No generation result set, so no cache
      useDesignerStore.getState().setParam('width', 5);
      const epochBefore = useDesignerStore.getState().generation.epoch;

      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
    });

    it('should restore cached mesh on redo', () => {
      useDesignerStore.getState().setParam('width', 5);
      const verts = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const norms = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
      const idxs = new Uint32Array([0, 1, 2]);
      useDesignerStore.getState().setGenerationResult({
        vertices: verts,
        normals: norms,
        indices: idxs,
        error: null,
        timingMs: 50,
      });

      useDesignerStore.getState().undo();
      const epochBeforeRedo = useDesignerStore.getState().generation.epoch;

      useDesignerStore.getState().redo();
      // Should have restored the mesh without epoch increment
      expect(useDesignerStore.getState().generation.epoch).toBe(epochBeforeRedo);
      expect(useDesignerStore.getState().generation.mesh?.vertices).toBe(verts);
    });
  });

  describe('generation actions', () => {
    it('should set generation status', () => {
      useDesignerStore.getState().setGenerationStatus('generating');
      expect(useDesignerStore.getState().generation.status).toBe('generating');
    });

    it('should set generation result and update status to complete', () => {
      const result = {
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 1, 0]),
        indices: new Uint32Array([0]),
        error: null,
        timingMs: 42,
      };
      useDesignerStore.getState().setGenerationResult(result);
      expect(useDesignerStore.getState().generation.mesh).toBe(result);
      expect(useDesignerStore.getState().generation.status).toBe('complete');
    });

    it('should set status to error when result has error', () => {
      const result = {
        vertices: null,
        normals: null,
        indices: null,
        error: 'Generation failed',
        timingMs: 10,
      };
      useDesignerStore.getState().setGenerationResult(result);
      expect(useDesignerStore.getState().generation.status).toBe('error');
    });
  });

  describe('UI actions', () => {
    it('should set active tab', () => {
      useDesignerStore.getState().setActiveTab('base');
      expect(useDesignerStore.getState().ui.activeTab).toBe('base');
    });

    it('should toggle export dialog', () => {
      useDesignerStore.getState().setExportDialogOpen(true);
      expect(useDesignerStore.getState().ui.exportDialogOpen).toBe(true);
    });

    it('should toggle wireframe mode', () => {
      useDesignerStore.getState().setWireframeMode(true);
      expect(useDesignerStore.getState().ui.wireframeMode).toBe(true);
    });
  });

  describe('WASM status', () => {
    it('should set WASM status', () => {
      useDesignerStore.getState().setWasmStatus('loading');
      expect(useDesignerStore.getState().wasmStatus).toBe('loading');

      useDesignerStore.getState().setWasmStatus('ready');
      expect(useDesignerStore.getState().wasmStatus).toBe('ready');
    });
  });
});
