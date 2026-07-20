/**
 * Per-side bin overhang resolution. Moved to shared/ so the bin-designer editor
 * and previews can compute the same overhang-expanded interior as the worker.
 * Re-exported here for the many generation-side importers.
 */
export * from '@/shared/utils/overhang';
