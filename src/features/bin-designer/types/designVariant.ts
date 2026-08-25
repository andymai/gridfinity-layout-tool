// The override shapes live in `shared/` because the variant resolver runs there
// (a feature cannot import another feature, and generation's scenario tests
// resolve variants too). Re-exported so this feature's own code keeps one
// import site.
export type {
  DimensionOverride,
  CutoutOverride,
  CutoutOverrideField,
  DimensionOverrideField,
  DesignOverrides,
  OrphanedOverride,
} from '@/shared/types/designOverrides';
export {
  CUTOUT_OVERRIDE_FIELDS,
  DIMENSION_OVERRIDE_FIELDS,
  isEmptyOverrides,
} from '@/shared/types/designOverrides';
