import { describe, expect, it } from 'vitest';
import type { KernelCapabilities } from 'brepjs';
import { copyOnMove } from './copyOnMove';

const OCCT_LIKE: KernelCapabilities = {
  exact: true,
  brepExport: true,
  exactMeasurement: true,
  tessellationModel: 'extract-time',
  placementSharesGeometry: true,
};

describe('copyOnMove', () => {
  it('turns placement sharing off on the adapter it is given', () => {
    const adapter = { capabilities: OCCT_LIKE };
    expect(copyOnMove(adapter).capabilities).toEqual({
      ...OCCT_LIKE,
      placementSharesGeometry: false,
    });
  });

  it('leaves the shared capabilities object of other adapters alone', () => {
    const first = { capabilities: OCCT_LIKE };
    const second = { capabilities: OCCT_LIKE };
    copyOnMove(first);
    expect(second.capabilities.placementSharesGeometry).toBe(true);
    expect(OCCT_LIKE.placementSharesGeometry).toBe(true);
  });
});
