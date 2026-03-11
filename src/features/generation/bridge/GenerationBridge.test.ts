import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenerationBridge } from './GenerationBridge';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { WorkerResponse, MeshResultResponse } from './types';

/**
 * Mock Worker that simulates the generation worker's message protocol.
 */
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners: Map<string, Array<(event: unknown) => void>> = new Map();
  public terminated = false;
  public messages: unknown[] = [];

  /** Control: respond with a message as if from the worker */
  simulateResponse(data: WorkerResponse): void {
    const event = { data } as MessageEvent;
    const handlers = this.listeners.get('message') ?? [];
    for (const handler of handlers) {
      handler(event);
    }
  }

  postMessage(data: unknown): void {
    this.messages.push(data);

    const msgType = (data as { type: string }).type;
    // Auto-respond to INIT
    if (msgType === 'INIT') {
      const kernel = (data as { kernel?: string }).kernel ?? 'opencascade';
      setTimeout(() => {
        this.simulateResponse({
          type: 'INIT_READY',
          isThreaded: false,
          hardwareConcurrency: 4,
          kernel: kernel as 'opencascade' | 'brepkit',
        });
      }, 0);
    }
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    const existing = this.listeners.get(type);
    if (existing) {
      existing.push(handler);
    } else {
      this.listeners.set(type, [handler]);
    }
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

// Mock the Worker constructor globally
function createMockWorkerClass() {
  return function MockWorkerConstructor() {
    mockWorkerInstance = new MockWorker();
    return mockWorkerInstance as unknown as Worker;
  };
}
vi.stubGlobal('Worker', createMockWorkerClass());

/** Get the current mock worker instance, failing the test if it hasn't been created yet. */
function getWorker(): MockWorker {
  if (mockWorkerInstance === null) {
    throw new Error('MockWorker not yet created — call bridge.init() first');
  }
  return mockWorkerInstance;
}

describe('GenerationBridge', () => {
  let bridge: GenerationBridge;

  beforeEach(() => {
    mockWorkerInstance = null;
    bridge = new GenerationBridge();
    vi.useFakeTimers();
  });

  afterEach(() => {
    bridge.destroy();
    vi.useRealTimers();
  });

  describe('init', () => {
    it('creates a worker and resolves on INIT_READY', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      expect(mockWorkerInstance).not.toBeNull();
      expect(getWorker().messages[0]).toEqual({ type: 'INIT', kernel: 'opencascade' });
    });

    it('passes kernel name from constructor in INIT message', async () => {
      const brepkitBridge = new GenerationBridge('brepkit');
      const initPromise = brepkitBridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      expect(getWorker().messages[0]).toEqual({ type: 'INIT', kernel: 'brepkit' });
      brepkitBridge.destroy();
    });

    it('returns cached promise on multiple init calls', async () => {
      const p1 = bridge.init();
      const p2 = bridge.init();
      expect(p1).toBe(p2);

      await vi.advanceTimersByTimeAsync(10);
      await p1;
    });

    it('rejects if bridge is destroyed', async () => {
      bridge.destroy();
      await expect(bridge.init()).rejects.toThrow('destroyed');
    });
  });

  describe('generate', () => {
    it('sends GENERATE message after debounce', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      // Start generation (will debounce)
      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);

      // Before debounce: no GENERATE message yet
      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(0);

      // Advance past debounce (200ms)
      await vi.advanceTimersByTimeAsync(200);

      const afterDebounce = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(afterDebounce.length).toBe(1);

      // Simulate result
      const msg = afterDebounce[0] as { payload: { requestId: string } };
      getWorker().simulateResponse({
        type: 'MESH_RESULT',
        requestId: msg.payload.requestId,
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 0, 1]),
        indices: new Uint32Array([0]),
        triangleCount: 1,
        timingMs: 42,
      });

      const result = await genPromise;
      expect(result.mesh.triangleCount).toBe(1);
      expect(result.timingMs).toBe(42);
    });

    it('cancels previous request when new one arrives', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      // First request
      const p1 = bridge.generate(DEFAULT_BIN_PARAMS);

      // Second request before debounce expires (cancels first)
      await vi.advanceTimersByTimeAsync(100);
      const p2 = bridge.generate({ ...DEFAULT_BIN_PARAMS, width: 3 });

      // First should reject with 'cancelled'
      await expect(p1).rejects.toThrow('cancelled');

      // Advance past debounce for second request
      await vi.advanceTimersByTimeAsync(200);

      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(1); // Only second request sent

      // Complete second request
      const msg = generateMessages[0] as { payload: { requestId: string } };
      getWorker().simulateResponse({
        type: 'MESH_RESULT',
        requestId: msg.payload.requestId,
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 0, 1]),
        indices: new Uint32Array([0]),
        triangleCount: 1,
        timingMs: 10,
      });

      const result = await p2;
      expect(result.mesh.triangleCount).toBe(1);
    });

    it('rejects on ERROR response', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      await vi.advanceTimersByTimeAsync(200);

      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      const msg = generateMessages[0] as { payload: { requestId: string } };

      getWorker().simulateResponse({
        type: 'ERROR',
        requestId: msg.payload.requestId,
        error: 'Out of memory',
      });

      await expect(genPromise).rejects.toThrow('Out of memory');
    });

    it('calls progress callback', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const progressCalls: Array<{ stage: string; progress: number }> = [];
      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS, (stage, progress) => {
        progressCalls.push({ stage, progress });
      });
      await vi.advanceTimersByTimeAsync(200);

      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      const msg = generateMessages[0] as { payload: { requestId: string } };

      // Simulate progress updates
      getWorker().simulateResponse({
        type: 'PROGRESS',
        requestId: msg.payload.requestId,
        stage: 'shell',
        progress: 0.5,
      });

      expect(progressCalls).toEqual([{ stage: 'shell', progress: 0.5 }]);

      // Complete
      getWorker().simulateResponse({
        type: 'MESH_RESULT',
        requestId: msg.payload.requestId,
        vertices: new Float32Array(9),
        normals: new Float32Array(9),
        indices: new Uint32Array([0, 1, 2]),
        triangleCount: 1,
        timingMs: 5,
      });

      await genPromise;
    });

    it('rejects if bridge is destroyed', async () => {
      bridge.destroy();
      await expect(bridge.generate(DEFAULT_BIN_PARAMS)).rejects.toThrow('destroyed');
    });
  });

  describe('generateImmediate', () => {
    it('sends GENERATE message without debounce', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generateImmediate(DEFAULT_BIN_PARAMS);

      // Should be sent immediately (no debounce wait)
      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(1);

      // Complete the generation to avoid unhandled rejection in afterEach
      const msg = generateMessages[0] as { payload: { requestId: string } };
      getWorker().simulateResponse({
        type: 'MESH_RESULT',
        requestId: msg.payload.requestId,
        vertices: new Float32Array(9),
        normals: new Float32Array(9),
        indices: new Uint32Array([0, 1, 2]),
        triangleCount: 1,
        timingMs: 1,
      });
      await genPromise;
    });
  });

  describe('cancel', () => {
    it('sends CANCEL message and rejects pending promise', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      await vi.advanceTimersByTimeAsync(200); // Past debounce

      // Attach rejection handler BEFORE cancel to prevent unhandled rejection
      const rejection = expect(genPromise).rejects.toThrow('cancelled');
      bridge.cancel();
      await rejection;

      const cancelMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'CANCEL'
      );
      expect(cancelMessages.length).toBe(1);
    });

    it('clears pending debounce timer', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      // Attach handler before cancel to prevent unhandled rejection
      const rejection = expect(genPromise).rejects.toThrow('cancelled');
      // Cancel before debounce fires
      bridge.cancel();
      await rejection;

      // Advance time - no GENERATE should have been sent
      await vi.advanceTimersByTimeAsync(500);
      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(0);
    });
  });

  describe('exportSplitBin', () => {
    it('sends EXPORT_SPLIT message and resolves with pieces', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      // Start the async export (it awaits init internally, which is already done)
      const splitPromise = bridge.exportSplitBin(DEFAULT_BIN_PARAMS, [21], []);

      // Let the microtask queue flush so the message is posted
      await vi.advanceTimersByTimeAsync(0);

      // Find the EXPORT_SPLIT message
      const splitMsg = getWorker().messages.find(
        (m) => (m as { type: string }).type === 'EXPORT_SPLIT'
      ) as {
        type: string;
        payload: { requestId: string; cutPlanesX: number[]; cutPlanesY: number[] };
      };
      expect(splitMsg).toBeDefined();
      expect(splitMsg.payload.cutPlanesX).toEqual([21]);
      expect(splitMsg.payload.cutPlanesY).toEqual([]);

      // Simulate worker response
      getWorker().simulateResponse({
        type: 'SPLIT_EXPORT_RESULT',
        requestId: splitMsg.payload.requestId,
        pieces: [
          { data: new ArrayBuffer(100), label: 'piece-1x1', col: 1, row: 1 },
          { data: new ArrayBuffer(100), label: 'piece-2x1', col: 2, row: 1 },
        ],
      });

      const result = await splitPromise;
      expect(result.pieces).toHaveLength(2);
      expect(result.pieces[0].label).toBe('piece-1x1');
    });

    it('rejects on error', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const splitPromise = bridge.exportSplitBin(DEFAULT_BIN_PARAMS, [21], []);

      await vi.advanceTimersByTimeAsync(0);

      const splitMsg = getWorker().messages.find(
        (m) => (m as { type: string }).type === 'EXPORT_SPLIT'
      ) as { type: string; payload: { requestId: string } };

      getWorker().simulateResponse({
        type: 'ERROR',
        requestId: splitMsg.payload.requestId,
        error: 'Split failed',
      });

      await expect(splitPromise).rejects.toThrow('Split failed');
    });

    it('rejects when bridge is destroyed', async () => {
      bridge.destroy();
      await expect(bridge.exportSplitBin(DEFAULT_BIN_PARAMS, [], [])).rejects.toThrow(
        'Bridge has been destroyed'
      );
    });
  });

  describe('types', () => {
    it('MeshResultResponse supports optional faceGroups', () => {
      const response: MeshResultResponse = {
        type: 'MESH_RESULT',
        requestId: 'test',
        vertices: new Float32Array(0),
        normals: new Float32Array(0),
        indices: new Uint32Array(0),
        edgeVertices: new Float32Array(0),
        triangleCount: 0,
        timingMs: 10,
        faceGroups: [{ start: 0, count: 3, tag: 0 }],
      };
      expect(response.faceGroups).toHaveLength(1);
      expect(response.faceGroups?.[0].tag).toBe(0);
    });
  });

  describe('destroy', () => {
    it('terminates the worker', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      bridge.destroy();
      expect(getWorker().terminated).toBe(true);
    });

    it('sets isDestroyed flag', () => {
      expect(bridge.isDestroyed).toBe(false);
      bridge.destroy();
      expect(bridge.isDestroyed).toBe(true);
    });

    it('is idempotent', () => {
      bridge.destroy();
      bridge.destroy(); // Should not throw
      expect(bridge.isDestroyed).toBe(true);
    });
  });
});
