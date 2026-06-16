/**
 * Types for the photo → outline tracer.
 *
 * The pure pipeline operates on plain pixel buffers (ImageDataLike) so it is
 * testable in node without a DOM canvas. Browser decoding lives in decodeImage.
 */

import type { Result } from '@/core/result';

/** A minimal stand-in for the browser ImageData (RGBA, row-major). */
export interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  /** RGBA bytes, length = width * height * 4. */
  readonly data: Uint8ClampedArray;
}

/** A point in pixel coordinates (origin top-left, y down — SVG convention). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A binary foreground mask (1 = object, 0 = background). */
export interface Mask {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export interface TraceOptions {
  /** Luminance cutoff 0–255. When omitted, Otsu's method picks it automatically. */
  readonly threshold?: number;
  /** Force foreground polarity. When omitted, the image border decides which side is background. */
  readonly invert?: boolean;
  /** Alpha below this (0–255) is treated as background outright (supports cutout/mask PNGs). */
  readonly alphaThreshold?: number;
  /** Douglas–Peucker tolerance in pixels. When omitted, scales with the image diagonal. */
  readonly simplifyTolerance?: number;
  /** Smallest foreground area (in pixels) accepted as a real object. */
  readonly minAreaPx?: number;
}

export type TraceErrorCode = 'NO_OBJECT' | 'DEGENERATE';

export interface TraceError {
  readonly code: TraceErrorCode;
  readonly detail?: string;
}

export type TraceResult = Result<string, TraceError>;
