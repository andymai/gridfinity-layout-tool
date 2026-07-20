// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { labelTabsFeature } from './labelTabBuilder';

// cacheKey is pure — no WASM init needed.
function keyFor(params: BinParams): string {
  const ctx = {
    params,
    dimensions: {
      shellKey: 'shell',
      innerW: 80,
      innerD: 80,
      interiorHeight: 30,
      isSlotted: false,
    },
  } as unknown as Parameters<typeof labelTabsFeature.cacheKey>[0];
  return labelTabsFeature.cacheKey(ctx);
}

function withCompartments(partial: Partial<BinParams['compartments']>): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, cells: [0, 1], ...partial },
  };
}

describe('labelTabsFeature.cacheKey', () => {
  it('changes when divider thickness changes', () => {
    // Thickness drives gusset width and per-group divider deductions (and
    // the discrete socket plate width); a thickness-only edit must never
    // serve a stale tab from the feature cache.
    expect(keyFor(withCompartments({ thickness: 1.2 }))).not.toBe(
      keyFor(withCompartments({ thickness: 2.4 }))
    );
  });

  it('changes with plate width overrides only in socket mode', () => {
    const socket = { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket' as const };
    expect(keyFor({ ...withCompartments({ labelPlateWidths: [1] }), label: socket })).not.toBe(
      keyFor({ ...withCompartments({ labelPlateWidths: [2] }), label: socket })
    );
    expect(keyFor(withCompartments({ labelPlateWidths: [1] }))).toBe(
      keyFor(withCompartments({ labelPlateWidths: [2] }))
    );
  });

  it('changes when the mode changes', () => {
    const base = withCompartments({});
    expect(keyFor(base)).not.toBe(keyFor({ ...base, label: { ...base.label, mode: 'socket' } }));
  });
});
