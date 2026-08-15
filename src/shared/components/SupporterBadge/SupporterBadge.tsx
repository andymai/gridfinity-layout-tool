import { Badge, Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';

export interface SupporterBadgeProps {
  /** Where this badge is rendered, for the click event's `source` property. */
  source: string;
  className?: string;
}

/**
 * Accent pill marking a community author as a Ko-fi supporter, linking to the
 * wall.
 *
 * Clickable on purpose: /supporters is a destination almost nobody navigates
 * to, and the gallery is the most-viewed surface in the app, so every badge is
 * also a door to the ask. A non-supporter who clicks one lands exactly where
 * the benefits and the CTA live.
 *
 * `stopPropagation` for the same reason the author filter and the heart do it —
 * these sit inside a card that is itself a click target, and a badge tap must
 * not also open the design.
 */
export function SupporterBadge({ source, className }: SupporterBadgeProps) {
  const t = useTranslation();
  const { navigateToSupporters } = useSupportersRouting();

  return (
    <Button
      variant="ghost"
      aria-label={t('supporters.badge.aria')}
      title={t('supporters.badge.tooltip')}
      onClick={(event) => {
        event.stopPropagation();
        trackEvent('supporters_page_opened', { source });
        navigateToSupporters();
      }}
      className={`relative z-10 h-auto shrink-0 p-0 ${className ?? ''}`}
    >
      <Badge tone="accent" shape="pill">
        {t('supporters.badge.label')}
      </Badge>
    </Button>
  );
}
