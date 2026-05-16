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
  return { available: true };
}

export function detectWebGL(): WebGLDetectionResult {
  cached ??= probe();
  return cached;
}

export function resetWebGLDetectionCacheForTests(): void {
  cached = null;
}
