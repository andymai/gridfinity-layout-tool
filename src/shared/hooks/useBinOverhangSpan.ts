import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { OverhangSpan } from '@/core/constants';
import { useLayoutStore } from '@/core/store/layout';
import type { DesignId } from '@/core/types';
import type { OverhangConfig } from '@/shared/types/bin';
import { resolveBinOverhang, type OverhangSource } from '@/shared/utils/drawerMargin';
import { resolveOverhang } from '@/shared/utils/overhang';
import { useLinkedDesignKinds } from './useLinkedDesignKinds';
import { useLinkedDesignOverhangs } from './useLinkedDesignOverhangs';

type PlacedBin = OverhangSource & { readonly linkedDesignId?: DesignId };

/**
 * A placed bin's overhang, resolved the way the print list and layout ZIP
 * resolve it: the placement's overhang wins, and the linked design's is the
 * fallback.
 */
export function useBinOverhang(): (bin: PlacedBin) => OverhangConfig | undefined {
  const { drawer, baseplate } = useLayoutStore(
    useShallow((s) => ({ drawer: s.layout.drawer, baseplate: s.layout.baseplateParams }))
  );
  const designKinds = useLinkedDesignKinds();
  const designOverhangs = useLinkedDesignOverhangs();
  return useCallback(
    (bin) => {
      const linkedId = bin.linkedDesignId;
      const linkedKind = linkedId === undefined ? undefined : designKinds.get(linkedId);
      return (
        resolveBinOverhang(bin, drawer, baseplate, linkedKind) ??
        (linkedId === undefined ? undefined : designOverhangs.get(linkedId))
      );
    },
    [drawer, baseplate, designKinds, designOverhangs]
  );
}

/** How far a placed bin's body reaches past its footprint, per axis: {@link useBinOverhang}. */
export function useBinOverhangSpan(): (bin: PlacedBin) => OverhangSpan {
  const overhangFor = useBinOverhang();
  return useCallback(
    (bin) => {
      const o = resolveOverhang(overhangFor(bin));
      return { width: o.left + o.right, depth: o.front + o.back };
    },
    [overhangFor]
  );
}
