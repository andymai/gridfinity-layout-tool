import { useMemo } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { KOFI_URL } from '@/shared/constants/links';
import { useSupportersRouting } from '@/shared/hooks/useSupportersRouting';
import { buildSupporterBins, getSupporterCount } from '../../utils/supportersData';

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {ICON_PATHS.heart.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * Standalone /supporters page: a thank-you wall where each supporter is a
 * Gridfinity bin snapped into a baseplate. No amounts, no tiers, no counts —
 * every bin is equal. Names are shuffled so no one is first or last.
 */
export function SupportersPage() {
  const t = useTranslation();
  const { navigateHome } = useSupportersRouting();
  const bins = useMemo(() => buildSupporterBins(), []);
  const total = getSupporterCount();

  const handleKofiClick = () => {
    trackEvent('kofi_clicked', { source: 'supporters_page' });
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="min-h-screen overflow-y-auto bg-surface text-content">
      <div className="mx-auto flex max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        {/* Back to the app */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={navigateHome}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-content-secondary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t('supporters.back')}
          </Button>
        </div>

        {/* Hero — warm, no count shown */}
        <header className="mb-10 text-center motion-safe:animate-fade-in">
          <div className="mb-4 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated text-accent">
              <HeartIcon className="h-6 w-6" />
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-content sm:text-3xl">
            {t('supporters.heading')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-content-secondary sm:text-base">
            {t('supporters.subheading')}
          </p>
        </header>

        {/* The baseplate: a subtle socket grid holding a bin per supporter */}
        <ul
          aria-label={t('supporters.listAria', { count: total })}
          className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5 rounded-2xl border border-stroke-subtle p-3 sm:gap-3 sm:p-4"
          style={{
            backgroundImage:
              'linear-gradient(rgba(128,128,128,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.10) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          {bins.map((bin, i) => {
            const isAnonymous = bin.name === null;
            return (
              <li
                key={bin.id}
                title={isAnonymous ? t('supporters.anonymous') : (bin.name ?? undefined)}
                className={[
                  'group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center',
                  'transition-transform duration-150 ease-out',
                  'motion-safe:animate-fade-in motion-safe:hover:-translate-y-1',
                  isAnonymous
                    ? 'border-stroke-subtle bg-surface text-content-disabled'
                    : 'border-stroke-subtle bg-surface-elevated text-content shadow-sm hover:shadow-md',
                ].join(' ')}
                style={{ animationDelay: `${Math.min(i * 18, 600)}ms` }}
              >
                {/* Gridfinity-style label tab */}
                <span
                  aria-hidden="true"
                  className={[
                    'absolute left-3 right-3 top-2 h-1 rounded-full bg-accent',
                    isAnonymous ? 'opacity-20' : 'opacity-40',
                  ].join(' ')}
                />
                {isAnonymous ? (
                  <>
                    <HeartIcon className="h-4 w-4 opacity-60" />
                    <span className="text-[11px] font-medium">{t('supporters.anonymous')}</span>
                  </>
                ) : (
                  <span className="line-clamp-3 break-words text-xs font-medium leading-tight sm:text-sm">
                    {bin.name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Gentle CTA */}
        <section className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-content-secondary">{t('supporters.cta.text')}</p>
          <Button
            variant="primary"
            onClick={handleKofiClick}
            className="flex items-center gap-2 px-4 py-2 text-sm"
            style={{ color: '#fff', textShadow: '0 1px 1px rgba(34, 34, 34, 0.15)' }}
          >
            <img
              src="/kofi-cup.png"
              alt=""
              aria-hidden="true"
              className="kofi-cup-wiggle h-4 w-auto"
            />
            {t('supporters.cta.button')}
          </Button>
          <p className="mt-2 max-w-md text-xs text-content-disabled">
            {t('supporters.optOut')}{' '}
            <a
              href={KOFI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-tertiary hover:underline"
            >
              {t('supporters.optOutLink')}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
