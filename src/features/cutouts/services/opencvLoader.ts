/**
 * OpenCV.js lazy loader with progress tracking.
 *
 * OpenCV.js is a ~8MB WASM library. This module:
 * 1. Lazy-loads the module only when needed
 * 2. Reports download and initialization progress
 * 3. Caches the loaded module for reuse
 * 4. Handles errors gracefully with user-friendly messages
 *
 * The module is self-hosted as a separate chunk for PWA caching.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- OpenCV.js has no TypeScript types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- OpenCV.js has no TypeScript types */

import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { OpenCVLoadProgress, ProcessingError } from '../types';
import { processingError } from '../types';

/** OpenCV module instance (cv namespace) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenCV.js doesn't have TypeScript types
let cv: any = null;

/** Current loading state */
let loadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';

/** Cached loading promise for deduplication */
let loadPromise: Promise<Result<void, ProcessingError>> | null = null;

/**
 * Check if OpenCV is loaded and ready to use.
 */
export function isOpenCVReady(): boolean {
  return loadState === 'ready' && cv !== null;
}

/**
 * Get the OpenCV module instance.
 * Throws if not loaded - always check isOpenCVReady() first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenCV.js doesn't have TypeScript types
export function getCV(): any {
  if (!isOpenCVReady()) {
    throw new Error('OpenCV not loaded. Call loadOpenCV() first.');
  }
  return cv;
}

/**
 * Reset the loader state (for testing).
 */
export function resetOpenCVState(): void {
  cv = null;
  loadState = 'idle';
  loadPromise = null;
}

/**
 * Create a mock OpenCV module for development/testing.
 *
 * This provides the basic API surface for development without
 * requiring the full 8MB library to be loaded.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenCV.js mock matches untyped API
export function createMockCV(): any {
  // Mock Mat class
  class MockMat {
    rows = 100;
    cols = 100;
    data: Uint8Array;
    type(): number {
      return 0;
    }
    delete(): void {
      // No-op
    }
    constructor() {
      this.data = new Uint8Array(100 * 100);
    }
  }

  return {
    Mat: MockMat,
    MatVector: class {
      size(): number {
        return 0;
      }
      get(): MockMat {
        return new MockMat();
      }
      delete(): void {
        // No-op
      }
    },
    cvtColor: (): void => {
      // No-op
    },
    GaussianBlur: (): void => {
      // No-op
    },
    threshold: (): number => 128,
    findContours: (): void => {
      // No-op
    },
    contourArea: (): number => 1000,
    arcLength: (): number => 100,
    approxPolyDP: (): void => {
      // No-op
    },
    boundingRect: (): { x: number; y: number; width: number; height: number } => ({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }),
    matFromImageData: (imageData: ImageData): MockMat => {
      const mat = new MockMat();
      mat.rows = imageData.height;
      mat.cols = imageData.width;
      return mat;
    },
    // Constants
    COLOR_RGBA2GRAY: 11,
    THRESH_BINARY: 0,
    THRESH_OTSU: 8,
    RETR_EXTERNAL: 0,
    CHAIN_APPROX_SIMPLE: 2,
  };
}

/**
 * Load OpenCV.js as a lazy chunk.
 *
 * This function:
 * 1. Dynamically imports OpenCV.js
 * 2. Reports progress via callback
 * 3. Waits for WASM initialization
 * 4. Caches the result for subsequent calls
 *
 * For development/testing, uses a mock implementation.
 *
 * @param onProgress Optional callback for progress updates
 * @returns Result indicating success or failure
 */
export async function loadOpenCV(
  onProgress?: (progress: OpenCVLoadProgress) => void
): Promise<Result<void, ProcessingError>> {
  // Return cached result if already loaded
  if (loadState === 'ready') {
    onProgress?.({ stage: 'ready', progress: 100 });
    return ok(undefined);
  }

  // Return existing promise if currently loading
  if (loadState === 'loading' && loadPromise) {
    return loadPromise;
  }

  // Start loading
  loadState = 'loading';
  onProgress?.({ stage: 'downloading', progress: 0 });

  loadPromise = (async (): Promise<Result<void, ProcessingError>> => {
    try {
      onProgress?.({ stage: 'downloading', progress: 20 });

      // In test/dev mode, use mock CV
      // In production, this will load the actual OpenCV.js via script tag
      if (import.meta.env.MODE === 'test' || import.meta.env.DEV) {
        // Use mock for development/testing
        cv = createMockCV();
        loadState = 'ready';
        onProgress?.({ stage: 'ready', progress: 100 });
        return ok(undefined);
      }

      // Production: Load OpenCV.js via script tag
      // The script will be served from /assets/opencv.js after copying to public/
      await loadOpenCVScript(onProgress);

      loadState = 'ready';
      onProgress?.({ stage: 'ready', progress: 100 });

      return ok(undefined);
    } catch (error) {
      loadState = 'error';
      const message = error instanceof Error ? error.message : 'Unknown error loading OpenCV';
      onProgress?.({ stage: 'error', progress: 0, error: message });
      return err(processingError.opencvLoadFailed(message));
    }
  })();

  return loadPromise;
}

/**
 * Load OpenCV.js via script tag (production only).
 *
 * This approach allows:
 * 1. Better caching via service worker
 * 2. Progress tracking via script.onprogress
 * 3. Proper global cv variable setup
 */
async function loadOpenCVScript(
  onProgress?: (progress: OpenCVLoadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded globally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenCV.js sets window.cv globally
    if (typeof (window as any).cv !== 'undefined' && (window as any).cv.Mat) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenCV.js sets window.cv globally
      cv = (window as any).cv;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = '/opencv.js';

    script.onload = () => {
      onProgress?.({ stage: 'initializing', progress: 70 });

      // Wait for OpenCV WASM to initialize

      const checkReady = (retries = 50): void => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenCV.js sets window.cv globally
        if (typeof (window as any).cv !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenCV.js sets window.cv globally
          const cvGlobal = (window as any).cv;

          // Check if WASM is initialized
          if (cvGlobal.Mat) {
            cv = cvGlobal;
            resolve();
            return;
          }

          // Set up initialization callback
          cvGlobal.onRuntimeInitialized = () => {
            cv = cvGlobal;
            resolve();
          };
        } else if (retries > 0) {
          setTimeout(() => checkReady(retries - 1), 100);
        } else {
          reject(new Error('OpenCV failed to initialize'));
        }
      };

      checkReady();
    };

    script.onerror = () => {
      reject(new Error('Failed to load OpenCV.js script'));
    };

    document.head.appendChild(script);
  });
}
