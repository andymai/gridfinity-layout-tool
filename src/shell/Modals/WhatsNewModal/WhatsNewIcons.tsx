import { Badge } from '@/design-system';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import type { WhatsNewEntry } from '@/features/whats-new';

export function LabsBadge({ entry }: { entry: WhatsNewEntry }) {
  const t = useTranslation();
  if (entry.labs === undefined) return null;
  return (
    <Badge tone="warning" size="sm">
      {t('whatsNew.labs')}
    </Badge>
  );
}

export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={ICON_PATHS.chevronRight[0]}
      />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 5l7 7-7 7M3 12h18"
      />
    </svg>
  );
}
