import { describe, it, expect, beforeEach } from 'vitest';
import { useCutoutSelection } from './cutoutSelection';

describe('cutoutSelection store', () => {
  beforeEach(() => {
    useCutoutSelection.setState({ selectedIds: new Set(), previewOverrides: new Map() });
  });

  it('starts with empty selection', () => {
    expect(useCutoutSelection.getState().selectedIds.size).toBe(0);
  });

  it('sets selected IDs', () => {
    useCutoutSelection.getState().setSelectedIds(new Set(['a', 'b']));
    expect(useCutoutSelection.getState().selectedIds.size).toBe(2);
    expect(useCutoutSelection.getState().selectedIds.has('a')).toBe(true);
    expect(useCutoutSelection.getState().selectedIds.has('b')).toBe(true);
  });

  it('replaces selection on subsequent set', () => {
    useCutoutSelection.getState().setSelectedIds(new Set(['a']));
    useCutoutSelection.getState().setSelectedIds(new Set(['b']));
    expect(useCutoutSelection.getState().selectedIds.has('a')).toBe(false);
    expect(useCutoutSelection.getState().selectedIds.has('b')).toBe(true);
  });

  it('can clear selection', () => {
    useCutoutSelection.getState().setSelectedIds(new Set(['a', 'b']));
    useCutoutSelection.getState().setSelectedIds(new Set());
    expect(useCutoutSelection.getState().selectedIds.size).toBe(0);
  });

  it('starts with empty preview overrides', () => {
    expect(useCutoutSelection.getState().previewOverrides.size).toBe(0);
  });

  it('sets preview overrides', () => {
    const overrides = new Map([['a', { x: 5, y: 10 }]]);
    useCutoutSelection.getState().setPreviewOverrides(overrides);
    const result = useCutoutSelection.getState().previewOverrides;
    expect(result.size).toBe(1);
    expect(result.get('a')).toEqual({ x: 5, y: 10 });
  });

  it('clears preview overrides', () => {
    useCutoutSelection.getState().setPreviewOverrides(new Map([['a', { x: 5 }]]));
    useCutoutSelection.getState().setPreviewOverrides(new Map());
    expect(useCutoutSelection.getState().previewOverrides.size).toBe(0);
  });
});
