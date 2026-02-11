import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeneration } from './useGeneration';
import { useDesignerStore } from '../store';
import type { WorkerResponse } from '@/shared/generation/bridge';

/**
 * Mock Worker for testing the useGeneration hook.
 * Uses setTimeout(0) instead of queueMicrotask so fake timers can control it.
 */
class MockWorker {
  private listeners: Map<string, Array<(event: unknown) => void>> = new Map();
  public terminated = false;

  simulateResponse(data: WorkerResponse): void {
    const event = { data } as MessageEvent;
    const handlers = this.listeners.get('message') ?? [];
    for (const handler of handlers) {
      handler(event);
    }
  }

  postMessage(data: unknown): void {
    const msg = data as { type: string; payload?: { requestId: string } };

    if (msg.type === 'INIT') {
      setTimeout(() => {
        this.simulateResponse({ type: 'INIT_READY' });
      }, 0);
    }

    if (msg.type === 'GENERATE' && msg.payload) {
      setTimeout(() => {
        this.simulateResponse({
          type: 'MESH_RESULT',
          requestId: msg.payload!.requestId,
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          indices: new Uint32Array([0, 1, 2]),
          edgeVertices: new Float32Array(0),
          triangleCount: 1,
          timingMs: 5,
        });
      }, 0);
    }
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);
  }

  removeEventListener(type: string, handler: (event: unknown) => void): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

let mockWorkerInstance: MockWorker | null = null;

function createMockWorkerClass() {
  return function MockWorkerConstructor() {
    mockWorkerInstance = new MockWorker();
    return mockWorkerInstance as unknown as Worker;
  };
}

describe('useGeneration', () => {
  beforeEach(() => {
    mockWorkerInstance = null;
    vi.useFakeTimers();
    vi.stubGlobal('Worker', createMockWorkerClass());
    // Full store reset (resetToDefaults only resets params)
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

    // Advance: setTimeout(0) for INIT_READY + promise resolution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(mockWorkerInstance).not.toBeNull();
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

    // Step 1: Init completes (setTimeout 0 → INIT_READY → promise resolves)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Step 2: Generate debounce fires (200ms timer in bridge)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(201);
    });

    // Step 3: Worker responds with MESH_RESULT (setTimeout 0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    const state = useDesignerStore.getState();
    expect(state.generation.status).toBe('complete');
    expect(state.generation.mesh).not.toBeNull();
    expect(state.generation.mesh!.vertices).not.toBeNull();
  });

  it('regenerates when params change', async () => {
    renderHook(() => useGeneration());

    // Complete initial generation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1); // init
      await vi.advanceTimersByTimeAsync(201); // debounce
      await vi.advanceTimersByTimeAsync(1); // worker response
    });

    expect(useDesignerStore.getState().generation.status).toBe('complete');

    // Change params
    act(() => {
      useDesignerStore.getState().setParam('width', 4);
    });

    // Wait for re-generation: debounce (200ms) + worker response
    await act(async () => {
      await vi.advanceTimersByTimeAsync(201); // debounce
      await vi.advanceTimersByTimeAsync(1); // worker response
    });

    expect(useDesignerStore.getState().generation.status).toBe('complete');
  });

  it('destroys the worker on unmount', async () => {
    const { unmount } = renderHook(() => useGeneration());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockWorkerInstance).not.toBeNull();

    unmount();
    expect(mockWorkerInstance!.terminated).toBe(true);
  });

  it('handles generation error', async () => {
    // Override worker to respond with error
    function createErrorWorkerClass() {
      return function ErrorWorkerConstructor() {
        const worker = new MockWorker();
        worker.postMessage = (data: unknown) => {
          const msg = data as { type: string; payload?: { requestId: string } };
          if (msg.type === 'INIT') {
            setTimeout(() => worker.simulateResponse({ type: 'INIT_READY' }), 0);
          }
          if (msg.type === 'GENERATE' && msg.payload) {
            setTimeout(() => {
              worker.simulateResponse({
                type: 'ERROR',
                requestId: msg.payload!.requestId,
                error: 'Generation failed',
              });
            }, 0);
          }
        };
        mockWorkerInstance = worker;
        return worker as unknown as Worker;
      };
    }
    vi.stubGlobal('Worker', createErrorWorkerClass());

    renderHook(() => useGeneration());

    // Init + debounce + error response
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1); // init
      await vi.advanceTimersByTimeAsync(201); // debounce
      await vi.advanceTimersByTimeAsync(1); // worker error response
    });

    const state = useDesignerStore.getState();
    expect(state.generation.status).toBe('error');
    expect(state.generation.mesh?.error).toBe('Generation failed');
  });
});
