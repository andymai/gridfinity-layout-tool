import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  captureThumbnail,
  setPreviewCanvas,
  clearPreviewCanvas,
} from '../../utils/thumbnail';

describe('thumbnail', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    // Create a mock canvas that simulates the Three.js preview
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    // Mock getContext for the offscreen canvas used internally
    mockCtx = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement, contextId: string) {
        if (contextId === '2d' && this !== mockCanvas) {
          return mockCtx;
        }
        return null;
      } as typeof HTMLCanvasElement.prototype.getContext
    );

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,mockThumb'
    );
  });

  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
  });

  it('returns null when no canvas is registered', () => {
    expect(captureThumbnail()).toBeNull();
  });

  it('returns null after clearPreviewCanvas', () => {
    setPreviewCanvas(mockCanvas);
    clearPreviewCanvas();
    expect(captureThumbnail()).toBeNull();
  });

  it('captures a JPEG data URL when canvas is registered', () => {
    setPreviewCanvas(mockCanvas);

    const result = captureThumbnail();

    expect(result).toBe('data:image/jpeg;base64,mockThumb');
  });

  it('draws the canvas center-cropped to 96x96', () => {
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // Source is 800x600, so crop to 600x600 centered (srcX = 100, srcY = 0)
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockCanvas,
      100, 0, 600, 600, // source: center-cropped square
      0, 0, 96, 96      // destination: thumbnail size
    );
  });

  it('handles square canvas without offset', () => {
    mockCanvas.width = 500;
    mockCanvas.height = 500;
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockCanvas,
      0, 0, 500, 500,
      0, 0, 96, 96
    );
  });

  it('handles tall canvas (portrait) with vertical center crop', () => {
    mockCanvas.width = 400;
    mockCanvas.height = 800;
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // Min dimension is 400, so srcY = (800-400)/2 = 200
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockCanvas,
      0, 200, 400, 400,
      0, 0, 96, 96
    );
  });

  it('calls toDataURL with JPEG format at 0.7 quality', () => {
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // toDataURL is called on the offscreen canvas (not the source)
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith(
      'image/jpeg',
      0.7
    );
  });

  it('returns null if offscreen getContext fails', () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    setPreviewCanvas(mockCanvas);
    expect(captureThumbnail()).toBeNull();
  });
});
