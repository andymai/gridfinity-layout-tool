/**
 * Ensures the layout always has an active baseplate design.
 *
 * Mirrors `useDesignerInit`'s contract ("always has an active design"). With a
 * design always present and autosaving, the header needs no Save / Save As /
 * New cluster — just a name, a list, and a status, like the bin designer.
 *
 * IMPORTANT: this creates a design **from the layout's current params** rather
 * than adopting the most recently used one, which is where it deliberately
 * diverges from `useDesignerInit`. A `SavedDesign` is standalone, but
 * `baseplateParams` live on the `Layout` — adopting another design would
 * overwrite baseplate settings this layout already has. Creating preserves
 * them; it is exactly what the old explicit Save did, minus the click.
 *
 * Only runs on the /baseplate page, so a library entry appears when the user
 * actually opens the baseplate tool rather than for every layout they own.
 */

import { useEffect, useRef } from 'react';
import { isOk } from '@/core/result';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { useLayoutStore } from '@/core/store/layout';
import { useMutations } from '@/shared/contexts';
import { useBaseplateLibrary } from './useBaseplateLibrary';
import { nextBaseplateName } from '../utils/baseplateName';

export function useBaseplateInit(): void {
  const { list, activeBaseplateId, saveCurrentAsNew } = useBaseplateLibrary();
  const params = useLayoutStore((s) => s.layout.baseplateParams);
  const mutations = useMutations();
  // Guards against a second create while the first is in flight (StrictMode
  // double-invoke, or a params edit re-running the effect mid-save).
  const creating = useRef(false);

  useEffect(() => {
    if (activeBaseplateId || creating.current) return;
    creating.current = true;

    void (async () => {
      try {
        const result = await saveCurrentAsNew(
          nextBaseplateName(list),
          params ?? DEFAULT_BASEPLATE_PARAMS
        );
        if (isOk(result)) {
          mutations.setActiveBaseplate(result.value.id, result.value.params);
        }
      } finally {
        creating.current = false;
      }
    })();
  }, [activeBaseplateId, list, params, saveCurrentAsNew, mutations]);
}
