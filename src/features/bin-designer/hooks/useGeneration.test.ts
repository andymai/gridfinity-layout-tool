import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeneration } from './useGeneration';
import { useDesignerStore } from '../store';
import type { GenerationBridge } from '@/shared/generation/bridge';

// Mock bridgeManager to isolate tests from the singleton
const mockBridge = {
  isDestroyed: false,
  init: vi.fn(),
  generate: vi.fn(),
  generateImmediate: vi.fn(),
  destroy: vi.fn(),
  cancel: vi.fn(),
  getThreadingInfo: vi.fn(() => ({ isThreaded: false, hardwareConcurrency: 4 })),
} as unknown as GenerationBridge;

const mockAcquire = vi.fn<() => Promise<GenerationBridge>>();
const mockRelease = vi.fn();
const mockGet = vi.fn<() => GenerationBridge | null>();

vi.mock('@/shared/generation/bridge', () => ({
  bridgeManager: {
    acquire: () => mockAcquire(),
    release: () => mockRelease(),
    get: () => mockGet(),
  },
  GenerationBridge: vi.fn(),
  getActiveBridge: vi.fn(),
}));

describe('useGeneration', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Reset mock bridge state
    (mockBridge as { isDestroyed: boolean }).isDestroyed = false;
    (mockBridge.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
      mesh: {
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        indices: new Uint32Array([0, 1, 2]),
        edgeVertices: new Float32Array(0),
        triangleCount: 1,
      },
      timingMs: 5,
    });
    (mockBridge.getThreadingInfo as ReturnType<typeof vi.fn>).mockReturnValue({
      isThreaded: false,
      hardwareConcurrency: 4,
    });

    mockAcquire.mockReset();
    mockAcquire.mockResolvedValue(mockBridge);
    mockRelease.mockReset();
    mockGet.mockReset();
    mockGet.mockReturnValue(mockBridge);

    // Full store reset
    useDesignerStore.setState({
      wasmStatus: 'unloaded',
      generation: { status: 'idle', mesh: null, progress: 0 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes the worker on mount', async () => {
    renderHook(() => useGeneration());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(mockAcquire).toHaveBeenCalledTimes(1);
    expect(useDesignerStore.getState().wasmStatus).toBe('ready');
  });

  it('sets wasmStatus to loading then ready', async () => {
    expect(useDesignerStore.getState().wasmStatus).toBe('unloaded');

    renderHook(() => useGeneration());

    // Immediately after mount, should be loading
    expect(useDesignerStore.getState().wasmStatus).toBe('loading');

    // After init completes
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(useDesignerStore.getState().wasmStatus).toBe('ready');
  });

  it('triggers initial generation after init', async () => {
    renderHook(() => useGeneration());

    // acquire() resolves + initial generation triggers
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Wait for the generate call (which goes through the bridge, not Worker directly)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(201);
    });

    const state = useDesignerStore.getState();
    expect(state.generation.status).toBe('complete');
    expect(state.generation.mesh).not.toBeNull();
    expect(state.generation.mesh?.vertices).not.toBeNull();
  });

  it('regenerates when params change', async () => {
    renderHook(() => useGeneration());

    // Complete initial generation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(201);
    });

    expect(useDesignerStore.getState().generation.status).toBe('complete');

    // Change params
    act(() => {
      useDesignerStore.getState().setParam('width', 4);
    });

    // Wait for re-generation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(201);
    });

    expect(useDesignerStore.getState().generation.status).toBe('complete');
  });

  it('releases bridge on unmount', async () => {
    const { unmount } = renderHook(() => useGeneration());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockAcquire).toHaveBeenCalledTimes(1);

    unmount();

    // Should call release() to decrement ref count
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('handles generation error', async () => {
    (mockBridge.generate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Generation failed')
    );

    renderHook(() => useGeneration());

    // acquire() resolves
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Wait for generation attempt
    await act(async () => {
      await vi.advanceTimersByTimeAsync(201);
    });

    const state = useDesignerStore.getState();
    expect(state.generation.status).toBe('error');
    expect(state.generation.mesh?.error).toBe('Generation failed');
  });
});
