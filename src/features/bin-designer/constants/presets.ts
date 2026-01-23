/**
 * Built-in design presets for the Bin Designer.
 *
 * Each preset is a partial override of BinParams that gets merged
 * with the current parameters (non-destructive: only specified fields change).
 */

import type { BinParams } from '@/features/bin-designer/types';

/** A named preset with partial parameter overrides */
export interface DesignPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: 'heavy' | 'fast' | 'workshop' | 'vase' | 'divider';
  readonly overrides: Partial<BinParams>;
}

/**
 * Built-in presets covering the most common use cases.
 *
 * These presets only override relevant fields, leaving dimensions
 * and inserts unchanged so users don't lose their layout work.
 */
export const BUILT_IN_PRESETS: readonly DesignPreset[] = [
  {
    id: 'heavy-duty',
    name: 'Heavy Duty',
    description: 'Rugged bin with magnet base and thick walls. Ideal for heavy tools.',
    icon: 'heavy',
    overrides: {
      style: 'rugged',
      base: {
        style: 'magnet',
        magnetDiameter: 6,
        magnetDepth: 2.4,
        screwDiameter: 3,
        stackingLip: true,
      },
      scoop: true,
      walls: { front: 0, back: 0, left: 0, right: 0 },
    },
  },
  {
    id: 'quick-print',
    name: 'Quick Print',
    description: 'Lightweight bin for fast printing. Thin walls, no extras.',
    icon: 'fast',
    overrides: {
      height: 3,
      style: 'lite',
      base: {
        style: 'standard',
        magnetDiameter: 6,
        magnetDepth: 2.4,
        screwDiameter: 3,
        stackingLip: false,
      },
      scoop: false,
      dividers: { x: 0, y: 0, thickness: 1.2 },
      label: { enabled: false, text: '', fontSize: 'auto' },
    },
  },
  {
    id: 'workshop',
    name: 'Workshop Bin',
    description: 'Screw-mount bin with scoop and label. Great for wall-mounted storage.',
    icon: 'workshop',
    overrides: {
      height: 6,
      style: 'standard',
      base: {
        style: 'screw',
        magnetDiameter: 6,
        magnetDepth: 2.4,
        screwDiameter: 3,
        stackingLip: true,
      },
      scoop: true,
      label: { enabled: true, text: '', fontSize: 'auto' },
    },
  },
  {
    id: 'vase-mode',
    name: 'Vase Mode',
    description: 'Single-wall print (vase/spiral mode). Ultra-fast, no interior features.',
    icon: 'vase',
    overrides: {
      style: 'vase',
      base: {
        style: 'standard',
        magnetDiameter: 6,
        magnetDepth: 2.4,
        screwDiameter: 3,
        stackingLip: false,
      },
      scoop: false,
      dividers: { x: 0, y: 0, thickness: 1.2 },
      label: { enabled: false, text: '', fontSize: 'auto' },
      inserts: [],
    },
  },
  {
    id: 'divider-grid',
    name: 'Divider Grid',
    description: 'Standard bin with 2×2 divider grid. Ready for small parts.',
    icon: 'divider',
    overrides: {
      style: 'standard',
      base: {
        style: 'standard',
        magnetDiameter: 6,
        magnetDepth: 2.4,
        screwDiameter: 3,
        stackingLip: true,
      },
      dividers: { x: 1, y: 1, thickness: 1.2 },
      scoop: true,
    },
  },
] as const;

/**
 * Retrieve a design preset by its identifier.
 *
 * @param id - The preset identifier to look up
 * @returns The matching `DesignPreset`, or `undefined` if no preset has the given id
 */
export function getPresetById(id: string): DesignPreset | undefined {
  return BUILT_IN_PRESETS.find((p) => p.id === id);
}