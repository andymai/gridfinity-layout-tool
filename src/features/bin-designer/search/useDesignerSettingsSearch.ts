import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { categoryForControl } from '@/features/bin-designer/settingsManifest';
import {
  DESIGNER_CATEGORIES,
  type PageCategory,
} from '@/features/bin-designer/components/BinPanelShell/categoryDefs';
import {
  DESIGNER_CONTROL_SEARCH,
  DESIGNER_OPTION_RECORDS,
  isDesignerControlAvailable,
  type ControlAvailabilityContext,
} from './designerControlRegistry';
import { matchRecords, type HighlightRange, type SearchableRecord } from './matcher';

export interface DesignerSearchResult {
  id: string;
  /** The section marker the selection jumps to. */
  controlId: string;
  label: string;
  /** Parent section title, shown as a breadcrumb on sub-option results. */
  breadcrumb?: string;
  category: PageCategory;
  categoryLabel: string;
  /** Label ranges to highlight (search results only). */
  highlight: readonly HighlightRange[];
  kind: 'section' | 'option';
}

interface ResultMeta {
  kind: 'section' | 'option';
  controlId: string;
  category: PageCategory;
  categoryLabel: string;
  breadcrumb?: string;
}

const CATEGORY_ORDER = new Map(DESIGNER_CATEGORIES.map((c, i) => [c.id, i]));
const CATEGORY_LABEL_KEY = new Map(DESIGNER_CATEGORIES.map((c) => [c.id, c.labelKey]));
const TITLE_KEY_OF_SECTION = new Map(DESIGNER_CONTROL_SEARCH.map((s) => [s.controlId, s.titleKey]));

const toResult = (r: {
  id: string;
  label: string;
  meta: ResultMeta;
  highlight?: readonly HighlightRange[];
}): DesignerSearchResult => ({
  id: r.id,
  controlId: r.meta.controlId,
  label: r.label,
  breadcrumb: r.meta.breadcrumb,
  category: r.meta.category,
  categoryLabel: r.meta.categoryLabel,
  highlight: r.highlight ?? [],
  kind: r.meta.kind,
});

/**
 * Filters the designer's search index by a free-text query. An empty query
 * returns the SECTION records ordered by category (the browse view). A non-empty
 * query runs the ranked matcher over both sections and their finer sub-options,
 * returning breadcrumbed, highlighted results. Records whose section is not
 * mounted for the current params/view are always excluded so a jump never
 * dead-ends.
 */
export function useDesignerSettingsSearch(
  query: string,
  ctx: ControlAvailabilityContext
): DesignerSearchResult[] {
  const t = useTranslation();

  return useMemo(() => {
    const categoryLabel = (category: PageCategory): string => {
      const key = CATEGORY_LABEL_KEY.get(category);
      return key ? t(key) : category;
    };

    // Section records (always in play; the browse view uses only these).
    const sections = DESIGNER_CONTROL_SEARCH.filter((s) =>
      isDesignerControlAvailable(s.controlId, ctx)
    ).flatMap((s): SearchableRecord<ResultMeta>[] => {
      const category = categoryForControl(s.controlId);
      if (!category) return [];
      return [
        {
          id: s.controlId,
          label: t(s.titleKey),
          keywords: t(s.keywordsKey).split('|'),
          meta: {
            kind: 'section',
            controlId: s.controlId,
            category,
            categoryLabel: categoryLabel(category),
          },
        },
      ];
    });

    if (!query.trim()) {
      return [...sections]
        .sort(
          (a, b) =>
            (CATEGORY_ORDER.get(a.meta.category) ?? 0) -
              (CATEGORY_ORDER.get(b.meta.category) ?? 0) || a.label.localeCompare(b.label)
        )
        .map(toResult);
    }

    // Finer sub-options join the sections only once the user is searching.
    const options = DESIGNER_OPTION_RECORDS.filter((o) =>
      isDesignerControlAvailable(o.section, ctx)
    ).flatMap((o): SearchableRecord<ResultMeta>[] => {
      const category = categoryForControl(o.section);
      const titleKey = TITLE_KEY_OF_SECTION.get(o.section);
      if (!category) return [];
      return [
        {
          id: o.id,
          label: t(o.labelKey),
          keywords: o.keywords,
          meta: {
            kind: 'option',
            controlId: o.section,
            category,
            categoryLabel: categoryLabel(category),
            breadcrumb: titleKey ? t(titleKey) : undefined,
          },
        },
      ];
    });

    return matchRecords(query, [...sections, ...options]).map(toResult);
  }, [query, ctx, t]);
}
