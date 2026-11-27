import { useCallback, useSyncExternalStore } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useToastStore } from '@/core/store/toast';
import { useMutations } from '@/shared/contexts';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { useBaseplateLibrary } from '@/features/baseplate/hooks/useBaseplateLibrary';
import { nextBaseplateName } from '@/features/baseplate/utils/baseplateName';

export interface UseNewBaseplate {
  /**
   * Resolves true once the new design is saved and active. A call while a save
   * is pending joins that save instead of starting another.
   */
  createBaseplate: () => Promise<boolean>;
  creating: boolean;
}

// Module-scoped so the header button, the library modal and the phone menu
// share one save. The phone menu unmounts its items on click, so state held in
// the hook would reset on reopen and let a second save take the same name.
let inFlight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isCreating(): boolean {
  return inFlight !== null;
}

function setInFlight(next: Promise<boolean> | null): void {
  inFlight = next;
  listeners.forEach((listener) => listener());
}

export function useNewBaseplate(): UseNewBaseplate {
  const t = useTranslation();
  const { list, saveCurrentAsNew } = useBaseplateLibrary();
  const mutations = useMutations();
  const addToast = useToastStore((s) => s.addToast);
  const creating = useSyncExternalStore(subscribe, isCreating, isCreating);

  const createBaseplate = useCallback((): Promise<boolean> => {
    if (inFlight) return inFlight;
    const create = async (): Promise<boolean> => {
      const { activeLayoutId } = useLayoutStore.getState();
      const result = await saveCurrentAsNew(nextBaseplateName(list), {
        ...DEFAULT_BASEPLATE_PARAMS,
      });
      if (!isOk(result)) {
        addToast(t('toast.baseplateSaveFailed'), 'error');
        return false;
      }
      // Another layout opened during the save. Activation would replace that
      // layout's plate settings with the defaults.
      if (useLayoutStore.getState().activeLayoutId !== activeLayoutId) return false;
      mutations.setActiveBaseplate(result.value.id, result.value.params);
      return true;
    };
    const pending = create().finally(() => setInFlight(null));
    setInFlight(pending);
    return pending;
  }, [list, saveCurrentAsNew, mutations, addToast, t]);

  return { createBaseplate, creating };
}
