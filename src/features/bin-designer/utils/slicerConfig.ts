/**
 * Re-export slicer config from shared module.
 *
 * The canonical implementation lives in @/shared/utils/slicerConfig.
 * This re-export maintains backward compatibility for existing imports.
 */
export { buildSlicerUrl } from '@/shared/utils/slicerConfig';
