/**
 * Manages the Bento workspace quickstart overlay localStorage flag.
 *
 * Its own key, so dismissing the cutout workspace's card does not silently
 * consume this one's only chance to explain a different editor.
 */

import { createQuickstartFlag } from './quickstartFlag';

const useFlag = createQuickstartFlag('gridfinity-bento-quickstart-seen');

export interface UseBentoQuickstartReturn {
  quickstartSeen: boolean;
  markQuickstartSeen: () => void;
}

export function useBentoQuickstart(): UseBentoQuickstartReturn {
  const { seen, markSeen } = useFlag();
  return { quickstartSeen: seen, markQuickstartSeen: markSeen };
}
