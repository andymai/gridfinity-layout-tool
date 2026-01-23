/**
 * Electronics insert templates for the Bin Designer.
 *
 * Dimensions sourced from standard specifications with 0.5mm clearance
 * added per side for 3D printing tolerance.
 */

import type { InsertTemplate } from '../types';

/**
 * Standard 3D printing clearance added to each dimension.
 * 0.5mm total (0.25mm per side) provides snug fit without binding.
 */
const CLEARANCE = 0.5;

export const ELECTRONICS_TEMPLATES: readonly InsertTemplate[] = [
  {
    id: 'battery-aa',
    name: 'AA Battery',
    category: 'electronics',
    description: 'Standard AA cell (14.5mm × 50.5mm), standing upright',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 14.5 + CLEARANCE,
      depth: 14.5 + CLEARANCE,
      cutDepth: 50.5 + CLEARANCE,
      rotation: 0,
      cornerRadius: 0,
      label: 'AA',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Pocket Depth', min: 10, max: 55, step: 0.5, unit: 'mm' },
    ],
  },
  {
    id: 'battery-aaa',
    name: 'AAA Battery',
    category: 'electronics',
    description: 'Standard AAA cell (10.5mm × 44.5mm), standing upright',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 10.5 + CLEARANCE,
      depth: 10.5 + CLEARANCE,
      cutDepth: 44.5 + CLEARANCE,
      rotation: 0,
      cornerRadius: 0,
      label: 'AAA',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Pocket Depth', min: 10, max: 50, step: 0.5, unit: 'mm' },
    ],
  },
  {
    id: 'battery-9v',
    name: '9V Battery',
    category: 'electronics',
    description: 'Standard 9V block (26.5 × 17.5 × 48.5mm), standing upright',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 26.5 + CLEARANCE,
      depth: 17.5 + CLEARANCE,
      cutDepth: 48.5 + CLEARANCE,
      rotation: 0,
      cornerRadius: 2,
      label: '9V',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Pocket Depth', min: 10, max: 52, step: 0.5, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },
  {
    id: 'battery-cr2032',
    name: 'CR2032 Coin Cell',
    category: 'electronics',
    description: 'Standard coin cell (20mm × 3.2mm), stackable flat pocket',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 20 + CLEARANCE,
      depth: 20 + CLEARANCE,
      cutDepth: 6.9, // Fits 2 stacked cells (3.2 × 2 + clearance)
      rotation: 0,
      cornerRadius: 0,
      label: 'CR2032',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 3.5, max: 25, step: 3.2, unit: 'mm' },
    ],
  },
  {
    id: 'sd-card',
    name: 'SD Card',
    category: 'electronics',
    description: 'Full-size SD card (32 × 24 × 2.1mm), flat pocket',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 24 + CLEARANCE,
      depth: 32 + CLEARANCE,
      cutDepth: 4.7, // Fits 2 stacked cards + clearance
      rotation: 0,
      cornerRadius: 1.5,
      label: 'SD',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 2.5, max: 20, step: 2.1, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },
  {
    id: 'microsd-card',
    name: 'MicroSD Card',
    category: 'electronics',
    description: 'MicroSD card (15 × 11 × 1mm), flat pocket',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 11 + CLEARANCE,
      depth: 15 + CLEARANCE,
      cutDepth: 5.5, // Fits ~5 stacked cards
      rotation: 0,
      cornerRadius: 1,
      label: 'µSD',
    },
    configurableParams: [
      { key: 'cutDepth', label: 'Stack Depth', min: 1.5, max: 15, step: 1, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },
  {
    id: 'usb-a-drive',
    name: 'USB-A Drive',
    category: 'electronics',
    description: 'Standard USB-A flash drive (12 × 5 × 45mm), lying flat',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 12 + CLEARANCE,
      depth: 45 + CLEARANCE,
      cutDepth: 5 + CLEARANCE,
      rotation: 0,
      cornerRadius: 1,
      label: 'USB',
    },
    configurableParams: [
      { key: 'depth', label: 'Drive Length', min: 30, max: 80, step: 1, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 4, max: 15, step: 0.5, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },
  {
    id: 'usb-c-coil',
    name: 'USB-C Cable Coil',
    category: 'electronics',
    description: 'Circular pocket for coiled USB-C cable',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 50,
      depth: 50,
      cutDepth: 25,
      rotation: 0,
      cornerRadius: 0,
      label: 'USB-C',
    },
    configurableParams: [
      { key: 'width', label: 'Coil Diameter', min: 30, max: 100, step: 5, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 10, max: 50, step: 5, unit: 'mm' },
    ],
  },
] as const;
