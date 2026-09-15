import { cn } from '@/design-system';
import { useTranslation } from '@/i18n';

interface AboutGridfinityProps {
  className?: string;
  /** Omit the inner heading when the parent disclosure already shows the title. */
  heading?: boolean;
}

/**
 * The homepage's only crawlable prose about Gridfinity as a topic. The SPA
 * shell is otherwise all tool copy, and the static fallback in index.html is
 * display:none, so this block is what a rendering crawler reads for the bare
 * "gridfinity" query on both the desktop sidebar and the mobile strip.
 */
export function AboutGridfinity({ className, heading = true }: AboutGridfinityProps) {
  const t = useTranslation();

  return (
    <section
      aria-label={t('sidebar.about.heading')}
      className={cn('text-xs text-content-tertiary leading-relaxed space-y-2', className)}
    >
      {heading && (
        <h3 className="text-xs font-semibold text-content-secondary">
          {t('sidebar.about.heading')}
        </h3>
      )}
      <p>{t('sidebar.about.definition')}</p>
      <p>{t('sidebar.about.spec')}</p>
      <p>{t('sidebar.about.origin')}</p>
    </section>
  );
}
