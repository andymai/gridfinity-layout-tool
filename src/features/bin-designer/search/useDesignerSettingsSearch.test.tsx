import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignerSettingsSearch } from './useDesignerSettingsSearch';
import {
  DESIGNER_CONTROL_SEARCH,
  type ControlAvailabilityContext,
} from './designerControlRegistry';

const allAvailable: ControlAvailabilityContext = {
  style: 'standard',
  hasText: true,
  needsSplit: true,
  viewMode: 'rail',
  slideTrayEnabled: true,
};

const restricted: ControlAvailabilityContext = {
  style: 'solid',
  hasText: false,
  needsSplit: false,
  viewMode: 'scroll',
  slideTrayEnabled: false,
};

const ids = (results: { controlId: string }[]) => results.map((r) => r.controlId);

describe('useDesignerSettingsSearch', () => {
  it('lists every available control, ordered by category, when the query is empty', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('', allAvailable));
    expect(result.current).toHaveLength(DESIGNER_CONTROL_SEARCH.length);
    expect(result.current[0].category).toBe('shape');
    // categories never interleave in browse order
    const order = ['shape', 'interior', 'features', 'style', 'print'];
    const seen = result.current.map((r) => order.indexOf(r.category));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('matches a control by its label', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('scoop', allAvailable));
    expect(ids(result.current)).toContain('bd-scoop');
  });

  it('matches a control by a synonym that is not in its label', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('drainage', allAvailable));
    expect(ids(result.current)).toContain('bd-floor-pattern');
  });

  it('ranks a label-prefix hit above others', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('lid', allAvailable));
    expect(result.current[0].controlId).toBe('bd-lid');
  });

  it('omits controls whose section is not currently mounted', () => {
    const labelHit = renderHook(() => useDesignerSettingsSearch('label', restricted));
    expect(ids(labelHit.result.current)).not.toContain('bd-label-tabs');

    const fontHit = renderHook(() => useDesignerSettingsSearch('font', restricted));
    expect(ids(fontHit.result.current)).not.toContain('bd-type');

    const splitHit = renderHook(() => useDesignerSettingsSearch('split', restricted));
    expect(ids(splitHit.result.current)).not.toContain('bd-print-fit');

    const slideHit = renderHook(() => useDesignerSettingsSearch('slide', restricted));
    expect(ids(slideHit.result.current)).not.toContain('bd-slide-tray');
  });

  it('keeps view- and flag-gated controls when the current state mounts them', () => {
    const printFit = renderHook(() =>
      useDesignerSettingsSearch('split', { ...restricted, viewMode: 'rail' })
    );
    expect(ids(printFit.result.current)).toContain('bd-print-fit');

    const slideTray = renderHook(() =>
      useDesignerSettingsSearch('slide', { ...restricted, slideTrayEnabled: true })
    );
    expect(ids(slideTray.result.current)).toContain('bd-slide-tray');
  });

  it('never surfaces the excluded lid-grip control', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('grip', allAvailable));
    expect(ids(result.current)).not.toContain('bd-lid-grip');
  });
});
