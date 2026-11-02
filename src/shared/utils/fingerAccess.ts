import type { Cutout, CutoutShape } from '@/shared/types/bin';

type FingerBottom = NonNullable<Cutout['finger']>['bottom'];

/** Shapes a finger-access cut can take. */
export const FINGER_SHAPES: readonly CutoutShape[] = ['slot', 'circle'];

/** The cut's finger-access bottom, or null when it is not finger access. */
export function fingerBottom(cutout: Pick<Cutout, 'shape' | 'finger'>): FingerBottom | null {
  return cutout.finger !== undefined && FINGER_SHAPES.includes(cutout.shape)
    ? cutout.finger.bottom
    : null;
}
