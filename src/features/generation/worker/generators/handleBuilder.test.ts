// @vitest-environment node
/**
 * Tests for the handle hole builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, HandleConfig } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';

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

describe('buildHandleHoles', () => {
  it('returns null when handles disabled', async () => {
    const { buildHandleHoles } = await import('./handleBuilder');
    const params = makeParams({ enabled: false });
    const result = buildHandleHoles(params, 40, 40, 20, 1.2, false);
    expect(result).toBeNull();
  });

  it('returns null when all sides disabled', async () => {
    const { buildHandleHoles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      front: { enabled: false },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandleHoles(params, 40, 40, 20, 1.2, false);
    expect(result).toBeNull();
  });

  it('produces geometry when front enabled', async () => {
    const { buildHandleHoles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      height: 15,
      width: 50,
      cornerRadius: 3,
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandleHoles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  it('suppresses back handle when label tabs enabled', async () => {
    const { buildHandleHoles } = await import('./handleBuilder');
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
    const result = buildHandleHoles(params, 40, 40, 20, 1.2, false);
    expect(result).toBeNull();
  });

  it('produces geometry with minimum height and width', async () => {
    const { buildHandleHoles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      height: 8, // MIN_HANDLE_HEIGHT
      width: 10, // MIN_HANDLE_WIDTH
      cornerRadius: 0,
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandleHoles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  it('produces geometry with sharp corners (radius=0)', async () => {
    const { buildHandleHoles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      height: 15,
      width: 50,
      cornerRadius: 0,
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandleHoles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  it('clamps corner radius to half smallest dimension', async () => {
    const { buildHandleHoles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      height: 10,
      width: 50,
      cornerRadius: 10, // larger than height/2, will be clamped
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: false },
      right: { enabled: false },
    });
    const result = buildHandleHoles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  it('produces geometry for multiple sides', async () => {
    const { buildHandleHoles } = await import('./handleBuilder');
    const params = makeParams({
      enabled: true,
      height: 15,
      width: 50,
      cornerRadius: 3,
      front: { enabled: true },
      back: { enabled: false },
      left: { enabled: true },
      right: { enabled: true },
    });
    const result = buildHandleHoles(params, 40, 40, 20, 1.2, false);
    expect(result).not.toBeNull();
  });

  describe('polygon (cellMask) footprints', () => {
    // 3×3 L-shape at half-bin resolution: bottom-right 1u removed.
    const L_MASK: CellMask = {
      cols: 6,
      rows: 6,
      cells: [
        // bottom row first (grid origin is bottom-left)
        1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1,
      ],
    };

    it('produces front-handle geometry on a 3×3 L footprint', async () => {
      const { buildHandleHoles } = await import('./handleBuilder');
      const params: BinParams = {
        ...makeParams({
          enabled: true,
          front: { enabled: true },
          back: { enabled: false },
          left: { enabled: false },
          right: { enabled: false },
        }),
        width: 3,
        depth: 3,
        cellMask: L_MASK,
      };
      // innerW/D reflect the bin AABB (3u × 3u minus walls/clearance).
      const result = buildHandleHoles(params, 120, 120, 30, 1.2, false);
      expect(result).not.toBeNull();
    });

    it('skips interior handles on polygon bins even when interior=true', async () => {
      const { buildHandleHoles } = await import('./handleBuilder');
      const params: BinParams = {
        ...makeParams({
          enabled: true,
          interior: true,
          front: { enabled: false },
          back: { enabled: false },
          left: { enabled: false },
          right: { enabled: false },
        }),
        width: 3,
        depth: 3,
        cellMask: L_MASK,
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 2,
          rows: 2,
          cells: [0, 1, 2, 3],
        },
      };
      // With all outer sides off and only `interior` requested, polygon bins
      // must return null (compartments don't exist for custom shapes).
      const result = buildHandleHoles(params, 120, 120, 30, 1.2, false);
      expect(result).toBeNull();
    });
  });
});
