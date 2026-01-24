import { useTranslation } from '@/i18n';

interface EmptyStateProps {
  /** Platform variant affects touch targets and sizing */
  variant: 'desktop' | 'mobile';
}

/**
 * Empty state shown when no bin is selected.
 * Provides guidance on how to create/select bins.
 */
export function EmptyState({ variant }: EmptyStateProps) {
  const t = useTranslation();

  if (variant === 'mobile') {
    return (
      <div className="py-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-surface-elevated">
          <svg
            className="w-8 h-8 text-content-disabled"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <p className="font-medium mb-1 text-content-secondary">{t('inspector.empty.title')}</p>
        <p className="text-sm mb-4 text-content-disabled">{t('inspector.empty.mobileHint')}</p>

        {/* Creation hint */}
        <div className="mx-4 p-3 rounded-lg text-left bg-surface-elevated border border-stroke-subtle">
          <p className="text-sm font-medium mb-2 text-content-secondary">{t('inspector.empty.howToCreate')}</p>
          <ul className="text-sm space-y-1.5 text-content-tertiary">
            <li className="flex items-start gap-2">
              <span className="text-accent">1.</span>
              <span>{t('inspector.empty.mobileStep1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent">2.</span>
              <span>{t('inspector.empty.mobileStep2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent">3.</span>
              <span>{t('inspector.empty.mobileStep3')}</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Desktop empty state
  return (
    <div className="empty-state py-4">
      <div className="empty-state-icon">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <p className="text-sm text-content-secondary mb-1">{t('inspector.empty.title')}</p>
      <p className="text-xs text-content-disabled mb-3">{t('inspector.empty.drawHint')}</p>
      <div className="text-left text-xs space-y-1.5 text-content-tertiary w-full">
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-surface-elevated border border-stroke-subtle text-content-disabled font-mono">
            Drag
          </kbd>
          <span>{t('inspector.empty.hintDraw')}</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-surface-elevated border border-stroke-subtle text-content-disabled font-mono">
            Ctrl+D
          </kbd>
          <span>{t('inspector.empty.hintDuplicate')}</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-surface-elevated border border-stroke-subtle text-content-disabled font-mono">
            L
          </kbd>
          <span>{t('inspector.empty.hintLabel')}</span>
        </div>
      </div>
    </div>
  );
}
