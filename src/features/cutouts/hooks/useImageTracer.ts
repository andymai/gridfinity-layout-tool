/**
 * Hook for tracing tool contours from images.
 *
 * Handles:
 * - OpenCV.js lazy loading with progress tracking
 * - Image to contour processing pipeline
 * - Thumbnail generation
 * - Error state management
 */

import { useState, useCallback } from 'react';
import { loadOpenCV, isOpenCVReady } from '../services/opencvLoader';
import { traceImageContour, fileToImageData } from '../services/imageProcessor';
import { generateThumbnail } from '../services/thumbnailGenerator';
import type { TracedContour, ProcessingOptions, OpenCVLoadProgress } from '../types';
import { DEFAULT_PROCESSING_OPTIONS } from '../types';

export interface TraceResult {
  contour: TracedContour;
  thumbnail: string;
}

export interface UseImageTracerReturn {
  /** Trace a contour from an image file */
  traceImage: (file: File, options?: ProcessingOptions) => Promise<TraceResult | null>;
  /** Whether currently processing an image */
  isProcessing: boolean;
  /** Error message if tracing failed */
  error: string | null;
  /** OpenCV loading progress (when loading) */
  opencvProgress: OpenCVLoadProgress | null;
  /** Clear the current error */
  clearError: () => void;
}

/**
 * Hook for tracing tool contours from images.
 *
 * Provides a simple API for the complete image tracing pipeline:
 * 1. Load OpenCV.js (with progress tracking)
 * 2. Convert File to ImageData
 * 3. Trace contour using OpenCV
 * 4. Generate thumbnail for preview
 *
 * @example
 * ```tsx
 * const { traceImage, isProcessing, error } = useImageTracer();
 *
 * const handleFileSelect = async (file: File) => {
 *   const result = await traceImage(file);
 *   if (result) {
 *     // Use result.contour and result.thumbnail
 *   }
 * };
 * ```
 */
export function useImageTracer(): UseImageTracerReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opencvProgress, setOpencvProgress] = useState<OpenCVLoadProgress | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const traceImage = useCallback(
    async (
      file: File,
      options: ProcessingOptions = DEFAULT_PROCESSING_OPTIONS
    ): Promise<TraceResult | null> => {
      setIsProcessing(true);
      setError(null);

      try {
        // 1. Ensure OpenCV is loaded
        if (!isOpenCVReady()) {
          const loadResult = await loadOpenCV((progress) => {
            setOpencvProgress(progress);
          });

          if (!loadResult.ok) {
            setError(loadResult.error.message);
            return null;
          }
        }

        setOpencvProgress(null);

        // 2. Convert file to ImageData
        const imageData = await fileToImageData(file);

        // 3. Trace contour
        const traceResult = traceImageContour(imageData, options);

        if (!traceResult.ok) {
          setError(traceResult.error.message);
          return null;
        }

        // Extract value immediately after narrowing to preserve type safety across async boundaries
        const contour = traceResult.value;

        // 4. Generate thumbnail from original file
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        const thumbnail = await generateThumbnail(dataUrl);

        return {
          contour,
          thumbnail,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error during tracing';
        setError(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return {
    traceImage,
    isProcessing,
    error,
    opencvProgress,
    clearError,
  };
}
