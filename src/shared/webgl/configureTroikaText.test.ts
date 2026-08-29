import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Fake canvas whose WebGL1 context reports whether `ANGLE_instanced_arrays` is
 * available. `getContextResult: null` models a client that cannot create a
 * WebGL1 context at all.
 */
function stubCanvas(options: { instancedArrays: boolean; getContextResult?: 'context' | null }) {
  const { instancedArrays, getContextResult = 'context' } = options;
  const getExtension = vi.fn((name: string) => {
    if (name === 'ANGLE_instanced_arrays') return instancedArrays ? {} : null;
    return { loseContext: vi.fn() };
  });
  const gl = getContextResult === 'context' ? { getExtension } : null;
  const canvas = { getContext: vi.fn(() => gl) } as unknown as HTMLCanvasElement;
  vi.spyOn(document, 'createElement').mockReturnValue(canvas);
  return { getExtension };
}

async function loadModule(configureTextBuilder: ReturnType<typeof vi.fn>) {
  vi.doMock('troika-three-text', () => ({ configureTextBuilder }));
  vi.resetModules();
  await import('./configureTroikaText');
}

describe('configureTroikaText', () => {
  afterEach(() => {
    vi.doUnmock('troika-three-text');
    vi.restoreAllMocks();
  });

  it('forces the main-thread path when ANGLE_instanced_arrays is available', async () => {
    stubCanvas({ instancedArrays: true });
    const configureTextBuilder = vi.fn();

    await loadModule(configureTextBuilder);

    expect(configureTextBuilder).toHaveBeenCalledWith({ useWorker: false });
  });

  it('keeps the default worker path when ANGLE_instanced_arrays is missing', async () => {
    stubCanvas({ instancedArrays: false });
    const configureTextBuilder = vi.fn();

    await loadModule(configureTextBuilder);

    expect(configureTextBuilder).not.toHaveBeenCalled();
  });

  it('keeps the default worker path when no WebGL1 context is available', async () => {
    stubCanvas({ instancedArrays: false, getContextResult: null });
    const configureTextBuilder = vi.fn();

    await loadModule(configureTextBuilder);

    expect(configureTextBuilder).not.toHaveBeenCalled();
  });
});
