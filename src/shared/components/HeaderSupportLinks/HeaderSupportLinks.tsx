import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, IconButton, Menu } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import { LanguageSelector } from '@/shared/components/LanguageSelector';
import { GITHUB_ICON_PATH, ICON_PATHS, REDDIT_ICON_PATH } from '@/shared/constants/iconPaths';
import {
  GITHUB_ISSUES_URL,
  GITHUB_REPO_URL,
  KOFI_URL,
  REDDIT_GRIDFINITY_URL,
} from '@/shared/constants/links';

/**
 * Shared header support links: Language selector, Feedback, Help, an overflow
 * menu (GitHub, r/gridfinity), and the Ko-fi tip button.
 *
 * Used in the top-right of all three desktop headers (grid planner, bin designer, baseplate generator)
 * to provide a consistent set of support/engagement actions.
 *
 * The two outbound links sit in the overflow rather than the bar: the header
 * has to hold the design name and the export controls at every width, and
 * those are the actions a user came here for.
 */
export interface HeaderSupportLinksProps {
  /**
   * Fold every action except the language selector into the overflow menu.
   *
   * For narrow headers that still have to offer Help, Feedback and the rest:
   * hiding the cluster entirely is what left the mobile /community route with
   * no way to reach any of them.
   */
  compact?: boolean;

  /**
   * Extra items pinned above the links, with a divider beneath them.
   *
   * Lets the header park a secondary LAYOUT action here rather than spend a
   * top-level slot on it. The header row already collides at 1280px, so a new
   * button there is not free. Kept as a slot so this shared component stays
   * ignorant of any feature.
   */
  leadingItems?: ReactNode;
}

export function HeaderSupportLinks({
  compact = false,
  leadingItems,
}: HeaderSupportLinksProps = {}) {
  const t = useTranslation();
  const feedbackToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overflowRef = useRef<HTMLButtonElement>(null);
  const [overflow, setOverflow] = useState<{ open: boolean; position: { x: number; y: number } }>({
    open: false,
    position: { x: 0, y: 0 },
  });

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

  const handleSettingsClick = () => {
    window.dispatchEvent(new Event('open-settings-modal'));
  };

  const handleKofiClick = () => {
    trackEvent('kofi_clicked', { source: 'header' });
    window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
  };

  const handleRedditClick = () => {
    trackEvent('reddit_link_clicked', { source: 'header' });
  };

  const toggleOverflow = () => {
    const rect = overflowRef.current?.getBoundingClientRect();
    setOverflow((previous) =>
      previous.open
        ? { ...previous, open: false }
        : {
            open: true,
            position: { x: rect?.right ?? 0, y: (rect?.bottom ?? 0) + 4 },
          }
    );
  };

  const overflowMenu = (
    <Menu.Root
      open={overflow.open}
      onClose={() => setOverflow((previous) => ({ ...previous, open: false }))}
      position={overflow.position}
      align="end"
    >
      {leadingItems && (
        <>
          {leadingItems}
          <Menu.Divider />
        </>
      )}
      {compact && (
        <>
          <Menu.Item onClick={handleFeedbackClick}>{t('header.sendFeedback')}</Menu.Item>
          <Menu.Item onClick={handleHelpClick}>{t('header.helpAndShortcuts')}</Menu.Item>
          <Menu.Item onClick={handleSettingsClick}>{t('sidebar.settings')}</Menu.Item>
        </>
      )}
      <Menu.Item
        href={GITHUB_REPO_URL}
        icon={
          <svg fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d={GITHUB_ICON_PATH} />
          </svg>
        }
      >
        {t('header.starOnGithubLong')}
      </Menu.Item>
      <Menu.Item
        href={REDDIT_GRIDFINITY_URL}
        onClick={handleRedditClick}
        aria-label={t('common.redditCommunityAria')}
        icon={
          <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d={REDDIT_ICON_PATH} />
          </svg>
        }
      >
        {t('common.redditCommunity')}
      </Menu.Item>
      {compact && <Menu.Item onClick={handleKofiClick}>{t('header.supportOnKofi')}</Menu.Item>}
    </Menu.Root>
  );

  const overflowTrigger = (
    <IconButton
      ref={overflowRef}
      size="sm"
      aria-label={t('header.moreLinks')}
      aria-haspopup="menu"
      aria-expanded={overflow.open}
      title={t('header.moreLinks')}
      onClick={toggleOverflow}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {ICON_PATHS.dotsHorizontal.map((d) => (
          <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
        ))}
      </svg>
    </IconButton>
  );

  if (compact) {
    return (
      <>
        <LanguageSelector />
        {overflowTrigger}
        {overflowMenu}
      </>
    );
  }

  return (
    <>
      <LanguageSelector />

      {/* Feedback — opens GitHub Issues + thank-you toast with Ko-fi mention */}
      <Button
        variant="ghost"
        onClick={handleFeedbackClick}
        className="px-2.5 h-8 text-sm leading-none text-content-secondary flex items-center gap-1.5"
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
        className="px-2.5 h-8 text-sm leading-none text-content-secondary flex items-center gap-1.5"
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

      {/* Settings: app-wide, so it lives here on every view rather than only in
          the layout sidebar (#4034). Opens the global modal via window event. */}
      <IconButton
        size="sm"
        touchTarget={false}
        onClick={handleSettingsClick}
        className="h-8 w-8 text-content-secondary"
        title={t('sidebar.settings')}
        aria-label={t('sidebar.openSettings')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {ICON_PATHS.settings.map((d) => (
            <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
          ))}
        </svg>
      </IconButton>

      {overflowTrigger}
      {overflowMenu}

      {/* Ko-fi support — the official Widget_2 button reproduced natively (the site's
          CSP blocks the remote ko-fi script). Accent fill via btn-primary, official
          animated cup logo, white label like the widget. */}
      <Button
        variant="primary"
        onClick={handleKofiClick}
        className="px-3 h-8 text-sm leading-none flex items-center gap-1.5"
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
