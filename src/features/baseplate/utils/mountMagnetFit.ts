import type { StoredBaseplateParams } from '@/core/types';
import { baseplateFloorDepthBeforeScrews } from '@/shared/printSettings/baseplateHeight';
import { plateProfileHeightMm } from '@/shared/printSettings/gridfinityGeometry';
import { maxMountMagnetDepthMm } from '@/shared/generation/mountMagnetFit';
import { resolveScrewPadMm } from './buildFullParams';

/**
 * Deepest mount-magnet hole the plate's junctions hold at the stored diameter.
 * The slab height it is measured against includes the magnet floor, the solid
 * floor and the screw pad, each of which gives the hole more room.
 */
export function maxMountMagnetDepthForPlate(
  stored: StoredBaseplateParams,
  diameter: number,
  lowProfileBase: boolean
): number {
  const profileHeight = plateProfileHeightMm(lowProfileBase);
  const totalHeight =
    profileHeight +
    baseplateFloorDepthBeforeScrews({
      magnetHoles: stored.magnetHoles,
      magnetDepth: stored.magnetDepth,
      solidFloor: stored.solidFloor,
      solidFloorThickness: stored.solidFloorThickness,
    }) +
    resolveScrewPadMm(stored);
  return maxMountMagnetDepthMm(diameter, totalHeight, profileHeight);
}
