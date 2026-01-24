/**
 * Re-exports generation bridge API for cross-feature consumption.
 *
 * The canonical implementation lives in features/generation/bridge.
 * This barrel allows other features (e.g., bin-designer) to use
 * the bridge without a cross-feature import violation.
 */
export { GenerationBridge } from '@/features/generation/bridge';
export { setActiveBridge, getActiveBridge } from '@/features/generation/bridge';
