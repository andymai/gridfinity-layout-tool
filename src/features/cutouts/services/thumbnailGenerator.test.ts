/**
 * Thumbnail generator tests.
 *
 * Tests the image resizing functionality for creating ~10KB preview thumbnails.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateThumbnail, getImageDimensions } from './thumbnailGenerator';

// Mock canvas for Node.js environment
const mockContext = {
  drawImage: vi.fn(),
};

const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockThumbnail'),
  width: 0,
  height: 0,
};

vi.stubGlobal('document', {
  createElement: vi.fn((tag: string) => {
    if (tag === 'canvas') return mockCanvas;
    return {};
  }),
});

// Configurable mock image dimensions
let mockImageWidth = 800;
let mockImageHeight = 600;

// Mock Image constructor
class MockImage {
  width: number;
  height: number;
  onload: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  src = '';

  constructor() {
    // Copy current mock dimensions at construction time
    this.width = mockImageWidth;
    this.height = mockImageHeight;

    // Trigger onload in next tick to simulate async loading
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

vi.stubGlobal('Image', MockImage);

describe('thumbnailGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.width = 0;
    mockCanvas.height = 0;
    // Reset mock image dimensions
    mockImageWidth = 800;
    mockImageHeight = 600;
  });

  describe('generateThumbnail', () => {
    it('creates a thumbnail from a data URL', async () => {
      const result = await generateThumbnail('data:image/png;base64,testData');
      expect(result).toBe('data:image/jpeg;base64,mockThumbnail');
    });

    it('scales down landscape images correctly', async () => {
      // Image is 800x600 (landscape), maxSize 200
      await generateThumbnail('data:image/png;base64,testData', 200);

      // Should scale to fit within 200x200
      expect(mockCanvas.width).toBe(200);
      expect(mockCanvas.height).toBe(150);
    });

    it('scales down portrait images correctly', async () => {
      // Set mock dimensions for portrait image
      mockImageWidth = 600;
      mockImageHeight = 800;

      await generateThumbnail('data:image/png;base64,testData', 200);

      // Should scale to fit within 200x200
      expect(mockCanvas.width).toBe(150);
      expect(mockCanvas.height).toBe(200);
    });

    it('does not upscale small images', async () => {
      // Set mock dimensions for small image
      mockImageWidth = 100;
      mockImageHeight = 80;

      await generateThumbnail('data:image/png;base64,testData', 200);

      // Should keep original size
      expect(mockCanvas.width).toBe(100);
      expect(mockCanvas.height).toBe(80);
    });

    it('uses JPEG format for smaller file size', async () => {
      await generateThumbnail('data:image/png;base64,testData');
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', expect.any(Number));
    });

    it('uses default maxSize of 200', async () => {
      await generateThumbnail('data:image/png;base64,testData');
      // With 800x600 image and maxSize 200
      expect(mockCanvas.width).toBe(200);
      expect(mockCanvas.height).toBe(150);
    });

    it('calls drawImage with correct parameters', async () => {
      await generateThumbnail('data:image/png;base64,testData', 200);
      expect(mockContext.drawImage).toHaveBeenCalledWith(expect.any(MockImage), 0, 0, 200, 150);
    });
  });

  describe('getImageDimensions', () => {
    it('returns correct dimensions', async () => {
      const { width, height } = await getImageDimensions('data:image/png;base64,testData');
      expect(width).toBe(800);
      expect(height).toBe(600);
    });

    it('rejects on error', async () => {
      // Create an image that triggers error
      vi.stubGlobal(
        'Image',
        class {
          onload: (() => void) | null = null;
          onerror: ((error: Error) => void) | null = null;
          src = '';
          constructor() {
            setTimeout(() => {
              if (this.onerror) this.onerror(new Error('Failed to load'));
            }, 0);
          }
        }
      );

      await expect(getImageDimensions('invalid')).rejects.toThrow('Failed to load');

      // Restore
      vi.stubGlobal('Image', MockImage);
    });
  });
});
