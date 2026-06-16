/**
 * Overlay components rendered alongside the 3D canvas:
 *   - `TouchHint`: first-visit-only mobile gesture hint, persisted by
 *     `dismissedHints[]` in settings.
 *   - `GeneratingIndicator`: SimCity-style cycling loading messages shown
 *     during mesh regeneration.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { IconButton } from '@/design-system';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion';
import { useTranslation } from '@/i18n';

export function TouchHint() {
  const t = useTranslation();
  const { isTouchDevice, isDesktop } = useResponsive();
  const [dismissed, setDismissed] = useState(false);
  const alreadyDismissed = useSettingsStore((s) =>
    s.settings.dismissedHints.includes('designer-touch')
  );

  const visible = !dismissed && isTouchDevice && !isDesktop && !alreadyDismissed;

  const dismiss = useCallback(() => {
    setDismissed(true);
    const { settings, updateSetting } = useSettingsStore.getState();
    // Dedupe — multiple tabs / stale local state could otherwise push the
    // same id repeatedly and bloat the persisted list.
    if (settings.dismissedHints.includes('designer-touch')) return;
    updateSetting('dismissedHints', [...settings.dismissedHints, 'designer-touch']);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-3 flex justify-center"
      role="status"
      aria-label={t('binDesigner.touchGestureHints')}
    >
      <div className="flex items-center gap-3 rounded-full bg-black/70 px-4 py-2 text-[11px] text-white shadow-lg backdrop-blur-sm">
        <span>{t('binDesigner.dragToOrbit')}</span>
        <span className="h-3 w-px bg-white/30" />
        <span>{t('binDesigner.pinchToZoom')}</span>
        <span className="h-3 w-px bg-white/30" />
        <span>{t('binDesigner.doubleTapToReset')}</span>
        <IconButton
          variant="ghost"
          touchTarget={false}
          onClick={dismiss}
          className="ml-1 rounded-full p-2 hover:bg-white/20 min-w-[36px] min-h-[36px]"
          aria-label={t('binDesigner.dismissTouchHints')}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path d="M3 3l6 6M9 3l-6 6" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}

/** Number of nostalgic loading messages (SimCity/Maxis-inspired) available in i18n */
const LOADING_MESSAGE_COUNT = 12;

/**
 * Nostalgic loading indicator that cycles through SimCity-style messages.
 * Shows at the bottom center of the 3D preview during mesh regeneration.
 */
export function GeneratingIndicator() {
  const t = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduceMotionSetting = useSettingsStore((s) => s.settings.reduceMotion);
  const reduceMotion = prefersReducedMotion || reduceMotionSetting;

  const loadingMessages = useMemo(
    () =>
      Array.from({ length: LOADING_MESSAGE_COUNT }, (_, i) => t(`binDesigner.loadingMessage.${i}`)),
    [t]
  );

  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGE_COUNT)
  );

  // Cycle through messages every 1.5 seconds; skip when motion is reduced.
  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGE_COUNT);
    }, 1500);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  return (
    <div
      className="absolute inset-x-0 bottom-4 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 rounded-lg border border-stroke-subtle bg-surface-elevated/95 px-4 py-2 font-mono text-xs shadow-lg backdrop-blur-sm">
        <svg
          className="h-4 w-4 shrink-0 text-accent animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-80"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-content-secondary">{loadingMessages[messageIndex]}</span>
      </div>
    </div>
  );
}
