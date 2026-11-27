import { Button, IconButton } from '@/design-system';
import { cn } from '@/design-system/cn';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { useYour2026Routing } from '@/shared/hooks/useYour2026Routing';
import { hideYearReviewRow, markYearReviewSeen } from '@/shared/yearReview/dockRow';
import { useYearReviewRow } from './useYearReviewRow';

interface YearReviewRowProps {
  /** Runs before the route changes, so a sheet that holds the dock can close. */
  onOpen?: () => void;
}

export function YearReviewRow({ onOpen }: YearReviewRowProps) {
  const t = useTranslation();
  const { visible, unseen } = useYearReviewRow();
  const { navigateToYour2026 } = useYour2026Routing();

  if (!visible) return null;

  const open = () => {
    markYearReviewSeen();
    onOpen?.();
    navigateToYour2026('?from=dock');
  };

  return (
    <div className="flex items-center border-t border-stroke-subtle bg-surface-secondary">
      <Button
        type="button"
        variant="ghost"
        touchTarget={false}
        onClick={open}
        className="flex-1 min-w-0 justify-start gap-2 rounded-none px-3 py-1.5 text-xs font-normal text-content-secondary hover:bg-surface-hover hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        <span
          aria-hidden="true"
          data-testid="year-review-dot"
          className={cn('size-1.5 shrink-0 rounded-full', unseen ? 'bg-accent' : 'bg-transparent')}
        />
        <span className="truncate">{t('dock.yearReview.ready')}</span>
      </Button>
      <IconButton
        aria-label={t('dock.yearReview.hide')}
        size="sm"
        touchTarget={false}
        onClick={hideYearReviewRow}
        className="mr-1.5 shrink-0 text-content-tertiary hover:text-content"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          {ICON_PATHS.close.map((d) => (
            <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
          ))}
        </svg>
      </IconButton>
    </div>
  );
}
