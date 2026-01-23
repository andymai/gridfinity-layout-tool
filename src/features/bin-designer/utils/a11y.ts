/**
 * Accessibility utilities for the bin designer.
 *
 * Generates human-readable descriptions of bin configurations
 * for screen readers and ARIA labels.
 */

import type { BinParams, GenerationStatus, WasmStatus } from '../types';

/**
 * Generate a screen reader description of the current bin.
 *
 * Example output:
 * "3D preview of a 2×2×6 Gridfinity bin with magnet base, stacking lip, 2×1 dividers, label tab, and front scoop"
 */
export function describeBin(params: BinParams): string {
  const features: string[] = [];

  // Base style
  if (params.base.style !== 'standard') {
    features.push(`${params.base.style} base`);
  }
  if (params.base.stackingLip) {
    features.push('stacking lip');
  }

  // Style variant
  if (params.style !== 'standard') {
    features.push(`${params.style} walls`);
  }

  // Compartments
  if (params.compartments.cols > 1 || params.compartments.rows > 1) {
    const count = new Set(params.compartments.cells).size;
    features.push(`${count} compartment${count > 1 ? 's' : ''}`);
  }

  // Label
  if (params.label.enabled) {
    features.push('label tab');
  }

  // Scoop
  if (params.scoop.enabled) {
    features.push(params.scoop.allRows ? 'all-row scoops' : 'front scoop');
  }

  // Wall cutouts
  const cutoutSides: string[] = [];
  if (params.walls.front > 0) cutoutSides.push('front');
  if (params.walls.back > 0) cutoutSides.push('back');
  if (params.walls.left > 0) cutoutSides.push('left');
  if (params.walls.right > 0) cutoutSides.push('right');
  if (cutoutSides.length > 0) {
    features.push(`${cutoutSides.join('/')} wall cutouts`);
  }

  // Inserts
  if (params.inserts.length > 0) {
    features.push(`${params.inserts.length} insert${params.inserts.length > 1 ? 's' : ''}`);
  }

  const size = `${params.width}×${params.depth}×${params.height}`;
  const featureStr = features.length > 0
    ? ` with ${features.join(', ')}`
    : '';

  return `3D preview of a ${size} Gridfinity bin${featureStr}`;
}

/**
 * Generate a status announcement for ARIA live regions.
 * Returns null if no announcement needed (idle/complete with mesh).
 */
export function getStatusAnnouncement(
  wasmStatus: WasmStatus,
  generationStatus: GenerationStatus,
  hasMesh: boolean
): string | null {
  if (wasmStatus === 'loading') return 'Loading 3D engine';
  if (wasmStatus === 'error') return 'Error: 3D engine failed to load';
  if (generationStatus === 'generating') return 'Generating bin mesh';
  if (generationStatus === 'error') return 'Error: mesh generation failed';
  if (generationStatus === 'complete' && hasMesh) return 'Bin preview updated';
  return null;
}
