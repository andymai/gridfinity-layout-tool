/**
 * Hardware insert templates for the Bin Designer.
 *
 * Dimensions sourced from ISO standards:
 * - Socket head cap screws: ISO 4762
 * - Hex nuts: ISO 4032
 * - Washers: ISO 7089
 * - Hex keys: DIN 911
 * - Driver bits: 1/4" hex standard
 *
 * All dimensions include 0.5mm total clearance for FDM printing tolerance.
 */

import type { InsertTemplate } from '../types';

/** 3D printing clearance (0.25mm per side = 0.5mm total) */
const CLEARANCE = 0.5;

/**
 * Standard metric screw head diameters (socket head cap, ISO 4762).
 * Using head diameter since screws stand upright in pockets.
 */
const SCREW_HEAD: Record<string, { head: number; length: number }> = {
  M2: { head: 3.8, length: 12 },
  M3: { head: 5.5, length: 16 },
  M4: { head: 7.0, length: 20 },
  M5: { head: 8.5, length: 25 },
  M6: { head: 10.0, length: 30 },
  M8: { head: 13.0, length: 40 },
};

/**
 * Standard hex nut across-flats dimensions (ISO 4032).
 * Height is used for stacking depth calculations.
 */
const HEX_NUT: Record<string, { af: number; height: number }> = {
  M3: { af: 5.5, height: 2.4 },
  M4: { af: 7.0, height: 3.2 },
  M5: { af: 8.0, height: 4.7 },
  M6: { af: 10.0, height: 5.2 },
  M8: { af: 13.0, height: 6.8 },
};

/**
 * Standard washer outer diameters (ISO 7089).
 * Thickness used for stacking calculations.
 */
const WASHER: Record<string, { od: number; thickness: number }> = {
  M3: { od: 7.0, thickness: 0.5 },
  M4: { od: 9.0, thickness: 0.8 },
  M5: { od: 10.0, thickness: 1.0 },
  M6: { od: 12.0, thickness: 1.6 },
  M8: { od: 16.0, thickness: 1.6 },
};

