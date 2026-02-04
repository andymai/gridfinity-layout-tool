/**
 * Image processing service for tool contour tracing.
 *
 * Uses OpenCV.js to:
 * 1. Convert image to grayscale
 * 2. Apply Gaussian blur for noise reduction
 * 3. Threshold to binary
 * 4. Find contours
 * 5. Select largest contour by area
 * 6. Simplify using Douglas-Peucker algorithm
 * 7. Normalize to 0-1 coordinates
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- OpenCV.js has no TypeScript types */
/* eslint-disable @typescript-eslint/no-unsafe-call -- OpenCV.js has no TypeScript types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- OpenCV.js has no TypeScript types */
/* eslint-disable @typescript-eslint/no-unsafe-argument -- OpenCV.js has no TypeScript types */

import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { TracedContour, ProcessingOptions, ProcessingError, NormalizedPoint } from '../types';
import { processingError, MAX_IMAGE_SIZE_BYTES } from '../types';
import { isOpenCVReady, getCV } from './opencvLoader';
import { simplifyContour, contourArea } from './contourSimplifier';

/**
 * Validate image data before processing.
 *
 * @param imageData ImageData from canvas
 * @param maxSize Maximum allowed size in bytes
 * @returns Result indicating validity
 */
export function validateImageData(
  imageData: ImageData,
  maxSize: number = MAX_IMAGE_SIZE_BYTES
): Result<void, ProcessingError> {
  // Check for empty image
  if (imageData.width <= 1 || imageData.height <= 1) {
    return err(processingError.invalidImage('Image dimensions too small'));
  }

  // Check size limit
  const estimatedSize = imageData.width * imageData.height * 4;
  if (estimatedSize > maxSize) {
    return err(processingError.imageTooLarge(Math.ceil(maxSize / (1024 * 1024))));
  }

  // Check if image has content (not all transparent or all same color)
  let hasContent = false;
  const firstPixel = [imageData.data[0], imageData.data[1], imageData.data[2], imageData.data[3]];

  for (let i = 0; i < imageData.data.length; i += 4) {
    if (
      imageData.data[i] !== firstPixel[0] ||
      imageData.data[i + 1] !== firstPixel[1] ||
      imageData.data[i + 2] !== firstPixel[2] ||
      imageData.data[i + 3] !== firstPixel[3]
    ) {
      hasContent = true;
      break;
    }
  }

  if (!hasContent) {
    return err(processingError.invalidImage('Image appears to be blank or uniform'));
  }

  return ok(undefined);
}

/**
 * Trace the contour of a tool from an image.
 *
 * Algorithm:
 * 1. Load image to OpenCV Mat
 * 2. Convert to grayscale
 * 3. Apply Gaussian blur
 * 4. Threshold to binary
 * 5. Find contours
 * 6. Select largest contour
 * 7. Simplify with Douglas-Peucker
 * 8. Normalize to 0-1 coordinates
 *
 * @param imageData ImageData from canvas
 * @param options Processing options (threshold, blur, etc.)
 * @returns TracedContour or error
 */
export function traceImageContour(
  imageData: ImageData,
  options: ProcessingOptions
): Result<TracedContour, ProcessingError> {
  // Validate image first
  const validation = validateImageData(imageData);
  if (!validation.ok) {
    return validation;
  }

  // Ensure OpenCV is loaded
  if (!isOpenCVReady()) {
    return err(processingError.opencvLoadFailed('OpenCV not loaded. Call loadOpenCV() first.'));
  }

  try {
    const cv = getCV();
    return processWithOpenCV(cv, imageData, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    return err(processingError.processingFailed(message));
  }
}

/**
 * Process image with OpenCV.js.
 *
 * This function encapsulates all OpenCV operations.
 */

function processWithOpenCV(
  cv: ReturnType<typeof getCV>,
  imageData: ImageData,
  options: ProcessingOptions
): Result<TracedContour, ProcessingError> {
  // Keep track of Mats for cleanup
  const mats: Array<{ delete: () => void }> = [];

  try {
    // 1. Create Mat from ImageData
    const src = cv.matFromImageData(imageData);
    mats.push(src);

    // 2. Convert to grayscale
    const gray = new cv.Mat();
    mats.push(gray);
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 3. Apply Gaussian blur
    const blurred = new cv.Mat();
    mats.push(blurred);
    const ksize = new cv.Size(options.blur * 2 + 1, options.blur * 2 + 1);
    cv.GaussianBlur(gray, blurred, ksize, 0);

    // 4. Threshold to binary
    const binary = new cv.Mat();
    mats.push(binary);
    cv.threshold(blurred, binary, options.threshold, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    // 5. Find contours
    const contours = new cv.MatVector();
    mats.push(contours);
    const hierarchy = new cv.Mat();
    mats.push(hierarchy);

    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // 6. Find largest contour by area
    // NOTE: Each contours.get(i) returns a new Mat that must be deleted
    let largestContourIndex = -1;
    let largestArea = options.minContourArea;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area > largestArea) {
        largestArea = area;
        largestContourIndex = i;
      }
      // Clean up each contour Mat immediately after measuring area
      contour.delete();
    }

    if (largestContourIndex === -1) {
      return err(
        processingError.noContourFound(
          'No tool outline detected. Try adjusting the threshold or using a clearer image.'
        )
      );
    }

    // 7. Get largest contour again for processing (we deleted it during area comparison)
    const largestContour = contours.get(largestContourIndex);
    mats.push(largestContour); // Track for cleanup

    // Approximate polygon to reduce points
    const approx = new cv.Mat();
    mats.push(approx);
    const perimeter = cv.arcLength(largestContour, true);
    const epsilon = options.simplificationEpsilon * perimeter;
    cv.approxPolyDP(largestContour, approx, epsilon, true);

    // 8. Extract points
    const rawPoints: NormalizedPoint[] = [];
    for (let i = 0; i < approx.rows; i++) {
      rawPoints.push({
        x: approx.data32S[i * 2],
        y: approx.data32S[i * 2 + 1],
      });
    }

    // 9. Get bounding rect for normalization
    const boundingRect = cv.boundingRect(largestContour);
    const { x: bx, y: by, width: bw, height: bh } = boundingRect;

    // 10. Normalize to 0-1 coordinates
    const normalizedPoints = rawPoints.map((p) => ({
      x: bw > 0 ? (p.x - bx) / bw : 0.5,
      y: bh > 0 ? (p.y - by) / bh : 0.5,
    }));

    // 11. Apply additional simplification
    const simplifiedPoints = simplifyContour(normalizedPoints, options.simplificationEpsilon);

    // 12. Calculate normalized area
    const normalizedArea = contourArea(simplifiedPoints);

    // Cleanup all Mats
    mats.forEach((mat) => mat.delete());

    return ok({
      points: simplifiedPoints,
      boundingBox: {
        width: bw,
        height: bh,
      },
      area: normalizedArea,
    });
  } catch (error) {
    // Cleanup on error
    mats.forEach((mat) => {
      try {
        mat.delete();
      } catch {
        // Ignore cleanup errors
      }
    });

    const message = error instanceof Error ? error.message : 'OpenCV processing failed';
    return err(processingError.processingFailed(message));
  }
}

/**
 * Convert a File to ImageData for processing.
 *
 * @param file Image file (PNG or JPG)
 * @returns Promise resolving to ImageData
 */
export async function fileToImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = reader.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}
