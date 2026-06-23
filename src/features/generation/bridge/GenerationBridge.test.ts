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

  /** Control: simulate a worker error event (e.g., WASM crash) */
  simulateError(message = 'Worker crashed'): void {
    const event = { message, preventDefault: vi.fn() } as unknown as ErrorEvent;
    const handlers = this.listeners.get('error') ?? [];
    for (const handler of handlers) {
      handler(event);
    }
  }

  postMessage(data: unknown): void {
    this.messages.push(data);

    const msgType = (data as { type: string }).type;
    // Auto-respond to INIT
    if (msgType === 'INIT') {
      const kernel = (data as { kernel?: string }).kernel ?? 'occt-wasm';
      setTimeout(() => {
        this.simulateResponse({
          type: 'INIT_READY',
          isThreaded: false,
          hardwareConcurrency: 4,
          kernel: kernel as 'occt-wasm' | 'brepkit',
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
      expect(getWorker().messages[0]).toEqual({ type: 'INIT', kernel: 'occt-wasm' });
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

  describe('generation timeout recovery', () => {
    /** Drive a generation that never responds until its timeout fires. */
    async function timeOutAGeneration(): Promise<MockWorker> {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;
      const wedged = getWorker();

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      // Attach the rejection handler before advancing time so the timeout
      // rejection (which fires mid-advance) is never momentarily unhandled.
      const rejection = expect(genPromise).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(200); // past debounce -> GENERATE posted
      // Worker never answers — advance past the generation timeout budget.
      await vi.advanceTimersByTimeAsync(31_000);
      await rejection;
      return wedged;
    }

    it('terminates the wedged worker and starts a fresh one on timeout', async () => {
      const wedged = await timeOutAGeneration();

      expect(wedged.terminated).toBe(true);
      // A replacement worker was created eagerly (different instance).
      expect(mockWorkerInstance).not.toBe(wedged);
    });

    it('lets the next generation succeed on the fresh worker after a timeout', async () => {
      const wedged = await timeOutAGeneration();

      // Let the replacement worker finish its INIT handshake.
      await vi.advanceTimersByTimeAsync(10);
      const fresh = getWorker();
      expect(fresh).not.toBe(wedged);

      const genPromise = bridge.generate({ ...DEFAULT_BIN_PARAMS, width: 3 });
      await vi.advanceTimersByTimeAsync(200);

      const generateMessages = fresh.messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(1); // routed to the fresh worker

      const msg = generateMessages[0] as { payload: { requestId: string } };
      fresh.simulateResponse({
        type: 'MESH_RESULT',
        requestId: msg.payload.requestId,
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 0, 1]),
        indices: new Uint32Array([0]),
        triangleCount: 1,
        timingMs: 7,
      });

      const result = await genPromise;
      expect(result.mesh.triangleCount).toBe(1);
    });
  });

  describe('generateImmediate', () => {
    it('sends GENERATE message without debounce', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generateImmediate(DEFAULT_BIN_PARAMS);

      // Dispatched after the worker-ready microtask, but with no debounce wait.
      await vi.advanceTimersByTimeAsync(0);
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

  describe('export timeouts', () => {
    it('rejects exportBin when the worker never responds', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      // Fire the export and let the message reach the worker, but never respond.
      const exportPromise = bridge.exportBin(DEFAULT_BIN_PARAMS, 'stl');
      // Attach a no-op catch so the rejection is observed before assertions.
      const settled = exportPromise.catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(0);

      const exportMsg = getWorker().messages.find(
        (m) => (m as { type: string }).type === 'EXPORT'
      ) as { payload: { requestId: string } };
      expect(exportMsg).toBeDefined();
      const wedged = getWorker();

      // Export timeout is the complexity budget (BASE 30s for a default bin)
      // scaled by EXPORT_TIMEOUT_MULTIPLIER (×4 = 120s); advance well past it.
      await vi.advanceTimersByTimeAsync(180_000);

      const result = await settled;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toMatch(/timed out/i);

      // A worker wedged in a synchronous export can't process a CANCEL, so the
      // bridge terminates it instead of posting one.
      expect(wedged.terminated).toBe(true);
      const cancelMessages = wedged.messages.filter(
        (m) => (m as { type: string }).type === 'CANCEL'
      );
      expect(cancelMessages.length).toBe(0);
    });

    it('recovers the worker so generation works after an export timeout', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;
      const wedged = getWorker();

      const settled = bridge.exportBin(DEFAULT_BIN_PARAMS, 'stl').catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(180_000); // never answered -> timeout
      expect(await settled).toBeInstanceOf(Error);
      expect(wedged.terminated).toBe(true);

      // Replacement worker finishes its INIT handshake, then a generation runs.
      await vi.advanceTimersByTimeAsync(10);
      const fresh = getWorker();
      expect(fresh).not.toBe(wedged);

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      await vi.advanceTimersByTimeAsync(200);
      const genMsg = fresh.messages.find((m) => (m as { type: string }).type === 'GENERATE') as {
        payload: { requestId: string };
      };
      expect(genMsg).toBeDefined();
      fresh.simulateResponse({
        type: 'MESH_RESULT',
        requestId: genMsg.payload.requestId,
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 0, 1]),
        indices: new Uint32Array([0]),
        triangleCount: 1,
        timingMs: 4,
      });
      expect((await genPromise).mesh.triangleCount).toBe(1);
    });

    it('clears the timeout when the export resolves', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const exportPromise = bridge.exportBin(DEFAULT_BIN_PARAMS, 'stl');
      await vi.advanceTimersByTimeAsync(0);

      const exportMsg = getWorker().messages.find(
        (m) => (m as { type: string }).type === 'EXPORT'
      ) as { payload: { requestId: string } };

      getWorker().simulateResponse({
        type: 'EXPORT_RESULT',
        requestId: exportMsg.payload.requestId,
        data: new ArrayBuffer(8),
        format: 'stl',
        fileName: 'bin.stl',
      });

      const result = await exportPromise;
      expect(result.format).toBe('stl');

      // Past the timeout — should NOT spuriously reject after the fact.
      await vi.advanceTimersByTimeAsync(120_000);
      // No assertion needed — if a stale timer fires, the test would crash on
      // a now-removed pending entry. The fact that we got here is the proof.
    });
  });

  describe('deduplication', () => {
    /** Helper: init bridge, generate with DEFAULT_BIN_PARAMS, and complete successfully. */
    async function initAndGenerate(): Promise<void> {
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
        type: 'MESH_RESULT',
        requestId: msg.payload.requestId,
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 0, 1]),
        indices: new Uint32Array([0]),
        edgeVertices: new Float32Array([]),
        triangleCount: 1,
        timingMs: 42,
      });

      await genPromise;
    }

    it('returns cached result for identical params', async () => {
      await initAndGenerate();

      // Second call with identical params should resolve immediately
      const result = await bridge.generate(DEFAULT_BIN_PARAMS);
      expect(result.mesh.triangleCount).toBe(1);
      expect(result.timingMs).toBe(42);

      // No new GENERATE messages should have been sent
      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(1); // Only the first one
    });

    it('does not cache when params differ', async () => {
      await initAndGenerate();

      // Different params should send a new request
      const genPromise = bridge.generate({ ...DEFAULT_BIN_PARAMS, width: 3 });
      await vi.advanceTimersByTimeAsync(200);

      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(2); // First + new one

      // Complete the second request
      const msg = generateMessages[1] as { payload: { requestId: string } };
      getWorker().simulateResponse({
        type: 'MESH_RESULT',
        requestId: msg.payload.requestId,
        vertices: new Float32Array([4, 5, 6]),
        normals: new Float32Array([0, 1, 0]),
        indices: new Uint32Array([0]),
        edgeVertices: new Float32Array([]),
        triangleCount: 2,
        timingMs: 50,
      });

      const result = await genPromise;
      expect(result.mesh.triangleCount).toBe(2);
    });

    it('generateImmediate also uses cache', async () => {
      await initAndGenerate();

      const result = await bridge.generateImmediate(DEFAULT_BIN_PARAMS);
      expect(result.mesh.triangleCount).toBe(1);

      // No new GENERATE messages
      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(1);
    });

    it('cache is cleared on destroy', async () => {
      await initAndGenerate();

      bridge.destroy();
      await expect(bridge.generate(DEFAULT_BIN_PARAMS)).rejects.toThrow('destroyed');
    });

    it('does not serve stale cache after cancel', async () => {
      await initAndGenerate();

      // Start a new generation with different params, then cancel
      const genPromise = bridge.generate({ ...DEFAULT_BIN_PARAMS, width: 5 });
      await vi.advanceTimersByTimeAsync(200);

      const rejection = expect(genPromise).rejects.toThrow('cancelled');
      bridge.cancel();
      await rejection;

      // Retry with the original params — should still re-dispatch because
      // the last *successful* result was for DEFAULT_BIN_PARAMS, which
      // should still be cached
      const result = await bridge.generate(DEFAULT_BIN_PARAMS);
      expect(result.mesh.triangleCount).toBe(1);

      // Only 2 GENERATE messages total (initial + the cancelled one)
      const generateMessages = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE'
      );
      expect(generateMessages.length).toBe(2);
    });

    it('does not cache failed generation', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      // First generation fails
      const failPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      await vi.advanceTimersByTimeAsync(200);

      const msgs1 = getWorker().messages.filter((m) => (m as { type: string }).type === 'GENERATE');
      const msg1 = msgs1[0] as { payload: { requestId: string } };
      getWorker().simulateResponse({
        type: 'ERROR',
        requestId: msg1.payload.requestId,
        error: 'OCCT failure',
      });
      await expect(failPromise).rejects.toThrow('OCCT failure');

      // Retry with same params — should re-dispatch (not serve cached error)
      const retryPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      await vi.advanceTimersByTimeAsync(200);

      const msgs2 = getWorker().messages.filter((m) => (m as { type: string }).type === 'GENERATE');
      expect(msgs2.length).toBe(2); // Both dispatched

      // Complete the retry
      const msg2 = msgs2[1] as { payload: { requestId: string } };
      getWorker().simulateResponse({
        type: 'MESH_RESULT',
        requestId: msg2.payload.requestId,
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 0, 1]),
        indices: new Uint32Array([0]),
        edgeVertices: new Float32Array([]),
        triangleCount: 1,
        timingMs: 10,
      });

      const result = await retryPromise;
      expect(result.mesh.triangleCount).toBe(1);
    });

    it('does not cross-contaminate bin and baseplate caches when interleaved', async () => {
      await initAndGenerate(); // bin cache is warm (triangleCount=1)

      // Start a bin generation with different params (will be cancelled by baseplate)
      const binPromise = bridge.generate({ ...DEFAULT_BIN_PARAMS, width: 4 });
      await vi.advanceTimersByTimeAsync(200);

      // Supersede with a baseplate request — this cancels the in-flight bin request
      const rejection = expect(binPromise).rejects.toThrow('cancelled');
      const bpPromise = bridge.generateBaseplate(
        {
          width: 2,
          depth: 2,
          gridUnitMm: 42,
          magnetHoles: false,
          magnetDiameter: 6.5,
          magnetDepth: 2.4,
          paddingLeft: 0,
          paddingRight: 0,
          paddingFront: 0,
          paddingBack: 0,
          fractionalEdgeX: 'end',
          fractionalEdgeY: 'end',
        },
        () => {}
      );
      await rejection;
      await vi.advanceTimersByTimeAsync(200);

      // Complete the baseplate request
      const bpMsgs = getWorker().messages.filter(
        (m) => (m as { type: string }).type === 'GENERATE_BASEPLATE'
      );
      const bpMsg = bpMsgs[0] as { payload: { requestId: string } };
      getWorker().simulateResponse({
        type: 'MESH_RESULT',
        requestId: bpMsg.payload.requestId,
        vertices: new Float32Array([7, 8, 9]),
        normals: new Float32Array([0, 0, 1]),
        indices: new Uint32Array([0]),
        edgeVertices: new Float32Array([]),
        triangleCount: 99,
        timingMs: 20,
      });

      const bpResult = await bpPromise;
      expect(bpResult.mesh.triangleCount).toBe(99);

      // Now verify bin cache still returns the original result (not baseplate data)
      const binResult = await bridge.generate(DEFAULT_BIN_PARAMS);
      expect(binResult.mesh.triangleCount).toBe(1); // Original cached bin result
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

  describe('worker crash recovery', () => {
    it('rejects pending generation when worker fires error event', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      // Advance past debounce
      await vi.advanceTimersByTimeAsync(300);

      // Simulate worker crash (WASM OOM)
      getWorker().simulateError('Out of memory');

      await expect(genPromise).rejects.toThrow('Out of memory');
    });

    it('rejects pending generation with default message when error event has no message', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      await vi.advanceTimersByTimeAsync(300);

      getWorker().simulateError('');

      await expect(genPromise).rejects.toThrow('out-of-memory');
    });
  });

  describe('generation timeout', () => {
    it('rejects with timeout error when worker does not respond within 30s', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      // Attach rejection handler before advancing timers so it doesn't become unhandled
      const rejection = genPromise.catch((e: unknown) => e as Error);
      // Advance past debounce + timeout
      await vi.advanceTimersByTimeAsync(31_000);

      const error = await rejection;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('timed out');
    });

    it('does not timeout when generation completes in time', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      await vi.advanceTimersByTimeAsync(300);

      // Find the requestId from the GENERATE message
      const worker = getWorker();
      const generateMsg = worker.messages.find(
        (m) => (m as { type: string }).type === 'GENERATE'
      ) as { type: string; payload: { requestId: string } };

      // Respond before timeout
      worker.simulateResponse({
        type: 'MESH_RESULT',
        requestId: generateMsg.payload.requestId,
        vertices: new Float32Array(0),
        normals: new Float32Array(0),
        indices: new Uint32Array(0),
        edgeVertices: new Float32Array(0),
        triangleCount: 0,
        timingMs: 100,
      });

      const result = await genPromise;
      expect(result.timingMs).toBe(100);

      // Advancing past timeout should not cause issues
      await vi.advanceTimersByTimeAsync(30_000);
    });

    it('terminates the worker on timeout (CANCEL is useless to a blocked worker)', async () => {
      const initPromise = bridge.init();
      await vi.advanceTimersByTimeAsync(10);
      await initPromise;

      const genPromise = bridge.generate(DEFAULT_BIN_PARAMS);
      const rejection = expect(genPromise).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(300);

      const worker = getWorker();

      // Trigger timeout
      await vi.advanceTimersByTimeAsync(30_000);
      await rejection;

      // A single-threaded worker blocked in a synchronous op can't process a
      // CANCEL message, so the bridge terminates it instead of posting one.
      expect(worker.terminated).toBe(true);
      const cancelMsg = worker.messages.find((m) => (m as { type: string }).type === 'CANCEL');
      expect(cancelMsg).toBeUndefined();
    });
  });
});
