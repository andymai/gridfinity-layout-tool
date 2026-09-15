export type WebGLUnavailableReason =
  'no-document' | 'no-canvas' | 'context-failed' | 'context-lost' | 'no-precision';

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

  // A present-but-nonfunctional context (driver flake, blocklisted/virtualized
  // GPU, software renderer with a broken shader compiler) still answers
  // getContext() and reports a non-lost context, yet returns null from
  // getShaderPrecisionFormat(). three.js then dereferences `.precision` off that
  // null deep in WebGLRenderer setup and throws a generic `TypeError`. Probe
  // precision here so a broken context is caught up front and routed to the
  // WebGLFallback like every other unavailable case; `webglFailureReason`
  // catches the same throw when the context breaks AFTER this cached probe
  // passed. The method is always present on a conforming context; the jsdom
  // mock and non-conforming contexts may omit it, so a missing method counts
  // as broken.
  let precisionOk: boolean;
  try {
    // A working context returns a (truthy) precision descriptor; a broken one
    // returns null, and a non-conforming/mocked context omits the method.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for non-browser/mocked contexts
    precisionOk = Boolean(gl.getShaderPrecisionFormat?.(gl.VERTEX_SHADER, gl.HIGH_FLOAT));
  } catch {
    precisionOk = false;
  }
  if (!precisionOk) {
    releaseProbeContext(gl);
    return { available: false, reason: 'no-precision' };
  }

  releaseProbeContext(gl);
  return { available: true };
}

/**
 * Release the probe's context immediately. Browsers cap live WebGL contexts
 * (~16); holding this throwaway one would consume a slot the real `<Canvas>`
 * needs, and on context-starved devices that can tip renderer creation into
 * failure. The type says `getExtension` is always present, but the jsdom test
 * mock (and any non-conforming context) may omit it — guard at runtime.
 */
function releaseProbeContext(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for non-browser/mocked contexts
  gl.getExtension?.('WEBGL_lose_context')?.loseContext();
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

/** Substring of the error three.js throws when it can't acquire a GL context. */
const CONTEXT_CREATION_ERROR = 'Error creating WebGL context';

/**
 * three.js reading `.precision` off a null `getShaderPrecisionFormat()` result
 * while building its capabilities table, in the wordings that name the call
 * (WebKit, Gecko).
 */
const PRECISION_NULL_ERROR = /getShaderPrecisionFormat\([^)]*\)(?:\.precision| is null)/;

/**
 * V8 names only the property, so its wording is accepted only when the stack
 * runs through three.js: the `three-render` chunk in a build, the package in
 * dev. Anything else reading a `precision` field off null is an app error and
 * must reach the panel boundary.
 */
const PRECISION_NULL_V8 = /\(reading 'precision'\)/;
const THREE_SOURCE = /three/;

/**
 * Why a renderer threw at mount despite the cached probe passing, or null
 * when the error is not a WebGL failure at all.
 *
 * Both reasons come from the same window: the probe ran once at startup, and
 * the context can be exhausted or lost by the time a later `<Canvas>` mounts.
 * Read by the WebGL boundary to choose the fallback over the generic panel
 * error, and by the exception filter to group both wordings into one issue.
 *
 * @param source The error's stack, or its frames' filenames joined. Only the
 *   V8 wording needs it.
 */
export function webglFailureReason(
  message: string,
  source = ''
): 'context-failed' | 'no-precision' | null {
  if (message.includes(CONTEXT_CREATION_ERROR)) return 'context-failed';
  if (PRECISION_NULL_ERROR.test(message)) return 'no-precision';
  if (PRECISION_NULL_V8.test(message) && THREE_SOURCE.test(source)) return 'no-precision';
  return null;
}
