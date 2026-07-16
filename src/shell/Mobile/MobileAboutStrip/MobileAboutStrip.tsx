import { useLayoutStore } from '@/core/store/layout';
import { useTranslation, useLocale } from '@/i18n';
import { learnHref } from '@/shell/Sidebar/learnLinks';

/**
 * Crawlable about text + content links for the mobile shell. The mobile
 * rendered DOM otherwise contains no prose and no internal links, which is
 * what Google's mobile-first indexing sees on every route. Shown only while
 * the grid is empty: a stateless crawler always qualifies, real users lose
 * it as soon as they draw their first bin.
 */
export function MobileAboutStrip() {
  const t = useTranslation();
  const { locale } = useLocale();
  const binCount = useLayoutStore((state) => state.layout.bins.length);

  if (binCount > 0) return null;

  return (
    <aside className="flex-shrink-0 px-4 py-2 border-t border-stroke-subtle bg-surface text-[11px] leading-relaxed text-content-tertiary">
      <p>
        {t('sidebar.about')}{' '}
        <a
          href={learnHref('what-is-gridfinity', true, locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {t('sidebar.learn.whatIs')}
        </a>
        {' · '}
        <a
          href={learnHref('guide', true, locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {t('sidebar.learn.guide')}
        </a>
        {' · '}
        <a
          href={learnHref('gridfinity-generator', true, locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {t('sidebar.learn.generator')}
        </a>
      </p>
    </aside>
  );
}
