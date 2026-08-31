/**
 * The designer panel's rail shell: a vertical icon rail of task categories
 * beside per-category pages, replacing the old single-scroll accordion stack.
 *
 * Each page keeps its own scroll position (panels stay mounted), the active
 * category persists across sessions, and help-jump deep links re-route to the
 * owning category through the settings manifest before the dispatcher scrolls
 * to the target control.
 *
 * The 'selection' rail slot is a disabled placeholder until the contextual
 * selection page ships.
 */

import { useCallback, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { SidePanel, Tabs, Tooltip, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { HELP_JUMP_EVENT_PREFIX, type HelpJumpEventDetail } from '@/shared/help/helpJumpDispatcher';
import { useDesignerStore } from '@/features/bin-designer/store';
import { categoryForControl } from '@/features/bin-designer/settingsManifest';
import type { DesignerCategory } from '@/features/bin-designer/types';
import { DESIGNER_CATEGORIES, type PageCategory } from './categoryDefs';
import { loadLastCategory, saveLastCategory } from './railPrefsStorage';

/** The five legacy help surfaces the old accordion listened on. */
const HELP_SURFACES = [
  'binDesigner',
  'binDesigner:shape',
  'binDesigner:interior',
  'binDesigner:base',
  'binDesigner:lid',
  'binDesigner:finishing',
] as const;

function CategoryIcon({ paths }: { readonly paths: readonly string[] }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

export interface BinPanelShellProps {
  /**
   * docked = desktop chrome (resizable, collapsible SidePanel frame);
   * plain = a plain column for the narrow shells, rail rendered horizontally.
   */
  readonly frame: 'docked' | 'plain';
  /** Pinned at the very top, above the header: the control search bar. */
  readonly searchBar?: ReactNode;
  /** Pinned above the rail: community card, variant section. */
  readonly header?: ReactNode;
  /** Page content per category. */
  readonly pages: Readonly<Record<PageCategory, ReactNode>>;
  /** Rendered at the bottom of every page's scroll region. */
  readonly pageFooter?: ReactNode;
  /** Wraps the page region (e.g. VariantLock); the rail stays outside it. */
  readonly wrapPages?: (pages: ReactNode) => ReactNode;
  /** Rail tooltip per category, shown after the category name. */
  readonly summaries?: Partial<Record<PageCategory, string>>;
  /** Categories holding a non-default value, marked with a dot on the rail. */
  readonly modified?: Partial<Record<PageCategory, boolean>>;
  /** Categories needing attention (e.g. the bin no longer fits the bed). */
  readonly warnings?: Partial<Record<PageCategory, boolean>>;
  /** Pinned below everything, outside the scroll (user dock). */
  readonly dock?: ReactNode;
}

export function BinPanelShell({
  frame,
  searchBar,
  header,
  pages,
  pageFooter,
  wrapPages,
  summaries,
  modified,
  warnings,
  dock,
}: BinPanelShellProps) {
  const t = useTranslation();
  const activeCategory = useDesignerStore((s) => s.ui.activeCategory);
  const setActiveCategory = useDesignerStore((s) => s.setActiveCategory);

  // Hydrate the last-used category once, before first paint.
  useLayoutEffect(() => {
    const saved = loadLastCategory();
    if (saved) setActiveCategory(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydration
  }, []);

  const handleChange = useCallback(
    (id: DesignerCategory) => {
      setActiveCategory(id);
      saveLastCategory(id);
    },
    [setActiveCategory]
  );

  // A help deep link names a control; open its owning category first so the
  // dispatcher's DOM watch finds the target visible.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HelpJumpEventDetail>).detail;
      const category = detail?.controlId ? categoryForControl(detail.controlId) : undefined;
      if (category) {
        setActiveCategory(category);
        saveLastCategory(category);
      }
    };
    for (const surface of HELP_SURFACES) {
      window.addEventListener(`${HELP_JUMP_EVENT_PREFIX}${surface}`, handler);
    }
    return () => {
      for (const surface of HELP_SURFACES) {
        window.removeEventListener(`${HELP_JUMP_EVENT_PREFIX}${surface}`, handler);
      }
    };
  }, [setActiveCategory]);

  const vertical = frame === 'docked';

  const tabs = [
    {
      id: 'selection' as DesignerCategory,
      label: <CategoryIcon paths={ICON_PATHS.pointer} />,
      'aria-label': t('binDesigner.category.selection'),
      disabled: true,
    },
    ...DESIGNER_CATEGORIES.map(({ id, labelKey, iconPaths }) => {
      const label = t(labelKey);
      const summary = summaries?.[id];
      return {
        id: id,
        label: (
          <Tooltip
            content={summary ? `${label} · ${summary}` : label}
            placement={vertical ? 'right' : 'bottom'}
          >
            <span className="relative inline-flex">
              <CategoryIcon paths={iconPaths} />
              {warnings?.[id] ? (
                <span
                  aria-hidden="true"
                  data-testid="rail-warning-dot"
                  className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-warning"
                />
              ) : (
                modified?.[id] && (
                  <span
                    aria-hidden="true"
                    data-testid="rail-modified-dot"
                    className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-accent"
                  />
                )
              )}
            </span>
          </Tooltip>
        ),
        'aria-label': label,
      };
    }),
  ];

  const pageRegion = (
    <div className="relative h-full">
      {DESIGNER_CATEGORIES.map(({ id }) => (
        <Tabs.Panel
          key={id}
          tabId={id}
          activeTab={activeCategory}
          keepMounted
          className="relative h-full overflow-y-auto scrollbar-thin"
        >
          {pages[id]}
          {pageFooter}
        </Tabs.Panel>
      ))}
    </div>
  );

  const body = (
    <Tabs.Root>
      <div className={cn('flex min-h-0 flex-1', vertical ? 'flex-row' : 'flex-col')}>
        <Tabs.List
          tabs={tabs}
          activeTab={activeCategory}
          onChange={handleChange}
          aria-label={t('binDesigner.category.rail')}
          orientation={vertical ? 'vertical' : 'horizontal'}
          visual={vertical ? 'iconRail' : 'pill'}
          className={cn(
            'flex-shrink-0',
            vertical
              ? 'border-r border-stroke-subtle'
              : 'justify-center gap-1 border-b border-stroke-subtle px-2 py-1'
          )}
        />
        <div className="min-h-0 min-w-0 flex-1">
          {wrapPages ? wrapPages(pageRegion) : pageRegion}
        </div>
      </div>
    </Tabs.Root>
  );

  const column = (
    <div className="flex h-full min-h-0 flex-col">
      {searchBar}
      {header}
      {body}
      {dock}
    </div>
  );

  if (frame === 'plain') {
    return column;
  }

  return (
    <SidePanel.Root
      side="left"
      minWidth={280}
      maxWidth={480}
      defaultWidth={320}
      persistKey="gridfinity-designer-panel"
      labels={{
        collapse: t('binDesigner.panel.collapse'),
        expand: t('binDesigner.panel.expand'),
        resize: t('binDesigner.panel.resize'),
      }}
      railTitle={t('binDesigner.panel.railTitle')}
    >
      {column}
    </SidePanel.Root>
  );
}
