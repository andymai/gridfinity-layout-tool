/**
 * Thumbnail generator for cutout images.
 *
 * Creates small (~10KB) preview images from original photos for:
 * 1. Library grid display (fast loading)
 * 2. Reduced IndexedDB storage
 * 3. Quick visual identification
 */

import { THUMBNAIL_MAX_SIZE } from '../types';

/**
 * Generate a thumbnail from an image data URL.
 *
 * @param originalDataUrl Base64 data URL of the original image
 * @param maxSize Maximum dimension in pixels (default 200)
 * @returns Base64 data URL of the thumbnail (JPEG format)
 */
export async function generateThumbnail(
  originalDataUrl: string,
  maxSize: number = THUMBNAIL_MAX_SIZE
): Promise<string> {
  const { width, height } = await getImageDimensions(originalDataUrl);

  // Calculate scaled dimensions maintaining aspect ratio
  let newWidth = width;
  let newHeight = height;

  if (width > height) {
    // Landscape
    if (width > maxSize) {
      newWidth = maxSize;
      newHeight = Math.round((height / width) * maxSize);
    }
  } else {
    // Portrait or square
    if (height > maxSize) {
      newHeight = maxSize;
      newWidth = Math.round((width / height) * maxSize);
    }
  }

  // Create canvas and draw scaled image
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Load image and draw
  const img = await loadImage(originalDataUrl);
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  // Export as JPEG with moderate quality for small file size
  // 0.7 quality typically produces ~10KB thumbnails for 200x200
  return canvas.toDataURL('image/jpeg', 0.7);
}

/**
 * Get dimensions of an image from its data URL.
 *
 * @param dataUrl Base64 data URL of the image
 * @returns Object with width and height in pixels
 */
export async function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = (error) => {
      reject(error instanceof Error ? error : new Error('Failed to load image'));
    };
    img.src = dataUrl;
  });
}

/**
 * Load an image from a data URL.
 *
 * @param dataUrl Base64 data URL of the image
 * @returns Loaded HTMLImageElement
 */
async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      reject(error instanceof Error ? error : new Error('Failed to load image'));
    };
    img.src = dataUrl;
  });
}

/**
 * Estimate the file size of a base64 data URL in bytes.
 *
 * @param dataUrl Base64 data URL
 * @returns Approximate size in bytes
 */
export function estimateDataUrlSize(dataUrl: string): number {
  // Remove the data:image/xxx;base64, prefix
  const base64Data = dataUrl.split(',')[1] || '';
  // Base64 encodes 3 bytes as 4 characters
  return Math.ceil((base64Data.length * 3) / 4);
}
