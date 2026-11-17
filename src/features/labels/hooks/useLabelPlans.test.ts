import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { loadTestTypeMeasurer } from '@/test/testTypeMeasurer';
import type { TypeMeasurer } from '@/shared/utils/typePlan';
import { useLabelListStore } from '../store/labelListStore';
import { LABEL_DETAIL_FONT, LABEL_NAME_FONT } from '../utils/planLabel';
import { useLabelPlans } from './useLabelPlans';

const mocks = vi.hoisted(() => ({ measurer: null as TypeMeasurer | null }));

vi.mock('@/shared/hooks/useTypeMeasurer', () => ({
  useTypeMeasurer: () => mocks.measurer,
  useTypeFontsFailed: () => false,
}));

const initial = useLabelListStore.getState();

beforeAll(async () => {
  mocks.measurer = await loadTestTypeMeasurer([LABEL_NAME_FONT, LABEL_DETAIL_FONT]);
});

beforeEach(() => {
  localStorage.clear();
  useLabelListStore.setState(initial, true);
  useLabelListStore.getState().addEntries([
    { name: 'Nuts', detail: '' },
    { name: 'Washers', detail: '' },
  ]);
});

describe('useLabelPlans', () => {
  it('re-plans only the label that changed', () => {
    const { result } = renderHook(() => useLabelPlans());
    const [nuts, washers] = useLabelListStore.getState().entries;
    const before = result.current.plans;

    act(() => useLabelListStore.getState().updateEntry(nuts.id, { name: 'Nuts M4' }));

    expect(result.current.plans.get(washers.id)).toBe(before.get(washers.id));
    expect(result.current.plans.get(nuts.id)).not.toBe(before.get(nuts.id));
  });

  it('re-plans every label for a new length', () => {
    const { result } = renderHook(() => useLabelPlans());
    const [nuts] = useLabelListStore.getState().entries;
    const fitWidth = result.current.plans.get(nuts.id)?.widthMm;

    act(() => useLabelListStore.getState().setTapeLength(2));

    expect(result.current.plans.get(nuts.id)?.widthMm).toBe(78);
    expect(fitWidth).toBeLessThan(78);
  });
});
