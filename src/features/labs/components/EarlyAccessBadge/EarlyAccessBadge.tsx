import { useTranslation } from '@/i18n';

export function EarlyAccessBadge() {
  const t = useTranslation();
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-micro font-semibold uppercase tracking-wide rounded bg-info-muted text-info">
      {t('labs.earlyAccess')}
    </span>
  );
}
