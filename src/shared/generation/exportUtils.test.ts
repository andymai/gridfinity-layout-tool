// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { FORMAT_MIME_TYPES, triggerDownload } from './exportUtils';

describe('FORMAT_MIME_TYPES', () => {
  it('maps stl to application/sla', () => {
    expect(FORMAT_MIME_TYPES.stl).toBe('application/sla');
  });

  it('maps step to application/step', () => {
    expect(FORMAT_MIME_TYPES.step).toBe('application/step');
  });

  it('maps 3mf to 3D manufacturing MIME type', () => {
    expect(FORMAT_MIME_TYPES['3mf']).toBe('application/vnd.ms-package.3dmanufacturing-3dmodel+xml');
  });
});

describe('triggerDownload', () => {
  it('creates a temporary anchor, clicks it, and revokes the URL', () => {
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:test-url');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const anchor = {
      href: '',
      download: '',
      click,
      parentNode: null as unknown,
    } as unknown as HTMLAnchorElement;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
      // Set parentNode after appending so removeChild works
      Object.defineProperty(anchor, 'parentNode', { value: document.body, configurable: true });
      return anchor;
    });
    const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchor);

    const blob = new Blob(['test'], { type: 'text/plain' });
    triggerDownload(blob, 'test-file.txt');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(createElement).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('test-file.txt');
    expect(click).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');

    createElement.mockRestore();
    appendChild.mockRestore();
    removeChild.mockRestore();
    vi.unstubAllGlobals();
  });
});
