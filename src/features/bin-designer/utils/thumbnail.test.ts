import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  captureThumbnail,
  captureThumbnailPNG,
  setPreviewCanvas,
  clearPreviewCanvas,
} from './thumbnail';

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

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d' && this !== mockCanvas) {
        return mockCtx;
      }
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/webp;base64,mockThumb'
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

  it('captures a WebP data URL when canvas is registered', () => {
    setPreviewCanvas(mockCanvas);

    const result = captureThumbnail();

    expect(result).toBe('data:image/webp;base64,mockThumb');
  });

  it('draws the canvas center-cropped to 384x384', () => {
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // Source is 800x600, so crop to 600x600 centered (srcX = 100, srcY = 0)
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      mockCanvas,
      100,
      0,
      600,
      600, // source: center-cropped square
      0,
      0,
      384,
      384 // destination: thumbnail size
    );
  });

  it('handles square canvas without offset', () => {
    mockCanvas.width = 500;
    mockCanvas.height = 500;
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0, 500, 500, 0, 0, 384, 384);
  });

  it('handles tall canvas (portrait) with vertical center crop', () => {
    mockCanvas.width = 400;
    mockCanvas.height = 800;
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // Min dimension is 400, so srcY = (800-400)/2 = 200
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 200, 400, 400, 0, 0, 384, 384);
  });

  it('calls toDataURL with WebP format at 0.9 quality', () => {
    setPreviewCanvas(mockCanvas);
    captureThumbnail();

    // toDataURL is called on the offscreen canvas (not the source)
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/webp', 0.9);
  });

  it('returns null if offscreen getContext fails', () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    setPreviewCanvas(mockCanvas);
    expect(captureThumbnail()).toBeNull();
  });
});

describe('captureThumbnailPNG', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    mockCtx = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d' && this !== mockCanvas) {
        return mockCtx;
      }
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext);
  });

  afterEach(() => {
    clearPreviewCanvas();
    vi.restoreAllMocks();
  });

  it('returns null when no canvas is registered', async () => {
    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });

  it('draws center-cropped to 256x256', async () => {
    setPreviewCanvas(mockCanvas);

    const mockBlob = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    } as unknown as Blob;
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      _cb: BlobCallback
    ) {
      _cb(mockBlob);
    } as typeof HTMLCanvasElement.prototype.toBlob);

    await captureThumbnailPNG();

    // Source 800x600, crop to 600x600 centered (srcX=100, srcY=0)
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 100, 0, 600, 600, 0, 0, 256, 256);
  });

  it('returns Uint8Array from blob', async () => {
    setPreviewCanvas(mockCanvas);

    const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const mockBlob = {
      arrayBuffer: () => Promise.resolve(pngData.buffer),
    } as unknown as Blob;

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      _cb: BlobCallback
    ) {
      _cb(mockBlob);
    } as typeof HTMLCanvasElement.prototype.toBlob);

    const result = await captureThumbnailPNG();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result?.length).toBe(4);
  });

  it('returns null when toBlob returns null', async () => {
    setPreviewCanvas(mockCanvas);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      _cb: BlobCallback
    ) {
      _cb(null);
    } as typeof HTMLCanvasElement.prototype.toBlob);

    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });

  it('returns null when arrayBuffer rejects', async () => {
    setPreviewCanvas(mockCanvas);

    const mockBlob = {
      arrayBuffer: () => Promise.reject(new Error('read failed')),
    } as unknown as Blob;

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      _cb: BlobCallback
    ) {
      _cb(mockBlob);
    } as typeof HTMLCanvasElement.prototype.toBlob);

    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });

  it('returns null if getContext fails', async () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    setPreviewCanvas(mockCanvas);
    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });

  it('returns null if canvas throws (tainted)', async () => {
    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('Canvas is tainted');
    });

    setPreviewCanvas(mockCanvas);
    const result = await captureThumbnailPNG();
    expect(result).toBeNull();
  });
});
