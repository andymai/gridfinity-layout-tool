// @vitest-environment node
/**
 * Tests for the handle ledge builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__dual-kernel__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, HandleConfig } from '@/shared/types/bin';

function makeParams(handles: Partial<HandleConfig>, label?: { enabled: boolean }): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    handles: {
      ...DEFAULT_BIN_PARAMS.handles,
      ...handles,
      front: { ...DEFAULT_BIN_PARAMS.handles.front, ...(handles.front ?? {}) },
      back: { ...DEFAULT_BIN_PARAMS.handles.back, ...(handles.back ?? {}) },
      left: { ...DEFAULT_BIN_PARAMS.handles.left, ...(handles.left ?? {}) },
      right: { ...DEFAULT_BIN_PARAMS.handles.right, ...(handles.right ?? {}) },
    },
    label: { ...DEFAULT_BIN_PARAMS.label, ...(label ?? {}) },
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('buildHandles', () => {
  it('returns null when handles disabled', async () => {
    const { buildHandles } = await import('./handleBuilder');
    const params = makeParams({ enabled: false });
    const result = buildHandles(params, 40, 40, 20, 1.2, false);
    expect(result).toBeNull();
  });

  it('returns null when all sides disabled', async () => {
    const { buildHandles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      front: { enabled: false },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandles(params, 40, 40, 20, 1.2, false);
    expect(result).toBeNull();
  });

  it('produces geometry when front enabled', async () => {
    const { buildHandles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      depth: 8,
      width: 70,
      filletRadius: 5,
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  it('suppresses back handle when label tabs enabled', async () => {
    const { buildHandles } = await import('./handleBuilder');
    // Only back enabled + label enabled => should suppress back => null
    const params = makeParams(
      {
        enabled: true,
        front: { enabled: false },
        back: { enabled: true },
        left: { enabled: false },
        right: { enabled: false },
      },
      { enabled: true }
    );
    const result = buildHandles(params, 40, 40, 20, 1.2, false);
    expect(result).toBeNull();
  });

  it('produces geometry with minimum depth and width', async () => {
    const { buildHandles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      depth: 4, // MIN_HANDLE_DEPTH
      width: 10, // MIN_HANDLE_WIDTH
      filletRadius: 2,
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  it('clamps depth on narrow bins to prevent opposite-wall overlap', async () => {
    const { buildHandles } = await import('./handleBuilder');
    // 0.5-unit bin: innerD ≈ 19.8mm. depthSpan/2 - wt ≈ 8.7mm. depth=10 should clamp.
    const params = makeParams({
      enabled: true,
      depth: 10,
      width: 70,
      filletRadius: 5,
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandles(params, 40, 19.8, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  it('handles fillet radius larger than depth gracefully', async () => {
    const { buildHandles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      depth: 5,
      width: 70,
      filletRadius: 10, // >> depth * 0.7 = 3.5, will be clamped
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  it('produces geometry for multiple sides', async () => {
    const { buildHandles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      depth: 8,
      width: 70,
      filletRadius: 5,
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: true },
      right: { enabled: true },
    });
    const result = buildHandles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });
});