export const HARDWARE_TEMPLATES: readonly InsertTemplate[] = [
  // --- Screw slots (M3-M8) ---
  {
    id: 'screw-m3',
    name: 'M3 Screw',
    category: 'hardware',
    description: 'M3 socket head cap screw (5.5mm head, up to 16mm long)',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: SCREW_HEAD.M3.head + CLEARANCE,
      depth: SCREW_HEAD.M3.head + CLEARANCE,
      cutDepth: SCREW_HEAD.M3.length + CLEARANCE,
      rotation: 0,
      cornerRadius: 0,
      label: 'M3',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Screw Length', min: 6, max: 30, step: 2, unit: 'mm' },
    ],
  },
  {
    id: 'screw-m4',
    name: 'M4 Screw',
    category: 'hardware',
    description: 'M4 socket head cap screw (7mm head, up to 20mm long)',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: SCREW_HEAD.M4.head + CLEARANCE,
      depth: SCREW_HEAD.M4.head + CLEARANCE,
      cutDepth: SCREW_HEAD.M4.length + CLEARANCE,
      rotation: 0,
      cornerRadius: 0,
      label: 'M4',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Screw Length', min: 8, max: 50, step: 2, unit: 'mm' },
    ],
  },
  {
    id: 'screw-m5',
    name: 'M5 Screw',
    category: 'hardware',
    description: 'M5 socket head cap screw (8.5mm head, up to 25mm long)',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: SCREW_HEAD.M5.head + CLEARANCE,
      depth: SCREW_HEAD.M5.head + CLEARANCE,
      cutDepth: SCREW_HEAD.M5.length + CLEARANCE,
      rotation: 0,
      cornerRadius: 0,
      label: 'M5',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Screw Length', min: 10, max: 60, step: 5, unit: 'mm' },
    ],
  },
  {
    id: 'screw-m6',
    name: 'M6 Screw',
    category: 'hardware',
    description: 'M6 socket head cap screw (10mm head, up to 30mm long)',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: SCREW_HEAD.M6.head + CLEARANCE,
      depth: SCREW_HEAD.M6.head + CLEARANCE,
      cutDepth: SCREW_HEAD.M6.length + CLEARANCE,
      rotation: 0,
      cornerRadius: 0,
      label: 'M6',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Screw Length', min: 12, max: 80, step: 5, unit: 'mm' },
    ],
  },
  {
    id: 'screw-m8',
    name: 'M8 Screw',
    category: 'hardware',
    description: 'M8 socket head cap screw (13mm head, up to 40mm long)',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: SCREW_HEAD.M8.head + CLEARANCE,
      depth: SCREW_HEAD.M8.head + CLEARANCE,
      cutDepth: SCREW_HEAD.M8.length + CLEARANCE,
      rotation: 0,
      cornerRadius: 0,
      label: 'M8',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Screw Length', min: 16, max: 100, step: 5, unit: 'mm' },
    ],
  },

  // --- Hex nut pockets (M3-M8) ---
  {
    id: 'nut-m3',
    name: 'M3 Hex Nut',
    category: 'hardware',
    description: 'M3 hex nut pocket (5.5mm AF), stackable',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: HEX_NUT.M3.af + CLEARANCE,
      depth: HEX_NUT.M3.af + CLEARANCE,
      cutDepth: HEX_NUT.M3.height * 5 + CLEARANCE, // 5-stack default
      rotation: 0,
      cornerRadius: 0,
      label: 'M3 nut',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 2.5, max: 30, step: HEX_NUT.M3.height, unit: 'mm' },
    ],
  },
  {
    id: 'nut-m4',
    name: 'M4 Hex Nut',
    category: 'hardware',
    description: 'M4 hex nut pocket (7mm AF), stackable',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: HEX_NUT.M4.af + CLEARANCE,
      depth: HEX_NUT.M4.af + CLEARANCE,
      cutDepth: HEX_NUT.M4.height * 4 + CLEARANCE, // 4-stack default
      rotation: 0,
      cornerRadius: 0,
      label: 'M4 nut',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 3.5, max: 35, step: HEX_NUT.M4.height, unit: 'mm' },
    ],
  },
  {
    id: 'nut-m5',
    name: 'M5 Hex Nut',
    category: 'hardware',
    description: 'M5 hex nut pocket (8mm AF), stackable',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: HEX_NUT.M5.af + CLEARANCE,
      depth: HEX_NUT.M5.af + CLEARANCE,
      cutDepth: HEX_NUT.M5.height * 4 + CLEARANCE, // 4-stack default
      rotation: 0,
      cornerRadius: 0,
      label: 'M5 nut',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 5, max: 50, step: HEX_NUT.M5.height, unit: 'mm' },
    ],
  },
  {
    id: 'nut-m6',
    name: 'M6 Hex Nut',
    category: 'hardware',
    description: 'M6 hex nut pocket (10mm AF), stackable',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: HEX_NUT.M6.af + CLEARANCE,
      depth: HEX_NUT.M6.af + CLEARANCE,
      cutDepth: HEX_NUT.M6.height * 3 + CLEARANCE, // 3-stack default
      rotation: 0,
      cornerRadius: 0,
      label: 'M6 nut',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 5.5, max: 55, step: HEX_NUT.M6.height, unit: 'mm' },
    ],
  },
  {
    id: 'nut-m8',
    name: 'M8 Hex Nut',
    category: 'hardware',
    description: 'M8 hex nut pocket (13mm AF), stackable',
    shape: 'hexagon',
    defaults: {
      shape: 'hexagon',
      width: HEX_NUT.M8.af + CLEARANCE,
      depth: HEX_NUT.M8.af + CLEARANCE,
      cutDepth: HEX_NUT.M8.height * 3 + CLEARANCE, // 3-stack default
      rotation: 0,
      cornerRadius: 0,
      label: 'M8 nut',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 7, max: 70, step: HEX_NUT.M8.height, unit: 'mm' },
    ],
  },

  // --- Washer stacks ---
  {
    id: 'washer-m4',
    name: 'M4 Washer Stack',
    category: 'hardware',
    description: 'M4 washer pocket (9mm OD), holds 10+ washers',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: WASHER.M4.od + CLEARANCE,
      depth: WASHER.M4.od + CLEARANCE,
      cutDepth: WASHER.M4.thickness * 10 + CLEARANCE, // 10-stack default
      rotation: 0,
      cornerRadius: 0,
      label: 'M4 wash',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 2, max: 20, step: WASHER.M4.thickness, unit: 'mm' },
    ],
  },
  {
    id: 'washer-m5',
    name: 'M5 Washer Stack',
    category: 'hardware',
    description: 'M5 washer pocket (10mm OD), holds 10+ washers',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: WASHER.M5.od + CLEARANCE,
      depth: WASHER.M5.od + CLEARANCE,
      cutDepth: WASHER.M5.thickness * 10 + CLEARANCE, // 10-stack default
      rotation: 0,
      cornerRadius: 0,
      label: 'M5 wash',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 2, max: 25, step: WASHER.M5.thickness, unit: 'mm' },
    ],
  },
  {
    id: 'washer-m6',
    name: 'M6 Washer Stack',
    category: 'hardware',
    description: 'M6 washer pocket (12mm OD), holds 10+ washers',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: WASHER.M6.od + CLEARANCE,
      depth: WASHER.M6.od + CLEARANCE,
      cutDepth: WASHER.M6.thickness * 10 + CLEARANCE, // 10-stack default
      rotation: 0,
      cornerRadius: 0,
      label: 'M6 wash',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 3, max: 30, step: WASHER.M6.thickness, unit: 'mm' },
    ],
  },

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
