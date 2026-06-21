import { describe, it, expect, beforeEach } from 'vitest';
import { useBaseplatePageStore } from './baseplatePageStore';
import type { PieceMeshEntry } from './baseplatePageStore';
import type { BaseplateTiling } from '../types/tiling';

describe('baseplatePageStore', () => {
  beforeEach(() => {
    useBaseplatePageStore.setState({
      generation: { status: 'idle', mesh: null, epoch: 0 },
      wasmStatus: 'unloaded',
      tiling: null,
      pieceMeshes: [],
      splitViewMode: 'assembled',
      hoveredPieceLabel: null,
      selectedPieceLabel: null,
    });
  });

  describe('initial state', () => {
    it('starts with idle generation status', () => {
      const { generation } = useBaseplatePageStore.getState();
      expect(generation.status).toBe('idle');
    });

    it('starts with no mesh', () => {
      const { generation } = useBaseplatePageStore.getState();
      expect(generation.mesh).toBeNull();
    });

    it('starts with epoch 0', () => {
      const { generation } = useBaseplatePageStore.getState();
      expect(generation.epoch).toBe(0);
    });

    it('starts with unloaded wasm status', () => {
      expect(useBaseplatePageStore.getState().wasmStatus).toBe('unloaded');
    });

    it('starts with no tiling', () => {
      expect(useBaseplatePageStore.getState().tiling).toBeNull();
    });

    it('starts with empty pieceMeshes', () => {
      expect(useBaseplatePageStore.getState().pieceMeshes).toEqual([]);
    });

    it('starts with assembled split view mode', () => {
      expect(useBaseplatePageStore.getState().splitViewMode).toBe('assembled');
    });
  });

  describe('setGenerationStatus', () => {
    it('transitions from idle to generating', () => {
      useBaseplatePageStore.getState().setGenerationStatus('generating');
      expect(useBaseplatePageStore.getState().generation.status).toBe('generating');
    });

    it('transitions to complete', () => {
      useBaseplatePageStore.getState().setGenerationStatus('complete');
      expect(useBaseplatePageStore.getState().generation.status).toBe('complete');
    });

    it('transitions to error', () => {
      useBaseplatePageStore.getState().setGenerationStatus('error');
      expect(useBaseplatePageStore.getState().generation.status).toBe('error');
    });

    it('transitions back to idle', () => {
      useBaseplatePageStore.getState().setGenerationStatus('generating');
      useBaseplatePageStore.getState().setGenerationStatus('idle');
      expect(useBaseplatePageStore.getState().generation.status).toBe('idle');
    });
  });

  describe('setGenerationResult', () => {
    it('stores a mesh result', () => {
      const mesh = {
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 0, 1]),
        indices: null,
        edgeVertices: null,
        error: null,
        timingMs: 42,
      };

      useBaseplatePageStore.getState().setGenerationResult(mesh);
      expect(useBaseplatePageStore.getState().generation.mesh).toBe(mesh);
    });

    it('stores a mesh result with an error', () => {
      const mesh = {
        vertices: null,
        normals: null,
        indices: null,
        edgeVertices: null,
        error: 'Generation failed',
        timingMs: 0,
      };

      useBaseplatePageStore.getState().setGenerationResult(mesh);
      expect(useBaseplatePageStore.getState().generation.mesh?.error).toBe('Generation failed');
    });

    it('replaces a previous mesh result', () => {
      const first = {
        vertices: new Float32Array([1, 2, 3]),
        normals: null,
        indices: null,
        edgeVertices: null,
        error: null,
        timingMs: 10,
      };
      const second = {
        vertices: new Float32Array([4, 5, 6]),
        normals: null,
        indices: null,
        edgeVertices: null,
        error: null,
        timingMs: 20,
      };

      useBaseplatePageStore.getState().setGenerationResult(first);
      useBaseplatePageStore.getState().setGenerationResult(second);
      expect(useBaseplatePageStore.getState().generation.mesh).toBe(second);
    });
  });

  describe('setWasmStatus', () => {
    it('transitions to loading', () => {
      useBaseplatePageStore.getState().setWasmStatus('loading');
      expect(useBaseplatePageStore.getState().wasmStatus).toBe('loading');
    });

    it('transitions to ready', () => {
      useBaseplatePageStore.getState().setWasmStatus('ready');
      expect(useBaseplatePageStore.getState().wasmStatus).toBe('ready');
    });

    it('transitions to error', () => {
      useBaseplatePageStore.getState().setWasmStatus('error');
      expect(useBaseplatePageStore.getState().wasmStatus).toBe('error');
    });
  });

  describe('bumpEpoch', () => {
    it('increments epoch by 1', () => {
      useBaseplatePageStore.getState().bumpEpoch();
      expect(useBaseplatePageStore.getState().generation.epoch).toBe(1);
    });

    it('increments epoch multiple times', () => {
      useBaseplatePageStore.getState().bumpEpoch();
      useBaseplatePageStore.getState().bumpEpoch();
      useBaseplatePageStore.getState().bumpEpoch();
      expect(useBaseplatePageStore.getState().generation.epoch).toBe(3);
    });

    it('does not affect other generation fields', () => {
      useBaseplatePageStore.getState().setGenerationStatus('complete');
      useBaseplatePageStore.getState().bumpEpoch();
      expect(useBaseplatePageStore.getState().generation.status).toBe('complete');
    });
  });

  describe('setTiling', () => {
    const sampleTiling: BaseplateTiling = {
      isSplit: true,
      pieces: [],
      cols: 2,
      rows: 2,
      totalWidthUnits: 10,
      totalDepthUnits: 8,
      stackCount: 1,
      stackSeparatorThickness: 0,
      bedLoads: 1,
      paddingReductionHint: null,
    };

    it('sets a tiling plan', () => {
      useBaseplatePageStore.getState().setTiling(sampleTiling);
      expect(useBaseplatePageStore.getState().tiling).toBe(sampleTiling);
    });

    it('clears tiling with null', () => {
      useBaseplatePageStore.getState().setTiling(sampleTiling);
      useBaseplatePageStore.getState().setTiling(null);
      expect(useBaseplatePageStore.getState().tiling).toBeNull();
    });

    it('replaces a previous tiling', () => {
      const first: BaseplateTiling = { ...sampleTiling, cols: 1, rows: 1 };
      const second: BaseplateTiling = { ...sampleTiling, cols: 3, rows: 3 };

      useBaseplatePageStore.getState().setTiling(first);
      useBaseplatePageStore.getState().setTiling(second);
      expect(useBaseplatePageStore.getState().tiling?.cols).toBe(3);
    });
  });

  describe('setPieceMeshes', () => {
    const makePiece = (label: string): PieceMeshEntry => ({
      label,
      col: 0,
      row: 0,
      offsetX: 0,
      offsetY: 0,
      widthUnits: 5,
      depthUnits: 4,
      placementRotationDeg: 0,
      mesh: {
        vertices: null,
        normals: null,
        indices: null,
        edgeVertices: null,
        error: null,
        timingMs: 0,
      },
    });

    it('stores an array of piece meshes', () => {
      const pieces = [makePiece('A1'), makePiece('A2')];
      useBaseplatePageStore.getState().setPieceMeshes(pieces);
      expect(useBaseplatePageStore.getState().pieceMeshes).toHaveLength(2);
    });

    it('replaces existing piece meshes', () => {
      useBaseplatePageStore.getState().setPieceMeshes([makePiece('A1')]);
      useBaseplatePageStore.getState().setPieceMeshes([makePiece('B1'), makePiece('B2')]);
      const meshes = useBaseplatePageStore.getState().pieceMeshes;
      expect(meshes).toHaveLength(2);
      expect(meshes[0].label).toBe('B1');
      expect(meshes[1].label).toBe('B2');
    });

    it('clears piece meshes with empty array', () => {
      useBaseplatePageStore.getState().setPieceMeshes([makePiece('A1')]);
      useBaseplatePageStore.getState().setPieceMeshes([]);
      expect(useBaseplatePageStore.getState().pieceMeshes).toHaveLength(0);
    });
  });

  describe('setSplitViewMode', () => {
    it('switches to exploded mode', () => {
      useBaseplatePageStore.getState().setSplitViewMode('exploded');
      expect(useBaseplatePageStore.getState().splitViewMode).toBe('exploded');
    });

    it('switches back to assembled mode', () => {
      useBaseplatePageStore.getState().setSplitViewMode('exploded');
      useBaseplatePageStore.getState().setSplitViewMode('assembled');
      expect(useBaseplatePageStore.getState().splitViewMode).toBe('assembled');
    });
  });

  describe('hoveredPieceLabel', () => {
    it('starts as null', () => {
      expect(useBaseplatePageStore.getState().hoveredPieceLabel).toBeNull();
    });

    it('sets hovered piece label', () => {
      useBaseplatePageStore.getState().setHoveredPieceLabel('A1');
      expect(useBaseplatePageStore.getState().hoveredPieceLabel).toBe('A1');
    });

    it('clears hovered piece label', () => {
      useBaseplatePageStore.getState().setHoveredPieceLabel('A1');
      useBaseplatePageStore.getState().setHoveredPieceLabel(null);
      expect(useBaseplatePageStore.getState().hoveredPieceLabel).toBeNull();
    });
  });

  describe('selectedPieceLabel', () => {
    it('starts as null', () => {
      expect(useBaseplatePageStore.getState().selectedPieceLabel).toBeNull();
    });

    it('sets selected piece label', () => {
      useBaseplatePageStore.getState().setSelectedPieceLabel('B2');
      expect(useBaseplatePageStore.getState().selectedPieceLabel).toBe('B2');
    });

    it('clears selected piece label', () => {
      useBaseplatePageStore.getState().setSelectedPieceLabel('B2');
      useBaseplatePageStore.getState().setSelectedPieceLabel(null);
      expect(useBaseplatePageStore.getState().selectedPieceLabel).toBeNull();
    });
  });

  describe('dedupStats', () => {
    it('starts as null', () => {
      expect(useBaseplatePageStore.getState().dedupStats).toBeNull();
    });

    it('sets dedup stats', () => {
      useBaseplatePageStore.getState().setDedupStats({
        uniqueCount: 3,
        totalCount: 9,
        duplicatesSkipped: 6,
      });
      expect(useBaseplatePageStore.getState().dedupStats).toEqual({
        uniqueCount: 3,
        totalCount: 9,
        duplicatesSkipped: 6,
      });
    });

    it('clears dedup stats with null', () => {
      useBaseplatePageStore.getState().setDedupStats({
        uniqueCount: 3,
        totalCount: 9,
        duplicatesSkipped: 6,
      });
      useBaseplatePageStore.getState().setDedupStats(null);
      expect(useBaseplatePageStore.getState().dedupStats).toBeNull();
    });
  });

  describe('auto-reset on regeneration', () => {
    const makePiece = (label: string): PieceMeshEntry => ({
      label,
      col: 0,
      row: 0,
      offsetX: 0,
      offsetY: 0,
      widthUnits: 5,
      depthUnits: 4,
      placementRotationDeg: 0,
      mesh: {
        vertices: null,
        normals: null,
        indices: null,
        edgeVertices: null,
        error: null,
        timingMs: 0,
      },
    });

    it('resets hover and selection when setTiling is called', () => {
      useBaseplatePageStore.getState().setHoveredPieceLabel('A1');
      useBaseplatePageStore.getState().setSelectedPieceLabel('B1');

      useBaseplatePageStore.getState().setTiling({
        isSplit: true,
        pieces: [],
        cols: 2,
        rows: 2,
        totalWidthUnits: 10,
        totalDepthUnits: 8,
        stackCount: 1,
        stackSeparatorThickness: 0,
        bedLoads: 1,
        paddingReductionHint: null,
      });

      expect(useBaseplatePageStore.getState().hoveredPieceLabel).toBeNull();
      expect(useBaseplatePageStore.getState().selectedPieceLabel).toBeNull();
    });

    it('resets hover and selection when setPieceMeshes is called', () => {
      useBaseplatePageStore.getState().setHoveredPieceLabel('A1');
      useBaseplatePageStore.getState().setSelectedPieceLabel('B1');

      useBaseplatePageStore.getState().setPieceMeshes([makePiece('C1')]);

      expect(useBaseplatePageStore.getState().hoveredPieceLabel).toBeNull();
      expect(useBaseplatePageStore.getState().selectedPieceLabel).toBeNull();
    });
  });
});
