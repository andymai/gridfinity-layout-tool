import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DevThumbnailRoute } from './DevThumbnailRoute';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';

vi.mock('@/features/bin-designer/components/PreviewCanvas', () => ({
  PreviewCanvas: () => null,
}));

vi.mock('@/features/bin-designer/hooks/useGeneration', () => ({
  useGeneration: () => undefined,
}));

vi.mock('@/features/bin-designer/utils/thumbnail', () => ({
  captureThumbnailAtPreset: () => null,
  exportPreviewGlb: async () => null,
  __debugSceneMaterials: () => null,
}));

function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

describe('DevThumbnailRoute', () => {
  beforeEach(() => {
    useDesignerStore.getState().resetToDefaults();
  });

  it('loads a gallery example by id', () => {
    const example = EXAMPLE_DESIGNS[0];
    setSearch(`?devThumbnails=1&example=${example.id}`);
    render(<DevThumbnailRoute />);
    expect(useDesignerStore.getState().params.width).toBe(example.params.width);
    expect(useDesignerStore.getState().params.depth).toBe(example.params.depth);
  });

  it('applies arbitrary partial params from the base64 params query', () => {
    const payload = btoa(JSON.stringify({ width: 5, depth: 4 }));
    setSearch(`?devThumbnails=1&params=${payload}`);
    render(<DevThumbnailRoute />);
    expect(useDesignerStore.getState().params.width).toBe(5);
    expect(useDesignerStore.getState().params.depth).toBe(4);
  });

  it('prefers the example over the params query when both are present', () => {
    const example = EXAMPLE_DESIGNS[0];
    const payload = btoa(JSON.stringify({ width: 9 }));
    setSearch(`?devThumbnails=1&example=${example.id}&params=${payload}`);
    render(<DevThumbnailRoute />);
    expect(useDesignerStore.getState().params.width).toBe(example.params.width);
  });

  it('recovers a payload whose base64 plus signs decayed to spaces', () => {
    // btoa('{"width":5,"depth":4,"name":">a"}') contains '+'; when the query
    // string carries it unencoded, URLSearchParams decodes '+' as a space.
    const payload = btoa('{"width":5,"depth":4,"name":">a"}');
    expect(payload).toContain('+');
    setSearch(`?devThumbnails=1&params=${payload}`);
    render(<DevThumbnailRoute />);
    expect(useDesignerStore.getState().params.width).toBe(5);
    expect(useDesignerStore.getState().params.depth).toBe(4);
  });

  it('ignores an invalid params payload without throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const before = useDesignerStore.getState().params.width;
    setSearch('?devThumbnails=1&params=%%%not-base64%%%');
    render(<DevThumbnailRoute />);
    expect(useDesignerStore.getState().params.width).toBe(before);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
