import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useMenuKeyboardNav } from '@/shared/hooks/useMenuKeyboardNav';
import { useCustomBins } from '../../hooks/useCustomBins';
import { useDesignerStore } from '../../store';
import { layoutDesigns } from './layoutDesigns';
import type { LayoutDesign } from './layoutDesigns';

const ITEM_CLASS =
  'w-full justify-start gap-2.5 rounded-none px-2.5 py-2 text-left text-sm font-normal hover:bg-surface-hover';

export function LayoutDesignSwitch() {
  const t = useTranslation();
  const registry = useCustomBins();
  const { bins, categories, layoutName } = useLayoutStore(
    useShallow((s) => ({
      bins: s.layout.bins,
      categories: s.layout.categories,
      layoutName: s.layout.name,
    }))
  );
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const setDesignListOpen = useDesignerStore((s) => s.setDesignListOpen);
  const { navigateToDesign, designIdFromUrl } = useDesignerRouting();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const closeMenu = useCallback(() => setOpen(false), []);
  const onMenuKeyDown = useMenuKeyboardNav({ isOpen: open, menuRef, onClose: closeMenu });

  const entries = useMemo(
    () => layoutDesigns(bins, categories, registry),
    [bins, categories, registry]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Closing removes the focused item. Hand focus back to the chevron, unless
  // the chosen action already moved it (All designs opens a dialog).
  useEffect(() => {
    if (wasOpen.current && !open) {
      const lost = document.activeElement === null || document.activeElement === document.body;
      if (lost) triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const handleSwitch = useCallback(
    (entry: LayoutDesign) => {
      setOpen(false);
      // While another pick is still loading the URL names it, and navigating
      // back here is what supersedes it.
      if (entry.design.id === currentDesignId && designIdFromUrl === currentDesignId) return;
      navigateToDesign(entry.design.id, entry.binId);
    },
    [currentDesignId, designIdFromUrl, navigateToDesign]
  );

  if (entries.length === 0) return null;

  const label = t('binDesigner.layoutSwitch.open');

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-8 px-1.5 text-content-secondary hover:bg-surface-hover hover:text-content"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          aria-label={layoutName}
          className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-72 overflow-auto rounded-lg border border-stroke bg-surface-elevated py-1 shadow-lg"
        >
          <div className="truncate px-2.5 pb-0.5 pt-2 text-xs font-medium uppercase tracking-wider text-content-tertiary">
            {layoutName}
          </div>
          {entries.map((entry) => {
            const isActive = entry.design.id === currentDesignId;
            const { width, depth, height } = entry.design;
            return (
              <Button
                key={entry.design.id}
                variant="ghost"
                fullWidth
                role="menuitem"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => handleSwitch(entry)}
                className={`${ITEM_CLASS} ${isActive ? 'text-content' : 'text-content-secondary'}`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-stroke-subtle"
                  style={entry.color ? { backgroundColor: entry.color } : undefined}
                />
                <span className="min-w-0 flex-1 truncate" title={entry.design.name}>
                  {entry.design.name}
                </span>
                <span className="flex-shrink-0 text-xs tabular-nums text-content-tertiary">
                  {`${width}×${depth} · ${height}u`}
                </span>
                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                  {isActive && (
                    <svg
                      className="h-4 w-4 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
              </Button>
            );
          })}

          <div className="my-1 border-t border-stroke-subtle" />

          <Button
            variant="ghost"
            fullWidth
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setDesignListOpen(true);
            }}
            className={`${ITEM_CLASS} text-content-secondary hover:text-content`}
          >
            {t('binDesigner.layoutSwitch.allDesigns')}
          </Button>
        </div>
      )}
    </div>
  );
}
