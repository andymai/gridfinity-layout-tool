/**
 * useImageTracer hook tests.
 *
 * Tests the image tracing hook that wraps OpenCV loading and contour extraction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageTracer } from './useImageTracer';
import * as opencvLoader from '../services/opencvLoader';
import * as imageProcessor from '../services/imageProcessor';
import * as thumbnailGenerator from '../services/thumbnailGenerator';
import { ok, err } from '@/core/result';
import { processingError, DEFAULT_PROCESSING_OPTIONS } from '../types';
import type { TracedContour } from '../types';

// Mock the services
vi.mock('../services/opencvLoader', () => ({
  loadOpenCV: vi.fn(),
  isOpenCVReady: vi.fn(),
}));

vi.mock('../services/imageProcessor', () => ({
  traceImageContour: vi.fn(),
  fileToImageData: vi.fn(),
}));

vi.mock('../services/thumbnailGenerator', () => ({
  generateThumbnail: vi.fn(),
}));

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

// Mock File and FileReader
class MockFile {
  name: string;
  type: string;
  size: number;

  constructor(parts: string[], name: string, options: { type: string }) {
    this.name = name;
    this.type = options.type;
    this.size = parts.join('').length;
  }
}

// @ts-expect-error - Mock for testing
globalThis.File = MockFile;

// Mock FileReader
class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsDataURL(): void {
    // Simulate async read
    setTimeout(() => {
      this.result = 'data:image/png;base64,mockImageData';
      if (this.onload) {
        this.onload({ target: this } as ProgressEvent<FileReader>);
      }
    }, 0);
  }
}

// @ts-expect-error - Mock for testing
globalThis.FileReader = MockFileReader;

function createTestFile(): File {
  return new File(['test'], 'test.png', { type: 'image/png' });
}

function createTestContour(): TracedContour {
  return {
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    boundingBox: { width: 100, height: 100 },
    area: 0.8,
  };
}

describe('useImageTracer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(opencvLoader.isOpenCVReady).mockReturnValue(true);
    vi.mocked(opencvLoader.loadOpenCV).mockResolvedValue(ok(undefined));
    vi.mocked(imageProcessor.fileToImageData).mockResolvedValue(new ImageData(100, 100));
    vi.mocked(imageProcessor.traceImageContour).mockReturnValue(ok(createTestContour()));
    vi.mocked(thumbnailGenerator.generateThumbnail).mockResolvedValue(
      'data:image/jpeg;base64,thumbnail'
    );
  });

  describe('initial state', () => {
    it('starts with no processing', () => {
      const { result } = renderHook(() => useImageTracer());

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.opencvProgress).toBeNull();
    });
  });

  describe('traceImage', () => {
    it('returns traced contour on success', async () => {
      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      let traceResult: { contour: TracedContour; thumbnail: string } | null = null;

      await act(async () => {
        traceResult = await result.current.traceImage(file, DEFAULT_PROCESSING_OPTIONS);
      });

      expect(traceResult).not.toBeNull();
      if (!traceResult) return;

      expect(traceResult.contour.points).toHaveLength(4);
      expect(traceResult.thumbnail).toBe('data:image/jpeg;base64,thumbnail');
    });

    it('sets isProcessing during trace', async () => {
      // Make fileToImageData take some time
      vi.mocked(imageProcessor.fileToImageData).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(new ImageData(100, 100)), 50))
      );

      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      let promise: Promise<unknown>;

      act(() => {
        promise = result.current.traceImage(file, DEFAULT_PROCESSING_OPTIONS);
      });

      // Should be processing
      expect(result.current.isProcessing).toBe(true);

      await act(async () => {
        await promise;
      });

      // Should be done processing
      expect(result.current.isProcessing).toBe(false);
    });

    it('loads OpenCV if not ready', async () => {
      vi.mocked(opencvLoader.isOpenCVReady).mockReturnValue(false);

      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      await act(async () => {
        await result.current.traceImage(file, DEFAULT_PROCESSING_OPTIONS);
      });

      expect(opencvLoader.loadOpenCV).toHaveBeenCalled();
    });

    it('reports OpenCV progress', async () => {
      vi.mocked(opencvLoader.isOpenCVReady).mockReturnValue(false);
      vi.mocked(opencvLoader.loadOpenCV).mockImplementation(async (onProgress) => {
        onProgress?.({ stage: 'downloading', progress: 50 });
        return ok(undefined);
      });

      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      await act(async () => {
        await result.current.traceImage(file, DEFAULT_PROCESSING_OPTIONS);
      });

      // Progress was reported (may have been reset after completion)
      expect(opencvLoader.loadOpenCV).toHaveBeenCalled();
    });

    it('returns null and sets error on OpenCV load failure', async () => {
      vi.mocked(opencvLoader.isOpenCVReady).mockReturnValue(false);
      vi.mocked(opencvLoader.loadOpenCV).mockResolvedValue(
        err(processingError.opencvLoadFailed('Failed to load'))
      );

      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      let traceResult: unknown = 'not null';

      await act(async () => {
        traceResult = await result.current.traceImage(file, DEFAULT_PROCESSING_OPTIONS);
      });

      expect(traceResult).toBeNull();
      expect(result.current.error).toBe('Failed to load');
    });

    it('returns null and sets error on trace failure', async () => {
      vi.mocked(imageProcessor.traceImageContour).mockReturnValue(
        err(processingError.noContourFound('No tool outline detected'))
      );

      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      let traceResult: unknown = 'not null';

      await act(async () => {
        traceResult = await result.current.traceImage(file, DEFAULT_PROCESSING_OPTIONS);
      });

      expect(traceResult).toBeNull();
      expect(result.current.error).toBe('No tool outline detected');
    });

    it('uses default processing options when not provided', async () => {
      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      await act(async () => {
        await result.current.traceImage(file);
      });

      expect(imageProcessor.traceImageContour).toHaveBeenCalledWith(
        expect.any(ImageData),
        DEFAULT_PROCESSING_OPTIONS
      );
    });

    it('uses custom processing options when provided', async () => {
      const customOptions = {
        threshold: 200,
        blur: 5,
        minContourArea: 50,
        simplificationEpsilon: 0.01,
      };

      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      await act(async () => {
        await result.current.traceImage(file, customOptions);
      });

      expect(imageProcessor.traceImageContour).toHaveBeenCalledWith(
        expect.any(ImageData),
        customOptions
      );
    });
  });

  describe('clearError', () => {
    it('clears the error state', async () => {
      vi.mocked(imageProcessor.traceImageContour).mockReturnValue(
        err(processingError.noContourFound('Error'))
      );

      const { result } = renderHook(() => useImageTracer());
      const file = createTestFile();

      await act(async () => {
        await result.current.traceImage(file, DEFAULT_PROCESSING_OPTIONS);
      });

      expect(result.current.error).toBe('Error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
