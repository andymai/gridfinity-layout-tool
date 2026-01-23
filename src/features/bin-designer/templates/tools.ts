/**
 * Tools insert templates for the Bin Designer.
 *
 * Practical tool holder inserts for common workshop tools.
 * Dimensions based on typical consumer tool sizes with generous
 * clearance for easy retrieval.
 *
 * Uses 1mm total clearance (0.5mm per side) for tools since
 * easy extraction is more important than snug fit.
 */

import type { InsertTemplate } from '../types';

/** Looser clearance for tools — easy extraction matters more than snug fit */
const CLEARANCE = 1.0;

export const TOOLS_TEMPLATES: readonly InsertTemplate[] = [
  // --- Screwdrivers ---
  {
    id: 'screwdriver-small',
    name: 'Small Screwdriver',
    category: 'tools',
    description: 'Precision/jeweler screwdriver slot (6mm shaft, up to 120mm)',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 6 + CLEARANCE,
      depth: 6 + CLEARANCE,
      cutDepth: 80,
      rotation: 0,
      cornerRadius: 0,
      label: 'Screw-S',
    },
    configurableParams: [
      { key: 'width', label: 'Shaft Diameter', min: 4, max: 10, step: 0.5, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 40, max: 150, step: 10, unit: 'mm' },
    ],
  },
  {
    id: 'screwdriver-medium',
    name: 'Medium Screwdriver',
    category: 'tools',
    description: 'Standard screwdriver slot (8mm shaft, up to 150mm)',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 8 + CLEARANCE,
      depth: 8 + CLEARANCE,
      cutDepth: 100,
      rotation: 0,
      cornerRadius: 0,
      label: 'Screw-M',
    },
    configurableParams: [
      { key: 'width', label: 'Shaft Diameter', min: 6, max: 14, step: 1, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 60, max: 200, step: 10, unit: 'mm' },
    ],
  },
  {
    id: 'screwdriver-handle',
    name: 'Screwdriver (lying)',
    category: 'tools',
    description: 'Screwdriver lying flat in elongated slot (handle up to 35mm wide)',
    shape: 'slot',
    defaults: {
      shape: 'slot',
      width: 35 + CLEARANCE,
      depth: 150 + CLEARANCE,
      cutDepth: 20,
      rotation: 0,
      cornerRadius: 17, // Half of width for full rounding
      label: 'Screwdriver',
    },
    configurableParams: [
      { key: 'width', label: 'Handle Width', min: 20, max: 45, step: 5, unit: 'mm' },
      { key: 'depth', label: 'Total Length', min: 100, max: 300, step: 10, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 10, max: 35, step: 5, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },

  // --- Pliers ---
  {
    id: 'pliers-needle',
    name: 'Needle-Nose Pliers',
    category: 'tools',
    description: 'Slim slot for needle-nose pliers (25mm × 160mm)',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 25 + CLEARANCE,
      depth: 160 + CLEARANCE,
      cutDepth: 22,
      rotation: 0,
      cornerRadius: 8,
      label: 'Pliers-N',
    },
    configurableParams: [
      { key: 'width', label: 'Handle Width', min: 20, max: 40, step: 5, unit: 'mm' },
      { key: 'depth', label: 'Total Length', min: 120, max: 220, step: 10, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 15, max: 40, step: 5, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },
  {
    id: 'pliers-standard',
    name: 'Standard Pliers',
    category: 'tools',
    description: 'Wide slot for combination/linesman pliers (35mm × 200mm)',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 35 + CLEARANCE,
      depth: 200 + CLEARANCE,
      cutDepth: 25,
      rotation: 0,
      cornerRadius: 10,
      label: 'Pliers',
    },
    configurableParams: [
      { key: 'width', label: 'Handle Width', min: 25, max: 50, step: 5, unit: 'mm' },
      { key: 'depth', label: 'Total Length', min: 150, max: 280, step: 10, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 20, max: 50, step: 5, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },

  // --- Markers / Pens ---
  {
    id: 'marker-fine',
    name: 'Fine Marker',
    category: 'tools',
    description: 'Fine-tip marker or pen pocket (10mm diameter), standing upright',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 10 + CLEARANCE,
      depth: 10 + CLEARANCE,
      cutDepth: 100,
      rotation: 0,
      cornerRadius: 0,
      label: 'Pen',
    },
    configurableParams: [
      { key: 'width', label: 'Diameter', min: 7, max: 15, step: 0.5, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 50, max: 150, step: 10, unit: 'mm' },
    ],
  },
  {
    id: 'marker-sharpie',
    name: 'Sharpie / Marker',
    category: 'tools',
    description: 'Standard Sharpie or marker pocket (12mm diameter), standing upright',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 12 + CLEARANCE,
      depth: 12 + CLEARANCE,
      cutDepth: 110,
      rotation: 0,
      cornerRadius: 0,
      label: 'Marker',
    },
    configurableParams: [
      { key: 'width', label: 'Diameter', min: 10, max: 20, step: 1, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 60, max: 150, step: 10, unit: 'mm' },
    ],
  },
  {
    id: 'marker-thick',
    name: 'Thick Marker',
    category: 'tools',
    description: 'Chisel-tip or large marker pocket (18mm diameter)',
    shape: 'circle',
    defaults: {
      shape: 'circle',
      width: 18 + CLEARANCE,
      depth: 18 + CLEARANCE,
      cutDepth: 120,
      rotation: 0,
      cornerRadius: 0,
      label: 'Marker-L',
    },
    configurableParams: [
      { key: 'width', label: 'Diameter', min: 14, max: 25, step: 1, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 60, max: 160, step: 10, unit: 'mm' },
    ],
  },

  // --- Tape Measure ---
  {
    id: 'tape-measure-small',
    name: 'Tape Measure (3m)',
    category: 'tools',
    description: 'Compact 3m/10ft tape measure pocket (65 × 65 × 35mm)',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 65 + CLEARANCE,
      depth: 65 + CLEARANCE,
      cutDepth: 35 + CLEARANCE,
      rotation: 0,
      cornerRadius: 10,
      label: 'Tape 3m',
    },
    configurableParams: [
      { key: 'width', label: 'Width', min: 50, max: 90, step: 5, unit: 'mm' },
      { key: 'depth', label: 'Depth', min: 50, max: 90, step: 5, unit: 'mm' },
      { key: 'cutDepth', label: 'Height', min: 25, max: 55, step: 5, unit: 'mm' },
    ],
  },
  {
    id: 'tape-measure-large',
    name: 'Tape Measure (5m)',
    category: 'tools',
    description: 'Standard 5m/16ft tape measure pocket (80 × 80 × 45mm)',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 80 + CLEARANCE,
      depth: 80 + CLEARANCE,
      cutDepth: 45 + CLEARANCE,
      rotation: 0,
      cornerRadius: 12,
      label: 'Tape 5m',
    },
    configurableParams: [
      { key: 'width', label: 'Width', min: 60, max: 110, step: 5, unit: 'mm' },
      { key: 'depth', label: 'Depth', min: 60, max: 110, step: 5, unit: 'mm' },
      { key: 'cutDepth', label: 'Height', min: 35, max: 65, step: 5, unit: 'mm' },
    ],
  },

  // --- Utility Knife ---
  {
    id: 'utility-knife',
    name: 'Utility Knife',
    category: 'tools',
    description: 'Standard retractable utility knife slot (18 × 150mm)',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 18 + CLEARANCE,
      depth: 150 + CLEARANCE,
      cutDepth: 22 + CLEARANCE,
      rotation: 0,
      cornerRadius: 5,
      label: 'Knife',
    },
    configurableParams: [
      { key: 'width', label: 'Body Width', min: 15, max: 25, step: 1, unit: 'mm' },
      { key: 'depth', label: 'Total Length', min: 120, max: 200, step: 10, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 15, max: 35, step: 5, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },
  {
    id: 'utility-knife-compact',
    name: 'Compact Knife',
    category: 'tools',
    description: 'Compact folding or snap-off knife slot (12 × 100mm)',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 12 + CLEARANCE,
      depth: 100 + CLEARANCE,
      cutDepth: 18 + CLEARANCE,
      rotation: 0,
      cornerRadius: 4,
      label: 'Knife-S',
    },
    configurableParams: [
      { key: 'width', label: 'Body Width', min: 10, max: 20, step: 1, unit: 'mm' },
      { key: 'depth', label: 'Total Length', min: 80, max: 160, step: 10, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 12, max: 25, step: 3, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },

  // --- Scissors ---
  {
    id: 'scissors',
    name: 'Scissors',
    category: 'tools',
    description: 'Standard scissors lying flat (25 × 180mm)',
    shape: 'rounded-rect',
    defaults: {
      shape: 'rounded-rect',
      width: 25 + CLEARANCE,
      depth: 180 + CLEARANCE,
      cutDepth: 12 + CLEARANCE,
      rotation: 0,
      cornerRadius: 8,
      label: 'Scissors',
    },
    configurableParams: [
      { key: 'width', label: 'Width', min: 18, max: 40, step: 2, unit: 'mm' },
      { key: 'depth', label: 'Length', min: 120, max: 250, step: 10, unit: 'mm' },
      { key: 'cutDepth', label: 'Pocket Depth', min: 8, max: 20, step: 2, unit: 'mm' },
      { key: 'rotation', label: 'Rotation', min: 0, max: 270, step: 90, unit: '°' },
    ],
  },
] as const;
