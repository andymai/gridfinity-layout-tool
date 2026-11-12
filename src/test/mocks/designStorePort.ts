import type { PreparedBinParams } from '@/core/storage/designStorePort';

/**
 * `DesignStorePort.prepareBinParams` for a fake port: objects pass as they are,
 * anything else is refused, as the real adapter refuses it.
 */
export async function prepareBinParamsAsIs(params: unknown): Promise<PreparedBinParams | null> {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) return null;
  const { width, depth, height } = params as Partial<Record<'width' | 'depth' | 'height', number>>;
  return { params, width: width ?? 1, depth: depth ?? 1, height: height ?? 1 };
}
