import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLidGroupSummary } from './useLidGroupSummary';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

function setLid(overrides: Partial<typeof DEFAULT_BIN_PARAMS.lid>) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, lid: { ...DEFAULT_BIN_PARAMS.lid, ...overrides } },
  });
}

describe('useLidGroupSummary', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('reports Off when the lid is disabled', () => {
    setLid({ enabled: false });
    const { result } = renderHook(() => useLidGroupSummary());
    expect(result.current).toBe('Off');
  });

  it('reports Off when there is no stacking lip even if the lid is enabled', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      },
    });
    const { result } = renderHook(() => useLidGroupSummary());
    expect(result.current).toBe('Off');
  });

  it('summarizes the magnetic attachment with its magnet dimensions', () => {
    setLid({
      enabled: true,
      attachment: 'magnetic',
      retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 0 },
    });
    const { result } = renderHook(() => useLidGroupSummary());
    expect(result.current).toMatch(/6\.0 × 2\.0 mm/);
  });

  it('summarizes click rails with coverage', () => {
    setLid({
      enabled: true,
      attachment: 'clickRails',
      clickRailCoverage: 50,
      clickRails: { front: true, back: true, left: true, right: true },
    });
    const { result } = renderHook(() => useLidGroupSummary());
    expect(result.current).toBe('50% rails');
  });
});
