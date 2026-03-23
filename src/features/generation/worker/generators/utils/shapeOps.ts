/**
 * Shared shape operation helpers for the generation pipeline.
 *
 * Provides utilities for fusing, cloning, and disposing shapes
 * that are used across multiple builder modules.
 */

import { unwrap, fuseAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';

/** Fuse an array of shapes into one, returning null if the array is empty. */
export function fuseAllOrNull(shapes: Shape3D[]): Shape3D | null {
  if (shapes.length === 0) return null;
  if (shapes.length === 1) return shapes[0];
  return unwrap(fuseAll(shapes as ValidSolid[]));
}
