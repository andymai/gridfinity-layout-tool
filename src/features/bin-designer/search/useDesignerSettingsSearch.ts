import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { categoryForControl } from '@/features/bin-designer/settingsManifest';
import {
  DESIGNER_CATEGORIES,
  type PageCategory,
} from '@/features/bin-designer/components/BinPanelShell/categoryDefs';
import {
  DESIGNER_CONTROL_SEARCH,
  isDesignerControlAvailable,
  type ControlAvailabilityContext,
} from './designerControlRegistry';

export interface DesignerControlSearchResult {
  controlId: string;
  label: string;
  description: string;
  category: PageCategory;
  categoryLabel: string;
}

const CATEGORY_ORDER = new Map(DESIGNER_CATEGORIES.map((c, index) => [c.id, index]));
const CATEGORY_LABEL_KEY = new Map(DESIGNER_CATEGORIES.map((c) => [c.id, c.labelKey]));

/**
 * Filters the designer's controls by a free-text query, matching against each
 * control's label and synonym keywords and ranking label-prefix > word-prefix >
 * substring (the same scoring as the global settings search). An empty query
 * returns every currently-available control ordered by category, so the bar
 * doubles as a browse-all list. Controls whose section is not mounted for the
 * current params/view are always left out, so a result never dead-ends a jump.
 */
export function useDesignerSettingsSearch(
  query: string,
  ctx: ControlAvailabilityContext
): DesignerControlSearchResult[] {
  const t = useTranslation();

  return useMemo(() => {
    const available = DESIGNER_CONTROL_SEARCH.filter((entry) =>
      isDesignerControlAvailable(entry.controlId, ctx)
    ).flatMap((entry) => {
      const category = categoryForControl(entry.controlId);
      if (!category) return [];
      const labelKey = CATEGORY_LABEL_KEY.get(category);
      return [
        {
          entry,
          category,
          result: {
            controlId: entry.controlId,
            label: t(entry.titleKey),
            description: t(entry.descriptionKey),
            category,
            categoryLabel: labelKey ? t(labelKey) : category,
          } satisfies DesignerControlSearchResult,
        },
      ];
    });

    const needle = query.trim().toLowerCase();

    if (!needle) {
      return available
        .sort(
          (a, b) =>
            (CATEGORY_ORDER.get(a.category) ?? 0) - (CATEGORY_ORDER.get(b.category) ?? 0) ||
            a.result.label.localeCompare(b.result.label)
        )
        .map((item) => item.result);
    }

    return available
      .map((item) => {
        const label = item.result.label.toLowerCase();
        const keywords = t(item.entry.keywordsKey).toLowerCase();
        let score = -1;
        if (label.startsWith(needle)) score = 3;
        else if (label.split(/\s+/).some((word) => word.startsWith(needle))) score = 2;
        else if (`${label} ${keywords}`.includes(needle)) score = 1;
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort(({ item: a, score: sa }, { item: b, score: sb }) => {
        if (sb !== sa) return sb - sa;
        return a.result.label.localeCompare(b.result.label);
      })
      .map(({ item }) => item.result);
  }, [query, ctx, t]);
}
