/**
 * What the designer needs to know about the open design's variant relationship.
 *
 * Read from storage rather than held in the designer store: the overrides are
 * the variant's persisted truth, not editing state, and they change only
 * through the storage actions that also rewrite `params`.
 */

import { useCallback, useEffect, useState } from 'react';
import { isOk } from '@/core/result';
import { designId as toDesignId } from '@/core/types';
import type { DesignId } from '@/core/types';
import type { BinParams, DesignOverrides, OrphanedOverride } from '@/features/bin-designer/types';
import { loadDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { applyOverrides } from '@/shared/utils/applyOverrides';

export interface VariantContext {
  readonly isVariant: boolean;
  readonly parentId: DesignId | null;
  readonly parentName: string;
  /** The parent's current params, the baseline every inherited value comes from. */
  readonly parentParams: BinParams | null;
  readonly overrides: DesignOverrides;
  /** Overrides naming a cutout the parent no longer has. */
  readonly orphans: readonly OrphanedOverride[];
  readonly isLoading: boolean;
  readonly reload: () => void;
}

const NONE: VariantContext = {
  isVariant: false,
  parentId: null,
  parentName: '',
  parentParams: null,
  overrides: {},
  orphans: [],
  isLoading: false,
  reload: () => {},
};

export function useVariantContext(currentDesignId: string | null): VariantContext {
  const [state, setState] = useState<Omit<VariantContext, 'reload'>>(NONE);
  const [generation, setGeneration] = useState(0);

  const reload = useCallback(() => {
    setGeneration((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Every write happens in the async body, including the reset: a synchronous
    // setState here would cascade a render before the effect has done anything.
    void (async () => {
      if (!currentDesignId) {
        if (!cancelled) setState(NONE);
        return;
      }
      const self = await loadDesign(toDesignId(currentDesignId));
      if (cancelled) return;
      if (!isOk(self) || !self.value.variantOf) {
        setState(NONE);
        return;
      }

      const parent = await loadDesign(self.value.variantOf);
      if (cancelled) return;
      // A variant whose parent is gone keeps the params it has and stops
      // reporting as a variant: there is nothing left to inherit from, and
      // showing an inherit UI against a design that does not exist is worse
      // than showing none.
      if (!isOk(parent) || !parent.value.params) {
        setState(NONE);
        return;
      }

      const overrides = self.value.overrides ?? {};
      const { orphans } = applyOverrides(parent.value.params, overrides);
      setState({
        isVariant: true,
        parentId: self.value.variantOf,
        parentName: parent.value.name,
        parentParams: parent.value.params,
        overrides,
        orphans,
        isLoading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [currentDesignId, generation]);

  return { ...state, reload };
}
