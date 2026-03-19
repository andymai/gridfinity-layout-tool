import { useState, useCallback, useRef, useEffect } from 'react';
import { useLayoutSwitcher } from '@/hooks';
import { useToastStore } from '@/core/store/toast';
import { useMobileStore } from '@/core/store/mobile';
import { useInteractionStore } from '@/core/store/interaction';
import { isOk } from '@/core/result';
import { layoutId } from '@/core/types';
import { trackEvent } from '@/shared/analytics/posthog';
import { useResponsive } from '@/shared/hooks';
import { useTranslation } from '@/i18n';
import { INSPIRATION_LAYOUTS } from '@/features/inspiration-gallery/data';
import { LayoutThumbnailWithLabels } from '@/features/inspiration-gallery/components/LayoutThumbnailWithLabels';
import { THEME_CONFIG } from '@/features/inspiration-gallery/types';
import type { InspirationLayout } from '@/features/inspiration-gallery/types';

// Curated templates — hand-picked for diversity and visual impact

/** Template IDs shown in the welcome modal (popularity + diversity balanced) */
const CURATED_TEMPLATE_IDS = [
  'screw-organizer', // Workshop — most popular, half-bins showcase
  'hand-tools', // Workshop — familiar items
  'cutlery-drawer', // Kitchen — universal recognition
  'desk-drawer', // Office — relatable
  '3d-printing-supplies', // Hobby — core audience
  'edc-drawer', // Personal — compact, visually interesting
  'craft-supplies', // Hobby — creative audience
  'battery-drawer', // Workshop — simple, clean layout
];

const CURATED_TEMPLATES: InspirationLayout[] = CURATED_TEMPLATE_IDS.map((id) =>
  INSPIRATION_LAYOUTS.find((l) => l.id === id)
).filter((l): l is InspirationLayout => l !== undefined);

if (import.meta.env.DEV && CURATED_TEMPLATES.length !== CURATED_TEMPLATE_IDS.length) {
  const found = new Set(CURATED_TEMPLATES.map((l) => l.id));
  const missing = CURATED_TEMPLATE_IDS.filter((id) => !found.has(id));

  throw new Error(
    `[WelcomeModal] Missing template IDs in INSPIRATION_LAYOUTS: ${missing.join(', ')}`
  );
}

// Component

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: (method: 'template' | 'blank') => void;
}

/**
 * Wrapper that only mounts content when open (fresh state on each open).
 */
export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  if (!isOpen) return null;
  return <WelcomeModalContent onClose={onClose} />;
}

