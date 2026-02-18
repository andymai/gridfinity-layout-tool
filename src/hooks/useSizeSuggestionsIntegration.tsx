/**
 * App-level integration hook for size suggestions in the Grid.
 *
 * Lives at app level (not in a feature) because it orchestrates across
 * size-suggestions and grid-editor features, respecting module boundaries.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLabsStore } from '@/core/store/labs';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useUndoableAction } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { isOk } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { LayerId } from '@/core/types';
import { useSizeSuggestions } from '@/features/size-suggestions/hooks';
import type { SizeSuggestion } from '@/features/size-suggestions/types';
import { parseSize } from '@/features/size-suggestions/utils/parseSize';

export interface SizeSuggestionsOverlayProps {
  cellSize: number;
  gap: number;
  activeLayerId: LayerId;
  activeLayerHeight: number;
  onAccept: (suggestion: SizeSuggestion, layerId: LayerId, layerHeight: number) => void;
  categoryColor: string;
}

interface UseSizeSuggestionsIntegrationReturn {
  enabled: boolean;
  overlayProps: {
    onAccept: (suggestion: SizeSuggestion, layerId: LayerId, layerHeight: number) => void;
    categoryColor: string;
  } | null;
}

export function useSizeSuggestionsIntegration(): UseSizeSuggestionsIntegrationReturn {
  const enabled = useLabsStore((s) => s.isFeatureEnabled('size-suggestions'));
  const { debouncedFetch, fetchSuggestions } = useSizeSuggestions();
  const { addBin } = useMutations();
  const { execute } = useUndoableAction();
  const activeCategoryId = useSelectionStore((s) => s.activeCategoryId);
  const setSelectedBins = useSelectionStore((s) => s.setSelectedBins);

  const categories = useLayoutStore((s) => s.layout.categories);
  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId),
    [categories, activeCategoryId]
  );
  const activeCategoryColor = activeCategory?.color ?? '#6366f1';

  const hasInitialFetchRef = useRef(false);
  useEffect(() => {
    if (enabled && !hasInitialFetchRef.current) {
      hasInitialFetchRef.current = true;
      fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fetch on initial enable
  }, [enabled]);

  const handleAcceptSuggestion = useCallback(
    (suggestion: SizeSuggestion, layerId: LayerId, layerHeight: number) => {
      const pos = suggestion.position;
      if (!pos) return;

      const dims = parseSize(suggestion.size);
      if (!dims) return;

      execute(() => {
        const result = addBin({
          x: pos.x,
          y: pos.y,
          width: dims.width,
          depth: dims.depth,
          height: layerHeight,
          layerId,
          category: activeCategoryId,
          label: '',
          notes: '',
        });

        if (isOk(result)) {
          setSelectedBins([result.value]);
          mlTracking.trackPlacement(
            {
              id: result.value,
              x: pos.x,
              y: pos.y,
              width: dims.width,
              depth: dims.depth,
              height: layerHeight,
              layerId,
              category: activeCategoryId,
              label: '',
              notes: '',
            },
            'suggestion'
          );
          debouncedFetch();
        }
      });
    },
    [activeCategoryId, addBin, execute, setSelectedBins, debouncedFetch]
  );

  if (!enabled) {
    return { enabled: false, overlayProps: null };
  }

  return {
    enabled: true,
    overlayProps: {
      onAccept: handleAcceptSuggestion,
      categoryColor: activeCategoryColor,
    },
  };
}
