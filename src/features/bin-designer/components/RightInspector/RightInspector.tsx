/**
 * Desktop right column: a collapsible contextual inspector. Mirrors the cutout
 * InspectorDock chrome for visual consistency in the same screen slot.
 *
 * Mounted only in the desktop branch of DesignerMainContent; the mode gate
 * (useRightInspectorVisible) returns null in cutout/solid/non-bin contexts so
 * it never collides with the cutout workspace's own dock.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { RightInspectorBody } from './RightInspectorBody';
import { useRightInspectorVisible } from './useRightInspectorVisible';
import { useSelectedElement, type SelectedElement } from './useSelectedElement';
import { loadRightInspectorCollapsed, saveRightInspectorCollapsed } from './rightInspectorStorage';

/** Below this viewport width the inspector starts collapsed so the canvas keeps
 *  room between the two 288px panels (the user's later choice is remembered). */
const OPEN_BY_DEFAULT_MIN_WIDTH = 1200;

const ICON_BTN =
  'flex-shrink-0 rounded-md p-1.5 text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content';

function Icon({ paths }: { readonly paths: readonly string[] }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      {paths.map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

/** A change in this key marks a genuinely new selection (vs. a re-render), driving
 *  the auto-expand + scroll-to-top effect below. */
function selectionKeyOf(selected: SelectedElement | null): string | null {
  if (!selected) return null;
  switch (selected.kind) {
    case 'compartment':
      return `c:${selected.id}`;
    case 'divider':
      return `d:${selected.key}`;
    case 'colorZone':
      return `z:${selected.zone}`;
  }
}

export function RightInspector() {
  const t = useTranslation();
  const visible = useRightInspectorVisible();
  const selected = useSelectedElement();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    const stored = loadRightInspectorCollapsed();
    if (stored !== null) return stored;
    return typeof window !== 'undefined' && window.innerWidth < OPEN_BY_DEFAULT_MIN_WIDTH;
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveRightInspectorCollapsed(next);
      return next;
    });
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 0);
  }, []);

  // A new selection auto-expands the rail and scrolls the pinned editor into
  // view, so a click in the 2D editor always reveals the thing it selected.
  const selectionKey = selectionKeyOf(selected);
  useEffect(() => {
    if (!selectionKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to an external selection change from the designer store
    setCollapsed((prev) => {
      if (prev) saveRightInspectorCollapsed(false);
      return false;
    });
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectionKey]);

  if (!visible) return null;

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-shrink-0 flex-col items-center border-l border-stroke-subtle bg-surface-secondary py-2">
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={toggleCollapsed}
          className={ICON_BTN}
          aria-expanded={false}
          aria-label={t('binDesigner.inspector.expand')}
          title={t('binDesigner.inspector.expand')}
        >
          <Icon paths={ICON_PATHS.chevronDoubleLeft} />
        </IconButton>
        <span
          className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-content-tertiary"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t('binDesigner.inspector.title')}
        </span>
      </aside>
    );
  }

  return (
    <aside className="animate-fade-in flex w-72 flex-shrink-0 flex-col overflow-hidden border-l border-stroke-subtle bg-surface-secondary">
      <div
        className={`flex flex-shrink-0 items-center gap-2 border-b border-stroke-subtle px-4 py-2 transition-shadow duration-200 ${
          isScrolled ? 'shadow-elevated' : ''
        }`}
      >
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={toggleCollapsed}
          className={ICON_BTN}
          aria-expanded
          aria-label={t('binDesigner.inspector.collapse')}
          title={t('binDesigner.inspector.collapse')}
        >
          <Icon paths={ICON_PATHS.chevronDoubleRight} />
        </IconButton>
        <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
          {t('binDesigner.inspector.title')}
        </span>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
      >
        <RightInspectorBody />
      </div>
    </aside>
  );
}
