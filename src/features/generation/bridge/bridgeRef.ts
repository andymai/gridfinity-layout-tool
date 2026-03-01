import type { GenerationBridge } from './GenerationBridge';
import { bridgeManager } from './BridgeManager';

/** Returns the active bridge without acquiring a reference, or null if none is active. */
export function getActiveBridge(): GenerationBridge | null {
  return bridgeManager.get();
}
