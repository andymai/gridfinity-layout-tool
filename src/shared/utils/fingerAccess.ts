import type { Cutout, CutoutShape } from '@/shared/types/bin';

type FingerBottom = NonNullable<Cutout['finger']>['bottom'];

export const FINGER_SHAPES: readonly CutoutShape[] = ['slot', 'circle'];

export function fingerBottom(cutout: Pick<Cutout, 'shape' | 'finger'>): FingerBottom | null {
  return cutout.finger !== undefined && FINGER_SHAPES.includes(cutout.shape)
    ? cutout.finger.bottom
    : null;
}
