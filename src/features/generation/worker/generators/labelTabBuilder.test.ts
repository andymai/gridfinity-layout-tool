// @vitest-environment node
/**
 * Tests for the label tab builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__dual-kernel__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('buildLabelTabs', () => {
  it('returns null when label disabled', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).toBeNull();
  });

  it('builds label tabs with bracket support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });

  it('builds label tabs with solid support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });

  it('builds label tabs with fillet support', async () => {
    const { buildLabelTabs } = await import('./labelTabBuilder');
    const params = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'fillet' as const },
    };
    const result = buildLabelTabs(params, 80, 80, 35, 1.2);
    expect(result).not.toBeNull();
  });
});
