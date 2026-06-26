import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectWebGL, markWebGLUnavailable, resetWebGLDetectionCacheForTests } from './detectWebGL';

afterEach(() => {
  resetWebGLDetectionCacheForTests();
  vi.restoreAllMocks();
});

/** Minimal context that passes every detectWebGL() check (non-lost + precision). */
function workingGl(): WebGLRenderingContext {
  return {
    isContextLost: () => false,
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
  } as unknown as WebGLRenderingContext;
}

describe('detectWebGL', () => {
  it('returns available when getContext returns a non-lost WebGL context', () => {
    const fakeGl = workingGl();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl2' ? fakeGl : null) as typeof HTMLCanvasElement.prototype.getContext);

    expect(detectWebGL()).toEqual({ available: true });
  });

  it('falls back to webgl1 when webgl2 is unavailable', () => {
    const fakeGl = workingGl();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl' ? fakeGl : null) as typeof HTMLCanvasElement.prototype.getContext);

    expect(detectWebGL()).toEqual({ available: true });
  });

  it('reports no-precision when getShaderPrecisionFormat returns null', () => {
    const fakeGl = {
      isContextLost: () => false,
      getShaderPrecisionFormat: () => null,
    } as unknown as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl);
    expect(detectWebGL()).toEqual({ available: false, reason: 'no-precision' });
  });

  it('reports no-precision when getShaderPrecisionFormat throws', () => {
    const fakeGl = {
      isContextLost: () => false,
      getShaderPrecisionFormat: () => {
        throw new Error('broken');
      },
    } as unknown as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl);
    expect(detectWebGL()).toEqual({ available: false, reason: 'no-precision' });
  });

  it('reports no-precision when getShaderPrecisionFormat is absent (non-conforming context)', () => {
    const fakeGl = { isContextLost: () => false } as unknown as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl);
    expect(detectWebGL()).toEqual({ available: false, reason: 'no-precision' });
  });

  it('reports context-failed when no context can be acquired', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(detectWebGL()).toEqual({ available: false, reason: 'context-failed' });
  });

  it('reports context-failed when getContext throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(detectWebGL()).toEqual({ available: false, reason: 'context-failed' });
  });

  it('reports context-lost when the returned context is already lost', () => {
    const fakeGl = { isContextLost: () => true } as unknown as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl);
    expect(detectWebGL()).toEqual({ available: false, reason: 'context-lost' });
  });

  it('memoizes the first result across calls', () => {
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ isContextLost: () => false } as unknown as WebGLRenderingContext);

    detectWebGL();
    detectWebGL();
    detectWebGL();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('releases the probe context so it does not consume a slot', () => {
    const loseContext = vi.fn();
    const fakeGl = {
      isContextLost: () => false,
      getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
      getExtension: vi.fn(() => ({ loseContext })),
    } as unknown as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl);

    expect(detectWebGL()).toEqual({ available: true });
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('releases the probe context even when the precision probe fails', () => {
    const loseContext = vi.fn();
    const fakeGl = {
      isContextLost: () => false,
      getShaderPrecisionFormat: () => null,
      getExtension: vi.fn(() => ({ loseContext })),
    } as unknown as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl);

    expect(detectWebGL()).toEqual({ available: false, reason: 'no-precision' });
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});

describe('markWebGLUnavailable', () => {
  it('overrides the cache so detectWebGL() reports unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(workingGl());
    expect(detectWebGL().available).toBe(true);

    markWebGLUnavailable('context-failed');

    expect(detectWebGL()).toEqual({ available: false, reason: 'context-failed' });
  });
});
