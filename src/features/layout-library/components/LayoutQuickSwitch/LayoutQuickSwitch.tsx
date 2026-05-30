import { useCallback, useEffect, useRef, useState } from 'react';
import { useLayoutSwitcher } from '@/shared/hooks';
import { LayoutThumbnail } from '@/shell/LayoutThumbnail';
import { layoutId } from '@/core/types';
import { useTranslation } from '@/i18n';

interface LayoutQuickSwitchProps {
  /** Opens the (management-only) layout manager modal. */
  onManage: () => void;
}

/**
 * Header control that shows the active layout's thumbnail and switches layouts
 * in one click via a thumbnail dropdown. Layouts are recognized by shape, so
 * the trigger leads with the preview rather than text. Management (rename,
 * delete, share, import) lives behind "Manage…".
 */
export function LayoutQuickSwitch({ onManage }: LayoutQuickSwitchProps) {
  const t = useTranslation();
  const { activeLayoutId, library, switchLayout, createNewLayout } = useLayoutSwitcher();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasLayouts = library.entries.length > 0;
  const activeEntry = library.entries.find((e) => e.id === activeLayoutId) ?? library.entries[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSwitch = useCallback(
    async (id: string) => {
      setOpen(false);
      if (id === activeLayoutId) return;
      await switchLayout(layoutId(id));
    },
    [activeLayoutId, switchLayout]
  );

  const handleNew = useCallback(async () => {
    setOpen(false);
    await createNewLayout();
  }, [createNewLayout]);

  if (!hasLayouts) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.switchLayout', { name: activeEntry.name })}
      >
        <span className="flex h-6 w-8 items-center justify-center overflow-hidden rounded border border-stroke-subtle bg-surface">
          <LayoutThumbnail
            preview={activeEntry.preview}
            size={30}
            className="max-h-full max-w-full"
          />
        </span>
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-64 overflow-auto rounded-lg border border-stroke bg-surface-elevated py-1 shadow-lg"
        >
          {library.entries.map((entry) => {
            const isActive = entry.id === activeLayoutId;
            return (
              <button
                key={entry.id}
                role="menuitem"
                onClick={() => void handleSwitch(entry.id)}
                className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover ${
                  isActive ? 'text-content' : 'text-content-secondary'
                }`}
              >
                <span className="flex h-8 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-stroke-subtle bg-surface">
                  <LayoutThumbnail
                    preview={entry.preview}
                    size={38}
                    className="max-h-full max-w-full"
                  />
                </span>
                <span className="min-w-0 flex-1 truncate" title={entry.name}>
                  {entry.name}
                </span>
                {isActive && (
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-label={t('layouts.active')}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}

          <div className="my-1 border-t border-stroke-subtle" />

          <button
            role="menuitem"
            onClick={() => void handleNew()}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t('layouts.newLayout')}
          </button>

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm text-content-secondary transition-colors hover:bg-surface-hover hover:text-content"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {t('header.manageLayouts')}
          </button>
        </div>
      )}
    </div>
  );
}
