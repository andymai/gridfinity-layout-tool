export type WebGLUnavailableReason =
  | 'no-document'
  | 'no-canvas'
  | 'context-failed'
  | 'context-lost';

export interface WebGLDetectionResult {
  available: boolean;
  reason?: WebGLUnavailableReason;
}

let cached: WebGLDetectionResult | null = null;

function probe(): WebGLDetectionResult {
  if (typeof document === 'undefined') {
    return { available: false, reason: 'no-document' };
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = document.createElement('canvas');
  } catch {
    return { available: false, reason: 'no-canvas' };
  }

  let gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  try {
    gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
  } catch {
    return { available: false, reason: 'context-failed' };
  }

  if (!gl) return { available: false, reason: 'context-failed' };
  if (gl.isContextLost()) return { available: false, reason: 'context-lost' };
  // Release the probe's context immediately. Browsers cap live WebGL contexts
  // (~16); holding this throwaway one would consume a slot the real <Canvas>
  // needs, and on context-starved devices that can tip renderer creation into
  // failure. The type says `getExtension` is always present, but the jsdom test
  // mock (and any non-conforming context) may omit it — guard at runtime.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for non-browser/mocked contexts
  gl.getExtension?.('WEBGL_lose_context')?.loseContext();
  return { available: true };
}

export function detectWebGL(): WebGLDetectionResult {
  cached ??= probe();
  return cached;
}

/**
 * Force subsequent `detectWebGL()` calls to report unavailable. Called when a
 * real renderer fails to acquire a context despite the probe passing (context
 * slot exhaustion, GPU-process loss), so the next render skips the canvas and
 * shows the fallback instead of re-throwing and spamming error telemetry.
 */
export function markWebGLUnavailable(reason: WebGLUnavailableReason): void {
  cached = { available: false, reason };
}

export function resetWebGLDetectionCacheForTests(): void {
  cached = null;
}
