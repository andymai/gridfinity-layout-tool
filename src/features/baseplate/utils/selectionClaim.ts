import { useLayoutStore } from '@/core/store/layout';

// Module-scoped so every hook instance shares it: the selector and the phone
// menu unmount and remount between clicks.
let latest = 0;

/**
 * Claims the active plate for a change that awaits storage (a library pick or
 * a New baseplate save). The returned check turns true once a newer claim
 * starts or another layout opens, so a slow change never overwrites a newer
 * selection or lands on the wrong layout.
 */
export function claimSelection(): () => boolean {
  const token = ++latest;
  const { activeLayoutId } = useLayoutStore.getState();
  return () => token !== latest || useLayoutStore.getState().activeLayoutId !== activeLayoutId;
}
