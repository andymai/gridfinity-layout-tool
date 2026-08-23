/**
 * Numeric inspector fields per part type. Ranges mirror the descriptor
 * schema, which stays the authority — `updateAssemblyPartParams` re-validates
 * every edit, so a drifted range here can annoy but never corrupt.
 */
import type { AssemblyPartType, PartLabelFace } from '@/shared/types/assembly';

export interface PartNumberField {
  readonly key: string;
  readonly labelKey: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const PART_NUMBER_FIELDS: Record<AssemblyPartType, readonly PartNumberField[]> = {
  post: [
    { key: 'diameter', labelKey: 'workshop.field.diameter', min: 2, max: 60, step: 0.5 },
    { key: 'height', labelKey: 'workshop.field.height', min: 4, max: 200, step: 1 },
    { key: 'taperDeg', labelKey: 'workshop.field.taperDeg', min: 0, max: 15, step: 1 },
    { key: 'tipChamfer', labelKey: 'workshop.field.tipChamfer', min: 0, max: 5, step: 0.2 },
  ],
  fin: [
    { key: 'length', labelKey: 'workshop.field.length', min: 4, max: 400, step: 1 },
    { key: 'thickness', labelKey: 'workshop.field.thickness', min: 0.8, max: 20, step: 0.2 },
    { key: 'height', labelKey: 'workshop.field.height', min: 4, max: 200, step: 1 },
    { key: 'leanDeg', labelKey: 'workshop.field.leanDeg', min: 0, max: 45, step: 1 },
  ],
  block: [
    { key: 'width', labelKey: 'workshop.field.width', min: 2, max: 400, step: 1 },
    { key: 'depth', labelKey: 'workshop.field.depth', min: 2, max: 400, step: 1 },
    { key: 'height', labelKey: 'workshop.field.height', min: 1, max: 200, step: 1 },
    { key: 'wedgeAngleDeg', labelKey: 'workshop.field.wedgeAngleDeg', min: 0, max: 60, step: 1 },
    { key: 'tiltDeg', labelKey: 'workshop.field.tiltDeg', min: 0, max: 20, step: 1 },
  ],
  tube: [
    { key: 'boreDiameter', labelKey: 'workshop.field.boreDiameter', min: 2, max: 80, step: 0.5 },
    { key: 'wall', labelKey: 'workshop.field.wall', min: 0.8, max: 10, step: 0.2 },
    { key: 'height', labelKey: 'workshop.field.height', min: 4, max: 200, step: 1 },
    { key: 'tiltDeg', labelKey: 'workshop.field.tiltDeg', min: 0, max: 30, step: 1 },
    {
      key: 'counterboreDiameter',
      labelKey: 'workshop.field.counterboreDiameter',
      min: 0,
      max: 90,
      step: 0.5,
    },
    {
      key: 'counterboreDepth',
      labelKey: 'workshop.field.counterboreDepth',
      min: 0,
      max: 40,
      step: 0.5,
    },
    { key: 'boreTaperDeg', labelKey: 'workshop.field.boreTaperDeg', min: 0, max: 10, step: 0.5 },
  ],
  cradle: [
    { key: 'length', labelKey: 'workshop.field.length', min: 4, max: 400, step: 1 },
    { key: 'width', labelKey: 'workshop.field.width', min: 4, max: 100, step: 1 },
    { key: 'height', labelKey: 'workshop.field.height', min: 4, max: 100, step: 1 },
    { key: 'grooveWidth', labelKey: 'workshop.field.grooveWidth', min: 2, max: 80, step: 0.5 },
    { key: 'grooveDepth', labelKey: 'workshop.field.grooveDepth', min: 1, max: 60, step: 0.5 },
    { key: 'tiltDeg', labelKey: 'workshop.field.tiltDeg', min: 0, max: 20, step: 1 },
  ],
  hook: [
    { key: 'stemHeight', labelKey: 'workshop.field.stemHeight', min: 4, max: 200, step: 1 },
    { key: 'reach', labelKey: 'workshop.field.reach', min: 4, max: 100, step: 1 },
    { key: 'lipHeight', labelKey: 'workshop.field.lipHeight', min: 0, max: 60, step: 1 },
    { key: 'thickness', labelKey: 'workshop.field.thickness', min: 0.8, max: 20, step: 0.2 },
    { key: 'width', labelKey: 'workshop.field.width', min: 2, max: 100, step: 1 },
  ],
  arch: [
    { key: 'span', labelKey: 'workshop.field.span', min: 8, max: 400, step: 1 },
    { key: 'height', labelKey: 'workshop.field.height', min: 8, max: 200, step: 1 },
    { key: 'rodDiameter', labelKey: 'workshop.field.rodDiameter', min: 2, max: 40, step: 0.5 },
    { key: 'bridgeWidth', labelKey: 'workshop.field.bridgeWidth', min: 2, max: 60, step: 1 },
    {
      key: 'uprightThickness',
      labelKey: 'workshop.field.uprightThickness',
      min: 2,
      max: 30,
      step: 0.5,
    },
    { key: 'depth', labelKey: 'workshop.field.depth', min: 4, max: 60, step: 1 },
  ],
  comb: [
    { key: 'width', labelKey: 'workshop.field.width', min: 10, max: 300, step: 1 },
    { key: 'depth', labelKey: 'workshop.field.depth', min: 4, max: 80, step: 1 },
    { key: 'height', labelKey: 'workshop.field.height', min: 5, max: 120, step: 1 },
    { key: 'slotCount', labelKey: 'workshop.field.slotCount', min: 1, max: 15, step: 1 },
    { key: 'slotWidth', labelKey: 'workshop.field.slotWidth', min: 1, max: 60, step: 0.5 },
    { key: 'slotDepth', labelKey: 'workshop.field.slotDepth', min: 1, max: 110, step: 1 },
  ],
  riser: [
    { key: 'width', labelKey: 'workshop.field.width', min: 10, max: 300, step: 1 },
    { key: 'stepCount', labelKey: 'workshop.field.stepCount', min: 2, max: 6, step: 1 },
    { key: 'stepDepth', labelKey: 'workshop.field.stepDepth', min: 5, max: 80, step: 1 },
    { key: 'stepHeight', labelKey: 'workshop.field.stepHeight', min: 2, max: 60, step: 1 },
  ],
  boreBank: [
    { key: 'width', labelKey: 'workshop.field.width', min: 10, max: 300, step: 1 },
    { key: 'depth', labelKey: 'workshop.field.depth', min: 8, max: 120, step: 1 },
    { key: 'height', labelKey: 'workshop.field.height', min: 8, max: 120, step: 1 },
    { key: 'boreDiameter', labelKey: 'workshop.field.boreDiameter', min: 2, max: 40, step: 0.5 },
    { key: 'boreDepth', labelKey: 'workshop.field.boreDepth', min: 3, max: 110, step: 1 },
    { key: 'columns', labelKey: 'workshop.field.columns', min: 1, max: 15, step: 1 },
    { key: 'rows', labelKey: 'workshop.field.rows', min: 1, max: 6, step: 1 },
    { key: 'angleDeg', labelKey: 'workshop.field.leanDeg', min: 0, max: 30, step: 1 },
  ],
  cutter: [
    { key: 'depth', labelKey: 'workshop.field.cutDepth', min: 0.5, max: 200, step: 0.5 },
    { key: 'clearance', labelKey: 'workshop.field.clearance', min: 0, max: 5, step: 0.1 },
    { key: 'chamfer', labelKey: 'workshop.field.chamfer', min: 0, max: 5, step: 0.2 },
  ],
};

export const PART_LABEL_KEYS: Record<AssemblyPartType, string> = {
  post: 'workshop.part.post',
  fin: 'workshop.part.fin',
  block: 'workshop.part.block',
  tube: 'workshop.part.tube',
  cradle: 'workshop.part.cradle',
  hook: 'workshop.part.hook',
  arch: 'workshop.part.arch',
  comb: 'workshop.part.comb',
  riser: 'workshop.part.riser',
  boreBank: 'workshop.part.boreBank',
  cutter: 'workshop.part.cutter',
};

export const LABEL_FACES: Partial<Record<AssemblyPartType, readonly PartLabelFace[]>> = {
  block: ['front', 'back', 'left', 'right', 'top'],
  comb: ['front', 'back', 'left', 'right'],
  boreBank: ['front', 'back', 'left', 'right'],
  riser: ['front', 'left', 'right', 'top'],
};