function WelcomeModalContent({ onClose }: { onClose: (method: 'template' | 'blank') => void }) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const [isImporting, setIsImporting] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const modalRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { importLayoutFromJSON, switchLayout } = useLayoutSwitcher();
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);
  const closeMobilePanel = useMobileStore((state) => state.closeMobilePanel);
  const addToast = useToastStore((state) => state.addToast);

  // Track modal shown
  useEffect(() => {
    trackEvent('onboarding_welcome_shown', { template_count: CURATED_TEMPLATES.length });
  }, []);

  // Focus trap: focus modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose('blank');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleTemplateSelect = useCallback(
    async (layout: InspirationLayout) => {
      if (isImporting) return;

      setIsImporting(true);
      trackEvent('onboarding_template_selected', {
        template_id: layout.id,
        template_name: layout.name,
        template_theme: layout.theme,
        bin_count: layout.metrics.binCount,
      });

      try {
        const result = await importLayoutFromJSON(
          { ...layout.layout, name: layout.name },
          { name: layout.name, author: 'Gridfinity Templates' }
        );

        if (isOk(result)) {
          const switchResult = await switchLayout(layoutId(result.value));
          if (isOk(switchResult)) {
            addToast(t('toast.galleryAdded', { name: layout.name }), 'success');
            announceToScreenReader(t('toast.galleryAdded', { name: layout.name }));
            trackEvent('onboarding_template_imported', {
              template_id: layout.id,
              template_name: layout.name,
              success: true,
            });
          }
          closeMobilePanel();
          onClose('template');
        } else {
          addToast(t('toast.galleryAddFailed'), 'error');
          trackEvent('onboarding_template_imported', {
            template_id: layout.id,
            template_name: layout.name,
            success: false,
          });
        }
      } finally {
        setIsImporting(false);
      }
    },
    [
      isImporting,
      importLayoutFromJSON,
      switchLayout,
      addToast,
      announceToScreenReader,
      closeMobilePanel,
      onClose,
      t,
    ]
  );

  // Grid keyboard navigation
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!gridRef.current) return;

      const cards = gridRef.current.querySelectorAll('[data-welcome-card]');
      const cardCount = cards.length;
      if (cardCount === 0) return;

      const cols = 4;
      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          newIndex = Math.min(focusedIndex + 1, cardCount - 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = Math.max(focusedIndex - 1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newIndex = Math.min(focusedIndex + cols, cardCount - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIndex = Math.max(focusedIndex - cols, 0);
          break;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        (cards[newIndex] as HTMLElement).focus();
      }
    },
    [focusedIndex]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose('blank');
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('onboarding.welcome.title')}
        tabIndex={-1}
        className={`
          bg-surface rounded-2xl shadow-2xl overflow-hidden
          flex flex-col
          focus:outline-none
          ${isMobile ? 'w-full h-full rounded-none' : 'w-full max-w-3xl max-h-[90vh]'}
        `}
      >
        {isMobile ? (
          /* Mobile — desktop nudge + single action */
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <h1 className="text-2xl font-bold text-content mb-3">
              {t('onboarding.welcome.title')}
            </h1>
            <p className="text-sm text-content-secondary mb-8 max-w-xs">
              {t('onboarding.welcome.desktopNudge')}
            </p>
            <button
              onClick={() => onClose('blank')}
              className="btn btn-primary px-8 py-2.5 text-sm font-semibold rounded-lg"
              disabled={isImporting}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
              autoFocus
            >
              {t('onboarding.welcome.startDesigning')}
            </button>
          </div>
        ) : (
          /* Desktop — hero + template showcase (unchanged) */
          <>
            {/* Hero — compact, confident, one clear action */}
            <div className="px-6 pt-8 pb-5 text-center flex-shrink-0">
              <h1 className="text-2xl font-bold text-content mb-1.5">
                {t('onboarding.welcome.title')}
              </h1>
              <p className="text-sm text-content-secondary mb-6">
                {t('onboarding.welcome.subtitle')}
              </p>
              <button
                onClick={() => onClose('blank')}
                className="btn btn-primary px-8 py-2.5 text-sm font-semibold rounded-lg"
                disabled={isImporting}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
                autoFocus
              >
                {t('onboarding.welcome.startBlank')}
              </button>
            </div>

            {/* Showcase — "here's what people build" */}
            <div className="border-t border-stroke-subtle flex-shrink-0 px-6 pt-4 pb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-content-secondary">
                {t('onboarding.welcome.showcaseHeading')}
              </h2>
              <span className="text-xs text-content-disabled">
                {t('onboarding.welcome.showcaseAction')}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div
                ref={gridRef}
                className="grid gap-3 grid-cols-4"
                role="listbox"
                tabIndex={0}
                aria-label={t('onboarding.welcome.showcaseHeading')}
                onKeyDown={handleGridKeyDown}
              >
                {CURATED_TEMPLATES.map((layout, index) => (
                  <WelcomeTemplateCard
                    key={layout.id}
                    layout={layout}
                    index={index}
                    isImporting={isImporting}
                    isFocusTarget={focusedIndex === index || (focusedIndex === -1 && index === 0)}
                    onSelect={() => handleTemplateSelect(layout)}
                    onFocus={() => setFocusedIndex(index)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Template Card (simplified from LayoutCard)

interface WelcomeTemplateCardProps {
  layout: InspirationLayout;
  index: number;
  isImporting: boolean;
  isFocusTarget: boolean;
  onSelect: () => void;
  onFocus: () => void;
}

function WelcomeTemplateCard({
  layout,
  index,
  isImporting,
  isFocusTarget,
  onSelect,
  onFocus,
}: WelcomeTemplateCardProps) {
  const t = useTranslation();
  const { name, shortDescription, metrics, theme } = layout;
  const themeConfig = THEME_CONFIG[theme];
  const animationDelay = `${Math.min(index * 60, 400)}ms`;

  return (
    <div
      role="option"
      aria-selected={false}
      tabIndex={isFocusTarget ? 0 : -1}
      onClick={isImporting ? undefined : onSelect}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isImporting) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`
        group text-left bg-surface-secondary rounded-lg p-2
        border-2 border-transparent hover:border-accent/50
        transition-colors animate-slide-up
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        ${isImporting ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
      `}
      style={{ animationDelay }}
      aria-label={`${name}. ${themeConfig.label}. ${metrics.binCount} bins. ${shortDescription}`}
      data-welcome-card
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-surface rounded overflow-hidden mb-2 flex items-center justify-center relative p-1.5">
        <LayoutThumbnailWithLabels
          layout={layout.layout}
          responsive
          className="max-w-full max-h-full"
        />
        <span
          className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white backdrop-blur-sm"
          aria-hidden="true"
        >
          {themeConfig.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-medium text-content text-sm leading-tight line-clamp-1" title={name}>
        {name}
      </h3>

      {/* Metadata */}
      <p className="text-xs text-content-tertiary mt-0.5">
        {t('gallery.card.metadata', {
          bins: metrics.binCount,
          size: `${metrics.drawerSize.width}×${metrics.drawerSize.depth}`,
        })}
      </p>
    </div>
  );
}
