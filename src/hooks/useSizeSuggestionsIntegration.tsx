/**
 * App-level integration hook for size suggestions in the Grid.
 *
 * Lives at app level (not in a feature) because it orchestrates across
 * size-suggestions and grid-editor features, respecting module boundaries.
 */

import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useLabsStore } from '@/core/store/labs';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useUndoableAction } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import { isOk } from '@/core/result';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { useSizeSuggestions } from '@/features/size-suggestions/hooks';
import { NextBinPreview, SuggestionGhost } from '@/features/size-suggestions';
import type { SizeSuggestion } from '@/features/size-suggestions/types';

interface SizeSuggestionsOverlayProps {
  cellSize: number;
  gap: number;
  activeLayerId: string;
  activeLayerHeight: number;
}

interface UseSizeSuggestionsIntegrationReturn {
  enabled: boolean;
  SizeSuggestionsOverlay: ((props: SizeSuggestionsOverlayProps) => ReactNode) | null;
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

  useEffect(() => {
    if (enabled) {
      fetchSuggestions();
    }
  }, [enabled, fetchSuggestions]);

  const handleAcceptSuggestion = useCallback(
    (suggestion: SizeSuggestion, activeLayerId: string, layerHeight: number) => {
      const pos = suggestion.position;
      if (!pos) return;

      const [width, depth] = suggestion.size.split('x').map(Number);
      if (!width || !depth) return;

      execute(() => {
        const result = addBin({
          x: pos.x,
          y: pos.y,
          width,
          depth,
          height: layerHeight,
          layerId: activeLayerId,
          category: activeCategoryId,
        });

        if (isOk(result)) {
          setSelectedBins([result.value]);
          mlTracking.trackPlacement(
            {
              id: result.value,
              x: pos.x,
              y: pos.y,
              width,
              depth,
              height: layerHeight,
              layerId: activeLayerId,
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
    return { enabled: false, SizeSuggestionsOverlay: null };
  }

  const SizeSuggestionsOverlay = ({
    cellSize,
    gap,
    activeLayerId,
    activeLayerHeight,
  }: SizeSuggestionsOverlayProps): ReactNode => (
    <>
      <SuggestionGhost cellSize={cellSize} gap={gap} categoryColor={activeCategoryColor} />
      <NextBinPreview
        onAccept={(s) => handleAcceptSuggestion(s, activeLayerId, activeLayerHeight)}
        categoryColor={activeCategoryColor}
      />
    </>
  );

  return { enabled: true, SizeSuggestionsOverlay };
}
