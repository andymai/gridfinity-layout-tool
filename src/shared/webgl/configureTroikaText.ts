import { configureTextBuilder } from 'troika-three-text';

/**
 * troika-three-text generates glyph SDFs in a worker by default. Some WebKit
 * builds fail to `eval` the stringified worker module, so every `<Text>` sync
 * throws "Worker module function was called but `init` did not return a callable
 * function" instead of laying out text (the `troika-worker-init-failed` PostHog
 * fingerprint in errorFilters.ts). Forcing the main-thread code path sidesteps
 * that eval.
 *
 * The main-thread path is not always safe. troika's bundled
 * `webgl-sdf-generator` draws on a WebGL1 context and needs the
 * `ANGLE_instanced_arrays` extension; without it, `setAttribute` throws
 * "ANGLE_instanced_arrays not supported". troika's JS fallback still copies the
 * result through the same extension-dependent `renderImageData`, so the throw
 * escapes uncaught and breaks the whole 3D preview. Software-rendered and
 * blocklisted GPUs are the clients that lack the extension.
 *
 * So force the main thread only when the extension is present. Otherwise keep
 * the default worker path: those clients are not WebKit, so the worker loads,
 * and if worker generation still fails the text degrades without a main-thread
 * throw (the `troika-sdf-instancing-unsupported` fingerprint catches any that
 * do reach PostHog).
 */
function mainThreadSdfIsSupported(): boolean {
  if (typeof document === 'undefined') return false;

  let canvas: HTMLCanvasElement;
  try {
    canvas = document.createElement('canvas');
  } catch {
    return false;
  }

  let gl: WebGLRenderingContext | null;
  try {
    gl =
      canvas.getContext('webgl') ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
  } catch {
    return false;
  }
  if (!gl) return false;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for mocked contexts that omit the method
  const supported = Boolean(gl.getExtension?.('ANGLE_instanced_arrays'));
  // Release the probe context immediately; browsers cap live WebGL contexts and
  // the real `<Canvas>` needs the slot.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for mocked contexts that omit the method
  gl.getExtension?.('WEBGL_lose_context')?.loseContext();
  return supported;
}

if (mainThreadSdfIsSupported()) {
  configureTextBuilder({ useWorker: false });
}
