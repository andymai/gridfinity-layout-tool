import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectWebGL, resetWebGLDetectionCacheForTests } from './detectWebGL';

afterEach(() => {
  resetWebGLDetectionCacheForTests();
  vi.restoreAllMocks();
});

describe('detectWebGL', () => {
  it('returns available when getContext returns a non-lost WebGL context', () => {
    const fakeGl = { isContextLost: () => false } as unknown as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl2' ? fakeGl : null) as typeof HTMLCanvasElement.prototype.getContext);

    expect(detectWebGL()).toEqual({ available: true });
  });

  it('falls back to webgl1 when webgl2 is unavailable', () => {
    const fakeGl = { isContextLost: () => false } as unknown as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl' ? fakeGl : null) as typeof HTMLCanvasElement.prototype.getContext);

    expect(detectWebGL()).toEqual({ available: true });
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
});
