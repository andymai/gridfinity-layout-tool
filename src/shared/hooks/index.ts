// Shared hooks - cross-cutting concerns with no domain coupling

export { useAutoSave } from './useAutoSave';
export type { SaveStatus } from './useAutoSave';

export { useResponsive, prefersTouch } from './useResponsive';
export type { ResponsiveState, LayoutMode } from './useResponsive';

export { useCrossTabSync } from './useCrossTabSync';

export { usePWAUpdate } from './usePWAUpdate';

export { useKeyboard } from './useKeyboard';
