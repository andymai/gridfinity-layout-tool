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
const labels = (results: { label: string }[]) => results.map((r) => r.label);

describe('useDesignerSettingsSearch', () => {
  it('browses only the sections, ordered by category, when the query is empty', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('', allAvailable));
    expect(result.current).toHaveLength(DESIGNER_CONTROL_SEARCH.length);
    expect(result.current.every((r) => r.kind === 'section')).toBe(true);
    expect(result.current[0].category).toBe('shape');
    const order = ['shape', 'interior', 'features', 'style', 'print'];
    const seen = result.current.map((r) => order.indexOf(r.category));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('surfaces a finer sub-option, with its section as a breadcrumb', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('lightweight', allAvailable));
    const hit = result.current.find((r) => r.label === 'Lightweight floor');
    expect(hit).toBeDefined();
    expect(hit?.kind).toBe('option');
    expect(hit?.controlId).toBe('bd-base');
    expect(hit?.breadcrumb).toBeTruthy();
  });

  it('highlights the matched span of the label', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('floor', allAvailable));
    const hit = result.current.find((r) => r.label === 'Lightweight floor');
    // "Lightweight floor" — the run "floor" starts at index 12.
    expect(hit?.highlight).toEqual([[12, 17]]);
  });

  it('matches a section by a synonym that is not in its label', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('drainage', allAvailable));
    expect(ids(result.current)).toContain('bd-floor-pattern');
  });

  it('ranks an exact-label hit first', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('lid', allAvailable));
    expect(result.current[0].controlId).toBe('bd-lid');
  });

  it('omits records whose section is not currently mounted', () => {
    const label = renderHook(() => useDesignerSettingsSearch('label', restricted));
    expect(ids(label.result.current)).not.toContain('bd-label-tabs');

    const font = renderHook(() => useDesignerSettingsSearch('font', restricted));
    expect(ids(font.result.current)).not.toContain('bd-type');

    const split = renderHook(() => useDesignerSettingsSearch('split', restricted));
    expect(ids(split.result.current)).not.toContain('bd-print-fit');
  });

  it('never jumps to the unanchored lid-grip marker (grip lands on the lid)', () => {
    const { result } = renderHook(() => useDesignerSettingsSearch('scallop', allAvailable));
    expect(ids(result.current)).not.toContain('bd-lid-grip');
    expect(labels(result.current)).toContain('Lid grip');
    expect(result.current.find((r) => r.label === 'Lid grip')?.controlId).toBe('bd-lid');
  });
});
