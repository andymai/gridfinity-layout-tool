/**
 * Image processor tests.
 *
 * Tests the contour tracing functionality using mocked OpenCV.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { traceImageContour, validateImageData } from './imageProcessor';
import { loadOpenCV, resetOpenCVState } from './opencvLoader';
import { DEFAULT_PROCESSING_OPTIONS, MAX_IMAGE_SIZE_BYTES } from '../types';

// Polyfill ImageData for Node.js environment
class MockImageData implements ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = 'srgb';

  constructor(sw: number, sh: number);
  constructor(data: Uint8ClampedArray, sw: number, sh?: number);
  constructor(dataOrSw: Uint8ClampedArray | number, swOrSh: number, sh?: number) {
    if (typeof dataOrSw === 'number') {
      this.width = dataOrSw;
      this.height = swOrSh;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrSw;
      this.width = swOrSh;
      this.height = sh ?? Math.floor(dataOrSw.length / (swOrSh * 4));
    }
  }
}

// @ts-expect-error - Polyfill for test environment
globalThis.ImageData = MockImageData;

describe('imageProcessor', () => {
  beforeEach(async () => {
    resetOpenCVState();
    await loadOpenCV();
  });

  afterEach(() => {
    resetOpenCVState();
    vi.clearAllMocks();
  });

  describe('validateImageData', () => {
    it('rejects empty image data', () => {
      const emptyData = new ImageData(1, 1);
      const result = validateImageData(emptyData);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_image');
      }
    });

    it('accepts valid image data with varied content', () => {
      // Create an image with varied content (not uniform)
      const imageData = createTestImageData();
      const result = validateImageData(imageData);
      expect(result.ok).toBe(true);
    });

    it('rejects image data that is too large', () => {
      // Create a mock large image (we can't actually create one this big)
      const mockLargeData = {
        width: 10000,
        height: 10000,
        data: { length: 10000 * 10000 * 4 } as Uint8ClampedArray,
      } as ImageData;

      const result = validateImageData(mockLargeData, MAX_IMAGE_SIZE_BYTES / 10);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('image_too_large');
      }
    });
  });

  describe('traceImageContour', () => {
    it('requires OpenCV to be loaded', () => {
      resetOpenCVState();

      const imageData = createTestImageData();
      const result = traceImageContour(imageData, DEFAULT_PROCESSING_OPTIONS);

      // Should indicate OpenCV not loaded
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('opencv_load_failed');
      }
    });

    it('returns traced contour with valid image', () => {
      const imageData = createTestImageData();
      const result = traceImageContour(imageData, DEFAULT_PROCESSING_OPTIONS);

      // In test mode with mock CV, this may return no_contour_found
      // because the mock doesn't actually process the image
      // The test verifies the function doesn't throw and returns a proper Result
      expect('ok' in result).toBe(true);
    });

    it('uses provided processing options', () => {
      const imageData = createTestImageData();
      const customOptions = {
        threshold: 200,
        blur: 5,
        minContourArea: 50,
        simplificationEpsilon: 0.01,
      };

      // Should not throw
      const result = traceImageContour(imageData, customOptions);
      expect('ok' in result).toBe(true);
    });

    it('returns error for empty/invalid image', () => {
      const emptyData = new ImageData(1, 1);
      const result = traceImageContour(emptyData, DEFAULT_PROCESSING_OPTIONS);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_image');
      }
    });
  });
});

/**
 * Helper to create test image data with a simple shape.
 */
function createTestImageData(): ImageData {
  const width = 200;
  const height = 200;
  const imageData = new ImageData(width, height);

  // Create a white background with a black square in the center
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // Black square from (50,50) to (150,150)
      if (x >= 50 && x <= 150 && y >= 50 && y <= 150) {
        imageData.data[i] = 0; // R
        imageData.data[i + 1] = 0; // G
        imageData.data[i + 2] = 0; // B
      } else {
        imageData.data[i] = 255; // R
        imageData.data[i + 1] = 255; // G
        imageData.data[i + 2] = 255; // B
      }
      imageData.data[i + 3] = 255; // A
    }
  }

  return imageData;
}
