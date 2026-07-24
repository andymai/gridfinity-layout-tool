/**
 * One-time orientation card for first-visit /baseplate landers.
 * Content composition over the shared QuickstartCard shell; flag state and
 * auto-dismiss-on-edit live in useBaseplateFirstRun.
 */

import { QuickstartCard } from '@/shared/components/QuickstartCard';
import { useTranslation } from '@/i18n';

interface BaseplateQuickstartCardProps {
  readonly onDismiss: (method: 'got_it' | 'escape') => void;
}

export function BaseplateQuickstartCard({ onDismiss }: BaseplateQuickstartCardProps) {
  const t = useTranslation();

  return (
    <QuickstartCard
      titleId="baseplate-quickstart-title"
      title={t('baseplate.quickstart.title')}
      rows={[
        { icon: <RulerIcon />, text: t('baseplate.quickstart.dimensions') },
        { icon: <SplitIcon />, text: t('baseplate.quickstart.split') },
        { icon: <DownloadIcon />, text: t('baseplate.quickstart.export') },
      ]}
      dismissLabel={t('baseplate.quickstart.dismiss')}
      onDismiss={onDismiss}
    />
  );
}

// ── Inline SVG icons (20×20) ──────────────────────────────────────────────────

function RulerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="7" width="16" height="6" rx="1" />
      <path d="M5.5 7v2.5M8.5 7v2.5M11.5 7v2.5M14.5 7v2.5" strokeLinecap="round" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="16" height="12" rx="1.5" />
      <path d="M10 4v3.5M10 12.5V16M10 7.5a1.75 1.75 0 1 0 0 5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 15.5h13" strokeLinecap="round" />
    </svg>
  );
}
