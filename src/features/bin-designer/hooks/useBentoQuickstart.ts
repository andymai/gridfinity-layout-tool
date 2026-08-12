/**
 * Manages the Bento workspace quickstart overlay localStorage flag.
 *
 * Its own key, so dismissing the cutout workspace's card does not silently
 * consume this one's only chance to explain a different editor. The `-v2`
 * suffix re-arms the card for users who dismissed the merge/split-era one:
 * the gesture model changed to draw/move/stash, so their dismissal covered
 * instructions that no longer apply.
 */

import { createQuickstartFlag } from './quickstartFlag';

const useFlag = createQuickstartFlag('gridfinity-bento-quickstart-seen-v2');

export interface UseBentoQuickstartReturn {
  quickstartSeen: boolean;
  markQuickstartSeen: () => void;
}

export function useBentoQuickstart(): UseBentoQuickstartReturn {
  const { seen, markSeen } = useFlag();
  return { quickstartSeen: seen, markQuickstartSeen: markSeen };
}
