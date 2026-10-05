/**
 * Re-exports the mount-magnet fit check for the baseplate panel, which warns
 * when a hole is too large for the plate's junctions before the worker skips it.
 */
export {
  maxMountMagnetDepthMm,
  mountMagnetFits,
} from '@/features/generation/worker/generators/mountMagnetPlan';
