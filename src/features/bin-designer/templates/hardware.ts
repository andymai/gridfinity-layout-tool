/**
 * Hardware insert templates for the Bin Designer.
 *
 * Dimensions sourced from standards:
 * - Hex keys: DIN 911
 * - Driver bits: 1/4" hex standard
 *
 * All dimensions include 0.5mm total clearance for FDM printing tolerance.
 */

import type { InsertTemplate } from '../types';

/** 3D printing clearance (0.25mm per side = 0.5mm total) */
const CLEARANCE = 0.5;

export const HARDWARE_TEMPLATES: readonly InsertTemplate[] = [
  // --- Hex key holders ---
  {
    id: 'hex-key-set',
    name: 'Hex Key (2.5mm)',
    category: 'hardware',
    description: '2.5mm hex key slot, standing upright in hexagonal pocket',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: 2.5 + CLEARANCE,
      depth: 2.5 + CLEARANCE,
      cutDepth: 40, // Typical short-arm length
      rotation: 0,
      cornerRadius: 0,
      label: '2.5',
    },
    configurableParams: [
      { key: 'width', label: 'Key Size', min: 1.5, max: 10, step: 0.5, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 20, max: 80, step: 5, unit: 'mm' },
    ],
  },
  {
    id: 'hex-key-4mm',
    name: 'Hex Key (4mm)',
    category: 'hardware',
    description: '4mm hex key slot, standing upright in hexagonal pocket',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: 4 + CLEARANCE,
      depth: 4 + CLEARANCE,
      cutDepth: 50,
      rotation: 0,
      cornerRadius: 0,
      label: '4',
    },
    configurableParams: [
      { key: 'width', label: 'Key Size', min: 1.5, max: 10, step: 0.5, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 25, max: 90, step: 5, unit: 'mm' },
    ],
  },
  {
    id: 'hex-key-6mm',
    name: 'Hex Key (6mm)',
    category: 'hardware',
    description: '6mm hex key slot, standing upright in hexagonal pocket',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: 6 + CLEARANCE,
      depth: 6 + CLEARANCE,
      cutDepth: 60,
      rotation: 0,
      cornerRadius: 0,
      label: '6',
    },
    configurableParams: [
      { key: 'width', label: 'Key Size', min: 1.5, max: 10, step: 0.5, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 30, max: 100, step: 5, unit: 'mm' },
    ],
  },

  // --- Driver bit holders ---
  {
    id: 'bit-quarter-inch',
    name: '¼" Driver Bit',
    category: 'hardware',
    description: 'Standard ¼" (6.35mm) hex driver bit pocket',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: 6.35 + CLEARANCE,
      depth: 6.35 + CLEARANCE,
      cutDepth: 25 + CLEARANCE, // Standard 25mm bit length
      rotation: 0,
      cornerRadius: 0,
      label: 'Bit',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Bit Length', min: 20, max: 75, step: 5, unit: 'mm' },
    ],
  },
  {
    id: 'bit-long',
    name: 'Long Driver Bit',
    category: 'hardware',
    description: 'Long ¼" (6.35mm) hex driver bit pocket (50mm+)',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: 6.35 + CLEARANCE,
      depth: 6.35 + CLEARANCE,
      cutDepth: 50 + CLEARANCE, // Long bit
      rotation: 0,
      cornerRadius: 0,
      label: 'Long bit',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Bit Length', min: 40, max: 150, step: 10, unit: 'mm' },
    ],
  },
] as const;
