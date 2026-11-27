import { useCallback, useState } from 'react';
import { useToastStore } from '@/core/store/toast';
import { useMutations } from '@/shared/contexts';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { useBaseplateLibrary } from '@/features/baseplate/hooks/useBaseplateLibrary';
import { nextBaseplateName } from '@/features/baseplate/utils/baseplateName';

export interface UseNewBaseplate {
  /** Resolves true once the new design is saved and active. */
  createBaseplate: () => Promise<boolean>;
  creating: boolean;
}

export function useNewBaseplate(): UseNewBaseplate {
  const t = useTranslation();
  const { list, saveCurrentAsNew } = useBaseplateLibrary();
  const mutations = useMutations();
  const addToast = useToastStore((s) => s.addToast);
  const [creating, setCreating] = useState(false);

  const createBaseplate = useCallback(async () => {
    setCreating(true);
    const result = await saveCurrentAsNew(nextBaseplateName(list), { ...DEFAULT_BASEPLATE_PARAMS });
    setCreating(false);
    if (!isOk(result)) {
      addToast(t('toast.baseplateSaveFailed'), 'error');
      return false;
    }
    mutations.setActiveBaseplate(result.value.id, result.value.params);
    return true;
  }, [list, saveCurrentAsNew, mutations, addToast, t]);

  return { createBaseplate, creating };
}
