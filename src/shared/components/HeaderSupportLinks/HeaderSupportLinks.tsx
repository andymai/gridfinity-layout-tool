import { useEffect, useRef } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import { LanguageSelector } from '@/shared/components/LanguageSelector';
import { GITHUB_ISSUES_URL, GITHUB_REPO_URL, KOFI_URL } from '@/shared/constants/links';

/**
 * Shared header support links: Language selector, Feedback, Help, GitHub, and Ko-fi tip.
 *
 * Used in the top-right of all three desktop headers (grid planner, bin designer, baseplate generator)
 * to provide a consistent set of support/engagement actions.
 */
export function HeaderSupportLinks() {
  const t = useTranslation();
  const feedbackToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackToastTimer.current) {
        clearTimeout(feedbackToastTimer.current);
      }
    };
  }, []);

  const handleFeedbackClick = () => {
    window.open(GITHUB_ISSUES_URL, '_blank', 'noopener,noreferrer');
    trackEvent('feedback_link_clicked', { source: 'header' });

    if (feedbackToastTimer.current) clearTimeout(feedbackToastTimer.current);
    feedbackToastTimer.current = setTimeout(() => {
      useToastStore.getState().addToast({
        message: t('engagement.feedbackThankYou'),
        type: 'success',
        duration: 8000,
        action: {
          label: t('engagement.support'),
          onClick: () => {
            trackEvent('kofi_clicked', { source: 'feedback_thankyou' });
            window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
          },
        },
      });
      feedbackToastTimer.current = null;
    }, 1000);
  };

  const handleHelpClick = () => {
    window.dispatchEvent(new Event('open-help-modal'));
  };

  const handleKofiClick = () => {
    trackEvent('kofi_clicked', { source: 'header' });
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <LanguageSelector />

      {/* Feedback — opens GitHub Issues + thank-you toast with Ko-fi mention */}
      <Button
        variant="ghost"
        onClick={handleFeedbackClick}
        className="px-2.5 py-1.5 text-sm leading-none text-content-secondary flex items-center gap-1.5"
        title={t('header.sendFeedback')}
        aria-label={t('header.sendFeedback')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="hidden lg:inline">{t('header.sendFeedback')}</span>
      </Button>

      {/* Help */}
      <Button
        variant="ghost"
        onClick={handleHelpClick}
        className="px-2.5 py-1.5 text-sm leading-none text-content-secondary flex items-center gap-1.5"
        title={t('header.showHelp')}
        aria-label={t('header.helpAndShortcuts')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="hidden lg:inline">{t('header.help')}</span>
      </Button>

      {/* GitHub */}
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost px-2.5 py-1.5 text-sm leading-none text-content-secondary flex items-center gap-1.5"
        title={t('header.starOnGithub')}
        aria-label={t('header.starOnGithub')}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span className="hidden lg:inline">{t('header.starOnGithub')}</span>
      </a>

      {/* Ko-fi support — the official Widget_2 button reproduced natively (the site's
          CSP blocks the remote ko-fi script). Accent fill via btn-primary, official
          animated cup logo, white label like the widget. */}
      <Button
        variant="primary"
        onClick={handleKofiClick}
        className="px-3 py-1.5 text-sm leading-none flex items-center gap-1.5"
        style={{ color: '#fff', textShadow: '0 1px 1px rgba(34, 34, 34, 0.15)' }}
        title={t('header.supportOnKofi')}
        aria-label={t('header.supportOnKofi')}
      >
        <img src="/kofi-cup.png" alt="" aria-hidden="true" className="kofi-cup-wiggle h-4 w-auto" />
        <span className="hidden xl:inline">{t('header.supportOnKofi')}</span>
      </Button>
    </>
  );
}
